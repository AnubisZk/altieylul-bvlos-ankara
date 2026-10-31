// Uses only existing terrain/obstacle data; this is a classroom landing check.
export function canLandHere(sim,world,harbor){
  if(!world||!sim||!Number.isFinite(sim.y))return false;
  const {x,z}=sim,atPad=Math.hypot(x-sim.home.x,z-sim.home.z)<1.1;
  const y=world.getGroundHeight(x,z);
  if(!Number.isFinite(y))return false;
  if(!atPad){
    for(const [dx,dz] of [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]]){
      const ground=world.getGroundHeight(x+dx,z+dz),obstacle=world.getObstacleHeight(x+dx,z+dz);
      // World layers return -Infinity when there is no obstacle.
      if(world.isWater(x+dx,z+dz)||!Number.isFinite(ground)||(obstacle!==-Infinity&&!Number.isFinite(obstacle))||Math.abs(ground-y)>.35||obstacle>ground+.2)return false;
    }
  }
  for(let h=y+.5;h<=sim.y;h+=.5)if(world.hitTest(x,h,z,.3)||harbor?.hitTest(x,h,z,.3))return false;
  return true;
}
export function gamepadSafety(sim){
  if(!sim)return false;
  sim.manual={forward:0,side:0,vertical:0,yaw:0};
  sim.manualForward=sim.manualSide=sim.yawSpeed=0;
  if(['manual','takeoff'].includes(sim.mode)&&sim.link>0){
    sim.hold();sim.log('Oyun kolu kontrolü kesildi · konum korunuyor. Manuel düğmesiyle kontrolü al.');
    return true;
  }
  return false;
}
