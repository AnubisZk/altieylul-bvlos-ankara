import {pointInRing} from './area.js';
export function musicTrackAt(position,zone,current=null){
  if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.z)||!zone?.ring?.length)return current||'ankara';
  const inside=pointInRing(position.x,position.z,zone.ring);
  return inside?'anitkabir':'ankara';
}
