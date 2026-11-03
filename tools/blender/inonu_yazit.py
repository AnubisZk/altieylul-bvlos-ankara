# İsmet İnönü Lahdi — okunur kitabe (Blender bpy)
#
#   python tools/blender/inonu_yazit.py -- --in models/inonu-lahdi.glb --out models/inonu-lahdi.glb
#
# Meshy modelindeki harfler bozuk ve okunmuyor. Bu betik modelin yüzeyine ışın atarak yüzeyi izleyen ince
# "kitabe" ağları ekler:
#   - +X uç yüz (oyunda Anıt Blok'a bakan, üçgen alınlıklı yüz): "İSMET İNÖNÜ" ve "1884 – 1973", oyma harfler
#   - iki uzun yan yüz: bozuk yazının üstünü örten düz granit panel
# Granit rengi modelin kendi dokusundan ölçülür. Yeniden çalıştırılırsa önceki "Lahit_Kitabe*" ağları silinir.
import bpy, bmesh, sys, os, argparse
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from PIL import Image, ImageDraw, ImageFont, ImageFilter

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser(); ap.add_argument('--in', dest='inp', default='models/inonu-lahdi.glb'); ap.add_argument('--out', default='models/inonu-lahdi.glb')
ap.add_argument('--preview', default=None); A = ap.parse_args(argv)
FONT = next((f for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf') if os.path.exists(f)), None)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=A.inp)
for o in [o for o in bpy.data.objects if o.name.startswith('Lahit_Kitabe')]: bpy.data.objects.remove(o)
body = max((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: len(o.data.polygons))
bm = bmesh.new(); bm.from_mesh(body.data); bm.transform(body.matrix_world); tree = BVHTree.FromBMesh(bm)
lo = Vector([min(v.co[i] for v in bm.verts) for i in range(3)]); hi = Vector([max(v.co[i] for v in bm.verts) for i in range(3)]); bm.free()
size = hi - lo; print('[inonu_yazit] model', tuple(round(v, 3) for v in size))

# granit tonu: modelin taban rengi dokusunun ortalaması
img = next((n.image for m in body.data.materials if m and m.use_nodes for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
if img is not None:
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)[:, :3]; GRANITE = np.median(px, axis=0)
else: GRANITE = np.array((0.42, 0.33, 0.30))
print('[inonu_yazit] granit', GRANITE.round(3))

def granite(w, h, seed):
    r = np.random.default_rng(seed); g = r.normal(0, 1, (h, w))
    big = np.array(Image.fromarray(((r.random((h // 8, w // 8)) * 255)).astype(np.uint8)).resize((w, h), Image.BICUBIC)) / 255.0
    speck = (r.random((h, w)) > 0.96) * r.uniform(-0.35, 0.3, (h, w))
    t = 1.06 + 0.09 * g + 0.12 * (big - 0.5) + speck
    return np.clip(GRANITE[None, None] * t[..., None], 0, 1)

def kitabe_tex(w, h, lines, seed):
    """Oyma harfler: kesik yüz açık tonda, üst kenarda ince gölge (güneş yukarıdan)."""
    rgb = granite(w, h, seed)
    if not lines: return rgb
    mask = Image.new('L', (w, h), 0); d = ImageDraw.Draw(mask)
    y = h * 0.22
    for text, rel in lines:
        px = int(h * rel)
        while True:                                                # satır panel eninin %84'üne sığsın
            f = ImageFont.truetype(FONT, px) if FONT else ImageFont.load_default()
            bb = d.textbbox((0, 0), text, font=f); tw, th = bb[2] - bb[0], bb[3] - bb[1]
            if tw <= 0.84 * w or px < 12: break
            px = int(px * 0.94)
        d.text(((w - tw) / 2 - bb[0], y - bb[1]), text, fill=255, font=f); y += th + h * 0.14
    m = np.array(mask.filter(ImageFilter.GaussianBlur(1.0))) / 255.0
    sh = np.array(mask.filter(ImageFilter.GaussianBlur(1.5)).transform((w, h), Image.AFFINE, (1, 0, 0, 0, 1, -3))) / 255.0
    cut = np.clip(GRANITE * 1.55 + 0.08, 0, 1)                    # kesik granit: daha açık, mat
    out = rgb * (1 - m[..., None]) + cut[None, None] * m[..., None]
    out *= (1 - 0.45 * np.clip(sh - m, 0, 1))[..., None]          # harfin üst iç kenarı gölgede
    return np.clip(out, 0, 1)

def make_image(name, rgb):
    h, w = rgb.shape[:2]; im = bpy.data.images.new(name, w, h)
    im.pixels.foreach_set(np.concatenate([rgb, np.ones((h, w, 1))], axis=2)[::-1].astype(np.float32).ravel()); im.pack(); return im

def material(name, rgb):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.55; b.inputs['Metallic'].default_value = 0
    t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = make_image(name, rgb); m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    return m

def conform(name, mat, axis, sign, u_rng, v_rng, nu=24, nv=12, off=0.006):
    """axis yönündeki yüzeye (sign tarafından bakılan) uyan ağ; u izleyicinin sağına, v yukarı."""
    verts, faces, uv = [], [], []
    ai = 'xyz'.index(axis); ui = 1 if axis == 'x' else 0
    right = sign if axis == 'x' else -sign                          # +X'ten bakan için sağ = +Y; −Y'den bakan için sağ = +X
    for j in range(nv + 1):
        for i in range(nu + 1):
            u, v = i / nu, j / nv
            o = Vector((0, 0, 0)); o[ai] = sign * 5; o[ui] = right * (u_rng[0] + (u_rng[1] - u_rng[0]) * u); o[2] = v_rng[0] + (v_rng[1] - v_rng[0]) * v
            d = Vector((0, 0, 0)); d[ai] = -sign
            hit, nrm, _, _ = tree.ray_cast(o, d)
            if hit is None: raise SystemExit(f'{name}: yüzey bulunamadı ({u:.2f},{v:.2f})')
            verts.append(hit + d * -off); uv.append((u, v))
    for j in range(nv):
        for i in range(nu):
            k = j * (nu + 1) + i; faces.append((k, k + 1, k + nu + 2, k + nu + 1))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    lay = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices: lay.data[li].uv = uv[me.loops[li].vertex_index]
    bmx = bmesh.new(); bmx.from_mesh(me); bmx.normal_update()
    want = Vector((0, 0, 0)); want[ai] = sign
    if sum(f.normal.dot(want) for f in bmx.faces) < 0:
        for f in bmx.faces: f.normal_flip()
    bmx.to_mesh(me); bmx.free(); me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); return ob

# yüz bölgeleri model birimiyle (uzun eksen X ≈ 1.9, en Y ≈ 1.0, yükseklik Z ≈ 1.0; ölçüler göreli tutulur)
sx, sy, sz = size.x / 1.898, size.y / 1.005, size.z / 0.991
cz = (lo.z + hi.z) / 2
END = dict(u=(-0.30 * sy, 0.30 * sy), v=(cz - 0.17 * sz, cz + 0.26 * sz))
SIDE = dict(u=(-0.72 * sx, 0.72 * sx), v=(cz - 0.13 * sz, cz + 0.23 * sz))
we = END['u'][1] - END['u'][0]; he = END['v'][1] - END['v'][0]
TW = 1024; TH = int(TW * he / we)
end_rgb = kitabe_tex(TW, TH, [('İSMET İNÖNÜ', 0.24), ('1884 – 1973', 0.17)], 3)
conform('Lahit_Kitabe_On', material('Lahit_Kitabe', end_rgb), 'x', 1, END['u'], END['v'], 28, 16)
side_rgb = kitabe_tex(1024, int(1024 * (SIDE['v'][1] - SIDE['v'][0]) / (SIDE['u'][1] - SIDE['u'][0])), [], 9)
sm = material('Lahit_Yan_Panel', side_rgb)
conform('Lahit_Kitabe_Yan_A', sm, 'y', -1, SIDE['u'], SIDE['v'], 32, 10)
conform('Lahit_Kitabe_Yan_B', sm, 'y', 1, SIDE['u'], SIDE['v'], 32, 10)
if A.preview: Image.fromarray((end_rgb * 255).astype(np.uint8)).save(A.preview)

bpy.ops.object.select_all(action='SELECT')
fmt = 'WEBP'
try: bpy.ops.export_scene.gltf(filepath=A.out, export_format='GLB', use_selection=True, export_yup=True, export_image_format=fmt, export_materials='EXPORT')
except TypeError:
    fmt = 'JPEG'; bpy.ops.export_scene.gltf(filepath=A.out, export_format='GLB', use_selection=True, export_yup=True, export_image_format=fmt, export_materials='EXPORT')
print('[inonu_yazit]', A.out, os.path.getsize(A.out), 'bayt,', fmt)
