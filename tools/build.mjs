import fs from 'node:fs';import path from 'node:path';import {bundlePage} from './build/bundle.mjs';
const root=process.cwd(),dist=path.join(root,'dist');fs.mkdirSync(dist,{recursive:true});
const jsDir=path.join(dist,'js');if(fs.existsSync(jsDir))for(const f of fs.readdirSync(jsDir))if(/\.(js|map)$/.test(f))fs.unlinkSync(path.join(jsDir,f));
await bundlePage({root,dist,page:'index.html'});
for(const f of ['style.css','cdn.js','icon.svg','LICENSE','NOTICE','ASSETS-LICENSE.md'])fs.copyFileSync(path.join(root,f),path.join(dist,f));
fs.rmSync(path.join(dist,'data'),{recursive:true,force:true});fs.cpSync('data/ank',path.join(dist,'data/ank'),{recursive:true,filter:src=>!/report\.txt$/.test(src)});
// Only a public-app basemap key restricted to this site's referrers belongs here.
// Never commit account credentials or private/admin API keys.
if(fs.existsSync('imagery.local.json')){
  const {apiKey}=JSON.parse(fs.readFileSync('imagery.local.json','utf8').replace(/^\uFEFF/,''));
  if(typeof apiKey!=='string'||apiKey.length<20)throw Error('Invalid imagery configuration');
  fs.writeFileSync(path.join(dist,'data/ank/imagery.json'),JSON.stringify({provider:'arcgis-world-imagery',apiKey}));
}
fs.cpSync('music',path.join(dist,'music'),{recursive:true});
fs.mkdirSync(path.join(dist,'models'),{recursive:true});fs.copyFileSync('models/bilsem-surveyor.glb',path.join(dist,'models/bilsem-surveyor.glb'));
fs.mkdirSync(path.join(dist,'vendor'),{recursive:true});for(const f of ['leaflet.js','leaflet.css'])fs.copyFileSync('node_modules/leaflet/dist/'+f,path.join(dist,'vendor',f));fs.cpSync('node_modules/leaflet/dist/images',path.join(dist,'vendor/images'),{recursive:true});
fs.mkdirSync(path.join(dist,'licenses'),{recursive:true});for(const pkg of ['three','leaflet'])fs.copyFileSync('node_modules/'+pkg+'/LICENSE',path.join(dist,'licenses',pkg+'-LICENSE'));
fs.mkdirSync(path.join(dist,'src/ui/assets'),{recursive:true});for(const f of fs.readdirSync('src/ui/assets'))if(!f.endsWith('.js'))fs.copyFileSync('src/ui/assets/'+f,path.join(dist,'src/ui/assets',f));
// Source maps are local debug artifacts, not part of the deployment.
for(const f of fs.readdirSync(path.join(dist,'js')))if(f.endsWith('.map'))fs.unlinkSync(path.join(dist,'js',f));
fs.writeFileSync(path.join(dist,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n');
console.log('BVLOS build ready: dist/');
