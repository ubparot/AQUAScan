"""Generate a judge-friendly diagram of AQUAScan's winch deployment code."""

from pathlib import Path
from shutil import copyfile

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "deliverables" / "visuals" / "aquascan-winch-code-flow.png"
WEB_OUTPUT = ROOT / "web" / "public" / "aquascan-winch-code-flow.png"

WIDTH, HEIGHT = 2400, 1500
NAVY = "#061D3C"
BLUE = "#06428E"
BRIGHT_BLUE = "#168ED1"
PALE_BLUE = "#EAF6FD"
LIGHT_BLUE = "#D5ECFA"
WHITE = "#FFFFFF"
INK = "#102A43"
MUTED = "#52677F"
LINE = "#B8D3E6"
GREEN = "#17875B"
PALE_GREEN = "#E8F7F0"
RED = "#C83B2B"
PALE_RED = "#FFF0EE"
GRAY = "#EEF3F7"


def font(size: int, bold: bool = False):
    names = (
        ["C:/Windows/Fonts/seguisb.ttf", "C:/Windows/Fonts/arialbd.ttf"]
        if bold
        else ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"]
    )
    for name in names:
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


F_TITLE = font(74, True)
F_SUBTITLE = font(30)
F_STEP = font(24, True)
F_CARD_TITLE = font(34, True)
F_BODY = font(25)
F_BODY_BOLD = font(25, True)
F_CODE = font(20, True)
F_SMALL = font(21)
F_SMALL_BOLD = font(21, True)


def rounded(draw, box, radius=24, fill=WHITE, outline=LINE, width=3):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def centered(draw, xy, text, face, fill=INK):
    draw.text(xy, text, font=face, fill=fill, anchor="mm")


def wrap(draw, text, face, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=face) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def paragraph(draw, xy, text, face, fill=INK, max_width=400, spacing=8):
    x, y = xy
    for line in wrap(draw, text, face, max_width):
        draw.text((x, y), line, font=face, fill=fill)
        y += face.size + spacing
    return y


def pill(draw, xy, text, fill=BLUE, text_fill=WHITE):
    x, y = xy
    w = draw.textlength(text, font=F_STEP) + 44
    draw.rounded_rectangle((x, y, x + w, y + 44), radius=22, fill=fill)
    centered(draw, (x + w / 2, y + 22), text, F_STEP, text_fill)


def arrow(draw, start, end, color=BRIGHT_BLUE, width=10, head=22):
    draw.line((start, end), fill=color, width=width)
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    length = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    tip = (x2, y2)
    left = (x2 - ux * head - px * head * 0.7, y2 - uy * head - py * head * 0.7)
    right = (x2 - ux * head + px * head * 0.7, y2 - uy * head + py * head * 0.7)
    draw.polygon((tip, left, right), fill=color)


def icon_button(draw, center):
    x, y = center
    draw.rounded_rectangle((x - 58, y - 42, x + 58, y + 42), radius=16, fill=BRIGHT_BLUE)
    draw.polygon(((x, y - 23), (x - 25, y + 8), (x - 8, y + 8), (x - 8, y + 25),
                  (x + 8, y + 25), (x + 8, y + 8), (x + 25, y + 8)), fill=WHITE)


def icon_chip(draw, center):
    x, y = center
    draw.rounded_rectangle((x - 55, y - 45, x + 55, y + 45), radius=12, fill=NAVY)
    draw.rounded_rectangle((x - 33, y - 25, x + 33, y + 25), radius=6, fill=BRIGHT_BLUE)
    for offset in (-38, -13, 13, 38):
        draw.line((x + offset, y - 57, x + offset, y - 45), fill=BLUE, width=7)
        draw.line((x + offset, y + 45, x + offset, y + 57), fill=BLUE, width=7)
    for offset in (-28, 0, 28):
        draw.line((x - 67, y + offset, x - 55, y + offset), fill=BLUE, width=7)
        draw.line((x + 55, y + offset, x + 67, y + offset), fill=BLUE, width=7)


def icon_motor(draw, center):
    x, y = center
    draw.rounded_rectangle((x - 82, y - 40, x + 20, y + 40), radius=18, fill=NAVY)
    draw.ellipse((x - 98, y - 40, x - 65, y + 40), fill=BLUE)
    draw.line((x + 20, y, x + 70, y), fill=MUTED, width=15)
    draw.ellipse((x + 42, y - 48, x + 135, y + 48), fill=LIGHT_BLUE, outline=BLUE, width=6)
    for off in (-27, -9, 9, 27):
        draw.line((x + 60, y + off, x + 118, y + off), fill=BRIGHT_BLUE, width=5)


def icon_probe(draw, center):
    x, y = center
    draw.line((x, y - 80, x, y - 25), fill=BLUE, width=7)
    draw.rounded_rectangle((x - 28, y - 25, x + 28, y + 75), radius=18, fill=NAVY)
    for off in (0, 28, 56):
        draw.ellipse((x - 10, y - 12 + off, x + 10, y + 8 + off), fill=BRIGHT_BLUE)


def card(draw, box, step, title, body, icon=None, code=None):
    rounded(draw, box, radius=28, fill=WHITE, outline=LINE, width=3)
    x1, y1, x2, _ = box
    pill(draw, (x1 + 24, y1 + 22), step)
    if icon:
        icon(draw, ((x1 + x2) / 2, y1 + 155))
        title_y = y1 + 235
    else:
        title_y = y1 + 100
    centered(draw, ((x1 + x2) / 2, title_y), title, F_CARD_TITLE, NAVY)
    body_y = title_y + 42
    for line in body:
        centered(draw, ((x1 + x2) / 2, body_y), line, F_BODY, MUTED)
        body_y += 35
    if code:
        code_y = body_y + 16
        draw.rounded_rectangle((x1 + 24, code_y, x2 - 24, code_y + 55), radius=12, fill=PALE_BLUE)
        centered(draw, ((x1 + x2) / 2, code_y + 27), code, F_CODE, BLUE)


def safety_card(draw, box, title, body, accent=RED, fill=PALE_RED):
    rounded(draw, box, radius=20, fill=fill, outline=accent, width=3)
    x1, y1, x2, _ = box
    draw.ellipse((x1 + 20, y1 + 23, x1 + 64, y1 + 67), fill=accent)
    centered(draw, (x1 + 42, y1 + 45), "!", F_BODY_BOLD, WHITE)
    draw.text((x1 + 80, y1 + 18), title, font=F_SMALL_BOLD, fill=accent)
    paragraph(draw, (x1 + 80, y1 + 52), body, F_SMALL, MUTED, x2 - x1 - 105, 4)


def make_diagram():
    image = Image.new("RGB", (WIDTH, HEIGHT), "#F7FBFE")
    draw = ImageDraw.Draw(image)

    # Header
    draw.rectangle((0, 0, WIDTH, 184), fill=NAVY)
    draw.rectangle((0, 184, WIDTH, 194), fill=BRIGHT_BLUE)
    draw.text((95, 38), "AQUASCAN WINCH DEPLOYMENT CONTROL", font=F_TITLE, fill=WHITE)
    draw.text((100, 125), "How the code turns one operator command into controlled, fail-safe probe motion",
              font=F_SUBTITLE, fill="#CDEBFA")

    # Main signal path
    card(draw, (70, 250, 480, 650), "1  OPERATOR", "Hold a control",
         ["Choose speed (60-255)", "Hold Raise or Lower", "Release to stop"], icon_button)
    card(draw, (535, 250, 945, 650), "2  WEB APP", "Send command",
         ["Creates a sequenced", "probe-control message", "Repeats while held"],
         code='{"direction":"lower","speed":160}')
    card(draw, (1000, 250, 1410, 650), "3  ESP32", "Check + translate",
         ["E-stop forces STOP", "Speed clamped to 0-255", "Direction becomes -1, 0, +1"],
         icon_chip, code="W, seq, direction, speed")
    card(draw, (1465, 250, 1875, 650), "4  ARDUINO MEGA", "Validate + drive pins",
         ["Parses each W command", "Clamps direction and speed", "Selects only one output"],
         icon_chip)
    card(draw, (1930, 250, 2330, 650), "5  HARDWARE", "Move the probe",
         ["PWM drives the winch", "Cable raises or lowers", "Probe samples by depth"],
         icon_motor)

    for x1, x2 in ((480, 535), (945, 1000), (1410, 1465), (1875, 1930)):
        arrow(draw, (x1 + 8, 450), (x2 - 8, 450))

    # Pin logic section
    draw.text((70, 716), "ARDUINO OUTPUT LOGIC", font=F_CARD_TITLE, fill=NAVY)
    draw.text((480, 724), "Only one winch direction output can be active at a time.", font=F_BODY, fill=MUTED)

    logic_boxes = [
        ((70, 780, 710, 995), "LOWER", "+1", "Pin 7 = PWM speed", "Pin 6 = 0", BRIGHT_BLUE, PALE_BLUE),
        ((880, 780, 1520, 995), "STOP / HOLD", "0", "Pin 7 = 0", "Pin 6 = 0", MUTED, GRAY),
        ((1690, 780, 2330, 995), "RAISE", "-1", "Pin 7 = 0", "Pin 6 = PWM speed", BLUE, PALE_BLUE),
    ]
    for box, title, direction, first, second, accent, fill in logic_boxes:
        rounded(draw, box, radius=25, fill=fill, outline=accent, width=4)
        x1, y1, x2, _ = box
        draw.ellipse((x1 + 34, y1 + 50, x1 + 144, y1 + 160), fill=accent)
        centered(draw, (x1 + 89, y1 + 105), direction, F_CARD_TITLE, WHITE)
        draw.text((x1 + 180, y1 + 35), title, font=F_CARD_TITLE, fill=accent)
        draw.text((x1 + 180, y1 + 92), first, font=F_BODY_BOLD, fill=INK)
        draw.text((x1 + 180, y1 + 137), second, font=F_BODY_BOLD, fill=INK)

    arrow(draw, (710, 888), (865, 888), color=LINE, width=8, head=18)
    arrow(draw, (1520, 888), (1675, 888), color=LINE, width=8, head=18)

    # Safety and feedback
    draw.text((70, 1055), "FAIL-SAFE BEHAVIOR", font=F_CARD_TITLE, fill=NAVY)
    safety_card(draw, (70, 1110, 600, 1275), "BUTTON RELEASE", "The web app immediately sends a STOP command.")
    safety_card(draw, (630, 1110, 1160, 1275), "E-STOP", "The ESP32 forces winch direction and speed to zero.")
    safety_card(draw, (1190, 1110, 1720, 1275), "INVALID COMMAND", "The Arduino rejects malformed input and stops the winch.")
    safety_card(draw, (1750, 1110, 2330, 1275), "3.5-SECOND TIMEOUT", "If commands stop arriving, the Arduino automatically stops the winch.")

    rounded(draw, (70, 1320, 2330, 1435), radius=24, fill=PALE_GREEN, outline=GREEN, width=3)
    draw.ellipse((100, 1346, 166, 1412), fill=GREEN)
    centered(draw, (133, 1379), "P", F_CARD_TITLE, WHITE)
    draw.text((195, 1344), "STATUS FEEDBACK", font=F_BODY_BOLD, fill=GREEN)
    draw.text((195, 1382), "Arduino returns P, seq, direction, speed through the ESP32 so the dashboard shows the applied winch state.",
              font=F_SMALL, fill=INK)
    icon_probe(draw, (2220, 1375))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    WEB_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, quality=95)
    copyfile(OUTPUT, WEB_OUTPUT)
    return OUTPUT


if __name__ == "__main__":
    print(make_diagram())
