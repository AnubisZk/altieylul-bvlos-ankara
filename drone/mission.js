// Ankara · Anıtkabir observation loop. Offsets in metres from the Tandoğan launch pad (x = east, z = south).
// ANCHOR_FROM_HOME is the Anıt Blok position seen from the pad (data/ank/region.json origin − home); the six points
// circle the complex at ~400 m. Recompute ANCHOR_FROM_HOME when the pad position is corrected from OSM data.
export const ANCHOR_FROM_HOME = [246,517];
const RING = [[-380,-200],[0,-420],[380,-220],[420,200],[0,430],[-400,180]];
export const OBSERVATION_POINTS = RING.map(([x,z])=>[ANCHOR_FROM_HOME[0]+x,ANCHOR_FROM_HOME[1]+z]);
export const createDefaultRoute = home => OBSERVATION_POINTS.map(([x,z])=>({x:home.x+x,z:home.z+z}));
// Heritage view targets (ids match data/ank/landmarks.json; distance = camera orbit radius in metres).
export const HERITAGE = [
  {id:'anit-blok',name:'Anıtkabir · Anıt Blok',distance:230},
  {id:'aslanli-yol',name:'Aslanlı Yol',distance:300},
  {id:'istiklal-hurriyet',name:'İstiklal ve Hürriyet kuleleri',distance:160},
  {id:'inonu-lahdi',name:'İsmet İnönü Lahdi',distance:150},
  {id:'baris-parki',name:'Anıtkabir · Barış Parkı',distance:650},
];
