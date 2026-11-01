import data from '../data/ank/opening-streets.json';

// Draw the landmarks from local OSM geometry so the opening view survives a tile outage.
// All layers are passive: the same map clicks still edit mission waypoints.
export function createStreetMap(map,L){
  const layer=L.layerGroup(),bounds=L.latLngBounds([]),labels=[];
  const labelPane=map.createPane('streetNames');
  labelPane.style.zIndex='610';labelPane.style.pointerEvents='none';
  const labelGroup=L.layerGroup();
  const toLatLng=([lon,lat])=>L.latLng(lat,lon);
  const anchor=toLatLng(data.monument.coordinates);
  bounds.extend(anchor);
  L.circleMarker(anchor,{radius:4,color:'#fff4d6',fillColor:'#956323',fillOpacity:1,weight:2,interactive:false}).addTo(layer);
  const offsets=[[48,2],[42,26],[-42,20],[-46,-14],[45,-21]];
  function addLabel(name,position,offset,monument=false){
    const tag=document.createElement('span');tag.textContent=name;
    const size=[Math.round(name.length*6.2+13),18];
    const marker=L.marker(position,{pane:'streetNames',interactive:false,keyboard:false,
      icon:L.divIcon({className:'street-name'+(monument?' monument-name':''),html:tag,iconSize:size,iconAnchor:size.map(n=>n/2)})});
    const leader=L.polyline([],{pane:'streetNames',color:'#785726',weight:1,interactive:false});
    labels.push({position,offset,size,marker,leader});
  }
  addLabel(data.monument.name,anchor,[0,-15],true);
  for(const [index,street] of data.streets.entries()){
    let mainLine;
    for(const way of street.ways){
      const points=way.coordinates.map(toLatLng);
      const line=L.polyline(points,{color:'#a8691b',weight:4,opacity:.9,interactive:false}).addTo(layer);
      L.polyline(points,{color:'#ffd789',weight:2,opacity:1,interactive:false}).addTo(layer);
      bounds.extend(line.getBounds());mainLine??=points;
    }
    // Pick a point from the road itself, not the centre of the road's bounding rectangle.
    addLabel(street.name,mainLine[Math.floor(mainLine.length/2)],offsets[index]);
  }
  function layout(){
    if(!map.hasLayer(layer))return;
    labelGroup.clearLayers();const taken=[],size=map.getSize();
    for(const {position,offset,size:[width,height],marker,leader} of labels){
      const p=map.latLngToContainerPoint(position);
      if(p.x<0||p.x>size.x||p.y<0||p.y>size.y)continue;
      const trials=[offset,[offset[0],-offset[1]],[-offset[0],offset[1]],[0,-26],[0,28],[48,-40],[-48,40],[55,52],[-55,-50]];
      let best,lowest=Infinity;
      for(const [dx,dy] of trials){
        const x=Math.max(width/2+4,Math.min(size.x-width/2-4,p.x+dx));
        const y=Math.max(height/2+4,Math.min(size.y-height/2-18,p.y+dy));
        const rect={l:x-width/2-2,r:x+width/2+2,t:y-height/2-2,b:y+height/2+2};
        const overlap=taken.reduce((s,a)=>s+Math.max(0,Math.min(a.r,rect.r)-Math.max(a.l,rect.l))*Math.max(0,Math.min(a.b,rect.b)-Math.max(a.t,rect.t)),0);
        const score=overlap*1000+Math.hypot(dx-offset[0],dy-offset[1]);
        if(score<lowest){lowest=score;best={rect,point:L.point(x,y)}}
      }
      taken.push(best.rect);const place=map.containerPointToLatLng(best.point);
      leader.setLatLngs([position,place]).addTo(labelGroup);marker.setLatLng(place).addTo(labelGroup);
    }
  }
  map.on('zoomend moveend resize',layout);
  return {
    show(){layer.addTo(map);labelGroup.addTo(map);map.fitBounds(bounds,{padding:[24,28],maxZoom:17,animate:false});layout();},
    hide(){map.removeLayer(labelGroup);map.removeLayer(layer);}
  };
}
