import fs from 'node:fs';import path from 'node:path';import {bundlePage} from './build/bundle.mjs';
import {imageryConfig} from './build/imagery-config.mjs';
const root=process.cwd(),dist=path.join(root,'dist');fs.mkdirSync(dist,{recursive:true});
const jsDir=path.join(dist,'js');if(fs.existsSync(jsDir))for(const f of fs.readdirSync(jsDir))if(/\.(js|map)$/.test(f))fs.unlinkSync(path.join(jsDir,f));
await bundlePage({root,dist,page:'index.html'});
for(const f of ['style.css','cdn.js','icon.svg','LICENSE','NOTICE','ASSETS-LICENSE.md'])fs.copyFileSync(path.join(root,f),path.join(dist,f));
fs.rmSync(path.join(dist,'data'),{recursive:true,force:true});fs.cpSync('data/ank',path.join(dist,'data/ank'),{recursive:true,filter:src=>!/report\.txt$/.test(src)});
// Only a public-app basemap key restricted to this site's referrers belongs here.
// Never commit account credentials or private/admin API keys.
const imagery=imageryConfig({readLocal:()=>fs.existsSync('imagery.local.json')?JSON.parse(fs.readFileSync('imagery.local.json','utf8').replace(/^\uFEFF/,'')):null});
fs.writeFileSync(path.join(dist,'data/ank/imagery.json'),JSON.stringify(imagery));
const musicDist=path.join(dist,'music');fs.rmSync(musicDist,{recursive:true,force:true});
fs.cpSync('music/guide-emel-v2',path.join(musicDist,'guide-emel-v2'),{recursive:true});
const tracks=JSON.parse(fs.readFileSync('drone/music-tracks.json','utf8'));
for(const track of Object.values(tracks))if(track.src){
  if(!/^music\/[a-z0-9-]+\.(mp3|m4a|ogg|wav)$/.test(track.src))throw Error('Invalid music asset path');
  fs.copyFileSync(track.src,path.join(dist,track.src));
}
fs.mkdirSync(path.join(dist,'models'),{recursive:true});for(const f of ['bilsem-surveyor.glb','anitkabir.glb','turk-bayragi.glb','anit-blok.glb','anit-blok-colliders.glb','heykel-erkek.glb','heykel-kadin.glb'])if(fs.existsSync('models/'+f))fs.copyFileSync('models/'+f,path.join(dist,'models',f));
fs.mkdirSync(path.join(dist,'models/aslanli-yol'),{recursive:true});for(const f of ['aslanli_yol_high.glb','aslanli_yol_low.glb','aslanli_yol_colliders.glb'])if(fs.existsSync('models/aslanli-yol/'+f))fs.copyFileSync('models/aslanli-yol/'+f,path.join(dist,'models/aslanli-yol',f));
fs.mkdirSync(path.join(dist,'vendor'),{recursive:true});for(const f of ['leaflet.js','leaflet.css'])fs.copyFileSync('node_modules/leaflet/dist/'+f,path.join(dist,'vendor',f));fs.cpSync('node_modules/leaflet/dist/images',path.join(dist,'vendor/images'),{recursive:true});
fs.mkdirSync(path.join(dist,'licenses'),{recursive:true});for(const pkg of ['three','leaflet'])fs.copyFileSync('node_modules/'+pkg+'/LICENSE',path.join(dist,'licenses',pkg+'-LICENSE'));
fs.mkdirSync(path.join(dist,'src/ui/assets'),{recursive:true});for(const f of fs.readdirSync('src/ui/assets'))if(!f.endsWith('.js'))fs.copyFileSync('src/ui/assets/'+f,path.join(dist,'src/ui/assets',f));
// Source maps are local debug artifacts, not part of the deployment.
for(const f of fs.readdirSync(path.join(dist,'js')))if(f.endsWith('.map'))fs.unlinkSync(path.join(dist,'js',f));
fs.writeFileSync(path.join(dist,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n');
console.log('BVLOS build ready: dist/');
