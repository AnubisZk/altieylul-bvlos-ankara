import bpy, math, os
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0,rough=.4):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
carbon=mat('Graphite composite',(.038,.046,.055),.5,.34)
shell=mat('Ceramic grey',(.38,.43,.45),.28,.3)
dark=mat('Rubber',(.012,.016,.022),.1,.58)
metal=mat('Anodized aluminium',(.17,.21,.24),.85,.22)
accent=mat('BILSEM turquoise',(.025,.7,.64),.45,.3)
glass=mat('Optical lens',(.018,.09,.14),.85,.09)
red=mat('Port red',(.8,.035,.018),.1,.22)
green=mat('Starboard green',(.03,.85,.3),.1,.22)
white=mat('Satin white identity panels',(.96,.96,.96),0,.44)
# Use the supplied artwork unchanged. UV regions arrange the original symbol and
# wordmark horizontally on the side panels, preserving Turkish lettering.
brand=mat('Altieylul Bilsem supplied artwork',(1,1,1),0,.44)
image=bpy.data.images.load(os.path.join(root,'models','branding','altieylul-bilsem.png'))
image.pack()
tex=brand.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
brand.node_tree.links.new(tex.outputs['Color'],brand.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
def decal(name,center,u,v,width,height,uv=(0,0,1,1)):
 c,u,v=Vector(center),Vector(u),Vector(v)
 vertices=[c+u*a*width+v*b*height for a,b in [(-.5,-.5),(.5,-.5),(.5,.5),(-.5,.5)]]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],[(0,1,2,3)]);mesh.update()
 layer=mesh.uv_layers.new(name='UVMap');x0,y0,x1,y1=uv
 for loop,coord in zip(layer.data,[(x0,y0),(x1,y0),(x1,y1),(x0,y1)]):loop.uv=coord
 obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(brand)
 return obj
def finish(o,n,m):
 o.name=n;o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 return o
def box(n,loc,scale,m,bevel=.01):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:mod=o.modifiers.new('Machined edges','BEVEL');mod.width=bevel;mod.segments=3;mod=o.modifiers.new('Normals','WEIGHTED_NORMAL')
 return finish(o,n,m)
def cyl(n,loc,r,depth,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=depth,location=loc);return finish(bpy.context.object,n,m)
def rod(n,a,b,r,m):
 a,b=Vector(a),Vector(b);o=cyl(n,(a+b)/2,r,(a-b).length,m);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
box('Airframe',(0,0,.11),(.24,.38,.1),carbon,.035)
box('Top shell',(0,0,.17),(.225,.32,.07),shell,.028)
box('Battery removable',(0,-.03,.225),(.15,.235,.04),dark,.008)
box('Battery latch',(0,-.16,.23),(.065,.03,.012),accent,.004)
box('Front identity stripe',(0,.155,.205),(.17,.014,.012),accent,.003)
for i in range(7):
 for sign in [-1,1]:box('Cooling fin',(sign*.118,-.07+i*.022,.128),(.008,.01,.038),dark,.002)
for sx in [-1,1]:
 for sy in [-1,1]:
  x,y=sx*.36,sy*.31
  rod('Carbon arm',(sx*.08,sy*.09,.11),(x,y,.13),.026,carbon)
  rod('Arm seam',(sx*.11,sy*.12,.134),(x*.89,y*.89,.155),.004,accent if sy==1 else metal)
  cyl('Motor mount',(x,y,.145),.046,.03,metal)
  cyl('Brushless motor',(x,y,.182),.037,.049,dark)
  for j in range(12):
   a=j*math.tau/12;box('Motor cooling slot',(x+.037*math.cos(a),y+.037*math.sin(a),.185),(.007,.007,.023),metal,.001)
  cyl('Motor bell',(x,y,.211),.033,.008,metal)
  bpy.ops.object.empty_add(type='PLAIN_AXES',location=(x,y,.22));rot=bpy.context.object;rot.name='Rotor_%s_%s'%(sx,sy)
  for sign in [-1,1]:
   blade=box('Propeller blade',(x+sign*.10,y,.222),(.235,.025,.005),carbon,.01);blade.rotation_euler.z=sign*.08;blade.parent=rot;blade.matrix_parent_inverse=rot.matrix_world.inverted()
  cap=cyl('Propeller hub',(x,y,.228),.014,.014,metal);cap.parent=rot;cap.matrix_parent_inverse=rot.matrix_world.inverted()
  cyl('Position LED',(x,y,.128),.013,.009,red if sx<0 else green)
  rod('Landing strut',(sx*.10,sy*.13,.07),(sx*.17,sy*.14,-.14),.009,metal)
  for xx in [-1,1]:cyl('Hex bolt',(x+xx*.024,y,.217),.003,.004,shell)
for sx in [-1,1]:rod('Landing skid',(sx*.17,-.24,-.15),(sx*.17,.25,-.15),.012,dark)
cyl('GPS pedestal',(0,-.11,.276),.028,.055,metal)
cyl('GNSS dome',(0,-.11,.307),.04,.014,shell)
for sx in [-1,1]:rod('Antenna',(sx*.085,-.15,.19),(sx*.115,-.20,.34),.004,dark)
box('Gimbal mount',(0,.135,.035),(.06,.055,.05),metal,.009)
rod('Gimbal pivot',(-.055,.15,-.007),(.055,.15,-.007),.013,metal)
box('Camera',(0,.17,-.045),(.078,.075,.067),dark,.018)
lens=cyl('Lens barrel',(0,.218,-.043),.028,.025,metal);lens.rotation_euler.x=math.pi/2
lens=cyl('Front optical element',(0,.232,-.043),.023,.003,glass);lens.rotation_euler.x=math.pi/2
for sx in [-1,1]:
 o=cyl('Forward obstacle sensor',(sx*.065,.189,.115),.012,.008,glass);o.rotation_euler.x=math.pi/2
# Low-profile white plaques sit clear of the cooling fins and battery latch.
for sx in [-1,1]:
 box('White identity side panel',(sx*.115,0,.179),(.012,.25,.064),white,.006)
 u=(0,sx,0);v=(0,0,1)
 decal('Side school symbol',(sx*.1214,-sx*.087,.179),u,v,.040,.053,(.285,.35,.73,.93))
 decal('Side school name',(sx*.1214,sx*.021,.179),u,v,.151,.060,(.223,.105,.781,.334))
box('White top identity panel',(0,.025,.247),(.133,.148,.004),white,.004)
decal('Top school logo and name',(0,.025,.2492),(1,0,0),(0,1,0),.128,.128)
# Join static meshes to reduce draw calls; rotor assemblies remain individually named.
bpy.ops.object.select_all(action='DESELECT')
static=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.parent]
for o in static:o.select_set(True)
bpy.context.view_layer.objects.active=static[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.join();bpy.context.object.name='BILSEM_Surveyor_Airframe'
os.makedirs(os.path.join(root,'models'),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root,'models','bilsem-surveyor.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(root,'models','bilsem-surveyor.glb'),export_format='GLB',export_yup=True,export_apply=True)
print('BILSEM Surveyor exported')
