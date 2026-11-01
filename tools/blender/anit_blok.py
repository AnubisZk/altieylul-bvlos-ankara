# Anıt Blok + Tören Meydanı zemini — Blender (bpy) betiği · Three.js GLTFLoader uyumlu GLB
#
#   blender -b -P tools/blender/anit_blok.py -- --out models
#
# Meshy modelindeki Anıt Blok (yuvarlak, eğri sütunlar, bulanık doku) gerçek ölçülerle yeniden kurulur; Meshy'nin
# meydan zemini üstüne cilalı traverten levha zemin serilir. Revaklar ve kuleler Meshy modelinde kalır.
#
# Ölçüler ve kaynakları:
#   - Peristil 8 × 14 kare kesitli pilon, dış ölçü 41.65 × 57.35 m; meydana bakan kısa cephe (OSM Türbe poligonu
#     51.0 × 61.9 m, basamak sahanlığıyla; Meshy modeli ve referans fotoğrafla tutarlı)
#   - Pilon kesiti 1.4 × 1.3 m, pilon yüksekliği ~16 m, çerçeve aralığı 5.5 m (ODTÜ yapısal değerlendirme makalesi)
#   - Tören Meydanı 129 × 84 m (Anıtkabir proje bilgisi); OSM'deki 8 kule meydan eksenini ve genişliğini doğruluyor
#   - Kaide yüksekliği ve basamak sayısı yaklaşık (fotoğraftan): 6.4 m, 36 basamak
# Koordinat: kök "AnitBlok" Anıt Blok merkezinde, meydan zemini yüksekliğinde; yerel +X = meydandan Anıt Blok'a eksen,
# yerel −Y = enine p (oyun işareti). data/ank/anitkabir.json içindeki floorY ve rotationY ile hizalanır.
import bpy, bmesh, math, os, sys, json, argparse
import numpy as np
from mathutils import Vector, Matrix

def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--monument', default='data/ank/anitkabir.json')
    p.add_argument('--out', default='models')
    p.add_argument('--lift', type=float, default=0.92, help='Meshy meydan zemini floorY üstünde ~0.5–0.9 m; yeni zemin bunun üstüne oturur')
    return p.parse_args(argv)
A = parse_args()
MON = json.load(open(A.monument, encoding='utf-8'))

FRONT_W, DEPTH = 41.65, 57.35          # peristil dış ölçüsü (enine × eksen boyunca)
PIL = (1.30, 1.40)                     # pilon kesiti (eksen boyunca × enine)
PIL_H = 16.0
NF, NS = 8, 14                         # kısa (ön/arka) ve uzun (yan) cephe pilon sayısı
PODIUM_H, STEPS = 6.4, 36
PODIUM_PAD = 5.3                       # kaide, peristilden taşma (Meshy kesimini örter)
ENT_H, CORNICE = 4.6, 0.75             # saçak kuşağı ve taşma
SQUARE = {'a0': -180.0, 'a1': -46.0, 'p': 42.0}   # Tören Meydanı (eksen boyunca a, enine ±p), yerel metre

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
COLL = {k: bpy.data.collections.new(k) for k in ('MODEL', 'COLLIDERS')}
for c in COLL.values(): scene.collection.children.link(c)

def root(name, coll):
    o = bpy.data.objects.new(name, None); COLL[coll].objects.link(o)
    o.location = (0, 0, MON['floorY'] + A.lift); o.rotation_euler = (0, 0, MON['transform']['rotationY'])
    return o
ROOT = {'MODEL': root('AnitBlok', 'MODEL'), 'COLLIDERS': root('AnitBlok_Colliders', 'COLLIDERS')}
def link(ob, coll):
    COLL[coll].objects.link(ob); ob.parent = ROOT[coll]; return ob
def L(a, p, z=0.0): return Vector((a, -p, z))

# ------------------------------------------------------------------ dokular
def make_image(name, rgb, colorspace='sRGB'):
    h, w = rgb.shape[:2]
    px = np.concatenate([np.clip(rgb, 0, 1), np.ones((h, w, 1))], axis=2)[::-1].astype(np.float32)
    img = bpy.data.images.new(name, w, h); img.colorspace_settings.name = colorspace
    img.pixels.foreach_set(px.ravel()); img.pack(); return img

def fbm(n, octaves, seed):
    r = np.random.default_rng(seed); out = np.zeros((n, n)); amp = 1.0; tot = 0
    for o in range(octaves):
        g = 4 * 2 ** o; base = r.random((g + 1, g + 1)); base[-1, :] = base[0, :]; base[:, -1] = base[:, 0]
        xs = np.linspace(0, g, n, endpoint=False); i = xs.astype(int); f = xs - i; f = f * f * (3 - 2 * f)
        a = base[i][:, i] * (1 - f)[None] + base[i][:, i + 1] * f[None]; b = base[i + 1][:, i] * (1 - f)[None] + base[i + 1][:, i + 1] * f[None]
        out += amp * (a * (1 - f)[:, None] + b * f[:, None]); tot += amp; amp *= 0.5
    return out / tot

def stone(n, base, slabs, seed, joint=0.004, contrast=1.0):
    """Döşenebilir traverten: damar + gözenek + levha derzleri (slabs = (sütun, satır))."""
    v = fbm(n, 6, seed); w = fbm(n, 4, seed + 1)
    y = np.linspace(0, 1, n, endpoint=False)[:, None].repeat(n, 1); x = y.T
    veins = 0.5 + 0.5 * np.sin((y * 7 + w * 1.4) * 2 * np.pi)
    pores = (np.random.default_rng(seed + 2).random((n, n)) > 0.997).astype(float)
    tone = 0.93 + contrast * (0.09 * (v - 0.5) + 0.03 * (veins - 0.5)) - 0.10 * pores
    cx, cy = slabs; row = np.floor(y * cy); xs = (x * cx + 0.5 * (row % 2)) % 1; ys = (y * cy) % 1
    jm = np.clip(1 - np.minimum(np.minimum(xs, 1 - xs) / cx, np.minimum(ys, 1 - ys) / cy) / joint, 0, 1)
    sid = np.random.default_rng(seed + 3).random((cy, cx))[(row % cy).astype(int), np.floor((x * cx + 0.5 * (row % 2)) % cx).astype(int)]
    rgb = np.array(base)[None, None] * (tone * (0.965 + 0.07 * sid) * (1 - 0.25 * jm))[..., None]
    hgt = -jm + 0.12 * v; gy, gx = np.gradient(hgt)
    nrm = np.dstack([-gx * 5, gy * 5, np.ones_like(gx)]); nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
    return rgb, nrm * 0.5 + 0.5

def pbr(name, img, nimg, rough, color=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; m.use_backface_culling = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = 0
    if img is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    else: b.inputs['Base Color'].default_value = (*color, 1)
    if nimg is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = nimg; nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.7
        nt.links.new(t.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m

WARM = (0.80, 0.66, 0.47)                   # Anıt Blok traverteni (referans fotoğraftaki sıcak bal rengi)
c, n = stone(1024, WARM, (2, 4), 51); TRAV = make_image('AnitBlok_Traverten', c); TRAV_N = make_image('AnitBlok_Traverten_N', n, 'Non-Color')
c, n = stone(1024, (0.86, 0.80, 0.71), (4, 4), 61, joint=0.003, contrast=0.8); FLOOR = make_image('Meydan_Traverten', c); FLOOR_N = make_image('Meydan_Traverten_N', n, 'Non-Color')
M = {
    'stone': pbr('AnitBlok_Tas', TRAV, TRAV_N, 0.68),
    'floor': pbr('Meydan_Zemin', FLOOR, FLOOR_N, 0.32),          # cilalı, ıslakken yansıyan meydan taşı
    'dark': pbr('Ic_Golge', None, None, 0.85, (0.05, 0.045, 0.04)),  # sütunlar arası derin revak ve camlar
    'glass': pbr('Vitray', None, None, 0.55, (0.035, 0.038, 0.042)),
    'roof': pbr('Cati_Kursun', None, None, 0.6, (0.44, 0.47, 0.48)),
    'col': pbr('Carpisma', None, None, 1.0, (1, 0, 1)),
}
TILE_STONE, TILE_FLOOR = 6.0, 10.0          # doku tekrarının gerçek boyu (m)

def uvs(bm, tile):
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        nn = f.normal
        for l in f.loops:
            co = l.vert.co
            l[uv].uv = (co.x / tile, co.y / tile) if abs(nn.z) > 0.6 else ((co.y if abs(nn.x) > abs(nn.y) else co.x) / tile, co.z / tile)

def box(bm, a0, a1, p0, p1, z0, z1, mat):
    r = bmesh.ops.create_cube(bm, size=1.0); vs = r['verts']
    bmesh.ops.scale(bm, vec=(a1 - a0, p1 - p0, z1 - z0), verts=vs)
    bmesh.ops.translate(bm, verts=vs, vec=L((a0 + a1) / 2, (p0 + p1) / 2, (z0 + z1) / 2))
    for f in {f for v in vs for f in v.link_faces}: f.material_index = mat
    return vs

MI = {'stone': 0, 'dark': 1, 'glass': 2, 'roof': 3}
bm = bmesh.new()
hw, hd = FRONT_W / 2, DEPTH / 2
P0 = PODIUM_H
# kaide (iki kademeli) ve yan duvarlar
box(bm, -hd - PODIUM_PAD, hd + PODIUM_PAD, -hw - PODIUM_PAD, hw + PODIUM_PAD, -1.5, P0 - 1.2, MI['stone'])
box(bm, -hd - PODIUM_PAD + 0.6, hd + PODIUM_PAD - 0.6, -hw - PODIUM_PAD + 0.6, hw + PODIUM_PAD - 0.6, P0 - 1.2, P0, MI['stone'])
# büyük merdiven: ön cephenin tamamı boyunca, meydana iner
run = 0.36; front = -hd - PODIUM_PAD
for k in range(STEPS):
    top = P0 * (STEPS - k) / STEPS
    box(bm, front - (k + 1) * run, front - k * run + 0.02, -hw - 2.0, hw + 2.0, -0.5, top, MI['stone'])
# merdiven yan duvarları (rölyef panellerinin yeri)
for s in (-1, 1):
    pa, pb = sorted((s * (hw + 2.0), s * (hw + 4.6)))
    box(bm, front - STEPS * run, front, pa, pb, -0.5, P0 * 0.55, MI['stone'])
# peristil pilonları
def pillar_line(n, a_fixed=None, p_fixed=None, skip_ends=False):
    for i in range(1 if skip_ends else 0, n - 1 if skip_ends else n):   # köşe pilonları yalnız ön/arka sırada (çakışma yok)
        if a_fixed is not None:
            p = -hw + PIL[1] / 2 + i * (FRONT_W - PIL[1]) / (n - 1); a = a_fixed
        else:
            a = -hd + PIL[0] / 2 + i * (DEPTH - PIL[0]) / (n - 1); p = p_fixed
        box(bm, a - PIL[0] / 2, a + PIL[0] / 2, p - PIL[1] / 2, p + PIL[1] / 2, P0, P0 + PIL_H, MI['stone'])
        box(bm, a - PIL[0] / 2 - 0.12, a + PIL[0] / 2 + 0.12, p - PIL[1] / 2 - 0.12, p + PIL[1] / 2 + 0.12, P0, P0 + 0.5, MI['stone'])   # pilon tabanı
pillar_line(NF, a_fixed=-hd + PIL[0] / 2); pillar_line(NF, a_fixed=hd - PIL[0] / 2)
pillar_line(NS, p_fixed=-hw + PIL[1] / 2, skip_ends=True); pillar_line(NS, p_fixed=hw - PIL[1] / 2, skip_ends=True)
# iç kütle (Şeref Holü duvarları): önde derin revak (koyu), yanlarda dar galeri, pencere bantları
ia0, ia1, ip = -hd + 7.5, hd - 3.2, hw - 3.4
box(bm, ia0, ia1, -ip, ip, P0, P0 + PIL_H, MI['stone'])
box(bm, ia0 - 0.05, ia0 + 0.2, -ip + 2.2, ip - 2.2, P0 + 1.0, P0 + PIL_H - 0.6, MI['glass'])      # ön cam/vitray yüzeyi
for s in (-1, 1):                                                                                  # yan pencere bantları
    for k in range(6):
        a = ia0 + 4.0 + k * (ia1 - ia0 - 8.0) / 5
        box(bm, a - 1.2, a + 1.2, s * ip - 0.15, s * ip + 0.15, P0 + 9.0, P0 + 14.5, MI['glass'])
box(bm, -hd + 1.4, ia0, -hw + 1.4, hw - 1.4, P0 + PIL_H - 0.02, P0 + PIL_H, MI['dark'])          # revak tavanı (gölge)
# saçak kuşağı (arşitrav + friz), korniş, çatı katı ve kurşun çatı
box(bm, -hd, hd, -hw, hw, P0 + PIL_H, P0 + PIL_H + ENT_H, MI['stone'])
box(bm, -hd - CORNICE, hd + CORNICE, -hw - CORNICE, hw + CORNICE, P0 + PIL_H + ENT_H, P0 + PIL_H + ENT_H + 0.7, MI['stone'])
box(bm, -hd + 0.4, hd - 0.4, -hw + 0.4, hw - 0.4, P0 + PIL_H + ENT_H + 0.7, P0 + PIL_H + ENT_H + 1.6, MI['stone'])
ztop = P0 + PIL_H + ENT_H + 1.6
r = bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=1.0, radius2=0.0, depth=1.0)
bmesh.ops.rotate(bm, verts=r['verts'], cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 4, 3, 'Z'))
bmesh.ops.scale(bm, vec=((DEPTH - 2.0) / math.sqrt(2), (FRONT_W - 2.0) / math.sqrt(2), 3.2), verts=r['verts'])
bmesh.ops.translate(bm, verts=r['verts'], vec=(0, 0, ztop + 1.6))
for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = MI['roof']
# friz üzerinde ince yatay profil hatları (kabartma hissi)
for z in (P0 + PIL_H + 0.9, P0 + PIL_H + 3.6):
    box(bm, -hd - 0.12, hd + 0.12, -hw - 0.12, hw + 0.12, z, z + 0.22, MI['stone'])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
uvs(bm, TILE_STONE)
me = bpy.data.meshes.new('AnitBlok'); bm.to_mesh(me); bm.free()
for k in ('stone', 'dark', 'glass', 'roof'): me.materials.append(M[k])
ob = link(bpy.data.objects.new('AnitBlok_Yapi', me), 'MODEL')
ob['note'] = 'Ölçüler: peristil 41.65 × 57.35 m, 8 × 14 pilon 1.4 × 1.3 × 16 m; kaide ve basamak yaklaşık'

# ------------------------------------------------------------------ Tören Meydanı cilalı traverten zemin
bm = bmesh.new()
a0, a1, p = SQUARE['a0'], SQUARE['a1'], SQUARE['p']
box(bm, a0, a1, -p, p, -0.6, 0.06, 0)
# meydandan merdivene uzanan bağlantı sahanlığı
box(bm, a1, front - STEPS * run + 0.02, -hw - 4.6, hw + 4.6, -0.6, 0.06, 0)
# Anıt Blok eksenindeki koyu taş şeritler (fotoğraftaki yön çizgileri)
for s in (-1, 1):
    box(bm, a0 + 2, front - STEPS * run, s * 3.2 - 0.18, s * 3.2 + 0.18, 0.06, 0.075, 1)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
uvs(bm, TILE_FLOOR)
me = bpy.data.meshes.new('Meydan'); bm.to_mesh(me); bm.free()
me.materials.append(M['floor']); me.materials.append(M['dark'])
link(bpy.data.objects.new('TorenMeydani_Zemin', me), 'MODEL')

# ------------------------------------------------------------------ çarpışma kutuları
UNIT = bpy.data.meshes.new('COL_Kutu'); b2 = bmesh.new(); bmesh.ops.create_cube(b2, size=1.0); b2.to_mesh(UNIT); b2.free(); UNIT.materials.append(M['col'])
def col(name, a0, a1, p0, p1, z0, z1):
    o = link(bpy.data.objects.new(name, UNIT), 'COLLIDERS'); o.location = L((a0 + a1) / 2, (p0 + p1) / 2, (z0 + z1) / 2); o.scale = (a1 - a0, p1 - p0, z1 - z0); return o
col('COL_Kaide', -hd - PODIUM_PAD, hd + PODIUM_PAD, -hw - PODIUM_PAD, hw + PODIUM_PAD, -1.5, P0)
col('COL_Yapi', -hd - CORNICE, hd + CORNICE, -hw - CORNICE, hw + CORNICE, P0, ztop + 3.2)
for k in range(0, STEPS, 6):   # merdiven: kademeli kutular
    top = P0 * (STEPS - k) / STEPS
    col(f'COL_Merdiven_{k:02d}', front - (k + 6) * run, front - k * run, -hw - 4.6, hw + 4.6, -0.5, top)

# ------------------------------------------------------------------ dışa aktarma
os.makedirs(A.out, exist_ok=True)
def export(coll, fname):
    bpy.ops.object.select_all(action='DESELECT')
    for o in COLL[coll].objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(A.out, fname), export_format='GLB', use_selection=True, export_yup=True,
        export_apply=False, export_animations=False, export_extras=True, export_materials='EXPORT' if coll == 'MODEL' else 'NONE',
        export_image_format='JPEG', export_jpeg_quality=88, export_texcoords=coll == 'MODEL', export_normals=True)
export('MODEL', 'anit-blok.glb'); export('COLLIDERS', 'anit-blok-colliders.glb')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(A.out, 'anit-blok.blend'), compress=True)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in COLL['MODEL'].objects if o.type == 'MESH')
print('[anit_blok]', json.dumps({'tris': tris, 'front_m': FRONT_W, 'depth_m': DEPTH, 'pillars': 2 * NF + 2 * NS - 4,
      'height_above_square_m': round(ztop + 3.2, 1), 'square_m': [a1 - a0, 2 * p], 'stairs_front_a': round(front - STEPS * run, 1)}, ensure_ascii=False))
