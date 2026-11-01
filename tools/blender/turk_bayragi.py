# Türk bayrağı ve direği — Blender (bpy) betiği · Three.js uyumlu, 120 karelik döngülü morph target animasyonu
#
# Çalıştırma (arayüzsüz):
#   blender -b -P tools/blender/turk_bayragi.py -- --out models --wind-speed 8 --wind-dir 0
#   blender -b -P tools/blender/turk_bayragi.py -- --anitkabir <Meshy_AI_Anıtkabir_….glb>   (referans olarak içe aktarır)
# Blender içinden: Scripting sekmesinde açıp "Run Script" (varsayılan ayarlarla çalışır).
#
# Çıktılar:  <out>/turk-bayragi.blend  (düzenlenebilir)   <out>/turk-bayragi.glb  (FlagPole + TurkishFlag + "FlagWave")
#
# Yöntem: Cloth Modifier / Geometry Nodes GLB'ye taşınmaz. Kumaş hareketi zamanla periyodik bir dalga alanından
# (farklı dalga boyu ve hızlarda 4 bileşen, her biri döngüde tam sayı kez ilerler) 24 anlık şekil olarak shape key'e
# yazılır. Her shape key ağırlığı komşu iki anlık şekil arasında doğrusal geçer; kare 120 = kare 0 olduğundan döngü
# sıçramasızdır. glTF'de bunlar morph target + "weights" animasyonu olur; Three.js AnimationMixer doğrudan oynatır.
# Direğe bağlı kenarda dalga zarfı tam sıfırdır (u = 0) → o kenar bütün animasyon boyunca hareketsiz kalır.
#
# Resmî ölçüler (2994 sayılı Türk Bayrağı Kanunu, G = bayrak genişliği):
#   A = 1/2 G (dış ay merkezinin uçkurluk ucundan uzaklığı)   B = 0.5 G (dış ay çapı)
#   C = 1/16 G (iç ve dış ay merkezleri arası)                 D = 0.4 G (iç ay çapı)
#   E = 1/3 G (iç ay ile yıldız çemberi arası)                 F = 1/4 G (yıldız çemberinin çapı)
#   L = 1.5 G (boy)                                            M = 1/30 G (beyaz uçkurluk genişliği)
#   Yıldızın bir köşesi ayın merkezine, yani direk tarafına bakar.
import bpy, bmesh, math, os, sys, argparse
import numpy as np

# ------------------------------------------------------------------ ayarlar
def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--out', default=os.path.join(os.path.dirname(bpy.data.filepath) or os.getcwd(), 'models'))
    p.add_argument('--name', default='turk-bayragi')
    p.add_argument('--width', type=float, default=4.0, help='G: bayrak genişliği (m); boy 1.5 G')
    p.add_argument('--pole-height', type=float, default=24.0)
    p.add_argument('--wind-speed', type=float, default=8.0, help='m/s; dalga genliği ve sarkma buna göre')
    p.add_argument('--wind-dir', type=float, default=0.0, help='rüzgârın estiği yön (derece, +X ekseninden saat tersi); bayrak bu yöne uzanır')
    p.add_argument('--frames', type=int, default=120)
    p.add_argument('--fps', type=int, default=24)
    p.add_argument('--keys', type=int, default=24, help='anlık şekil (shape key) sayısı; frames bölünebilmeli')
    p.add_argument('--nx', type=int, default=48)
    p.add_argument('--ny', type=int, default=24)
    p.add_argument('--texture', type=int, default=2048, help='doku genişliği (px)')
    p.add_argument('--anitkabir', default='', help='isteğe bağlı: Meshy Anıtkabir GLB, yalnız .blend içinde referans')
    return p.parse_args(argv)

A = parse_args()
assert A.frames % A.keys == 0, 'frames, keys sayısına tam bölünmeli'
G = A.width
SLEEVE = G / 30.0
L = 1.5 * G
TOTAL = SLEEVE + L

# ------------------------------------------------------------------ sahne
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.actions, bpy.data.shape_keys):
    for d in list(coll):
        if d.users == 0: coll.remove(d)
scene = bpy.context.scene
scene.render.fps = A.fps
scene.frame_start, scene.frame_end = 0, A.frames
scene.unit_settings.system = 'METRIC'

# ------------------------------------------------------------------ doku (resmî geometri, numpy ile, 3× süper örnekleme)
def flag_image(width):
    h = int(round(width * G / TOTAL)); w = width; ss = 3
    ys, xs = np.mgrid[0:h * ss, 0:w * ss].astype(np.float32)
    # piksel → bayrak koordinatı (G birimi): x direk tarafından, y yukarıdan aşağı
    x = (xs + 0.5) / (w * ss) * (TOTAL / G); y = (ys + 0.5) / (h * ss)
    xr = x - SLEEVE / G                       # kırmızı alan başlangıcından
    cy = 0.5
    outer = (xr - 0.5) ** 2 + (y - cy) ** 2 <= 0.25 ** 2
    inner = (xr - (0.5 + 1 / 16)) ** 2 + (y - cy) ** 2 <= 0.2 ** 2
    crescent = outer & ~inner
    sc = 0.5 + 1 / 16 + 0.2 + 1 / 3 + 0.125  # yıldız merkezi
    R = 0.125; r = R * math.sin(math.radians(18)) / math.sin(math.radians(126))   # düzgün beş köşeli yıldız iç yarıçapı
    pts = []
    for k in range(10):
        a = math.pi + k * math.pi / 5          # k=0: direk tarafına (−x) bakan köşe
        rad = R if k % 2 == 0 else r
        pts.append((sc + rad * math.cos(a), cy + rad * math.sin(a)))
    inside = np.zeros_like(xr, dtype=bool)
    for i in range(10):                          # çift-tek kuralıyla çokgen içi testi
        (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % 10]
        cond = ((y1 > y) != (y2 > y)) & (xr < (x2 - x1) * (y - y1) / ((y2 - y1) if y2 != y1 else 1e-9) + x1)
        inside ^= cond
    white = crescent | inside | (x < SLEEVE / G)
    red = np.array([0.890, 0.039, 0.090])        # #E30A17 (TS 2490 / resmî kırmızı, sRGB)
    rgb = np.where(white[..., None], np.array([1.0, 1.0, 1.0]), red)
    rgb = rgb.reshape(h, ss, w, ss, 3).mean(axis=(1, 3))
    rgba = np.concatenate([rgb, np.ones((h, w, 1))], axis=2)[::-1]   # Blender piksel sırası alttan üste
    img = bpy.data.images.new('TurkBayragi', w, h, alpha=False)
    img.colorspace_settings.name = 'sRGB'
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    img.pack()
    return img

# ------------------------------------------------------------------ malzemeler
def material(name, color=None, image=None, rough=0.8, metal=0.0, cull=True):
    m = bpy.data.materials.new(name); m.use_nodes = True; m.use_backface_culling = cull
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if image is not None:
        t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = image; t.interpolation = 'Linear'
        m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    elif color is not None:
        b.inputs['Base Color'].default_value = (*color, 1)
    return m

# ------------------------------------------------------------------ direk
def make_pole():
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.16, radius2=0.09, depth=A.pole_height)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, A.pole_height / 2))
    base = bmesh.new(); bmesh.ops.create_cone(base, cap_ends=True, segments=16, radius1=0.45, radius2=0.35, depth=0.6)
    bmesh.ops.translate(base, verts=base.verts, vec=(0, 0, 0.3))
    ball = bmesh.new(); bmesh.ops.create_uvsphere(ball, u_segments=16, v_segments=10, radius=0.2)
    bmesh.ops.translate(ball, verts=ball.verts, vec=(0, 0, A.pole_height + 0.18))
    me = bpy.data.meshes.new('FlagPole')
    for part, mat_index in ((bm, 0), (base, 0), (ball, 1)):
        for f in part.faces: f.material_index = mat_index; f.smooth = True
    joined = bmesh.new()
    for part in (bm, base, ball):
        tmp = bpy.data.meshes.new('tmp'); part.to_mesh(tmp); joined.from_mesh(tmp); bpy.data.meshes.remove(tmp); part.free()
    joined.to_mesh(me); joined.free()
    ob = bpy.data.objects.new('FlagPole', me); scene.collection.objects.link(ob)
    me.materials.append(material('Pole_Metal', (0.82, 0.82, 0.80), rough=0.35, metal=0.9))
    me.materials.append(material('Pole_Alem', (0.83, 0.62, 0.22), rough=0.3, metal=1.0))
    return ob

# ------------------------------------------------------------------ kumaş ve dalga alanı
HOIST_X = 0.17   # direğin yüzeyinden kumaş başlangıcı (m)

def wave(u, v, t):
    """u: direkten uzaklık oranı (0…1), v: üstten aşağı oran (0…1), t: döngü içindeki faz (0…1).
    Dönüş: (dx, dy, dz) metre. Her bileşen döngüde tam sayı kez ilerler → t=0 ile t=1 aynı şekil."""
    w = max(0.0, min(A.wind_speed, 20.0))
    amp = G * (0.035 + 0.009 * w)                       # rüzgâr arttıkça daha büyük dalga
    env = u ** 1.35                                       # direk kenarında 0 → sabit
    comps = (  # (genlik oranı, uzaysal dalga sayısı, döngü başına ilerleme, faz, dikey eğiklik)
        (1.00, 1.15, 2, 0.0, 0.35),
        (0.45, 2.10, 3, 1.3, -0.55),
        (0.22, 3.40, 5, 2.1, 0.9),
        (0.10, 5.30, 7, 0.7, -1.4),
    )
    dy = 0.0
    for a, k, n, ph, tilt in comps:
        dy += a * math.sin(2 * math.pi * (k * u - n * t) + ph + tilt * v)
    dy *= amp * env
    # uç kısmı hafif çırpınma (köşeler) — yine döngüsel
    dy += amp * 0.18 * env ** 3 * math.sin(2 * math.pi * (6.0 * u - 9 * t) + 4.0 * v)
    # kumaş uzamasın: dalga büyüdükçe serbest uç direğe doğru biraz yaklaşır
    dx = -0.06 * G * env * (0.6 + 0.4 * math.sin(2 * math.pi * (1.15 * u - 2 * t)))
    # zayıf rüzgârda serbest uç aşağı sarkar
    sag = G * 0.22 * max(0.0, 1.0 - w / 10.0)
    dz = -sag * env ** 1.6 * (0.85 + 0.15 * math.sin(2 * math.pi * (u - t)))
    return dx, dy, dz

def action_fcurves(act):
    """Blender 4.2–4.5: action.fcurves; 4.4+ katmanlı (slotted) eylemlerde kanal torbaları da taranır."""
    curves = list(getattr(act, 'fcurves', []) or [])
    if curves: return curves
    for layer in getattr(act, 'layers', []):
        for strip in layer.strips:
            for bag in getattr(strip, 'channelbags', []): curves.extend(bag.fcurves)
    return curves

def make_flag(image):
    nx, ny = A.nx, A.ny
    me = bpy.data.meshes.new('TurkishFlag'); bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    grid = {}
    for side in (0, 1):                                   # 0: ön yüz, 1: arka yüz (ayrı köşeler, ters sargı)
        for j in range(ny + 1):
            for i in range(nx + 1):
                grid[side, i, j] = bm.verts.new((HOIST_X + TOTAL * i / nx, 0.0, -G * j / ny))
    bm.verts.ensure_lookup_table()
    for side in (0, 1):
        for j in range(ny):
            for i in range(nx):
                q = [grid[side, i, j], grid[side, i + 1, j], grid[side, i + 1, j + 1], grid[side, i, j + 1]]
                uvs = [(i / nx, 1 - j / ny), ((i + 1) / nx, 1 - j / ny), ((i + 1) / nx, 1 - (j + 1) / ny), (i / nx, 1 - (j + 1) / ny)]
                if side == 1: q.reverse(); uvs.reverse()
                f = bm.faces.new(q); f.smooth = True
                for loop, t in zip(f.loops, uvs): loop[uv].uv = t
    bm.to_mesh(me); bm.free()
    # Arka yüz aynı UV'leri kullanır: arkadan bakan, kumaşın gerçek arka yüzünü (ay-yıldız direk tarafında) görür.
    ob = bpy.data.objects.new('TurkishFlag', me); scene.collection.objects.link(ob)
    me.materials.append(material('Flag_Kumas', image=image, rough=0.88, cull=True))
    # shape key'ler
    basis = ob.shape_key_add(name='Basis', from_mix=False)
    rest = [v.co.copy() for v in me.vertices]
    keys = []
    for k in range(A.keys):
        t = k / A.keys
        sk = ob.shape_key_add(name=f'Wave_{k:02d}', from_mix=False)
        for idx, co in enumerate(rest):
            u = (co.x - HOIST_X) / TOTAL; v = -co.z / G
            dx, dy, dz = wave(u, v, t)
            sk.data[idx].co = (co.x + dx, co.y + dy, co.z + dz)
        keys.append(sk)
    # ağırlık animasyonu: her anlık şekil kendi karesinde 1, komşu karelerde 0; kare frames = kare 0
    step = A.frames // A.keys
    me.shape_keys.use_relative = True
    for k, sk in enumerate(keys):
        for m in range(A.keys + 1):
            frame = m * step
            sk.value = 1.0 if (m % A.keys) == k else 0.0
            sk.keyframe_insert('value', frame=frame)
    act = me.shape_keys.animation_data.action; act.name = 'FlagWave'
    for fc in action_fcurves(act):
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    return ob

image = flag_image(A.texture)
pole = make_pole()
flag = make_flag(image)
flag.parent = pole
flag.location = (0, 0, A.pole_height - 0.35)
pole.rotation_euler = (0, 0, 0)
flag.rotation_euler = (0, 0, math.radians(A.wind_dir))   # bayrak rüzgârın estiği yöne uzanır
for ob, props in ((flag, {'windSpeed': A.wind_speed, 'windDir': A.wind_dir, 'loopFrames': A.frames, 'fps': A.fps,
                          'G': G, 'note': 'Three.js: mixer.timeScale ile rüzgâr hızı, rotation.y ile yön'}),
                  (pole, {'height': A.pole_height})):
    for k, v in props.items(): ob[k] = v

# isteğe bağlı: Anıtkabir referansı (yalnız .blend; GLB'ye girmez)
ref = None
if A.anitkabir and os.path.exists(A.anitkabir):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=A.anitkabir)
    ref = [o for o in bpy.data.objects if o not in before]
    for o in ref: o.hide_render = True; o.hide_select = True; o.name = 'REF_' + o.name

# ------------------------------------------------------------------ kayıt ve dışa aktarma
os.makedirs(A.out, exist_ok=True)
blend = os.path.join(A.out, A.name + '.blend'); glb = os.path.join(A.out, A.name + '.glb')
bpy.ops.object.select_all(action='DESELECT')
pole.select_set(True); flag.select_set(True); bpy.context.view_layer.objects.active = pole
scene.frame_set(0)
bpy.ops.export_scene.gltf(
    filepath=glb, export_format='GLB', use_selection=True,
    export_animations=True, export_frame_range=True, export_force_sampling=True, export_anim_single_armature=False,
    export_morph=True, export_morph_normal=True, export_morph_tangent=False,
    export_apply=False, export_yup=True, export_texcoords=True, export_normals=True,
    export_materials='EXPORT', export_image_format='AUTO', export_extras=True)
bpy.ops.wm.save_as_mainfile(filepath=blend)
print(f'[turk_bayragi] {glb} · {blend} · {len(flag.data.vertices)} köşe, {A.keys} shape key, {A.frames} kare @ {A.fps} fps')
