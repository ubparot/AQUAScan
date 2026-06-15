from __future__ import annotations

from pathlib import Path

import fitz
from PIL import Image as PilImage, ImageDraw
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "deliverables" / "aquascan-nationals-update"
INSERT_PDF = OUT / "AquaScan_Nationals_Update_Pages.pdf"
FINAL_PDF = OUT / "AquaScan_Nationals_Updated_Portfolio.pdf"
SOURCE_PDF = Path(r"Z:\21004 - 1 (1).pdf")

WEB_PLAN = ROOT / "web" / "tmp-project-preflight.png"
WEB_AI = ROOT / "web" / "tmp-research-analysis.png"
WEB_TELEMETRY = ROOT / "web" / "tmp-telemetry-ui.png"
BRIDGE = ROOT / ".codex_bridge_now.png"

BLUE = colors.HexColor("#17365D")
LIGHT_BLUE = colors.HexColor("#DCE6F1")
PALE_BLUE = colors.HexColor("#EEF4F9")
GREEN = colors.HexColor("#E2F0D9")
ORANGE = colors.HexColor("#FCE4D6")
ROW_ALT = colors.HexColor("#F5F8FB")

PAGE_LABELS = ["1A", "16A", "16B", "16C", "28A", "29A"]


styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    "UpdateTitle",
    parent=styles["Heading1"],
    fontName="Helvetica-Bold",
    fontSize=12,
    leading=14,
    spaceAfter=7,
    textColor=colors.black,
)
heading_style = ParagraphStyle(
    "UpdateHeading",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=9.5,
    leading=11,
    spaceBefore=4,
    spaceAfter=3,
    textColor=colors.black,
)
body_style = ParagraphStyle(
    "UpdateBody",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=8.2,
    leading=10.5,
    spaceAfter=4,
    textColor=colors.black,
)
bullet_style = ParagraphStyle(
    "UpdateBullet",
    parent=body_style,
    leftIndent=13,
    firstLineIndent=-7,
    bulletIndent=0,
    spaceAfter=2,
)
caption_style = ParagraphStyle(
    "UpdateCaption",
    parent=body_style,
    fontName="Helvetica-Bold",
    fontSize=6.8,
    leading=8,
    alignment=TA_CENTER,
    spaceAfter=4,
)
table_header_style = ParagraphStyle(
    "TableHeader",
    parent=body_style,
    fontName="Helvetica-Bold",
    fontSize=6.7,
    leading=8,
    textColor=colors.white,
    alignment=TA_CENTER,
)
table_body_style = ParagraphStyle(
    "TableBody",
    parent=body_style,
    fontSize=6.4,
    leading=7.7,
    spaceAfter=0,
)
callout_style = ParagraphStyle(
    "Callout",
    parent=body_style,
    fontSize=8,
    leading=10,
    spaceAfter=0,
)


def p(text: str, style=body_style) -> Paragraph:
    return Paragraph(text, style)


def bullet(lead: str, text: str) -> Paragraph:
    return Paragraph(f"<b>{lead}</b>{text}", bullet_style, bulletText="•")


def callout(label: str, text: str, fill=PALE_BLUE) -> Table:
    table = Table([[p(f"<font color='#17365D'><b>{label}</b></font>{text}", callout_style)]], colWidths=[7.35 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fill),
                ("BOX", (0, 0), (-1, -1), 0.45, BLUE),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def data_table(headers: list[str], rows: list[list[str]], widths: list[float], font_size=6.4) -> Table:
    header = [Paragraph(value, table_header_style) for value in headers]
    body_style_local = ParagraphStyle("TableBodyLocal", parent=table_body_style, fontSize=font_size, leading=font_size + 1.2)
    data = [header] + [[Paragraph(value, body_style_local) for value in row] for row in rows]
    table = Table(data, colWidths=[width * inch for width in widths], repeatRows=1, hAlign="CENTER")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#808080")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for row_index in range(1, len(data)):
        if row_index % 2 == 0:
            style.append(("BACKGROUND", (0, row_index), (-1, row_index), ROW_ALT))
    table.setStyle(TableStyle(style))
    return table


def image_with_caption(path: Path, caption: str, width=7.25 * inch, max_height=3.4 * inch) -> KeepTogether:
    with PilImage.open(path) as source:
        ratio = source.height / source.width
    height = min(width * ratio, max_height)
    if height == max_height:
        width = height / ratio
    return KeepTogether([Image(str(path), width=width, height=height), p(caption, caption_style)])


def paired_images(left_path: Path, left_caption: str, right_path: Path, right_caption: str) -> Table:
    width = 3.52 * inch
    with PilImage.open(left_path) as source:
        left_height = width * source.height / source.width
    with PilImage.open(right_path) as source:
        right_height = width * source.height / source.width
    height = min(2.38 * inch, left_height, right_height)
    left_width = height * PilImage.open(left_path).width / PilImage.open(left_path).height
    right_width = height * PilImage.open(right_path).width / PilImage.open(right_path).height
    table = Table(
        [
            [Image(str(left_path), width=left_width, height=height), Image(str(right_path), width=right_width, height=height)],
            [p(left_caption, caption_style), p(right_caption, caption_style)],
        ],
        colWidths=[3.65 * inch, 3.65 * inch],
        hAlign="CENTER",
    )
    table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    return table


def page_header(canvas, doc) -> None:
    canvas.saveState()
    label = PAGE_LABELS[min(doc.page - 1, len(PAGE_LABELS) - 1)]
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(letter[0] - 36, letter[1] - 28, label)
    canvas.restoreState()


def add_page(story: list, title: str, content: list) -> None:
    story.append(p(title, title_style))
    story.extend(content)
    story.append(PageBreak())


def build_insert_pdf() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frame = Frame(34, 30, letter[0] - 68, letter[1] - 64, id="main")
    document = BaseDocTemplate(
        str(INSERT_PDF),
        pagesize=letter,
        leftMargin=34,
        rightMargin=34,
        topMargin=34,
        bottomMargin=30,
        title="AquaScan Nationals Update Pages",
    )
    document.addPageTemplates(PageTemplate(id="update", frames=[frame], onPage=page_header))
    story: list = []

    add_page(
        story,
        "NATIONALS DEVELOPMENT UPDATE MAP",
        [
            p(
                "AquaScan did not remain frozen after the TSA States submission. The earlier portfolio documents the system that proved the core concept: a mobile vessel, deployable probe, Unity visualization, and field data workflow. The pages identified below document the next engineering cycle completed for Nationals."
            ),
            callout(
                "How to read this revision: ",
                "the original pages remain as evidence of the States baseline. These inserted pages show the problem identified after States, the refinement made, and the verified result.",
            ),
            p("Post-States Development Sequence", heading_style),
            data_table(
                ["Stage", "Engineering Focus", "Result"],
                [
                    ["States baseline", "Prove collection, control, and visualization concept", "Unity-based interface and working depth-aware data workflow"],
                    ["Field-access refinement", "Reduce setup friction and improve operator access", "Browser-based mission-control dashboard"],
                    ["Control-chain refinement", "Improve communication reliability and safety feedback", "WebSocket, ESP32, Arduino Mega, ESC, winch, and RS-485 telemetry chain"],
                    ["Data-use refinement", "Move from viewing measurements toward interpreting patterns", "MARIS experimental predictive-analysis model and research-analysis tools"],
                    ["Verification", "Test software behavior and model pipeline", "26 web tests, production build, lint, and 7 ML tests passed on June 14, 2026"],
                ],
                [1.15, 3.0, 3.2],
            ),
            p("Inserted Page Guide", heading_style),
            bullet("Pages 16A-16B: ", "web mission control and embedded communications iteration."),
            bullet("Page 16C: ", "MARIS experimental predictive analysis, placed directly before “What This Data Can Reveal.”"),
            bullet("Page 28A: ", "problem-change-evidence-impact iteration record and current verification results."),
            bullet("Page 29A: ", "post-States development record showing continued engineering activity."),
            p("Current System Position", heading_style),
            p(
                "AquaScan is currently a working integrated prototype for calm, shallow, and sheltered water environments. Manual control, telemetry, mission replay, data visualization, probe communications, and the training/export path for MARIS have been implemented. Full autonomous route execution and field-validated MARIS inference remain future development."
            ),
        ],
    )

    add_page(
        story,
        "POST-STATES ITERATION: FROM UNITY PROTOTYPE TO WEB MISSION CONTROL",
        [
            p(
                "The Unity interface shown on the preceding original portfolio page was the States baseline. It demonstrated that AquaScan data could be replayed, mapped, and connected to the vessel. After States, the team identified a field-use limitation: Unity required a dedicated installed application and made it harder to open the controls quickly on different operator devices."
            ),
            callout(
                "Iteration decision: ",
                "retain the proven mission-data and control concepts, but rebuild the operator interface as a browser-based field dashboard that can run locally and be opened from devices on the same network.",
                LIGHT_BLUE,
            ),
            data_table(
                ["States Baseline", "Post-States Web Refinement", "Engineering Benefit"],
                [
                    ["Unity desktop application", "Local browser-based dashboard", "Faster access and no Unity installation on the operator device"],
                    ["Mission replay and map layers", "Replay, route planning, saved project files, and exportable bundles", "Supports repeatable mission preparation and review"],
                    ["Live control concept", "Direct WebSocket connection to the boat with visible connection state", "Improves field awareness and troubleshooting"],
                    ["Single presentation-focused layout", "Simple/advanced drive modes, light/dark themes, and tabbed controls", "Separates essential control from detailed diagnostics"],
                ],
                [2.15, 2.7, 2.5],
            ),
            image_with_caption(WEB_PLAN, "Current web mission planner showing saved route data, validation status, playback, and telemetry.", max_height=3.55 * inch),
            bullet("Preserved capability: ", "CSV/JSON mission loading, GPS route projection, sample points, heat maps, and timeline playback."),
            bullet("Added capability: ", "mission-plan editing, local project saving, preflight checks, direct live control, and browser-accessible operation."),
            bullet("Current validation: ", "the web application passes 26 automated tests, production build, and lint checks."),
        ],
    )

    add_page(
        story,
        "WEB FIELD SYSTEM AND EMBEDDED COMMUNICATIONS ITERATION",
        [
            p(
                "The interface change was paired with a deeper electronics and firmware refinement. The post-States system separates high-level operator commands, motor control, and probe sensing across communication links chosen for each task."
            ),
            p("Current End-to-End Control and Data Path", heading_style),
            data_table(
                ["Link", "Current Function", "Reason for Refinement"],
                [
                    ["Browser dashboard → ESP32", "WebSocket commands, status, arming, E-stop, and live telemetry", "Provides direct network control and immediate operator feedback"],
                    ["ESP32 → Arduino Mega", "Full-duplex hardware UART control bridge", "More reliable than the earlier bridge approach and keeps USB debug available"],
                    ["Arduino Mega → ESCs/winch", "Applies motor pulses and deployment commands", "Centralizes real-time actuator control and neutral-output behavior"],
                    ["Arduino Mega ↔ probe", "Half-duplex RS-485 sensor communication", "Supports tether communication and separates sensor traffic from drive control"],
                    ["Telemetry → dashboard", "Sensor values, battery, RSSI, depth, motor output, and status", "Turns hidden system state into visible diagnostic evidence"],
                ],
                [1.55, 3.0, 2.8],
            ),
            paired_images(
                WEB_TELEMETRY,
                "Web telemetry and mission-control interface.",
                BRIDGE,
                "Arduino bridge serial monitor showing command, arm, motor-output, and winch status.",
            ),
            p("Safety and Reliability Behaviors", heading_style),
            bullet("Safe startup: ", "the system begins disarmed and commands neutral motor output."),
            bullet("Loss-of-command response: ", "disconnects, malformed messages, or command timeout force neutral output."),
            bullet("Operator override: ", "E-stop is visible in the dashboard and latches until reset."),
            bullet("Debug visibility: ", "Arduino and ESP32 status output makes command sequence, arm state, winch state, and motor outputs inspectable."),
        ],
    )

    add_page(
        story,
        "MARIS: EXPERIMENTAL PREDICTIVE ANALYSIS",
        [
            p(
                "MARIS is AquaScan’s first-pass machine-learning model for turning structured mission data into predictive research signals. It is an implemented proof of concept, not a field-validated decision system. MARIS demonstrates how future AquaScan missions could move beyond displaying measurements and begin forecasting or flagging conditions that deserve closer investigation."
            ),
            callout(
                "Accurate framing: ",
                "MARIS has been trained, evaluated, and exported as an ONNX model. The current primary dashboard still uses a transparent heuristic fallback while larger independent field datasets and live model integration are developed.",
                ORANGE,
            ),
            p("What MARIS Produces", heading_style),
            bullet("Current dissolved oxygen estimate: ", "provides the model’s present-condition regression output."),
            bullet("Dissolved oxygen forecasts: ", "predicts values at +30, +60, and +120 minutes."),
            bullet("Bloom-risk probability: ", "identifies combinations of conditions associated with elevated bloom risk."),
            bullet("Anomaly probability: ", "flags unusual or potentially concerning water-quality patterns."),
            data_table(
                ["Development Evidence", "Current Result", "Interpretation"],
                [
                    ["Training data", "3 real missions + 12 synthetic missions; 1,158 windows", "Sufficient for proof of concept, not broad field validation"],
                    ["Evaluation data", "232 evaluation windows", "Preliminary internal evaluation"],
                    ["Oxygen RMSE", "1.92 mg/L", "Shows the current model still requires accuracy improvement"],
                    ["Forecast RMSE", "2.08 mg/L", "Useful as a development benchmark, not a validated forecast claim"],
                    ["Bloom accuracy", "59.5%", "Early-stage result; larger labeled datasets are required"],
                    ["Anomaly accuracy", "93.5%", "Promising internal result, subject to label and dataset limitations"],
                    ["ONNX export", "Validated; max output difference 0.00000095", "Confirms exported model matches the PyTorch output"],
                ],
                [1.65, 2.5, 3.2],
                font_size=6.2,
            ),
            image_with_caption(
                WEB_AI,
                "Current dashboard research-analysis interface; the visible fallback label prevents experimental output from being presented as validated inference.",
                max_height=2.7 * inch,
            ),
        ],
    )

    add_page(
        story,
        "NATIONALS ITERATION EVIDENCE: PROBLEM → CHANGE → EVIDENCE → IMPACT",
        [
            p(
                "The largest post-States refinement was not one isolated feature. It was a system-level iteration focused on field usability, communications reliability, diagnostic visibility, and future data interpretation."
            ),
            data_table(
                ["Problem Identified", "Refinement Made", "Evidence Available", "Impact"],
                [
                    ["Unity was effective for demonstration but less convenient across field devices.", "Rebuilt the operator interface as a local React/Vite web dashboard.", "Current dashboard screenshots; passing build and automated tests.", "Faster access and a clearer path to use on laptops or tablets."],
                    ["The earlier communications chain exposed limited diagnostic information.", "Added explicit WebSocket status, sequence tracking, hardware UART bridge, and RS-485 probe telemetry.", "Firmware source, serial-monitor output, and UI telemetry cards.", "Makes failures easier to locate and system state easier to verify."],
                    ["Operator controls needed stronger safety behavior.", "Added disarmed startup, neutral timeout behavior, arm/disarm state, and latched E-stop.", "Control contract and automated drive-mapping tests.", "Reduces risk of unintended motor output during setup or communication loss."],
                    ["Mission data existed as CSV/JSON but was difficult to organize as a repeatable project.", "Added mission planning, validation, local project saving, and exportable bundles.", "Saved-plan UI and route-tool tests.", "Supports repeatable setup, review, and communication of mission data."],
                    ["Visualizations explained the past but did not explore predictive use.", "Developed MARIS training/export pipeline and research-analysis scaffolding.", "PyTorch/ONNX artifacts, metrics report, and 7 passing ML tests.", "Demonstrates a realistic future path while clearly documenting present limitations."],
                ],
                [1.65, 2.0, 1.85, 1.85],
                font_size=5.9,
            ),
            p("Verified June 14, 2026", heading_style),
            bullet("Web tests: ", "26 passed across mission loading, route planning, project files, control math, research metadata, and RS-485 sensor averaging."),
            bullet("Web release checks: ", "production build completed and lint completed without errors."),
            bullet("ML checks: ", "7 tests passed across data loading, feature engineering, normalization, and training outputs."),
            bullet("Model export: ", "ONNX artifact exported and numerically validated against the PyTorch model."),
            callout(
                "Engineering significance: ",
                "the system now preserves the functioning States prototype as evidence while showing a traceable cycle of limitation identification, redesign, implementation, and verification.",
                GREEN,
            ),
        ],
    )

    add_page(
        story,
        "POST-STATES DEVELOPMENT RECORD",
        [
            p(
                "The following record supplements the original TSA work log by documenting major repository-backed development completed after the April 29, 2026 States portfolio submission."
            ),
            data_table(
                ["Date", "Development Activity", "Result / Evidence"],
                [
                    ["04/30/26", "Expanded live-control WebSocket and metrics integration.", "Control and data behavior incorporated into the evolving software system."],
                    ["05/05/26", "Developed and tested first-pass multi-task ML pipeline.", "MARIS training code, PyTorch checkpoint, ONNX export, normalization data, and metrics report."],
                    ["05/06/26", "Created the browser-based AquaScan dashboard.", "React/Vite/Three.js dashboard with mission loading, visualization, drive controls, and tests."],
                    ["05/08-05/10/26", "Integrated project-wide software, visualization, and control updates.", "Consolidated system capable of playback, live control, and expanded data interpretation."],
                    ["05/28/26", "Expanded planning, project-file, preflight, and research-analysis tools.", "Saved routes, validation feedback, project bundles, and research-analysis scaffolding."],
                    ["06/07/26", "Added RS-485 sensor pipeline and UI telemetry.", "Separated probe sensing from motor-control communications and surfaced telemetry in the dashboard."],
                    ["06/11-06/12/26", "Validated current bridge/control behavior and captured evidence.", "Serial-monitor and connected-dashboard evidence of the control chain."],
                    ["06/14/26", "Ran current verification suite and prepared Nationals portfolio update.", "26 web tests passed; build/lint passed; 7 ML tests passed."],
                ],
                [1.05, 3.35, 3.0],
                font_size=6.2,
            ),
            p("Current Limitations Carried Forward", heading_style),
            bullet("MARIS validation: ", "requires substantially more independent real-water mission data and external validation."),
            bullet("Autonomy: ", "manual control and mission planning are implemented; full autonomous route execution remains a planned refinement."),
            bullet("Depth accuracy: ", "probe depth is still estimated from tether deployment rather than measured with a pressure sensor."),
            bullet("Sensor accuracy: ", "continued calibration and optical-window refinement are required for stronger scientific claims."),
            p(
                "<b>These limitations are included because the purpose of iteration is not to claim that every problem is solved.</b> They define the next measurable engineering cycle for AquaScan."
            ),
        ],
    )

    if story and isinstance(story[-1], PageBreak):
        story.pop()
    document.build(story)


def merge_portfolio() -> None:
    source = fitz.open(SOURCE_PDF)
    inserts = fitz.open(INSERT_PDF)
    merged = fitz.open()

    # Original pages are zero-indexed. Insert pages preserve the original portfolio
    # as the States baseline and add targeted Nationals evidence at relevant points.
    merged.insert_pdf(source, from_page=0, to_page=1)
    merged.insert_pdf(inserts, from_page=0, to_page=0)  # 1A after table of contents
    merged.insert_pdf(source, from_page=2, to_page=16)
    merged.insert_pdf(inserts, from_page=1, to_page=3)  # 16A-C before What This Data Can Reveal
    merged.insert_pdf(source, from_page=17, to_page=28)
    merged.insert_pdf(inserts, from_page=4, to_page=4)  # 28A after completed refinements
    merged.insert_pdf(source, from_page=29, to_page=29)
    merged.insert_pdf(inserts, from_page=5, to_page=5)  # 29A after communication of solution
    merged.insert_pdf(source, from_page=30, to_page=source.page_count - 1)
    merged.save(FINAL_PDF, garbage=4, deflate=True)
    source.close()
    inserts.close()
    merged.close()


def render_pdf(pdf_path: Path, output_dir: Path, contact_name: str) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    document = fitz.open(pdf_path)
    thumbs: list[PilImage.Image] = []
    for index, page in enumerate(document):
        pix = page.get_pixmap(matrix=fitz.Matrix(1.45, 1.45), alpha=False)
        image_path = output_dir / f"page-{index + 1:02d}.png"
        pix.save(image_path)
        image = PilImage.open(image_path).convert("RGB")
        image.thumbnail((230, 298))
        thumbs.append(image.copy())
        image.close()
    document.close()

    columns = 3
    gap = 20
    label_height = 22
    rows = (len(thumbs) + columns - 1) // columns
    sheet = PilImage.new("RGB", (columns * 230 + (columns + 1) * gap, rows * (298 + label_height) + (rows + 1) * gap), "white")
    draw = ImageDraw.Draw(sheet)
    for index, thumb in enumerate(thumbs):
        col = index % columns
        row = index // columns
        x = gap + col * (230 + gap)
        y = gap + row * (298 + label_height + gap)
        sheet.paste(thumb, (x, y))
        draw.text((x, y + 300), f"{index + 1}", fill="black")
    sheet.save(output_dir / contact_name)


if __name__ == "__main__":
    build_insert_pdf()
    merge_portfolio()
    render_pdf(INSERT_PDF, OUT / "insert-preview", "contact-sheet.png")
    render_pdf(FINAL_PDF, OUT / "merged-preview", "contact-sheet.png")
    print(INSERT_PDF)
    print(FINAL_PDF)
