# Anıt Blok + Tören Meydanı zemini — Blender (bpy) betiği · Three.js GLTFLoader uyumlu GLB
#
#   blender -b -P tools/blender/anit_blok.py -- --out models
#
# Meshy modelindeki Anıt Blok (yuvarlak, eğri sütunlar, bulanık doku) gerçek ölçülerle yeniden kurulur; Meshy'nin
# meydan zemini üstüne cilalı traverten levha zemin serilir. Revaklar ve kuleler Meshy modelinde kalır.
#
# Ölçüler ve kaynakları:
#   - Peristil 10 × 14 = 44 pilon (köşeler geniş; ön cephe fotoğrafında 10 pilon / 9 aks), dış ölçü 41.65 × 57.35 m; meydana bakan kısa cephe (OSM Türbe poligonu
#     51.0 × 61.9 m, basamak sahanlığıyla; Meshy modeli ve referans fotoğrafla tutarlı)
#   - Pilon yüksekliği 14.4 m, yapı ~17 m (Anıtkabir verisi); pilon kesiti ~1.4 × 1.5 m (fotoğraf oranı)
#   - Tören Meydanı 129 × 84 m (Anıtkabir proje bilgisi); OSM'deki 8 kule meydan eksenini ve genişliğini doğruluyor
#   - Kaide yüksekliği ve basamak sayısı yaklaşık (fotoğraftan): 6.4 m, 42 basamak; merdiven ortasında Hitabet kürsüsü
#   - Merdivenin iki yanında meydana bakan rölyefli teras duvarları ve üstlerinde ateş kaseleri (her yanda 5);
#     rölyef dokusu tools/blender/rolyef.py ile üretilen özgün kompozisyondur (gerçek eserlerin kopyası değildir)
#   - Ön cephede orta üç aks giriş girintisi + bronz ızgaralı kapı, 2–3. ve 7–8. akslarda yazıt panelleri (soyut)
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
NF, NS = 10, 14                        # ön/arka ve yan cephe pilon sayısı (köşeler dahil) → toplam 44 pilon
PIL = (1.40, 1.50)                     # ara pilon kesiti (derinlik × cephe genişliği)
PIL_C = 2.2                            # köşe pilonu (fotoğrafta ara pilonların ~1.5 katı)
PIL_H = 14.4                           # pilon yüksekliği; yapı ~17 m (Wikipedia/Anıtkabir)
PODIUM_H, STEPS = 6.4, 42
PODIUM_PAD = 5.3                       # kaide, peristilden taşma (Meshy kesimini örter)
ENT_H, CORNICE = 2.3, 0.7              # saçak kuşağı yüksekliği ve korniş taşması
STAIR_FOOT = -46.94                    # merdiven ayağı = rölyef duvarlarının ön yüzü (meydan sınırı)
STAIR_HW = 22.4                        # merdiven yarı genişliği (fotoğraf: peristilden biraz geniş)
TERR_P, TERR_BACK = 42.0, -20.0        # rölyefli teras: merdiven yanından revak uçlarına (±42 m), arkaya −20 m
CELLA_REC, CELLA_IP = 5.0, 14.4        # orta üç aksın giriş girintisi, iç kütle yarı genişliği
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
    'bronze': pbr('Bronz_Kase', None, None, 0.5, (0.16, 0.12, 0.08)),
    'marble': pbr('Beyaz_Mermer', None, None, 0.35, (0.90, 0.89, 0.86)),
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

MI = {'stone': 0, 'dark': 1, 'glass': 2, 'roof': 3, 'bronze': 4, 'marble': 5}
bm = bmesh.new()
hw, hd = FRONT_W / 2, DEPTH / 2
P0 = PODIUM_H
front = -hd - PODIUM_PAD
run = (front - STAIR_FOOT) / STEPS
# kaide (iki kademeli)
box(bm, -hd - PODIUM_PAD, hd + PODIUM_PAD, -hw - PODIUM_PAD, hw + PODIUM_PAD, -1.5, P0 - 1.2, MI['stone'])
box(bm, -hd - PODIUM_PAD + 0.6, hd + PODIUM_PAD - 0.6, -hw - PODIUM_PAD + 0.6, hw + PODIUM_PAD - 0.6, P0 - 1.2, P0, MI['stone'])
# büyük merdiven: iki rölyef duvarının arasında, meydandan kaideye
for k in range(STEPS):
    top = P0 * (STEPS - k) / STEPS
    box(bm, front - (k + 1) * run, front - k * run + 0.02, -STAIR_HW, STAIR_HW, -0.5, top, MI['stone'])
# Hitabet kürsüsü: merdivenin alt üçte birinde beyaz mermer blok
KK = 27; ka = front - (KK + 0.5) * run; kz = P0 * (STEPS - KK) / STEPS
box(bm, ka - 0.5, ka + 0.5, -2.7, 2.7, kz - 0.4, kz + 1.05, MI['marble'])
# rölyefli teraslar (merdivenin iki yanı) — ön yüzde rölyef paneli, üstte ateş kaseleri
BOWLS = []
for s in (-1, 1):
    pa, pb = sorted((s * STAIR_HW, s * TERR_P))
    box(bm, STAIR_FOOT, TERR_BACK, pa, pb, -1.5, P0, MI['stone'])
    box(bm, STAIR_FOOT - 0.35, STAIR_FOOT + 0.9, pa - (0.3 if s < 0 else 0), pb + (0.3 if s > 0 else 0), P0 - 0.05, P0 + 0.30, MI['stone'])   # harpuşta
    box(bm, STAIR_FOOT - 0.30, STAIR_FOOT + 0.5, pa, pb, -0.5, 0.55, MI['stone'])                     # alt silme
    for k in range(5):                                                                                    # ateş kaseleri
        p = s * (STAIR_HW + 2.6 + k * (TERR_P - STAIR_HW - 5.2) / 4); a = STAIR_FOOT + 2.6
        box(bm, a - 0.45, a + 0.45, p - 0.45, p + 0.45, P0, P0 + 0.85, MI['stone'])
        r = bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.25, radius2=0.85, depth=0.45)
        bmesh.ops.translate(bm, verts=r['verts'], vec=L(a, p, P0 + 0.85 + 0.225))
        for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = MI['bronze']
        BOWLS.append((a, p))
# peristil pilonları: 10 × 14, köşelerde geniş pilon
def pil(a, p, da, dp):
    box(bm, a - da / 2, a + da / 2, p - dp / 2, p + dp / 2, P0, P0 + PIL_H, MI['stone'])
    box(bm, a - da / 2 - 0.12, a + da / 2 + 0.12, p - dp / 2 - 0.12, p + dp / 2 + 0.12, P0, P0 + 0.45, MI['stone'])
PF = [-hw + PIL_C / 2 + i * (FRONT_W - PIL_C) / (NF - 1) for i in range(NF)]
PS = [-hd + PIL_C / 2 + j * (DEPTH - PIL_C) / (NS - 1) for j in range(NS)]
for sa in (-1, 1):
    for sp in (-1, 1): pil(sa * (hd - PIL_C / 2), sp * (hw - PIL_C / 2), PIL_C, PIL_C)
    for p in PF[1:-1]: pil(sa * (hd - PIL[0] / 2), p, PIL[0], PIL[1])
for sp in (-1, 1):
    for a in PS[1:-1]: pil(a, sp * (hw - PIL[0] / 2), PIL[1], PIL[0])
# iç kütle (Şeref Holü): ön cephede orta üç aksta derin giriş girintisi; dış akslardan yan galeri görünür
ia0, ia1, ip = -hd + 6.6, hd - 4.6, CELLA_IP
pr = PF[6]                                  # girinti kenarı = 4. ve 7. pilon ekseni
box(bm, ia0 + CELLA_REC, ia1, -ip, ip, P0, P0 + PIL_H, MI['stone'])
for s in (-1, 1):
    pa, pb = sorted((s * pr, s * ip)); box(bm, ia0, ia0 + CELLA_REC, pa, pb, P0, P0 + PIL_H, MI['stone'])
    pa, pb = sorted((s * pr, s * (pr - 0.06))); box(bm, ia0 + 0.05, ia0 + CELLA_REC, pa, pb, P0, P0 + PIL_H, MI['dark'])  # girinti yan yüzleri (gölgede)
box(bm, ia0 + CELLA_REC - 0.06, ia0 + CELLA_REC, -pr, pr, P0, P0 + PIL_H, MI['dark'])                                      # girinti arka duvarı
box(bm, ia0, ia0 + CELLA_REC, -pr, pr, P0 + PIL_H - 0.6, P0 + PIL_H, MI['dark'])                                          # girinti tavanı
for s in (-1, 1):                                                                                  # yan pencere bantları
    for k in range(6):
        a = ia0 + 6.0 + k * (ia1 - ia0 - 10.0) / 5
        box(bm, a - 1.1, a + 1.1, s * ip - 0.12, s * ip + 0.12, P0 + 8.5, P0 + 13.6, MI['glass'])
box(bm, -hd + 1.0, hd - 1.0, -hw + 1.0, hw - 1.0, P0 + PIL_H - 0.03, P0 + PIL_H, MI['dark'])        # revak tavanı (gölge)
# saçak kuşağı (arşitrav + friz), diş sırası, korniş, parapet ve alçak kurşun çatı
zE = P0 + PIL_H
box(bm, -hd, hd, -hw, hw, zE, zE + ENT_H, MI['stone'])
for z in (zE + 0.75, zE + ENT_H - 0.75):
    box(bm, -hd - 0.10, hd + 0.10, -hw - 0.10, hw + 0.10, z, z + 0.16, MI['stone'])
nd_f, nd_s = int(FRONT_W / 0.62), int(DEPTH / 0.62)
for i in range(nd_f):                                                                              # diş sırası (dentil)
    p = -hw + 0.31 + i * (FRONT_W - 0.62) / (nd_f - 1)
    for sa in (-1, 1): box(bm, sa * hd - 0.22, sa * hd + 0.22, p - 0.16, p + 0.16, zE + ENT_H - 0.45, zE + ENT_H, MI['stone'])
for j in range(nd_s):
    a = -hd + 0.31 + j * (DEPTH - 0.62) / (nd_s - 1)
    for sp in (-1, 1): box(bm, a - 0.16, a + 0.16, sp * hw - 0.22, sp * hw + 0.22, zE + ENT_H - 0.45, zE + ENT_H, MI['stone'])
box(bm, -hd - CORNICE, hd + CORNICE, -hw - CORNICE, hw + CORNICE, zE + ENT_H, zE + ENT_H + 0.55, MI['stone'])
box(bm, -hd + 0.2, hd - 0.2, -hw + 0.2, hw - 0.2, zE + ENT_H + 0.55, zE + ENT_H + 1.05, MI['stone'])
ztop = zE + ENT_H + 1.05
r = bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=1.0, radius2=0.0, depth=1.0)
bmesh.ops.rotate(bm, verts=r['verts'], cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 4, 3, 'Z'))
bmesh.ops.scale(bm, vec=((DEPTH - 1.6) / math.sqrt(2), (FRONT_W - 1.6) / math.sqrt(2), 1.6), verts=r['verts'])
bmesh.ops.translate(bm, verts=r['verts'], vec=(0, 0, ztop + 0.8 - 0.3))
for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = MI['roof']
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
uvs(bm, TILE_STONE)
me = bpy.data.meshes.new('AnitBlok'); bm.to_mesh(me); bm.free()
for k in ('stone', 'dark', 'glass', 'roof', 'bronze', 'marble'): me.materials.append(M[k])
ob = link(bpy.data.objects.new('AnitBlok_Yapi', me), 'MODEL')
ob['note'] = 'Ölçüler: peristil 41.65 × 57.35 m, 10 × 14 = 44 pilon, pilon 14.4 m; kaide, basamak ve teras yaklaşık (fotoğraf)'

# ------------------------------------------------------------------ özel UV'li yüzeyler: rölyef panelleri, yazıt panelleri, bronz kapı
import importlib.util
_spec = importlib.util.spec_from_file_location('rolyef', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rolyef.py'))
rolyef = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(rolyef)

def grid_panel(name, mat, a, p0, p1, z0, z1, nu, nv, height=None, depth=0.0):
    """a sabit düzlemde (meydana bakan, −a yönü) ızgara; u: p0→p1, v: z0→z1; height[v,u] (üstten satır) ile −a yönüne kabartma."""
    me = bpy.data.meshes.new(name); verts = []; faces = []; uv = []
    for j in range(nv + 1):
        for i in range(nu + 1):
            u, v = i / nu, j / nv; dz = 0.0
            if height is not None:
                hh, ww = height.shape; dz = depth * float(height[int((1 - v) * (hh - 1)), int(u * (ww - 1))])
            verts.append(L(a - dz, p0 + (p1 - p0) * u, z0 + (z1 - z0) * v)); uv.append((u, v))
    for j in range(nv):
        for i in range(nu):
            k = j * (nu + 1) + i; faces.append((k, k + nu + 1, k + nu + 2, k + 1))
    me.from_pydata(verts, [], faces); me.update()
    lay = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices: lay.data[li].uv = uv[me.loops[li].vertex_index]
    # yüz yönü: −a (meydana) baksın
    bmx = bmesh.new(); bmx.from_mesh(me); bmx.normal_update()
    if sum(f.normal.x for f in bmx.faces) > 0:
        for f in bmx.faces: f.normal_flip()
    bmx.to_mesh(me); bmx.free()
    for poly in me.polygons: poly.use_smooth = height is not None
    me.materials.append(mat)
    return link(bpy.data.objects.new(name, me), 'MODEL')

RW, RH = 2048, 560
for s, d, seed, nm in ((-1, 1, 11, 'Sol'), (1, -1, 23, 'Sag')):
    # sol panelde (p < 0) yürüyüş merdivene doğru (+p), sağda −p yönünde
    rgb, nrm, Hh = rolyef.textures(RW, RH, d, seed, base=WARM)
    img = make_image(f'Rolyef_{nm}', rgb); nimg = make_image(f'Rolyef_{nm}_N', nrm, 'Non-Color')
    mat = pbr(f'Rolyef_{nm}', img, nimg, 0.74)
    pa, pb = sorted((s * (STAIR_HW + 1.0), s * (TERR_P - 1.0)))
    grid_panel(f'Rolyef_{nm}', mat, STAIR_FOOT - 0.02, pa, pb, 0.75, P0 - 0.85, 220, 60, Hh, 0.16)

def inscription_tex(seed, w=512, h=1280):
    rng = np.random.default_rng(seed); n = fbm(256, 4, seed)
    base = np.array(WARM) * 0.78; img = base[None, None] * (0.92 + 0.12 * np.kron(n, np.ones((5, 2)))[:h, :w, None])
    gold = np.array((0.86, 0.66, 0.30))
    y = 70
    while y < h - 40:                                               # okunmayan, soyut yazı satırları (altın harf izlenimi)
        x = 40; big = y < 110
        while x < w - 40:
            L_ = int(rng.integers(8, 34)) * (2 if big else 1)
            if x + L_ > w - 40: break
            img[y:y + (14 if big else 8), x:x + L_] = gold * rng.uniform(0.8, 1.0)
            x += L_ + int(rng.integers(6, 12))
        y += 30 if big else 17
    return np.clip(img, 0, 1)

def door_tex(w=256, h=512):
    img = np.ones((h, w, 3)) * np.array((0.62, 0.66, 0.68))       # arkadan aydınlık buzlu cam
    img *= (0.85 + 0.15 * np.linspace(1, 0, h))[:, None, None]
    bz = np.array((0.23, 0.17, 0.10))
    for x in range(0, w, w // 8): img[:, max(0, x - 3):x + 3] = bz
    for y in range(0, h, h // 14): img[max(0, y - 3):y + 3] = bz
    img[:, :8] = bz; img[:, -8:] = bz; img[:8] = bz; img[-8:] = bz
    return img

INS = pbr('Yazit', make_image('Yazit', inscription_tex(5)), None, 0.6)
DOOR = pbr('Bronz_Kapi', make_image('Bronz_Kapi', door_tex()), None, 0.45)
for s in (-1, 1):
    for b0, b1 in ((PF[1], PF[2]), (PF[2], PF[3])):                # 2. ve 3. akslar (ve simetriği)
        lo, hi = sorted((s * abs(b0), s * abs(b1)))
        grid_panel(f'Yazit_{"Sol" if s < 0 else "Sag"}_{abs(b0):.0f}', INS, ia0 - 0.03, lo + 0.9, hi - 0.9, P0 + 0.9, P0 + 11.2, 1, 1)
grid_panel('Bronz_Kapi', DOOR, ia0 + CELLA_REC - 0.09, -2.2, 2.2, P0, P0 + 9.5, 1, 1)

# ------------------------------------------------------------------ Tören Meydanı cilalı traverten zemin
bm = bmesh.new()
a0, a1, p = SQUARE['a0'], SQUARE['a1'], SQUARE['p']
box(bm, a0, a1, -p, p, -0.6, 0.06, 0)
# meydandan merdivene uzanan bağlantı sahanlığı
box(bm, a1, STAIR_FOOT + 0.02, -STAIR_HW, STAIR_HW, -0.6, 0.06, 0) if a1 < STAIR_FOOT else None
# Anıt Blok eksenindeki koyu taş şeritler (fotoğraftaki yön çizgileri)
for s in (-1, 1):
    box(bm, a0 + 2, STAIR_FOOT, s * 3.2 - 0.18, s * 3.2 + 0.18, 0.06, 0.075, 1)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
uvs(bm, TILE_FLOOR)
me = bpy.data.meshes.new('Meydan'); bm.to_mesh(me); bm.free()
me.materials.append(M['floor']); me.materials.append(M['dark'])
link(bpy.data.objects.new('TorenMeydani_Zemin', me), 'MODEL')

# ------------------------------------------------------------------ İnönü revakı (meydanın Anıt Blok karşısındaki revak)
# Zafer Hoca'nın fotoğrafına göre: meydana açık, kare kesitli traverten pilonlu revak; ortasında İsmet İnönü Lahdi
# desenli (kilim motifli) taş döşeme üstünde. Meshy'nin bu bölümdeki revakı prepare-anitkabir.mjs'te kesilir
# (REVAK_CUT); yan revaklar ve köşe kuleleri Meshy'de kalır. Ölçüler yaklaşık (Meshy hacmi + fotoğraf oranları).
RV = dict(a_front=-180.0, a_step=-180.9, a_pil=-182.4, a_wall=-190.0, a_back=-194.6, p=41.5,
          floor=0.45, n=22, mid=5.2, pil=1.15, pil_h=7.4, ent=1.5, cor=0.45, par=0.7)
RV_TOP = 0.06 + RV['floor']
def kilim_tex(w=1024, h=540, seed=7):
    """Lahit çevresi döşemesi: krem traverten zemin, kırmızı-siyah basamaklı üçgen bordür, eşkenar dörtgen alan (geleneksel motif)."""
    y, x = np.mgrid[0:h, 0:w].astype(float)
    cream = np.array((0.86, 0.80, 0.70)); red = np.array((0.50, 0.14, 0.11)); blk = np.array((0.08, 0.075, 0.07))
    n = fbm(512, 4, seed); img = cream[None, None] * (0.93 + 0.1 * (np.kron(n, np.ones((2, 2)))[:h, :w, None] - 0.5))
    B = 70; d = np.minimum(np.minimum(x, w - 1 - x), np.minimum(y, h - 1 - y))
    img[(d >= 8) & (d < 16)] = blk; img[(d >= B - 10) & (d < B - 4)] = blk
    band = (d >= 16) & (d < B - 10)                                   # basamaklı üçgen bordür
    along = np.where(np.minimum(y, h - 1 - y) < np.minimum(x, w - 1 - x), x, y)
    tri = (np.abs((along % 60) - 30) // 6) * 6 + (d - 16) * 0.9 < 30
    img[band & tri] = red
    inner = d >= B                                                    # iç alan: eşkenar dörtgenler
    u = (x - w / 2) / 64.0; v = (y - h / 2) / 48.0
    du = np.abs(u - np.round(u)); dv = np.abs(v - np.round(v)); r = du + dv
    img[inner & (r < 0.36)] = red; img[inner & (r < 0.18)] = blk
    img[inner & (np.abs(r - 0.5) < 0.025)] = blk * 1.5
    return np.clip(img, 0, 1)
KILIM = pbr('Lahit_Doseme', make_image('Lahit_Doseme', kilim_tex()), None, 0.4)
def floor_panel(name, mat, a0, a1, p0, p1, z):
    me = bpy.data.meshes.new(name)
    me.from_pydata([L(a0, p0, z), L(a0, p1, z), L(a1, p1, z), L(a1, p0, z)], [], [(0, 1, 2, 3)]); me.update()
    lay = me.uv_layers.new(name='UVMap'); uvq = [(0, 1), (1, 1), (1, 0), (0, 0)]
    for li in me.polygons[0].loop_indices: lay.data[li].uv = uvq[me.loops[li].vertex_index]
    if me.polygons[0].normal.z < 0: me.polygons[0].flip()
    me.materials.append(mat); return link(bpy.data.objects.new(name, me), 'MODEL')

bm = bmesh.new(); RP = RV['p']
for k in range(3):                                                    # meydandan revak döşemesine 3 basamak
    box(bm, RV['a_front'] - (k + 1) * 0.3, RV['a_front'] - k * 0.3 + 0.02, -RP, RP, -0.6, 0.06 + RV['floor'] * (k + 1) / 3, 0)
box(bm, RV['a_back'], RV['a_step'], -RP, RP, -0.6, RV_TOP, 2)          # revak döşemesi (cilalı traverten)
z1 = RV_TOP + RV['pil_h']
_h = RV['n'] // 2; _p0, _p1 = RV['mid'] / 2 + RV['pil'] / 2, RP - RV['pil'] / 2 - 0.4   # lahdin önünde geniş orta açıklık
PR = sorted(sg * (_p0 + i * (_p1 - _p0) / (_h - 1)) for sg in (-1, 1) for i in range(_h))
for p in PR:
    h = RV['pil'] / 2
    box(bm, RV['a_pil'] - h, RV['a_pil'] + h, p - h, p + h, RV_TOP, z1, 0)
    box(bm, RV['a_pil'] - h - 0.1, RV['a_pil'] + h + 0.1, p - h - 0.1, p + h + 0.1, RV_TOP, RV_TOP + 0.35, 0)     # pilon ayağı
    box(bm, RV['a_pil'] - h - 0.08, RV['a_pil'] + h + 0.08, p - h - 0.08, p + h + 0.08, z1 - 0.3, z1, 0)           # başlık
    box(bm, RV['a_wall'] - 0.01, RV['a_wall'] + 0.22, p - 0.45, p + 0.45, RV_TOP, z1, 0)                           # arka duvar plastırı
    box(bm, RV['a_wall'] + 0.4, RV['a_pil'] - h - 0.3, p - 0.09, p + 0.09, RV_TOP, RV_TOP + 0.01, 1)                # döşeme koyu taş derzi
box(bm, RV['a_back'], RV['a_wall'], -RP, RP, -1.5, z1 + RV['ent'] + 0.45, 0)                                     # arka kütle (iç mekân)
for s in (-1, 1):                                                                                                  # yan uç duvarları
    pa, pb = sorted((s * (RP - 0.5), s * RP)); box(bm, RV['a_back'], RV['a_pil'] + 0.6, pa, pb, RV_TOP, z1, 0)
box(bm, RV['a_back'], RV['a_pil'] + 0.65, -RP, RP, z1, z1 + RV['ent'], 0)                                         # saçak kuşağı
box(bm, RV['a_wall'] + 0.2, RV['a_pil'] - 0.6, -RP + 0.5, RP - 0.5, z1 - 0.03, z1, 0)                              # tavan
for p in PR:                                                                                                       # tavan kirişleri
    box(bm, RV['a_wall'], RV['a_pil'], p - 0.3, p + 0.3, z1 - 0.55, z1, 0)
box(bm, RV['a_back'] - RV['cor'], RV['a_pil'] + 0.65 + RV['cor'], -RP, RP, z1 + RV['ent'], z1 + RV['ent'] + 0.45, 0)   # korniş
box(bm, RV['a_back'] + 0.2, RV['a_pil'] + 0.45, -RP, RP, z1 + RV['ent'] + 0.45, z1 + RV['ent'] + 0.45 + RV['par'], 0)  # korkuluk duvarı
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
uvs(bm, TILE_STONE)
me = bpy.data.meshes.new('Inonu_Revak'); bm.to_mesh(me); bm.free()
for k in ('stone', 'dark', 'floor'): me.materials.append(M[k])
ob = link(bpy.data.objects.new('Inonu_Revaki', me), 'MODEL')
ob['note'] = f'Meydana açık revak, {RV["n"]} kare pilon ({RV["pil"]} m, {RV["pil_h"]} m); ölçüler yaklaşık (Meshy hacmi + fotoğraf)'
LAHIT = dict(a=-186.2, p=0.0)                                       # galeri ortası; lahit modeli oyunda props ile gelir
floor_panel('Inonu_Lahit_Doseme', KILIM, LAHIT['a'] - 2.9, LAHIT['a'] + 2.9, -5.5, 5.5, RV_TOP + 0.015)

# ------------------------------------------------------------------ çarpışma kutuları
UNIT = bpy.data.meshes.new('COL_Kutu'); b2 = bmesh.new(); bmesh.ops.create_cube(b2, size=1.0); b2.to_mesh(UNIT); b2.free(); UNIT.materials.append(M['col'])
def col(name, a0, a1, p0, p1, z0, z1):
    o = link(bpy.data.objects.new(name, UNIT), 'COLLIDERS'); o.location = L((a0 + a1) / 2, (p0 + p1) / 2, (z0 + z1) / 2); o.scale = (a1 - a0, p1 - p0, z1 - z0); return o
col('COL_Kaide', -hd - PODIUM_PAD, hd + PODIUM_PAD, -hw - PODIUM_PAD, hw + PODIUM_PAD, -1.5, P0)
col('COL_Yapi', -hd - CORNICE, hd + CORNICE, -hw - CORNICE, hw + CORNICE, P0, ztop + 1.3)
for k in range(0, STEPS, 6):   # merdiven: kademeli kutular (oyunda zemin sayılır)
    top = P0 * (STEPS - k) / STEPS
    col(f'COL_Merdiven_{k:02d}', front - (k + 6) * run, front - k * run, -STAIR_HW, STAIR_HW, -0.5, top)
for s in (-1, 1):              # rölyefli teraslar (oyunda zemin sayılır; anitkabir.json anitBlok.terraces)
    pa, pb = sorted((s * STAIR_HW, s * TERR_P)); col(f'COL_Kaide_Teras_{"Sol" if s < 0 else "Sag"}', STAIR_FOOT, TERR_BACK, pa, pb, -1.5, P0)
for i, (a, p) in enumerate(BOWLS): col(f'COL_Ates_Kasesi_{i:02d}', a - 0.85, a + 0.85, p - 0.85, p + 0.85, P0, P0 + 1.5)
# İnönü revakı: döşeme oyunda zemin (anitkabir.json → anitBlok.revak); pilonlar, saçak, arka kütle engel
col('COL_Kaide_Revak', RV['a_back'], RV['a_front'], -RP, RP, -0.6, RV_TOP)
for i, p in enumerate(PR): col(f'COL_Revak_Pilon_{i:02d}', RV['a_pil'] - 0.68, RV['a_pil'] + 0.68, p - 0.68, p + 0.68, RV_TOP, z1)
col('COL_Revak_Ust', RV['a_back'] - RV['cor'], RV['a_pil'] + 0.65 + RV['cor'], -RP, RP, z1 - 0.55, z1 + RV['ent'] + 0.45 + RV['par'])
col('COL_Revak_Arka', RV['a_back'], RV['a_wall'] + 0.22, -RP, RP, RV_TOP, z1)
for s in (-1, 1):
    pa, pb = sorted((s * (RP - 0.5), s * RP)); col(f'COL_Revak_Yan_{"Sol" if s < 0 else "Sag"}', RV['a_back'], RV['a_pil'] + 0.6, pa, pb, RV_TOP, z1)
col('COL_Hitabet_Kursusu', ka - 0.5, ka + 0.5, -2.7, 2.7, kz - 0.4, kz + 1.05)

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
print('[anit_blok]', json.dumps({'tris': tris, 'front_m': FRONT_W, 'depth_m': DEPTH, 'pillars': 2 * NF + 2 * NS - 4, 'structure_m': round(PIL_H + ENT_H + 1.05, 2),
      'height_above_square_m': round(ztop + 1.3, 1), 'square_m': [SQUARE['a1'] - SQUARE['a0'], 2 * SQUARE['p']], 'stairs_front_a': STAIR_FOOT, 'pillar_m': PIL_H, 'revak': {'a0': RV['a_back'], 'a1': RV['a_front'], 'p': RP, 'top': RV['floor'], 'pillars': RV['n'], 'height_m': round(RV['floor'] + RV['pil_h'] + RV['ent'] + 0.45 + RV['par'], 2)}, 'lahit': LAHIT, 'terrace': [STAIR_FOOT, TERR_BACK, STAIR_HW, TERR_P]}, ensure_ascii=False))
