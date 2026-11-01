import {pointInRing,distanceToRing} from './area.js';
export function musicTrackAt(position,zone,current=null){
  if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.z)||!zone?.ring?.length)return current||'ankara';
  const inside=pointInRing(position.x,position.z,zone.ring);
  // Avoid restarting tracks when hovering along the perimeter.
  if(current&&distanceToRing(position.x,position.z,zone.ring)<8)return current;
  return inside?'anitkabir':'ankara';
}
