import * as T from 'three';

// Patch world materials only. The DOM map and the separate XR room are untouched.
// Thermal intensity comes from synthetic surface classes, never RGB photo brightness.
export function createNightVisuals({scene,world,model,home,fill}){
  const uniforms={uTrainingDusk:{value:0},uTrainingNight:{value:0},uTrainingThermal:{value:0},uTrainingHaze:{value:0}};
  const patched=new WeakSet(),env=world.environment,baseEnv=scene.environmentIntensity,baseFill=fill.intensity;
  const nightLights=new T.Group();nightLights.name='Training navigation lights';scene.add(nightLights);
  function glow(color){const m=new T.MeshBasicMaterial({color,toneMapped:false});m.userData.trainingLamp=true;return m;}
  const mint=glow(0x70ffe0),red=glow(0xff3b36),green=glow(0x46ff99),white=glow(0xffffff);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const lamp=new T.Mesh(new T.SphereGeometry(.025,12,8),mint);lamp.position.set(home.x+Math.cos(a)*1.27,world.getGroundHeight(home.x,home.z)+.19,home.z+Math.sin(a)*1.27);nightLights.add(lamp);}
  const nav=new T.Group();nav.name='Drone night navigation lights';model.add(nav);
  for(const [x,z,m] of [[-.32,0,red],[.32,0,green],[0,.28,white]]){const lamp=new T.Mesh(new T.SphereGeometry(.018,12,8),m);lamp.position.set(x,.05,z);nav.add(lamp);}
  // One short-range, shadowless lamp; no per-building point lights.
  const padLight=new T.PointLight(0x90ffe5,0,14,2);padLight.position.set(home.x,world.getGroundHeight(home.x,home.z)+2.5,home.z);scene.add(padLight);
  function patch(m){
    if(!m||patched.has(m))return;patched.add(m);
    const sky=m.name==='sf-sky',terrain=m.name==='sf-terrain';
    if(!sky&&!m.isMeshStandardMaterial&&!m.isMeshBasicMaterial&&!m.isMeshLambertMaterial&&!m.isMeshPhongMaterial)return;
    const previous=m.onBeforeCompile,cacheKey=m.customProgramCacheKey();
    m.onBeforeCompile=function(sh,renderer){
      previous.call(this,sh,renderer);Object.assign(sh.uniforms,uniforms);
      sh.uniforms.uTrainingHeat={value:m.userData.trainingHeat??(m.userData.trainingLamp ? .18 : m.name.includes('lead') ? .29 : .34)};
      const declaration='uniform float uTrainingDusk; uniform float uTrainingNight; uniform float uTrainingThermal; uniform float uTrainingHaze; uniform float uTrainingHeat;\n';
      sh.fragmentShader=declaration+sh.fragmentShader;
      if(sky){
        sh.fragmentShader=sh.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
          vec3 sd=normalize(vDir);
          float horizonGlow=pow(1.0-abs(sd.y),4.0);
          vec3 evening=mix(vec3(.065,.075,.16),vec3(.62,.27,.13),horizonGlow);
          vec3 midnight=mix(vec3(.009,.018,.045),vec3(.047,.066,.105),horizonGlow);
          vec2 starCell=floor(vec2(atan(sd.z,sd.x)*600.0,asin(sd.y)*600.0));
          float star=step(.9986,fract(sin(dot(starCell,vec2(12.9898,78.233)))*43758.5453))*smoothstep(.08,.4,sd.y);
          float moon=smoothstep(.99978,.99992,dot(sd,normalize(vec3(.35,.6,-.7))));
          midnight+=(star*.4+moon*.75)*(1.0-uOvercast);
          gl_FragColor.rgb=mix(gl_FragColor.rgb,evening,uTrainingDusk);
          gl_FragColor.rgb=mix(gl_FragColor.rgb,midnight,uTrainingNight);
          if(uTrainingThermal>.5)gl_FragColor.rgb=vec3(uTrainingThermal>1.5?.97:.03);
        `);
      }else{
        sh.vertexShader='varying vec3 vTrainingWorld;\n'+sh.vertexShader;
        sh.vertexShader=sh.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
          vec4 trainingPos=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            trainingPos=instanceMatrix*trainingPos;
          #endif
          vTrainingWorld=(modelMatrix*trainingPos).xyz;
        `);
        sh.fragmentShader='varying vec3 vTrainingWorld;\n'+sh.fragmentShader;
        const effect=`
          ${m.userData.trainingLamp?'':`gl_FragColor.rgb*=mix(vec3(1.0),vec3(.76,.66,.67),uTrainingDusk);
          gl_FragColor.rgb*=mix(vec3(1.0),vec3(.25,.34,.53),uTrainingNight);`}
          ${m.name==='heritage_limestone'?`gl_FragColor.rgb+=vec3(.14,.085,.032)*(uTrainingDusk*.5+uTrainingNight);`:''}
          if(uTrainingThermal>.5){
            float heat=${terrain?'mix(.14,.30,sfLandA)':'uTrainingHeat'};
            vec3 surfaceNormal=normalize(cross(dFdx(vTrainingWorld),dFdy(vTrainingWorld))+vec3(.00001));
            heat+=.035*abs(surfaceNormal.y)+.014*sin(vTrainingWorld.x*.35)*sin(vTrainingWorld.z*.29);
            float range=length(cameraPosition-vTrainingWorld);
            heat=mix(heat,.25,clamp(range/(3000.0-uTrainingHaze*2100.0),0.0,.85));
            heat=clamp(heat,.02,.98);
            gl_FragColor.rgb=vec3(uTrainingThermal>1.5?1.0-heat:heat);
          }
        `;
        sh.fragmentShader=sh.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\n'+effect);
      }
    };
    m.customProgramCacheKey=()=>cacheKey+'-training-night-thermal-v1';m.needsUpdate=true;
  }
  return {update({dusk,night,thermal,haze=0}){
    uniforms.uTrainingDusk.value=dusk;uniforms.uTrainingNight.value=night;uniforms.uTrainingThermal.value=thermal;uniforms.uTrainingHaze.value=haze;
    // setWeather restores these base intensities immediately before this call.
    env.sun.intensity*=1-.65*dusk-.985*night;env.hemi.intensity*=1-.35*dusk-.8*night;
    fill.intensity=baseFill*(1-.35*dusk-.92*night);scene.environmentIntensity=baseEnv*(1-.55*dusk-.96*night);
    // The sky shader carries the cloud cover at night; avoid daylight cloud discs.
    if(night>.5||dusk>.5)env.clouds.mesh.visible=false;
    nightLights.visible=nav.visible=dusk+night>.02;padLight.intensity=(dusk*.35+night)*12;
    scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])patch(m);});
  }};
}
