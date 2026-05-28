from math import cos, radians, sin
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
ASSET_ROOT = ROOT / "Assets" / "Alstra Infinite" / "Props LowPoly"
SOURCE_PATH = ASSET_ROOT / "Source" / "LowPoly_Furnace.blend"
FBX_PATH = ASSET_ROOT / "Models" / "LowPoly_Furnace.fbx"
PREVIEW_PATH = ASSET_ROOT / "Previews" / "LowPoly_Furnace.png"


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0


def material(name, color, roughness=0.75, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        if emission:
            bsdf.inputs["Emission Color"].default_value = emission
            bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def cube(name, location, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj


def cylinder(name, location, radius, depth, mat, vertices=8, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        end_fill_type="NGON",
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    bpy.ops.object.shade_flat()
    return obj


def arch_prism(name, center_y, z_bottom, width, straight_height, depth, mat, segments=6):
    radius = width * 0.5
    outline = [(-radius, z_bottom), (radius, z_bottom), (radius, z_bottom + straight_height)]
    for i in range(1, segments + 1):
        angle = radians(180 - (180 * i / segments))
        outline.append((cos(angle) * radius, z_bottom + straight_height + sin(angle) * radius))
    outline.append((-radius, z_bottom + straight_height))

    front_y = center_y - depth * 0.5
    back_y = center_y + depth * 0.5
    verts = [(x, front_y, z) for x, z in outline] + [(x, back_y, z) for x, z in outline]
    count = len(outline)
    faces = [tuple(range(count)), tuple(range(count, count * 2))]
    for i in range(count):
        faces.append((i, (i + 1) % count, (i + 1) % count + count, i + count))

    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def add_bevel(obj, amount):
    bevel = obj.modifiers.new("LowPolyBevel", "BEVEL")
    bevel.width = amount
    bevel.segments = 1
    bevel.affect = "EDGES"
    obj.modifiers.new("WeightedNormals", "WEIGHTED_NORMAL")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def set_origin_to_floor(root_empty):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    empty = bpy.context.object
    empty.name = root_empty
    for obj in [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]:
        obj.parent = empty
    return empty


def build_furnace():
    reset_scene()

    iron = material("LPF_Dark_Iron", (0.12, 0.13, 0.14, 1))
    iron_light = material("LPF_Edge_Worn_Iron", (0.34, 0.36, 0.36, 1))
    brick = material("LPF_Red_Brick", (0.54, 0.18, 0.12, 1))
    brass = material("LPF_Brass", (0.95, 0.62, 0.22, 1), 0.55)
    ember = material(
        "LPF_Ember_Glow",
        (1.0, 0.27, 0.05, 1),
        0.35,
        emission=(1.0, 0.18, 0.02, 1),
        strength=1.75,
    )
    ash = material("LPF_Ash_Coal", (0.04, 0.035, 0.03, 1))

    body = cube("LPF_Body", (0, 0, 1.05), (1.6, 1.15, 1.65), iron)
    add_bevel(body, 0.055)

    top = cube("LPF_Top_Lip", (0, 0, 1.91), (1.78, 1.28, 0.16), iron_light)
    base = cube("LPF_Base_Lip", (0, 0, 0.16), (1.86, 1.34, 0.2), iron_light)
    add_bevel(top, 0.035)
    add_bevel(base, 0.035)

    chimney = cylinder(
        "LPF_Chimney",
        (0.42, 0.07, 2.48),
        0.25,
        1.02,
        iron,
        vertices=8,
    )
    add_bevel(chimney, 0.025)
    cap = cube("LPF_Chimney_Cap", (0.42, 0.07, 3.03), (0.66, 0.66, 0.14), iron_light)
    add_bevel(cap, 0.025)

    front_y = -0.61
    door_frame = arch_prism("LPF_Door_Frame", front_y, 0.41, 0.86, 0.74, 0.08, brass)
    door = arch_prism("LPF_Firebox_Door", front_y - 0.04, 0.47, 0.68, 0.58, 0.08, iron_light)
    fire = arch_prism("LPF_Fire_Glow", front_y - 0.085, 0.54, 0.44, 0.33, 0.04, ember)
    for obj in (door_frame, door, fire):
        add_bevel(obj, 0.015)

    handle = cylinder(
        "LPF_Door_Handle",
        (0.34, front_y - 0.12, 0.86),
        0.035,
        0.18,
        brass,
        vertices=8,
        rotation=(radians(90), 0, 0),
    )
    latch = cube("LPF_Door_Latch", (0.2, front_y - 0.12, 0.86), (0.12, 0.07, 0.08), brass)
    add_bevel(latch, 0.012)

    grate = cube("LPF_Ash_Tray", (0, front_y - 0.06, 0.32), (1.05, 0.1, 0.18), ash)
    add_bevel(grate, 0.018)
    for i, x in enumerate([-0.35, -0.18, 0, 0.18, 0.35]):
        vent = cube(f"LPF_Ash_Vent_{i+1}", (x, front_y - 0.12, 0.34), (0.075, 0.035, 0.09), ember)
        add_bevel(vent, 0.006)

    for i, x in enumerate([-0.58, 0.58]):
        for j, y in enumerate([-0.42, 0.42]):
            leg = cube(f"LPF_Leg_{i+1}_{j+1}", (x, y, -0.08), (0.18, 0.18, 0.32), iron_light)
            add_bevel(leg, 0.02)

    for side_name, y in [("Left", -0.64), ("Right", 0.64)]:
        for index, z in enumerate([0.82, 1.08, 1.34]):
            pipe = cylinder(
                f"LPF_Side_Vent_{side_name}_{index+1}",
                (-0.82, y * 0.6, z),
                0.035,
                0.5,
                brass,
                vertices=6,
                rotation=(0, radians(90), 0),
            )

    for i, x in enumerate([-0.62, -0.36, -0.1, 0.16, 0.42, 0.68]):
        rivet = cylinder(
            f"LPF_Top_Rivet_{i+1}",
            (x, front_y - 0.03, 1.76),
            0.035,
            0.035,
            brass,
            vertices=8,
            rotation=(radians(90), 0, 0),
        )

    for i, (x, z, s) in enumerate([(-0.12, 0.62, 0.16), (0.04, 0.7, 0.12), (0.12, 0.58, 0.1)]):
        coal = cube(f"LPF_Coal_{i+1}", (x, front_y - 0.115, z), (s, 0.04, s * 0.7), ash)
        coal.rotation_euler[2] = radians(18 * (i + 1))
        add_bevel(coal, 0.01)

    root = set_origin_to_floor("LowPoly_Furnace")

    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj.data.polygons.foreach_set("use_smooth", [False] * len(obj.data.polygons))
            obj.select_set(True)
        else:
            obj.select_set(False)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    camera_data = bpy.data.cameras.new("LPF_Preview_Camera")
    camera = bpy.data.objects.new("LPF_Preview_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (4.2, -5.4, 3.4)
    look_at(camera, (0, 0, 1.38))
    bpy.context.scene.camera = camera
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 4.85

    light_data = bpy.data.lights.new("LPF_Key_Light", "AREA")
    light = bpy.data.objects.new("LPF_Key_Light", light_data)
    bpy.context.collection.objects.link(light)
    light.location = (-3, -4, 5)
    light.data.energy = 450
    light.data.size = 5

    fill_data = bpy.data.lights.new("LPF_Fill_Light", "POINT")
    fill = bpy.data.objects.new("LPF_Fill_Light", fill_data)
    bpy.context.collection.objects.link(fill)
    fill.location = (2.5, 2.5, 2.0)
    fill.data.energy = 90

    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    bpy.context.scene.eevee.taa_render_samples = 32
    bpy.context.scene.render.resolution_x = 1200
    bpy.context.scene.render.resolution_y = 900
    bpy.context.scene.view_settings.view_transform = "Standard"
    bpy.context.scene.view_settings.look = "Medium High Contrast"

    return root


def export_assets():
    ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    SOURCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    FBX_PATH.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)

    build_furnace()

    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_PATH))
    bpy.ops.export_scene.fbx(
        filepath=str(FBX_PATH),
        object_types={"EMPTY", "MESH"},
        use_active_collection=False,
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_UNITS",
        bake_space_transform=False,
        add_leaf_bones=False,
        mesh_smooth_type="OFF",
        path_mode="AUTO",
    )
    bpy.context.scene.render.filepath = str(PREVIEW_PATH)
    bpy.ops.render.render(write_still=True)

    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    tris = sum(len(poly.vertices) - 2 for obj in mesh_objects for poly in obj.data.polygons)
    verts = sum(len(obj.data.vertices) for obj in mesh_objects)
    print(f"LowPoly_Furnace exported: {len(mesh_objects)} mesh objects, {verts} verts, {tris} tris")
    print(FBX_PATH)
    print(SOURCE_PATH)
    print(PREVIEW_PATH)


if __name__ == "__main__":
    export_assets()
