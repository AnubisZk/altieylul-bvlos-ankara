# Aslanlı Yol — Blender (bpy) betiği · Three.js GLTFLoader uyumlu GLB'ler (yakın/orta LOD + çarpışma)
#
#   blender -b -P tools/blender/aslanli_yol.py -- --lion <Meshy_AI_Stone_Guardian_….glb> --out models/aslanli-yol
#
# Girdi: data/ank/aslanli-yol.json (tools/ankara/prepare-aslanli-yol.mjs: OSM + GLO-30 yerleşimi, simülatör yerel
#        metre koordinatı), aslan heykeli GLB'si (Meshy). Anıt Blok, Tören Meydanı ve bayrak bu betikte YOKTUR ve
#        değiştirilmez; onlar models/anitkabir.glb ve models/turk-bayragi.glb dosyalarındadır.
# Çıktı: aslanli_yol_master.blend · aslanli_yol_high.glb · aslanli_yol_low.glb · aslanli_yol_colliders.glb
#
# Koordinatlar: kök boş nesne "AslanliYol" yolun başına (merdiven üstü, eksen üzerinde) ve yol yönüne döndürülür;
# alt nesneler yol eksenine göre metre cinsindendir: yerel +X = boyuna (s, Tören Meydanı yönü),
# yerel −Y = enine t (oyundaki işaretle aynı), +Z = yukarı (kök, yol başı yüzey yüksekliğindedir).
# glTF'ye Y-yukarı aktarılır; Three.js'te kök düğüm doğrudan simülatörün yerel metre konumuna oturur.
#
# GLB'ye yalnız gerçek geometri, görüntü dokuları ve PBR değerleri gider. Blender'a özgü prosedürel düğümler,
# değiştiriciler veya parçacıklar kullanılmaz; bütün dokular numpy ile üretilip pakete gömülür.
import bpy, bmesh, math, os, sys, json, argparse, random
import numpy as np
from mathutils import Vector, Matrix, Euler

def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--layout', default='data/ank/aslanli-yol.json')
    p.add_argument('--lion', required=True, help='aslan heykeli GLB (kaliteli ana model)')
    p.add_argument('--out', default='models/aslanli-yol')
    p.add_argument('--lion-length', type=float, default=2.6, help='aslan + kendi kaidesi boyu (m), yaklaşık')
    p.add_argument('--lion-high', type=int, default=6000, help='yakın LOD aslan üçgen hedefi')
    p.add_argument('--lion-low', type=int, default=900, help='orta LOD aslan üçgen hedefi')
    p.add_argument('--visitors', type=int, default=46)
    p.add_argument('--seed', type=int, default=1938)
    return p.parse_args(argv)

A = parse_args()
LAY = json.load(open(A.layout, encoding='utf-8'))
rng = random.Random(A.seed)
LEN, WALK = LAY['length'], LAY['walkWidth']
HW = WALK / 2
RISE = LAY['y1'] - LAY['y0']

def h(s):
    """Yol yüzeyinin kök düğüme göre yüksekliği (m); merdiven bölgesinde merdiven profili."""
    if s >= 0: return RISE * min(max(s / LEN, 0.0), 1.0)
    st = LAY['stairs']; n = st['steps']; d = (st['to'] - st['from']) / n
    k = min(n - 1, max(0, int((s - st['from']) / d)))
    return -1.0 + (k + 1) / n

def P(s, t, z=0.0):            # yol eksenine göre (boyuna s, enine t, yükseklik) → yerel Blender konumu
    return Vector((s, -t, z))

# ------------------------------------------------------------------ sahne
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
COLL = {}
for name in ('HIGH', 'LOW', 'COLLIDERS', 'SOURCE'):
    c = bpy.data.collections.new(name); scene.collection.children.link(c); COLL[name] = c

def root(name, coll):
    o = bpy.data.objects.new(name, None); COLL[coll].objects.link(o)
    sx, sz = LAY['start']
    o.location = (sx, -sz, LAY['y0'])                 # oyun (x, z) → Blender (x, −z)
    o.rotation_euler = (0, 0, LAY['rotationY'])
    o['lod'] = coll
    return o

ROOT = {'HIGH': root('AslanliYol', 'HIGH'), 'LOW': root('AslanliYol_Low', 'LOW'), 'COLLIDERS': root('AslanliYol_Colliders', 'COLLIDERS')}

def link(ob, coll, parent=True):
    COLL[coll].objects.link(ob)
    if parent: ob.parent = ROOT[coll]
    return ob

# ------------------------------------------------------------------ dokular (numpy, gömülü)
def make_image(name, rgb, alpha=None, colorspace='sRGB'):
    hgt, wid = rgb.shape[:2]
    a = np.ones((hgt, wid, 1)) if alpha is None else alpha[..., None]
    px = np.concatenate([np.clip(rgb, 0, 1), a], axis=2)[::-1].astype(np.float32)
    img = bpy.data.images.new(name, wid, hgt, alpha=alpha is not None)
    img.colorspace_settings.name = colorspace
    img.pixels.foreach_set(px.ravel()); img.pack()
    return img

def fbm(n, octaves=5, seed=0):
    r = np.random.default_rng(seed); out = np.zeros((n, n)); amp = 1.0; tot = 0
    for o in range(octaves):
        g = 4 * 2 ** o
        base = r.random((g + 1, g + 1)); base[-1, :] = base[0, :]; base[:, -1] = base[:, 0]   # döşenebilir
        xs = np.linspace(0, g, n, endpoint=False); i = xs.astype(int); f = xs - i; f = f * f * (3 - 2 * f)
        row = base[i][:, i] * (1 - f)[None, :] + base[i][:, i + 1] * f[None, :]
        row2 = base[i + 1][:, i] * (1 - f)[None, :] + base[i + 1][:, i + 1] * f[None, :]
        out += amp * (row * (1 - f)[:, None] + row2 * f[:, None]); tot += amp; amp *= 0.5
    return out / tot

TILE = 4.8      # bir doku tekrarının gerçek boyu (m): 4 × 3 levha, levha 1.20 × 1.60 m

def travertine_textures(n=1024):
    v = fbm(n, 6, 11); v2 = fbm(n, 4, 12)
    # yatay damarlar (traverten tabakalanması) + küçük gözenekler
    yy = np.linspace(0, 1, n, endpoint=False)[:, None]
    veins = 0.5 + 0.5 * np.sin((yy * 9 + v2 * 1.6) * 2 * np.pi)
    pores = (np.random.default_rng(3).random((n, n)) > 0.996).astype(float)
    base = np.array([0.86, 0.80, 0.69])
    tone = 0.92 + 0.10 * (v - 0.5) + 0.035 * (veins - 0.5) - 0.18 * pores
    # levha derzleri: 4 sütun × 3 satır, sıralar yarım kaydırmalı
    x = np.linspace(0, 1, n, endpoint=False)[None, :].repeat(n, 0); y = yy.repeat(n, 1)
    row = np.floor(y * 3); xs = (x * 4 + 0.5 * (row % 2)) % 1.0; ys = (y * 3) % 1.0
    jw = 0.006
    joint = np.minimum(np.minimum(xs, 1 - xs) * 4 / 1, np.minimum(ys, 1 - ys) * 3 / 1)
    jmask = np.clip(1 - joint / jw, 0, 1)
    rgb = base[None, None, :] * tone[..., None] * (1 - 0.22 * jmask[..., None])
    # levha başına hafif ton farkı
    slab = np.random.default_rng(5).random((3, 4))
    sid = slab[(row % 3).astype(int), np.floor((x * 4 + 0.5 * (row % 2)) % 4).astype(int)]
    rgb *= (0.97 + 0.06 * sid)[..., None]
    # normal haritası: derz oluğu + yüzey dokusu
    height = -jmask * 1.0 + 0.15 * v + 0.6 * pores * -1
    gy, gx = np.gradient(height)
    nrm = np.dstack([-gx * 6, gy * 6, np.ones_like(gx)]); nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
    return make_image('Traverten_Renk', rgb), make_image('Traverten_Normal', nrm * 0.5 + 0.5, colorspace='Non-Color')

def grass_texture(n=512):
    v = fbm(n, 6, 21); w = fbm(n, 3, 22)
    rgb = np.dstack([0.20 + 0.10 * v, 0.36 + 0.16 * v + 0.05 * w, 0.12 + 0.05 * w])
    return make_image('Cim', rgb)

def flower_texture(n=512):
    r = np.random.default_rng(31); rgb = np.dstack([0.16 + 0.05 * fbm(n, 4, 33), 0.30 + 0.10 * fbm(n, 4, 34), 0.10 + 0.0 * fbm(n, 2, 35)])
    yy, xx = np.mgrid[0:n, 0:n]
    for _ in range(900):        # kırmızı ve beyaz çiçek kümeleri (Anıtkabir tarhlarındaki mevsimlik çiçekler, temsili)
        cx, cy, rad = r.integers(0, n), r.integers(0, n), r.uniform(2.5, 5.5)
        col = np.array([0.80, 0.08, 0.10]) if r.random() < 0.8 else np.array([0.93, 0.92, 0.88])
        dx = np.minimum(abs(xx - cx), n - abs(xx - cx)); dy = np.minimum(abs(yy - cy), n - abs(yy - cy))
        m = (dx * dx + dy * dy) < rad * rad
        rgb[m] = col * r.uniform(0.85, 1.05)
    return make_image('Cicek_Tarhi', rgb)

def bark_texture(n=256):
    v = fbm(n, 5, 41); x = np.linspace(0, 1, n)[None, :]
    rgb = np.dstack([0.30 + 0.10 * v, 0.22 + 0.07 * v, 0.16 + 0.05 * v]) * (0.85 + 0.15 * np.sin(x * 60 + v * 8))[..., None]
    return make_image('Ardic_Kabuk', rgb)

TRAV, TRAV_N = travertine_textures()
GRASS, FLOWERS, BARK = grass_texture(), flower_texture(), bark_texture()

def pbr(name, color=(1, 1, 1), image=None, normal=None, rough=0.8, metal=0.0, vcol=False, factor=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; m.use_backface_culling = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    b.inputs['Base Color'].default_value = (*color, 1)
    if image is not None:   # glTF'ye doğrudan baseColorTexture olarak gider (ara düğüm yok)
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = image
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    elif vcol:
        a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'
        nt.links.new(a.outputs['Color'], b.inputs['Base Color'])
    if normal is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = normal
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.8
        nt.links.new(t.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m

M = {
    'trav': pbr('Traverten', image=TRAV, normal=TRAV_N, rough=0.74),
    'trav_dark': pbr('Traverten_Bordur', color=(0.86, 0.83, 0.77), image=TRAV, normal=TRAV_N, rough=0.7),
    'grass': pbr('Cim', image=GRASS, rough=0.95),
    'flower': pbr('Cicek', image=FLOWERS, rough=0.9),
    'bark': pbr('Ardic_Govde', image=BARK, rough=0.9),
    'juniper': pbr('Ardic_Yaprak', vcol=True, rough=0.88),
    'tower': pbr('Kule_Taşı', color=(0.95, 0.92, 0.86), image=TRAV, normal=TRAV_N, rough=0.72),
    'col': pbr('Carpisma', color=(1, 0, 1), rough=1.0),
}
VIS_COLORS = [((0.12, 0.18, 0.32), (0.10, 0.10, 0.12)), ((0.62, 0.12, 0.10), (0.16, 0.18, 0.24)), ((0.85, 0.85, 0.80), (0.20, 0.22, 0.28)),
              ((0.20, 0.35, 0.22), (0.30, 0.25, 0.20)), ((0.55, 0.45, 0.30), (0.12, 0.12, 0.14)), ((0.25, 0.25, 0.28), (0.45, 0.40, 0.35))]
SKIN = [(0.80, 0.62, 0.50), (0.66, 0.48, 0.36), (0.55, 0.38, 0.28)]

# ------------------------------------------------------------------ mesh yardımcıları
def mesh_from_bm(name, bm, mats):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    return me

def world_uv(bm, scale=TILE):
    """Planar UV: yerel x/y metre / scale (doku gerçek ölçüde döşenir)."""
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for l in f.loops:
            co = l.vert.co
            if abs(n.z) > 0.6: l[uv].uv = (co.x / scale, co.y / scale)
            elif abs(n.x) > abs(n.y): l[uv].uv = (co.y / scale, co.z / scale)
            else: l[uv].uv = (co.x / scale, co.z / scale)

def slab(bm, s0, s1, t0, t1, top_off=0.0, depth=1.2, seg=6.0, mat=0):
    """Eğimli yüzey levhası (yolun eğimini izler) + yan etekler. Yükseklik h(s) + top_off."""
    n = max(1, int(math.ceil((s1 - s0) / seg)))
    ss = [s0 + (s1 - s0) * i / n for i in range(n + 1)]
    top = [[bm.verts.new(P(s, t, h(s) + top_off)) for t in (t0, t1)] for s in ss]
    bot = [[bm.verts.new(P(s, t, h(s) + top_off - depth)) for t in (t0, t1)] for s in ss]
    faces = []
    for i in range(n):
        faces.append(bm.faces.new((top[i][0], top[i + 1][0], top[i + 1][1], top[i][1])))
        faces.append(bm.faces.new((bot[i][0], bot[i][1], bot[i + 1][1], bot[i + 1][0])))
        faces.append(bm.faces.new((top[i][0], bot[i][0], bot[i + 1][0], top[i + 1][0])))
        faces.append(bm.faces.new((top[i][1], top[i + 1][1], bot[i + 1][1], bot[i][1])))
    faces.append(bm.faces.new((top[0][0], top[0][1], bot[0][1], bot[0][0])))
    faces.append(bm.faces.new((top[-1][0], bot[-1][0], bot[-1][1], top[-1][1])))
    for f in faces: f.material_index = mat
    return faces

def box(bm, center, size, rot_z=0.0, mat=0):
    r = bmesh.ops.create_cube(bm, size=1.0)
    vs = r['verts']
    bmesh.ops.scale(bm, vec=size, verts=vs)
    bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(rot_z, 3, 'Z'))
    bmesh.ops.translate(bm, verts=vs, vec=center)
    for f in {f for v in vs for f in v.link_faces}: f.material_index = mat
    return vs

def strip_ranges():
    st = LAY['strips']; n = st['count']; (a0, a1), (b0, b1) = st['first'], st['last']
    period = (b0 - a0) / (n - 1); length = ((a1 - a0) + (b1 - b0)) / 2
    return [(a0 + i * period, a0 + i * period + length) for i in range(n)]

STRIPS = strip_ranges()
LAT0, LAT1 = LAY['strips']['lateral']
PAVED = LAY['paved']['halfWidth']

# ------------------------------------------------------------------ yol zemini (HIGH ve LOW aynı yapı, LOW daha az parça)
def build_ground(coll, detailed):
    bm = bmesh.new()
    seg = 6.0 if detailed else 30.0
    slab(bm, 0, LEN, -HW, HW, 0.0, seg=seg, mat=0)                                   # yürüyüş yolu 12.80 m
    for sgn in (-1, 1):
        a, b = sorted((sgn * HW, sgn * (HW + 0.35)))
        slab(bm, 0, LEN, a, b, 0.12, depth=1.3, seg=seg, mat=1)                         # iç bordür
        a, b = sorted((sgn * LAT1, sgn * (LAT1 + 0.35)))
        slab(bm, 0, LEN, a, b, 0.12, depth=1.3, seg=seg, mat=1)                         # dış bordür
        a, b = sorted((sgn * (LAT1 + 0.35), sgn * PAVED))
        slab(bm, 0, LEN, a, b, 0.0, seg=seg, mat=0)                                      # dış kaldırım
        # çim şeritler arası (aslan grupları) taş zemin
        edges = [0.0] + [v for r in STRIPS for v in r] + [LEN]
        for i in range(0, len(edges), 2):
            s0, s1 = edges[i], edges[i + 1]
            if s1 - s0 > 0.2:
                a, b = sorted((sgn * (HW + 0.35), sgn * LAT1)); slab(bm, s0, s1, a, b, 0.0, seg=seg, mat=0)
        for s0, s1 in STRIPS:
            a, b = sorted((sgn * (HW + 0.35), sgn * LAT1))
            slab(bm, s0, s1, a, b, 0.05, seg=seg, mat=2)                                 # çim şerit
            if detailed:
                c = sgn * (HW + 0.35 + LAT1) / 2
                slab(bm, s0 + 1.0, s1 - 1.0, c - 0.65, c + 0.65, 0.17, depth=0.3, seg=seg, mat=3)   # çiçek tarhı
        a, b = sorted((sgn * PAVED, sgn * 26.0))
        slab(bm, 16.0, LEN, a, b, -0.15, seg=seg, mat=2)                                 # yan yeşil alan
    # başlangıç merdiveni (6 basamak, ~1 m), iki yanında sahanlık
    st = LAY['stairs']; n = st['steps']; d = (st['to'] - st['from']) / n
    for k in range(n):
        s0 = st['from'] + k * d; top = -1.0 + (k + 1) / n
        box(bm, P(s0 + d / 2 + (n - k - 1) * d / 2, 0, top - 0.6), (d * (n - k), 2 * st['halfWidth'], 1.2), mat=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)      # kapalı levhalar: normaller dışa
    world_uv(bm)
    me = mesh_from_bm('Zemin' + ('' if detailed else '_Low'), bm, [M['trav'], M['trav_dark'], M['grass'], M['flower']])
    for p in me.polygons: p.use_smooth = False
    ob = link(bpy.data.objects.new('Zemin' if detailed else 'Zemin_Low', me), coll)
    ob['part'] = 'ground'
    return ob

# ------------------------------------------------------------------ kuleler ve heykel kaideleri (temsili kütleler)
def build_towers(coll, detailed):
    bm = bmesh.new()
    for tw in LAY['towers']:
        s0, s1 = tw['along']; t0, t1 = tw['lateral']; cs, ct = (s0 + s1) / 2, (t0 + t1) / 2
        w, dpt = s1 - s0, t1 - t0; base = h(cs)
        box(bm, P(cs, ct, base + 0.6), (w + 1.2, dpt + 1.2, 1.2), mat=0)              # kaide
        box(bm, P(cs, ct, base + 1.2 + 6.5), (w, dpt, 13.0), mat=0)                   # gövde
        box(bm, P(cs, ct, base + 14.2 + 0.35), (w + 0.8, dpt + 0.8, 0.7), mat=0)     # saçak
        r = bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=(w + 0.8) / math.sqrt(2), radius2=0.3, depth=2.4)
        bmesh.ops.rotate(bm, verts=r['verts'], cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 4, 3, 'Z'))
        bmesh.ops.translate(bm, verts=r['verts'], vec=P(cs, ct, base + 14.9 + 1.2))
        if detailed:   # cephe nişleri (yalnız yol tarafı ve ön/arka): koyu girinti panelleri
            for k in range(3):
                for face_t, sgn in ((t0, -1), (t1, 1)):
                    if abs(face_t) > abs(ct): continue
                    box(bm, P(s0 + 2.5 + k * 4.0, face_t - 0.05 * (1 if ct > 0 else -1), base + 7.5), (2.2, 0.16, 7.5), mat=1)
        # heykel grubu kaidesi (heykeller için ayrı model gerekir; burada yalnız kaide)
        tt = (abs(ct) - 9.0) * (1 if ct > 0 else -1)
        box(bm, P(6.0, (HW + 3.0) * (1 if ct > 0 else -1), base + 0.8), (6.0, 2.6, 1.6), mat=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    world_uv(bm)
    me = mesh_from_bm('Kuleler' + ('' if detailed else '_Low'), bm, [M['tower'], M['trav_dark']])
    ob = link(bpy.data.objects.new('Kuleler' if detailed else 'Kuleler_Low', me), coll)
    ob['part'] = 'towers'; ob['note'] = 'Hürriyet ve İstiklal kuleleri: temsili kütle; heykel grupları için ayrı model gerekir'
    return ob

# ------------------------------------------------------------------ aslan heykeli (ana model + bağlı kopyalar)
def import_lion():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=A.lion)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    for o in new:
        for c in o.users_collection: c.objects.unlink(o)
        COLL['SOURCE'].objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    src = bpy.context.view_layer.objects.active
    mw = src.matrix_world.copy(); src.parent = None; src.matrix_world = mw
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o is not src and o.name in bpy.data.objects: bpy.data.objects.remove(o, do_unlink=True)
    # Meshy aslanı glTF +Z yönüne bakar → Blender −Y; +X (yol boyunca, Anıt Blok'a doğru) yönüne çevir
    me = src.data
    me.transform(Matrix.Rotation(math.pi / 2, 4, 'Z'))
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    length = max(xs) - min(xs); s = A.lion_length / length
    me.transform(Matrix.Translation((-(max(xs) + min(xs)) / 2, -(max(ys) + min(ys)) / 2, -min(zs))))
    me.transform(Matrix.Scale(s, 4))
    me.update()
    src.name = 'Aslan_Kaynak'; src.hide_render = True
    dims = (length * s, (max(ys) - min(ys)) * s, (max(zs) - min(zs)) * s)
    return src, dims, len(me.polygons)

def decimated_copy(src, name, target_tris, tex_size):
    me = src.data.copy(); me.name = name
    ob = bpy.data.objects.new(name, me); COLL['SOURCE'].objects.link(ob)
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    mod = ob.modifiers.new('dec', 'DECIMATE'); mod.ratio = min(1.0, target_tris / max(1, tris)); mod.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    newme = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); newme.name = name
    ob.modifiers.clear(); ob.data = newme; bpy.data.meshes.remove(me)
    for p in newme.polygons: p.use_smooth = True
    # malzeme: dokuları hedef boyuta indir (8K kaynak → 2048 / 512)
    mats = []
    for m in src.data.materials:
        mm = m.copy(); mm.name = f'{m.name}_{name}'
        for n in mm.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                img = n.image.copy(); img.name = f'{n.image.name}_{tex_size}'
                if max(img.size) > tex_size: img.scale(tex_size, tex_size)
                img.pack(); n.image = img
        b = mm.node_tree.nodes.get('Principled BSDF')
        if b: b.inputs['Metallic'].default_value = 0.0      # taş: metal değil
        mats.append(mm)
    newme.materials.clear()
    for mm in mats: newme.materials.append(mm)
    return ob, sum(len(p.vertices) - 2 for p in newme.polygons)

LION_SRC, LION_DIMS, LION_SRC_TRIS = import_lion()
LION_HI, LION_HI_TRIS = decimated_copy(LION_SRC, 'Aslan_High', A.lion_high, 2048)
LION_LO, LION_LO_TRIS = decimated_copy(LION_SRC, 'Aslan_Low', A.lion_low, 512)

def lion_positions():
    """6 boşluk × 2 yan × 2 aslan = 24. Her boşlukta iki aslan art arda; karşı yandaki çift simetrik."""
    out = []
    for i in range(len(STRIPS) - 1):
        gap0, gap1 = STRIPS[i][1], STRIPS[i + 1][0]; c = (gap0 + gap1) / 2
        for sgn in (-1, 1):
            for ds in (-2.05, 2.05):
                out.append((c + ds, sgn * (HW + 0.35 + LAT1) / 2, sgn))
    return out

LIONS = lion_positions()
PED = (LION_DIMS[0] + 0.3, LION_DIMS[1] + 0.3, 0.45)

def place_lions(coll, src_mesh, suffix):
    ped_bm = bmesh.new(); box(ped_bm, Vector((0, 0, PED[2] / 2)), PED, mat=0); world_uv(ped_bm)
    ped_me = mesh_from_bm('Aslan_Kaidesi' + suffix, ped_bm, [M['trav_dark']])
    for i, (s, t, sgn) in enumerate(LIONS):
        z = h(s)
        ped = link(bpy.data.objects.new(f'Kaide_{i:02d}{suffix}', ped_me), coll); ped.location = P(s, t, z)
        lion = link(bpy.data.objects.new(f'Aslan_{i:02d}{suffix}', src_mesh), coll)   # bağlı kopya: aynı mesh verisi
        lion.location = P(s, t, z + PED[2]); lion['part'] = 'lion'; lion['side'] = 'sol' if sgn < 0 else 'sag'

place_lions('HIGH', LION_HI.data, '')
place_lions('LOW', LION_LO.data, '_Low')

# ------------------------------------------------------------------ ardıç ağaçları (sütun biçimli, doğal kümeler)
def juniper_mesh(name, seed, detailed):
    r = random.Random(seed); bm = bmesh.new()
    H = r.uniform(6.0, 8.5); R = r.uniform(0.95, 1.3)
    col = bm.loops.layers.color.new('Col')
    # gövde
    t = bmesh.ops.create_cone(bm, cap_ends=False, segments=6 if detailed else 4, radius1=0.16, radius2=0.10, depth=1.4)
    bmesh.ops.translate(bm, verts=t['verts'], vec=(0, 0, 0.7))
    trunk_faces = {f for v in t['verts'] for f in v.link_faces}
    for f in trunk_faces: f.material_index = 0
    lobes = 11 if detailed else 3
    for k in range(lobes):
        u = (k + 0.5) / lobes
        zc = 0.9 + u * (H - 1.2)
        prof = R * (math.sin(math.pi * min(1, (u * 0.92 + 0.08))) ** 0.75) * (1.0 - 0.35 * u)
        rx = prof * r.uniform(0.7, 1.05); ry = prof * r.uniform(0.7, 1.05); rz = (H - 1.2) / lobes * r.uniform(1.2, 1.9)
        s = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        vs = s['verts']
        for v in vs:      # düzensiz yüzey: düşük frekanslı bozulma (yapay koni/küre görünümünü kırar)
            n = v.co.normalized(); j = 1 + 0.18 * math.sin(3.1 * n.x + seed) * math.cos(2.7 * n.y + k) + r.uniform(-0.08, 0.08)
            v.co = Vector((n.x * rx * j, n.y * ry * j, n.z * rz * j))
        off = Vector((r.uniform(-0.28, 0.28) * prof, r.uniform(-0.28, 0.28) * prof, zc + r.uniform(-0.15, 0.15)))
        bmesh.ops.translate(bm, verts=vs, vec=off)
        for f in {f for v in vs for f in v.link_faces}:
            f.material_index = 1; f.smooth = True
            for l in f.loops:   # ardıç tonu: koyu mavimsi yeşil, içe doğru koyulaşan
                shade = 0.72 + 0.38 * max(0.0, (l.vert.co - off).normalized().dot(Vector((0.3, -0.3, 0.9)))) + r.uniform(-0.07, 0.07)
                l[col] = (min(1, 0.20 * shade), min(1, 0.33 * shade), min(1, 0.24 * shade), 1.0)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops: l[uv].uv = (math.atan2(l.vert.co.y, l.vert.co.x) / (2 * math.pi), l.vert.co.z / 2)
    me = mesh_from_bm(name, bm, [M['bark'], M['juniper']])
    return me, H, R

JUNIPERS = {}
for d, coll in ((True, 'HIGH'), (False, 'LOW')):
    JUNIPERS[coll] = [juniper_mesh(f'Ardic_{"High" if d else "Low"}_{v}', 70 + v, d) for v in range(4)]
TREE_SPOTS = []
for sgn in (-1, 1):
    for row_t in (17.6, 21.4):
        s = 18.0 + rng.uniform(0, 3)
        while s < LEN - 4:
            TREE_SPOTS.append((s + rng.uniform(-0.8, 0.8), sgn * (row_t + rng.uniform(-0.5, 0.5)), rng.randrange(4), rng.uniform(0, math.tau), rng.uniform(0.88, 1.12)))
            s += rng.uniform(5.6, 7.2)
for coll in ('HIGH', 'LOW'):
    for i, (s, t, v, yaw, sc) in enumerate(TREE_SPOTS):
        me, H, R = JUNIPERS[coll][v]
        ob = link(bpy.data.objects.new(f'Ardic_{i:03d}{"" if coll == "HIGH" else "_Low"}', me), coll)
        ob.location = P(s, t, h(s) - 0.15); ob.rotation_euler = (0, 0, yaw); ob.scale = (sc, sc, sc); ob['part'] = 'tree'

# ------------------------------------------------------------------ ziyaretçiler (gerçek boy, düşük poligon)
def person_mesh(name, shirt, pants, skin):
    bm = bmesh.new()
    def cyl(r1, r2, d, z, x=0.0, y=0.0, seg=6, mat=0, sx=1.0):
        c = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=d)
        bmesh.ops.scale(bm, vec=(sx, 1, 1), verts=c['verts'])
        bmesh.ops.translate(bm, verts=c['verts'], vec=(x, y, z))
        for f in {f for v in c['verts'] for f in v.link_faces}: f.material_index = mat
    for y in (-0.09, 0.09): cyl(0.075, 0.06, 0.86, 0.43, y=y, mat=1)          # bacaklar
    cyl(0.19, 0.17, 0.62, 1.17, mat=0, sx=0.62)                                # gövde
    for y in (-0.22, 0.22): cyl(0.05, 0.045, 0.6, 1.12, y=y, mat=0)            # kollar
    hd = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.105)
    bmesh.ops.translate(bm, verts=hd['verts'], vec=(0, 0, 1.6))
    for f in {f for v in hd['verts'] for f in v.link_faces}: f.material_index = 2
    for f in bm.faces: f.smooth = True
    return mesh_from_bm(name, bm, [pbr(name + '_Ust', shirt, rough=0.9), pbr(name + '_Alt', pants, rough=0.9), pbr(name + '_Ten', skin, rough=0.7)])

PEOPLE = [person_mesh(f'Ziyaretci_{k}', VIS_COLORS[k][0], VIS_COLORS[k][1], SKIN[k % 3]) for k in range(len(VIS_COLORS))]
spots = []
tries = 0
while len(spots) < A.visitors and tries < 5000:
    tries += 1
    # gruplar hâlinde (1–4 kişi), yürüyüş yolu boyunca; aslanların önünde biraz daha yoğun
    s = rng.uniform(4, LEN - 6); t = rng.uniform(-HW + 0.8, HW - 0.8)
    group = rng.choice((1, 1, 2, 2, 3, 4)); heading = rng.choice((0.0, math.pi)) + rng.uniform(-0.35, 0.35)
    for g in range(group):
        ps, pt = s + rng.uniform(-1.2, 1.2), t + rng.uniform(-0.9, 0.9)
        if abs(pt) > HW - 0.4 or any(math.hypot(ps - q[0], pt - q[1]) < 0.9 for q in spots): continue
        spots.append((ps, pt, heading + rng.uniform(-0.4, 0.4), rng.uniform(0.92, 1.08), rng.randrange(len(PEOPLE))))
        if len(spots) >= A.visitors: break
for i, (s, t, yaw, sc, v) in enumerate(spots):
    ob = link(bpy.data.objects.new(f'Ziyaretci_{i:02d}', PEOPLE[v]), 'HIGH')
    ob.location = P(s, t, h(s)); ob.rotation_euler = (0, 0, yaw); ob.scale = (sc, sc, sc); ob['part'] = 'visitor'

# ------------------------------------------------------------------ zemin ve kuleler
build_ground('HIGH', True); build_ground('LOW', False)
build_towers('HIGH', True); build_towers('LOW', False)

# ------------------------------------------------------------------ çarpışma geometrisi (basit kutular)
UNIT = bpy.data.meshes.new('COL_Kutu'); bmc = bmesh.new(); bmesh.ops.create_cube(bmc, size=1.0); bmc.to_mesh(UNIT); bmc.free()
UNIT.materials.append(M['col'])
def collider(name, center, size, yaw=0.0):
    ob = link(bpy.data.objects.new(name, UNIT), 'COLLIDERS'); ob.location = center; ob.scale = size; ob.rotation_euler = (0, 0, yaw)
    ob['collider'] = 'box'; return ob
for i, (s, t, sgn) in enumerate(LIONS):
    z = h(s); hgt = PED[2] + LION_DIMS[2]
    collider(f'COL_Aslan_{i:02d}', P(s, t, z + hgt / 2), (PED[0], PED[1], hgt))
for i, (s, t, v, yaw, sc) in enumerate(TREE_SPOTS):
    me, H, R = JUNIPERS['HIGH'][v]
    collider(f'COL_Ardic_{i:03d}', P(s, t, h(s) + H * sc / 2), (1.5 * R * sc, 1.5 * R * sc, H * sc))
for tw in LAY['towers']:
    s0, s1 = tw['along']; t0, t1 = tw['lateral']; cs, ct = (s0 + s1) / 2, (t0 + t1) / 2
    collider(f'COL_{tw["name"].replace(" ", "_")}', P(cs, ct, h(cs) + 8.6), (s1 - s0 + 1.2, t1 - t0 + 1.2, 17.2))
    collider(f'COL_Heykel_Kaidesi_{"sag" if ct > 0 else "sol"}', P(6.0, (HW + 3.0) * (1 if ct > 0 else -1), h(6.0) + 0.8), (6.0, 2.6, 1.6))
st = LAY['stairs']; n = st['steps']; d = (st['to'] - st['from']) / n
for k in range(n):
    s0 = st['from'] + k * d; top = -1.0 + (k + 1) / n
    collider(f'COL_Basamak_{k}', P(s0 + d / 2, 0, top - 0.6), (d, 2 * st['halfWidth'], 1.2))

# ------------------------------------------------------------------ dışa aktarma
os.makedirs(A.out, exist_ok=True)
def export(coll, fname, instances=True):
    bpy.ops.object.select_all(action='DESELECT')
    for o in COLL[coll].objects: o.select_set(True)
    path = os.path.join(A.out, fname)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
        export_animations=False, export_morph=False, export_extras=True, export_materials='EXPORT' if coll != 'COLLIDERS' else 'NONE',
        export_image_format='JPEG', export_jpeg_quality=86, export_texcoords=coll != 'COLLIDERS', export_normals=True,
        export_gpu_instances=instances)
    return path
paths = {k: export(k, f, k != 'COLLIDERS') for k, f in (('HIGH', 'aslanli_yol_high.glb'), ('LOW', 'aslanli_yol_low.glb'), ('COLLIDERS', 'aslanli_yol_colliders.glb'))}
# master .blend: 8K kaynak aslan çıkarılır (dosya ~130 MB olurdu); yakın/orta LOD aslanları ve 2048/512 dokular kalır.
# Kaynağı yeniden işlemek için betik --lion ile yeniden çalıştırılır.
src_imgs = {n.image for m in LION_SRC.data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image}
src_mats = list(LION_SRC.data.materials); src_me = LION_SRC.data
bpy.data.objects.remove(LION_SRC, do_unlink=True); bpy.data.meshes.remove(src_me)
for m in src_mats: bpy.data.materials.remove(m)
for i in src_imgs: bpy.data.images.remove(i)
scene['lion_source'] = os.path.basename(A.lion)
bpy.ops.outliner.orphans_purge(do_recursive=True) if bpy.context.area else None
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(A.out, 'aslanli_yol_master.blend'), compress=True)

def tri_count(coll):
    total = 0
    for o in COLL[coll].objects:
        if o.type == 'MESH': total += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return total
report = {
    'length_m': LEN, 'walk_width_m': WALK, 'osm_length_m': LAY['osmLength'], 'lions': len(LIONS),
    'lion_dims_m': [round(v, 2) for v in LION_DIMS], 'lion_tris': {'source': LION_SRC_TRIS, 'high': LION_HI_TRIS, 'low': LION_LO_TRIS},
    'trees': len(TREE_SPOTS), 'visitors': len(spots), 'colliders': len(COLL['COLLIDERS'].objects) - 1,
    'scene_tris': {'high': tri_count('HIGH'), 'low': tri_count('LOW')},
    'files_mb': {k: round(os.path.getsize(p) / 1e6, 2) for k, p in paths.items()},
}
json.dump(report, open(os.path.join(A.out, 'rapor.json'), 'w'), indent=1, ensure_ascii=False)
print('[aslanli_yol]', json.dumps(report, ensure_ascii=False))
