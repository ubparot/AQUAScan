import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceFbx = resolve(root, 'public/source-assets/Speed_Boat.fbx')
const sourceTexture = resolve(root, 'public/source-assets/PolyPackBoats.png')
const outputGlb = resolve(root, 'public/models/speed-boat.glb')
const scriptPath = resolve(tmpdir(), `aquascan-convert-boat-${Date.now()}.py`)
const blenderExecutable =
  process.env.BLENDER_BIN ??
  (existsSync('C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe')
    ? 'C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe'
    : 'blender')
const python = String.raw`
import bpy
from pathlib import Path

source_fbx = Path(${JSON.stringify(sourceFbx)})
source_texture = Path(${JSON.stringify(sourceTexture)})
output_glb = Path(${JSON.stringify(outputGlb)})

try:
    bpy.ops.preferences.addon_enable(module="io_scene_fbx")
except Exception:
    pass

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

bpy.ops.import_scene.fbx(filepath=str(source_fbx))

if source_texture.exists():
    image = bpy.data.images.load(str(source_texture), check_existing=True)
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        if not obj.data.materials:
            obj.data.materials.append(bpy.data.materials.new(name="AQUAScanBoatMaterial"))
        for material in obj.data.materials:
            if material is None:
                continue
            material.use_nodes = True
            nodes = material.node_tree.nodes
            links = material.node_tree.links
            bsdf = nodes.get("Principled BSDF")
            texture = nodes.new(type="ShaderNodeTexImage")
            texture.image = image
            if bsdf is not None and "Base Color" in bsdf.inputs:
                links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(output_glb), export_format='GLB', export_apply=True)
`

if (!existsSync(sourceFbx)) {
  console.error(`Missing source FBX: ${sourceFbx}`)
  process.exit(1)
}

mkdirSync(dirname(outputGlb), { recursive: true })
writeFileSync(scriptPath, python, 'utf8')

const result = spawnSync(blenderExecutable, ['--background', '--factory-startup', '--python', scriptPath], {
  stdio: 'inherit',
})

rmSync(scriptPath, { force: true })

if (result.error) {
  console.error('Blender is required for asset conversion and was not found on PATH.')
  process.exit(1)
}

if (result.status !== 0) {
  console.error('Boat conversion failed. Install Blender and make sure the `blender` command is available on PATH.')
}

process.exit(result.status ?? 0)
