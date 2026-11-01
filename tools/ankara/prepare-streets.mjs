import fs from 'node:fs';

// Rebuild the small opening-map overlay from the already packaged Ankara extract.
const data = JSON.parse(fs.readFileSync('data/ank/ground.json','utf8'));
const landmarks = JSON.parse(fs.readFileSync('data/ank/landmarks.json','utf8'));
const ways = new Map(data.features.map(feature => [feature.id,feature]));
const streets = [
  ['Ordular Sokak',[25428631]],
  ['İlk Sokak',[25428628]],
  ['Hedef Sokak',[25428626]],
  ['Akdeniz Caddesi',[26004615,651818744]], // the two carriageways beside the four streets
  ['İleri Sokak',[34512635]],
].map(([name,ids]) => ({
  name, ways:ids.map(id => {
    const way=ways.get(id);
    if (!way?.tags.highway) throw Error(`Missing Ankara street way ${id}`);
    return {osm:id,sourceName:way.tags.name,coordinates:way.coordinates};
  })
}));
const monument = landmarks.landmarks.find(site => site.id==='anit-blok');
if (!monument) throw Error('Missing Anıt Blok landmark');
fs.writeFileSync('data/ank/opening-streets.json',JSON.stringify({
  source:data.source,license:data.license,sourceUrl:data.sourceUrl,timestamp:data.timestamp,
  monument:{name:'Anıtkabir',coordinates:[monument.lon,monument.lat],osm:monument.osm},streets
})+'\n');
