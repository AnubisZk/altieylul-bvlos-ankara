# Anıt Blok merdiveninin iki yanındaki rölyef duvarları için özgün kabartma dokusu (yükseklik + normal + albedo).
#
# Gerçek rölyefler (Sakarya ve Başkomutan Meydan Muharebeleri) heykeltıraşların telif kapsamındaki eserleridir; burada
# onların kopyası değil, aynı türde (Kurtuluş Savaşı yürüyüşü) özgün, sade bir kompozisyon üretilir: yürüyen askerler,
# cephane taşıyan kadınlar, top çeken atlar, sancaktar. Meshy modelindeki rölyef yüzeyi okunaksız gürültü olduğu için
# kullanılmaz. Tamamen yordamsal: aynı tohum → aynı doku.
#
#   python tools/blender/rolyef.py --preview out.png     (önizleme; Blender gerekmez, numpy + Pillow)
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


class Relief:
    """Katmanlı çizim: her şekil kendi yüksekliğiyle (0…1) çizilir, yüksek olan üstte kalır."""
    def __init__(self, w, h, ss=2):
        self.ss = ss; self.w, self.h = w * ss, h * ss
        self.H = np.zeros((self.h, self.w), np.float32)

    def _layer(self, draw_fn, height):
        im = Image.new('L', (self.w, self.h), 0); d = ImageDraw.Draw(im); draw_fn(d, self.ss)
        m = np.asarray(im, np.float32) / 255.0
        self.H = np.maximum(self.H, m * height)

    # --- temel parçalar (koordinatlar çıktı pikselinde; ss ile ölçeklenir)
    def poly(self, pts, height):
        self._layer(lambda d, s: d.polygon([(x * s, y * s) for x, y in pts], fill=255), height)

    def ell(self, cx, cy, rx, ry, height):
        self._layer(lambda d, s: d.ellipse([(cx - rx) * s, (cy - ry) * s, (cx + rx) * s, (cy + ry) * s], fill=255), height)

    def line(self, pts, width, height):
        def f(d, s):
            P = [(x * s, y * s) for x, y in pts]; d.line(P, fill=255, width=max(1, int(width * s)), joint='curve')
            for x, y in P: d.ellipse([x - width * s / 2, y - width * s / 2, x + width * s / 2, y + width * s / 2], fill=255)
        self._layer(f, height)

    def ring(self, cx, cy, r, width, height, spokes=8):
        def f(d, s):
            d.ellipse([(cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s], outline=255, width=int(width * s))
            for k in range(spokes):
                a = k * math.pi / spokes * 2
                d.line([(cx * s, cy * s), ((cx + r * math.cos(a)) * s, (cy + r * math.sin(a)) * s)], fill=255, width=max(1, int(width * 0.45 * s)))
        self._layer(f, height)


def person(R, x, ground, H, d, z, rng, kind='asker'):
    """Yürüyen insan figürü; d = yön (+1 sağa), z = kabartma yüksekliği (ön plan ~1, arka plan ~0.55)."""
    st = rng.uniform(0.6, 1.0) * (1 if rng.random() < 0.5 else -1)          # adım evresi
    head = H * 0.12; hip = ground - H * 0.47; sh = ground - H * 0.80; neck = ground - H * 0.86
    lean = d * H * 0.035
    # bacaklar
    for sgn in (1, -1):
        knee = (x + lean * 0.3 + sgn * st * d * H * 0.10, ground - H * 0.25)
        foot = (x + sgn * st * d * H * 0.20, ground - H * 0.02)
        R.line([(x + lean * 0.4 + sgn * H * 0.02, hip), knee, foot], H * 0.058, z * (0.92 if sgn > 0 else 0.84))
    # gövde (kaputlu asker ya da uzun etekli kadın)
    if kind == 'kadin':
        R.poly([(x + lean - H * 0.09, sh), (x + lean + H * 0.09, sh), (x + H * 0.15, ground - H * 0.10), (x - H * 0.15, ground - H * 0.10)], z)
    else:
        R.poly([(x + lean - H * 0.075, sh), (x + lean + H * 0.075, sh), (x + lean * 0.5 + H * 0.06, hip), (x + H * 0.10, hip + H * 0.14), (x - H * 0.09, hip + H * 0.14), (x + lean * 0.5 - H * 0.06, hip)], z)
    R.line([(x + lean, sh), (x + lean, neck)], H * 0.06, z)
    hx = x + lean * 1.3 + d * H * 0.01
    R.ell(hx, neck - head * 0.55, head * 0.42, head * 0.55, z)
    if kind == 'asker':      # kalpak / miğfer
        R.ell(hx, neck - head * 0.85, head * 0.48, head * 0.30, z)
    elif kind == 'kadin':    # başörtüsü, sırta düşen
        R.poly([(hx - d * head * 0.5, neck - head * 1.0), (hx + d * head * 0.4, neck - head * 0.9), (hx - d * head * 0.2, sh + H * 0.12), (hx - d * head * 0.75, sh + H * 0.05)], z * 0.97)
    # kollar ve taşınanlar
    fwd = (x + lean + d * H * 0.20, sh + H * 0.22)
    if kind == 'asker':
        R.line([(x + lean, sh + H * 0.02), (x + lean + d * H * 0.08, sh + H * 0.18), fwd], H * 0.055, z * 1.02)
        tip = (fwd[0] - d * H * 0.18, sh - H * 0.42)                         # omuzda tüfek
        R.line([(fwd[0] + d * H * 0.06, fwd[1] + H * 0.10), tip], H * 0.03, z * 1.05)
        R.poly([(x + lean - d * H * 0.06, sh + H * 0.03), (x + lean - d * H * 0.20, sh + H * 0.06), (x + lean - d * H * 0.18, sh + H * 0.30), (x + lean - d * H * 0.05, sh + H * 0.28)], z * 0.9)  # sırt çantası
    elif kind == 'kadin':
        R.line([(x + lean, sh + H * 0.02), (x + lean + d * H * 0.02, sh - H * 0.10)], H * 0.05, z * 1.02)  # yükü tutan kol
        R.poly([(hx - d * H * 0.20, sh - H * 0.06), (hx + d * H * 0.12, sh - H * 0.10), (hx + d * H * 0.10, sh - H * 0.24), (hx - d * H * 0.22, sh - H * 0.20)], z * 1.04)  # omuzda cephane sandığı
        R.line([(x + lean, sh + H * 0.04), fwd], H * 0.05, z * 1.02)
    elif kind == 'sancak':
        top = (x + lean + d * H * 0.05, sh - H * 0.42)
        R.line([(x + lean + d * H * 0.12, ground - H * 0.15), top], H * 0.035, z * 1.04)
        R.line([(x + lean, sh + H * 0.02), (x + lean + d * H * 0.10, sh + H * 0.08)], H * 0.055, z * 1.02)
        fl = [top]
        for k in range(1, 7):
            t = k / 6; fl.append((top[0] - d * H * 0.38 * t, top[1] + H * 0.04 * math.sin(t * 5) + H * 0.02 * t))
        R.poly(fl + [(p[0], p[1] + H * 0.20 - H * 0.03 * i / 6) for i, p in reversed(list(enumerate(fl)))], z * 0.95)


def horse(R, x, ground, H, d, z, rng):
    """Yürüyen at (H = omuz yüksekliği)."""
    bx, by = x, ground - H * 0.78; L = H * 0.62
    st = rng.uniform(0.5, 1.0)
    for i, (ox, ph) in enumerate(((-0.75, st), (-0.55, -st), (0.55, -st), (0.75, st))):
        hx = bx + d * L * ox
        R.line([(hx, by + H * 0.12), (hx + d * ph * H * 0.12, ground - H * 0.35), (hx + d * ph * H * 0.18, ground - H * 0.02)], H * 0.09, z * (0.80 if i in (0, 2) else 0.92))
    R.ell(bx, by, L * 0.95, H * 0.20, z)
    R.ell(bx - d * L * 0.62, by - H * 0.02, L * 0.36, H * 0.22, z * 1.01)
    R.ell(bx + d * L * 0.55, by - H * 0.03, L * 0.38, H * 0.23, z * 1.01)
    nk = (bx + d * L * 0.95, by - H * 0.05)
    R.poly([(nk[0] - d * H * 0.10, nk[1] + H * 0.10), (nk[0] + d * H * 0.06, nk[1] - H * 0.12), (nk[0] + d * H * 0.30, by - H * 0.55), (nk[0] + d * H * 0.16, by - H * 0.62)], z)
    R.poly([(nk[0] + d * H * 0.16, by - H * 0.62), (nk[0] + d * H * 0.30, by - H * 0.55), (nk[0] + d * H * 0.52, by - H * 0.32), (nk[0] + d * H * 0.44, by - H * 0.25), (nk[0] + d * H * 0.18, by - H * 0.40)], z * 1.03)
    R.ell(nk[0] + d * H * 0.20, by - H * 0.66, H * 0.03, H * 0.06, z * 1.03)   # kulak
    R.line([(bx - d * L * 1.0, by - H * 0.05), (bx - d * L * 1.25, by + H * 0.25), (bx - d * L * 1.2, by + H * 0.45)], H * 0.06, z * 0.9)  # kuyruk


def gun_carriage(R, x, ground, H, d, z):
    """At çekişli sahra topu: iki tekerlek, kundak, namlu."""
    r = H * 0.32
    R.line([(x - d * H * 0.2, ground - r * 1.2), (x + d * H * 0.9, ground - r * 0.9)], H * 0.07, z * 0.95)   # oklar
    R.line([(x - d * H * 0.3, ground - r * 1.1), (x - d * H * 1.05, ground - r * 1.8)], H * 0.11, z * 1.02)  # namlu
    R.ring(x, ground - r, r, H * 0.05, z * 1.06, spokes=10)
    R.ell(x, ground - r, r * 0.15, r * 0.15, z * 1.1)


def compose(w, h, d, seed):
    """Bir rölyef paneli: alt zemin çizgisi, iki derinlik katmanında soldan sağa (d=+1) ya da sağdan sola yürüyüş."""
    rng = np.random.default_rng(seed); R = Relief(w, h)
    ground = h * 0.93; Hf = h * 0.74; Hb = h * 0.60
    # arka plan: sık, daha sığ asker ve kadın sırası
    x = w * 0.02
    while x < w * 0.99:
        person(R, x, ground - h * 0.06, Hb * rng.uniform(0.93, 1.03), d, 0.50, rng, 'kadin' if rng.random() < 0.3 else 'asker')
        x += Hb * rng.uniform(0.22, 0.30)
    # ön plan: gruplar
    order = ['asker', 'asker', 'sancak', 'at', 'asker', 'kadin', 'kadin', 'top', 'asker', 'asker', 'kadin', 'at', 'asker']
    if d < 0: order = order[::-1]
    x = w * 0.05; i = 0
    while x < w * 0.97:
        k = order[i % len(order)]; i += 1
        if k == 'at':
            horse(R, x + Hf * 0.35, ground, Hf * 0.72, d, 0.95, rng); x += Hf * 0.95
        elif k == 'top':
            gun_carriage(R, x + Hf * 0.3, ground, Hf * 0.75, d, 1.0); x += Hf * 0.80
        else:
            person(R, x, ground, Hf * rng.uniform(0.95, 1.04), d, 1.0, rng, k); x += Hf * rng.uniform(0.30, 0.40)
    # yuvarlatma: kabartma kenarları yontulmuş gibi
    H = R.H
    img = Image.fromarray((H * 255).astype(np.uint8))
    a = np.asarray(img.filter(ImageFilter.GaussianBlur(6 * R.ss)), np.float32) / 255
    b = np.asarray(img.filter(ImageFilter.GaussianBlur(1.6 * R.ss)), np.float32) / 255
    H = 0.55 * b + 0.45 * np.maximum(a, b * 0.6)
    H = np.asarray(Image.fromarray((np.clip(H, 0, 1) * 65535).astype(np.uint16)).resize((w, h), Image.LANCZOS), np.float32) / 65535 if False else \
        H.reshape(h, R.ss, w, R.ss).mean(axis=(1, 3))
    # zemin şeridi ve kenar çerçevesi
    yy = np.arange(h)[:, None]; xx = np.arange(w)[None]
    H = np.maximum(H, np.clip((yy - ground) / 2.0, 0, 1) * 0.35)
    return H


def textures(w, h, d, seed, base=(0.80, 0.64, 0.42)):
    """→ (albedo rgb 0…1, normal 0…1, height 0…1); dizi satırları yukarıdan aşağıya."""
    H = compose(w, h, d, seed)
    rng = np.random.default_rng(seed + 7)
    # taş dokusu: ince gözenek + yatay blok derzleri (rölyef blok taşlara oyulmuş)
    n = rng.random((h // 4 + 1, w // 4 + 1)).astype(np.float32)
    n = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255
    joints = np.zeros((h, w), np.float32)
    for k in range(1, 4):
        y = int(h * k / 4); joints[max(0, y - 1):y + 1] = 1
    off = 0
    for k in range(4):
        y0, y1 = int(h * k / 4), int(h * (k + 1) / 4); off = (off + w // 7) % (w // 3)
        for xj in range(off, w, w // 3): joints[y0:y1, max(0, xj - 1):xj + 1] = 1
    joints *= (H < 0.08)
    gy, gx = np.gradient(H * 26.0)
    nrm = np.dstack([-gx, gy, np.ones_like(gx)]); nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
    blur = np.asarray(Image.fromarray((H * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10)), np.float32) / 255
    cavity = np.clip((blur - H) * 3.0, 0, 1)                    # oyukların dibi koyu
    light = np.clip(0.5 + 0.5 * (nrm[..., 0] * -0.35 + nrm[..., 1] * 0.55 + nrm[..., 2] * 0.75), 0, 1)
    tone = (0.86 + 0.10 * H + 0.06 * (n - 0.5)) * (1 - 0.30 * cavity) * (0.88 + 0.12 * light) * (1 - 0.18 * joints)
    rgb = np.array(base, np.float32)[None, None] * tone[..., None]
    return np.clip(rgb, 0, 1), nrm * 0.5 + 0.5, H


if __name__ == '__main__':
    import sys
    out = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else 'rolyef.png'
    rows = []
    for d, seed in ((1, 11), (-1, 23)):
        rgb, nrm, H = textures(2048, 560, d, seed)
        rows.append(np.concatenate([rgb, nrm], axis=0))
    Image.fromarray((np.concatenate(rows, axis=0) * 255).astype(np.uint8)).save(out)
    print('ok', out)
