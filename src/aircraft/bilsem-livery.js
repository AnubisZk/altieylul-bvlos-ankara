import * as THREE from 'three';

// Project the school's original artwork through the model's existing UV layout.
// Keeping this in the material preserves the rig, surface normals and moving rudder.
let artwork;
const brandedMaterials = new WeakSet();
function textures() {
  if (artwork) return artwork;
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b3268';
  ctx.font = '700 174px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Altıeylül Bilsem', 1024, 128, 1960);
  const title = new THREE.CanvasTexture(canvas);
  title.colorSpace = THREE.SRGBColorSpace;
  title.anisotropy = 8;
  const logo = new THREE.TextureLoader().load(new URL('./branding/altieylul-bilsem.png', import.meta.url).href);
  logo.colorSpace = THREE.SRGBColorSpace;
  artwork = { title, logo };
  return artwork;
}

function projection(id, part) {
  if (part === 'fuselage') return id === 'a320neo' ? `
    float station = vMapUv.x * 37.57;
    float height = 2.07 * cos(vMapUv.y * 6.2831853);
    bool rightFace = vMapUv.y > 0.5;
    vec2 labelUV = vec2((station - 7.1) / 11.5, (height - 0.96) / 1.03);
    float paint = step(6.9, station) * step(station, 21.0) * step(0.94, height) * step(height, 1.99);
  ` : `
    float station = vMapUv.x * 39.47;
    float height = 3.30 + 1.88 * cos((vMapUv.y - 0.5) * 6.2831853);
    bool rightFace = vMapUv.y < 0.5;
    vec2 labelUV = vec2((station - 7.1) / 11.5, (height - 3.86) / 0.97);
    float paint = step(6.9, station) * step(station, 21.0) * step(3.85, height) * step(height, 4.84);
  `;
  return id === 'a320neo' ? `
    bool rightFace = vMapUv.x < 0.4;
    float station = 27.8 + (rightFace ? (1.0 - vMapUv.x / 0.39) : (vMapUv.x - 0.4) / 0.39) * 9.4;
    float height = 1.4 + (1.0 - vMapUv.y) * 7.0;
    vec2 labelUV = vec2((station - 32.9) / 2.7, (height - 3.55) / 3.65);
    float fin = 1.0 - step(0.80, vMapUv.x);
  ` : `
    bool rightFace = vMapUv.x > 0.5;
    float height = 4.35 + (1.0 - vMapUv.y) * 8.25;
    float cap = smoothstep(12.33, 12.55, height);
    float leading = 31.40 + (height - 5.0) * 0.7812856 - (height <= 5.0 ? 1.75 : 1.75 * exp(-(height - 5.0) / 0.34)) + 0.25 * cap * cap;
    float station = leading + abs(vMapUv.x - 0.5) * 22.0;
    vec2 labelUV = vec2((station - 34.9) / 2.8, (height - 6.35) / 3.8);
    float fin = 1.0;
  `;
}

export function applyBilsemLivery(root, id) {
  if (!root || !['a320neo', 'b737'].includes(id)) return;
  const art = textures();
  const visited = new Set();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (const material of [].concat(mesh.material || [])) {
      const parts = id === 'a320neo' ? ['fuselage', 'tail', 'nacelle'] : ['fuselage', 'tail', 'wing'];
      if (visited.has(material) || brandedMaterials.has(material) || !material.map || !parts.includes(material.name)) continue;
      visited.add(material);
      brandedMaterials.add(material);
      const part = material.name;
      const previous = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.uniforms.bilsemTitle = { value: art.title };
        shader.uniforms.bilsemLogo = { value: art.logo };
        shader.fragmentShader = 'uniform sampler2D bilsemTitle;\nuniform sampler2D bilsemLogo;\n' + shader.fragmentShader;
        if (part === 'wing') {
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            float winglet = smoothstep(17.0 / 19.7099, 17.3 / 19.7099, vMapUv.x);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.005, 0.035, 0.14), winglet);
          `);
          return;
        }
        if (part === 'nacelle') {
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            float oldTitle = step(0.23, vMapUv.x) * step(vMapUv.x, 0.57) * (1.0 - step(0.042, min(abs(vMapUv.y - 0.25), abs(vMapUv.y - 0.75))));
            diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(map, vec2(vMapUv.x, 0.40)).rgb, oldTitle);
          `);
          return;
        }
        const paint = part === 'fuselage' ? `
          if (rightFace) labelUV.x = 1.0 - labelUV.x;
          vec4 lettering = texture2D(bilsemTitle, clamp(labelUV, 0.0, 1.0));
          float inside = step(0.0, labelUV.x) * step(labelUV.x, 1.0) * step(0.0, labelUV.y) * step(labelUV.y, 1.0);
          vec3 cleanPaint = texture2D(map, vec2(0.60, vMapUv.y)).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb, cleanPaint, paint);
          diffuseColor.rgb = mix(diffuseColor.rgb, lettering.rgb, lettering.a * inside * paint);
        ` : `
          if (rightFace) labelUV.x = 1.0 - labelUV.x;
          float inside = step(0.0, labelUV.x) * step(labelUV.x, 1.0) * step(0.0, labelUV.y) * step(labelUV.y, 1.0);
          // Crop by UVs, retaining the supplied logo file unchanged.
          vec2 logoUV = vec2(0.285 + labelUV.x * 0.45, 0.345 + labelUV.y * 0.595);
          vec3 emblem = texture2D(bilsemLogo, clamp(logoUV, 0.0, 1.0)).rgb;
          vec3 tailPaint = mix(vec3(0.005, 0.035, 0.14), vec3(1.0), fin);
          diffuseColor.rgb = mix(tailPaint, emblem, inside * fin);
        `;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + projection(id, part) + paint);
        if (part === 'fuselage') {
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.72, lettering.a * inside * paint);')
            .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - lettering.a * inside * paint;');
        }
      };
      material.customProgramCacheKey = () => `bilsem-v1-${id}-${part}`;
      material.needsUpdate = true;
    }
  });
}
