// Heykel grubu GLB hazırlığı (Meshy vb. çıktısı → oyun):  node tools/ankara/prepare-heykel.mjs --in <glb> --out models/heykel-erkek.glb
// Kaynak model Zafer Hoca tarafından sağlanır. Bu betik yalnız optimize eder: kaynaştırma, sadeleştirme (~16 bin üçgen),
// dokular en çok 2048 px WebP, metalik 0. Yerleşim (kaide, yön, 4.2 m yükseklik) oyunda data/ank/aslanli-yol.json'dan yapılır.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld,simplify,textureCompress,dedup,prune} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>(v.startsWith('--')&&a.push([v.slice(2),all[i+1]]),a),[]));
if(!args.in||!args.out)throw Error('--in <glb> --out <glb> gerekli');
const target=+(args.tris||16000);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);const doc=await io.read(args.in);
await MeshoptSimplifier.ready;
let tris=0;for(const m of doc.getRoot().listMeshes())for(const p of m.listPrimitives())tris+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;
await doc.transform(dedup(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:Math.min(1,target/tris),error:0.002}),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[2048,2048],quality:84}));
for(const m of doc.getRoot().listMaterials()){m.setMetallicFactor(0);m.setRoughnessFactor(1)}
await io.write(args.out,doc);
let after=0;for(const m of doc.getRoot().listMeshes())for(const p of m.listPrimitives())after+=(p.getIndices()?.getCount()??0)/3;
console.log(`${args.out}: ${Math.round(tris)} → ${Math.round(after)} üçgen`);
