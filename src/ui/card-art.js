// User-supplied menu reference, with the baked badges removed using imagegen.
// Keep the photographs in one shared texture; the live UI owns labels and selection.
const source = new URL('./assets/aircraft-cards-20260928.png', import.meta.url).href;
const width = 1850, height = 850;
const crops = {
  f16: [24, 592, 267, 149],
  f22: [306, 584, 266, 149],
  a320neo: [587, 592, 267, 149],
  b737: [869, 592, 266, 149],
  uh60: [1149, 592, 267, 149],
};
let ready;
const schoolPhotos = {
  a320neo: new URL('./assets/a320neo-bilsem.png', import.meta.url).href,
  b737: new URL('./assets/b737-bilsem.png', import.meta.url).href,
};
const photoCache = new Map();

export function loadCardArt(id) {
  if (schoolPhotos[id]) {
    const url = schoolPhotos[id];
    if (!photoCache.has(id)) photoCache.set(id, new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: 'center' });
      image.onerror = () => resolve(null);
      image.src = url;
    }));
    return photoCache.get(id);
  }
  if (!crops[id]) return Promise.resolve(null);
  if (!ready) ready = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth > 8);
    image.onerror = () => resolve(false);
    image.src = source;
  });
  return ready.then((loaded) => {
    if (!loaded) return null;
    const [x, y, w, h] = crops[id];
    return {
      backgroundImage: `url("${source}")`,
      backgroundSize: `${width / w * 100}% ${height / h * 100}%`,
      backgroundPosition: `${x / (width - w) * 100}% ${y / (height - h) * 100}%`,
    };
  });
}
