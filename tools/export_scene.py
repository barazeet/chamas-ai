"""
Scene export pipeline: Untitled.blend -> public/models/office.glb

Run:  ~/blender/blender -b references/Untitled.blend -P tools/export_scene.py

Non-destructive: the .blend on disk is never saved. Fixes are applied
in-memory at export time:

1. Repair broken window-view image paths (blend references two files that
   only exist under different names in references/).
2. Cut window holes in the solid wall quads (they fully cover the window
   openings, hiding anything behind them).
3. Bake the procedural wall/floor materials (Noise/Brick nodes — they can't
   exist in glTF) into real image textures, one per object.
4. Build the window parallax view planes: emissive quads at the exact world
   positions of the user's marker empties ('Empty', 'Empty.001'), carrying
   the windowleft/windowright photos.
5. Turn the 'Glass' window-pane material into real Principled transmission
   glass (exports as KHR_materials_transmission -> physical glass in
   three.js). Only 'Glass' — 'Window' is the wooden frame, 'M_Windows' is a
   logo decal, 'M_caseinside' is the PC interior. Do NOT add to this list
   without checking which objects carry the material.
6. Export GLB with cameras, textures kept intact (compress afterward).
   NO lights are exported — the blend's old lamps were deleted by
   decision; new lighting is built in code, one light at a time.

Post-export compression chain (order matters — webp FIRST, or textures
stay PNG and the file ends up 5x bigger):

  npx @gltf-transform/cli webp office.glb a.glb
  npx @gltf-transform/cli resize --width 2048 --height 2048 a.glb b.glb
  npx @gltf-transform/cli meshopt b.glb office.glb   # ~13 MB
"""

import os

import bpy

REPO = "/home/brzt/code/chamas/chamas-ai"
REF = os.path.join(REPO, "references")
OUT = os.path.join(REPO, "public", "models", "office.glb")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

# --- 1. Repair missing window-view images -------------------------------
REMAP = {
    "window1.avif": "windowleft.avif",
    "window2.webp": "windowright.webp",
}
for img in bpy.data.images:
    if img.packed_file or not img.filepath:
        continue
    abspath = bpy.path.abspath(img.filepath)
    if not os.path.exists(abspath):
        base = os.path.basename(abspath)
        target = REMAP.get(base)
        if target:
            img.filepath = os.path.join(REF, target)
            img.reload()
            print(f"[export] remapped {base} -> {target}")
        else:
            print(f"[export] STILL MISSING: {img.filepath}")

# --- 2. Cut window holes in the solid wall quads --------------------------
# The walls are single solid quads that fully cover the window openings —
# nothing behind them (parallax views, outside light) can ever show
# through. Boolean-cut a hole at each window's glass bbox.
HOLES = [
    # (wall object, hole center, hole size) — from the Glass panes' bboxes
    ("wall-1", (1.247, -0.453, 1.421), (1.02, 0.5, 0.93)),
    ("wall-2", (-2.043, 0.153, 1.118), (0.5, 1.02, 1.72)),
]
for wall_name, center, size in HOLES:
    wall = bpy.data.objects.get(wall_name)
    if not wall:
        print(f"[export] WARN: hole target {wall_name} not found")
        continue
    bpy.ops.mesh.primitive_cube_add(size=2, location=center)
    cutter = bpy.context.active_object
    cutter.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = wall.modifiers.new("winhole", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cutter
    bpy.ops.object.select_all(action="DESELECT")
    wall.select_set(True)
    bpy.context.view_layer.objects.active = wall
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter)
    print(f"[export] cut window hole in {wall_name}")

# --- 2b. Add the missing ceiling ------------------------------------------
# The room has no ceiling (walls rise 8.7m into void), so Point.002 — the
# 69.5W "sun" at z=3.93, ABOVE ceiling height — leaks straight down into
# the room. With a ceiling in place, that lamp is blocked and light only
# enters through the windows, as designed. Knob: CEILING_Z.
CEILING_Z = 2.8
scene = bpy.context.scene
cmesh = bpy.data.meshes.new("ceiling")
CX0, CX1 = -2.15, 4.85  # 10cm overhang past each wall plane — no hairline
CY0, CY1 = -0.56, 4.15
cmesh.from_pydata(
    [(CX0, CY0, 0), (CX1, CY0, 0), (CX1, CY1, 0), (CX0, CY1, 0)],
    [],
    [(0, 3, 2, 1)],  # normal faces down into the room
)
cmesh.update()
cuv = cmesh.uv_layers.new()
for i, loop in enumerate(cmesh.loops):
    cuv.data[i].uv = [(0, 0), (1, 0), (1, 1), (0, 1)][i]
ceiling = bpy.data.objects.new("ceiling", cmesh)
ceiling.location.z = CEILING_Z
scene.collection.objects.link(ceiling)
wall_mask = bpy.data.materials.get("wall-mask")
if wall_mask:
    cmesh.materials.append(wall_mask)
print(f"[export] ceiling added at z={CEILING_Z}")

# --- 2c. Seal the wall corner -----------------------------------------------
# The wall-1/wall-2 quads don't form a perfect seal at the corner — a thin
# vertical wedge leaks outside light. Least intrusive seal: a 45-degree
# quad on the VOID side of the corner in near-black matte — through the
# slit you see a natural shadow gap, and nothing intrudes into the room.
CD = 0.35  # half-width of the seal
CCX, CCY = -2.04, -0.45  # corner intersection of the two wall planes
POST_TOP = CEILING_Z + 0.4  # poke through the ceiling — seals the top corner
pmesh = bpy.data.meshes.new("corner_post")
pmesh.from_pydata(
    [
        (CCX - CD, CCY, 0),
        (CCX, CCY - CD, 0),
        (CCX, CCY - CD, POST_TOP),
        (CCX - CD, CCY, POST_TOP),
    ],
    [],
    [(0, 1, 2, 3)],
)
pmesh.update()
puv = pmesh.uv_layers.new()
for i, loop in enumerate(pmesh.loops):
    puv.data[i].uv = [(0, 0), (1, 0), (1, 1), (0, 1)][i]
post = bpy.data.objects.new("corner_post", pmesh)
scene.collection.objects.link(post)
seal_mat = bpy.data.materials.new("corner_seal")
seal_mat.use_nodes = True
seal_p = next(n for n in seal_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
seal_p.inputs["Base Color"].default_value = (0.002, 0.002, 0.002, 1.0)
seal_p.inputs["Roughness"].default_value = 1.0
pmesh.materials.append(seal_mat)
print("[export] corner seal added (void-side, near-black)")

# --- 3. Bake procedural wall/floor/ceiling materials to image textures ----------
# wall-1/wall-2/ceiling share 'wall-mask' (Noise), wall-1.001 is the brick
# floor ('Material.007'). Procedural nodes can't export — bake albedo to
# images. Each object gets its own material clone so nothing shares a bake.
BAKE_OBJECTS = ["wall-1", "wall-2", "wall-1.001", "ceiling"]
PROCEDURAL = {"TEX_NOISE", "TEX_BRICK", "TEX_VORONOI", "TEX_MUSGRAVE"}

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 1  # albedo-only bake, no light sampling needed

for obj_name in BAKE_OBJECTS:
    obj = bpy.data.objects.get(obj_name)
    if not obj:
        print(f"[export] WARN: bake target {obj_name} not found")
        continue
    for slot in obj.material_slots:
        src = slot.material
        if not src or not src.use_nodes:
            continue
        if not any(n.type in PROCEDURAL for n in src.node_tree.nodes):
            continue
        # walls/ceiling: remap the noise mottling into creamy white
        # (user request — knobs: CREAM_LIGHT / CREAM_DARK below)
        noise = next((n for n in src.node_tree.nodes if n.type == "TEX_NOISE"), None)
        if noise:
            CREAM_DARK = (0.82, 0.76, 0.66, 1.0)   # linear, mottle lows
            CREAM_LIGHT = (0.95, 0.90, 0.80, 1.0)  # linear, mottle highs
            ramp = src.node_tree.nodes.new("ShaderNodeValToRGB")
            ramp.color_ramp.elements[0].color = CREAM_DARK
            ramp.color_ramp.elements[1].color = CREAM_LIGHT
            targets = {
                link.to_socket
                for link in src.node_tree.links
                if link.from_node == noise  # Fac OR Color output
            }
            for sock in targets:
                for link in list(sock.links):
                    src.node_tree.links.remove(link)
                src.node_tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
                src.node_tree.links.new(ramp.outputs["Color"], sock)

        # floor tiles: square grid in METERS (user request). Brick width at
        # Scale s is 1/s texture units, so Row Height must be 1/s for
        # texture-space squares (Row Height is in the same units — 1.0 once
        # produced full-length planks). offset 0 = grid, no stagger.
        brick = next((n for n in src.node_tree.nodes if n.type == "TEX_BRICK"), None)
        if brick:
            brick.offset = 0.0
            brick.inputs["Row Height"].default_value = (
                1.0 / brick.inputs["Scale"].default_value
            )
        # unique clone so shared materials don't fight over one image
        mat = src.copy()
        mat.name = f"{src.name}__{obj_name}"
        slot.material = mat
        # aspect-correct the floor's brick pattern: measure the plane's
        # world-meters per UV unit along U and V (UV axes are NOT assumed
        # to match world axes — guessing the axis once produced planks),
        # then equalize cells-per-meter so tiles come out square.
        if brick:
            cbrick = next(
                (n for n in mat.node_tree.nodes if n.type == "TEX_BRICK"), None
            )
            uvl = obj.data.uv_layers.active
            if cbrick and not cbrick.inputs["Vector"].links and uvl:
                from mathutils import Vector as _V

                corners = {}
                for loop in obj.data.loops:
                    uv = uvl.data[loop.index].uv
                    key = (round(uv.x, 3), round(uv.y, 3))
                    corners[key] = (
                        obj.matrix_world @ obj.data.vertices[loop.vertex_index].co
                    )
                pts = sorted(corners.items())
                us = sorted({k[0] for k, _ in pts})
                vs = sorted({k[1] for k, _ in pts})
                if len(us) == 2 and len(vs) == 2:
                    du = (
                        corners[(us[1], vs[0])] - corners[(us[0], vs[0])]
                    ).length / (us[1] - us[0])
                    dv = (
                        corners[(us[0], vs[1])] - corners[(us[0], vs[0])]
                    ).length / (vs[1] - vs[0])
                    tc = mat.node_tree.nodes.new("ShaderNodeTexCoord")
                    mp = mat.node_tree.nodes.new("ShaderNodeMapping")
                    # more cells along the longer axis -> square tiles
                    mp.inputs["Scale"].default_value = (1.0, dv / du, 1.0)
                    mat.node_tree.links.new(
                        tc.outputs["Generated"], mp.inputs["Vector"]
                    )
                    mat.node_tree.links.new(
                        mp.outputs["Vector"], cbrick.inputs["Vector"]
                    )
                    print(
                        f"[export] floor aspect: {du:.2f}m/U {dv:.2f}m/V -> scale {dv / du:.3f}"
                    )
        img = bpy.data.images.new(f"baked_{obj_name}", 1024, 1024)
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = img
        mat.node_tree.nodes.active = tex
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        try:
            bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=16)
        except TypeError:  # older API
            bpy.ops.object.bake(
                type="DIFFUSE",
                use_pass_direct=False,
                use_pass_indirect=False,
                use_pass_color=True,
                margin=16,
            )
        # rewire: baked image feeds every socket the procedural nodes fed
        principled = next(
            (n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None
        )
        if principled:
            for inp in principled.inputs:
                for link in list(inp.links):
                    if link.from_node.type in PROCEDURAL:
                        mat.node_tree.links.remove(link)
                        mat.node_tree.links.new(tex.outputs["Color"], inp)
        print(f"[export] baked {obj_name} ({src.name})")

# --- 4. Recreate the window parallax view planes --------------------------
# The user marked view positions with locator empties behind each window
# ('Empty' 2.78m behind the square window, 'Empty.001' 1.2m behind the tall
# one), but no geometry ever carried the images — they survived only as
# orphaned datablocks. Build real emissive quads at the empties' exact
# world positions so the fake-parallax views export like everything else.
PARALLAX = [
    # (empty name, image in references/, window wall axis, window opening m)
    ("Empty", "windowleft.avif", "Y", 1.0),
    ("Empty.001", "windowright.webp", "X", 1.0),
]
COVER = 3.0  # plane width = COVER x window opening, so edges never show

for empty_name, img_file, axis, opening in PARALLAX:
    empty = bpy.data.objects.get(empty_name)
    if not empty:
        print(f"[export] WARN: parallax marker {empty_name} not found")
        continue
    img = bpy.data.images.load(os.path.join(REF, img_file), check_existing=True)
    w, h = img.size
    aspect = (w / h) if h else 16 / 9
    pw = COVER * opening
    ph = pw / aspect
    if axis == "Y":  # window lies in the XZ plane, view faces the room (+Y)
        verts = [(-pw / 2, 0, -ph / 2), (pw / 2, 0, -ph / 2),
                 (pw / 2, 0, ph / 2), (-pw / 2, 0, ph / 2)]
    else:            # window lies in the YZ plane, view faces the room (+X)
        verts = [(0, -pw / 2, -ph / 2), (0, pw / 2, -ph / 2),
                 (0, pw / 2, ph / 2), (0, -pw / 2, ph / 2)]
    mesh = bpy.data.meshes.new(f"parallax_{empty_name}")
    mesh.from_pydata(verts, [], [(0, 1, 2, 3)])
    mesh.update()
    uv = mesh.uv_layers.new()
    for i, loop in enumerate(mesh.loops):
        uv.data[i].uv = [(0, 0), (1, 0), (1, 1), (0, 1)][i]
    obj = bpy.data.objects.new(f"parallax_{empty_name}", mesh)
    obj.matrix_world.translation = empty.matrix_world.translation  # user's distance
    scene.collection.objects.link(obj)
    mat = bpy.data.materials.new(f"parallax_{empty_name}")
    mat.use_nodes = True
    p = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    texn = mat.node_tree.nodes.new("ShaderNodeTexImage")
    texn.image = img
    mat.node_tree.links.new(texn.outputs["Color"], p.inputs["Base Color"])
    emission = p.inputs.get("Emission Color") or p.inputs.get("Emission")
    if emission:
        mat.node_tree.links.new(texn.outputs["Color"], emission)
    p.inputs["Emission Strength"].default_value = 0.8  # matches window-view-photo
    p.inputs["Roughness"].default_value = 1.0
    mesh.materials.append(mat)
    print(f"[export] parallax plane: {obj.name} at {empty.matrix_world.translation[:]}")

# --- 6. Real transmission glass on the window pane material -------------
# Strip the asset's dirty-glass grime textures (baseColor/roughness/normal)
# — left in place they frost the pane and hide the parallax views. Crystal
# glass: white base, roughness 0.05, IOR 1.5, full transmission.
m = bpy.data.materials.get("Glass")
if m and m.use_nodes:
    p = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if p:
        for sock in ("Base Color", "Metallic", "Roughness", "Normal", "Alpha"):
            inp = p.inputs.get(sock)
            if inp:
                for link in list(inp.links):
                    m.node_tree.links.remove(link)
        p.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
        p.inputs["Metallic"].default_value = 0.0
        p.inputs["Alpha"].default_value = 1.0
        p.inputs["Roughness"].default_value = 0.05
        p.inputs["IOR"].default_value = 1.5
        p.inputs["Transmission Weight"].default_value = 1.0
        m.surface_render_method = "DITHERED"  # transmission needs no alpha blend
        print("[export] glassified: Glass")
else:
    print("[export] WARN: material 'Glass' not found")

# --- 7. Export GLB -------------------------------------------------------
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_apply=True,          # apply modifiers
    export_cameras=True,        # camera1 + camera2 ride along
    export_lights=False,        # NO lights — the blend's lamps are deleted
                                 # by decision; new lighting is built in code
    export_animations=False,
    export_image_format="AUTO",  # WEBP re-encode fails headless on some
                                 # textures; AUTO keeps sources intact.
                                 # Compress afterward with gltf-transform.
)
print("[export] wrote", OUT)
