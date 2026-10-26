import {useEffect,useRef} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {VEHICLE_CLEARANCE,type Scene,type Finding} from './model';
export default function World({scene,findings,selected,onSelect}:{scene:Scene;findings:Finding[];selected:string|null;onSelect:(id:string)=>void}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
 const host=ref.current!;let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})}catch{host.textContent='WebGL недоступен. Переключитесь на план 2D.';return}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.appendChild(renderer.domElement);
 const world=new THREE.Scene();world.background=new THREE.Color('#17211d');
 const size=Math.max(scene.width,scene.height),camera=new THREE.PerspectiveCamera(38,1,.1,size*12);camera.position.set(scene.width/2+size*.8,size*1.15,scene.height/2+size*.9);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(scene.width/2,0,scene.height/2);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2.15;controls.minDistance=Math.max(4,size*.4);controls.maxDistance=size*4;
 world.add(new THREE.HemisphereLight(0xd9f2dc,0x354137,2.5));const light=new THREE.DirectionalLight(0xffedd2,3);light.position.set(12,30,12);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-25,right:25,top:25,bottom:-25});world.add(light);
 const material=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.75});
 function box(x:number,y:number,z:number,w:number,h:number,d:number,color:string,id?:string){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x+w/2,y+h/2,z+d/2);m.castShadow=true;m.receiveShadow=true;if(id)m.userData.id=id;world.add(m);return m}
 box(0,-.3,0,scene.width,.3,scene.height,'#26332c');const grid=new THREE.GridHelper(Math.max(scene.width,scene.height),Math.max(scene.width,scene.height),0x435649,0x34473c);grid.position.set(scene.width/2,.01,scene.height/2);world.add(grid);
 box(0,0,0,scene.width,.4,.15,'#4c6154');box(0,0,0,.15,.4,scene.height,'#4c6154');
 const route=(points:Scene['vehicle'],color:string,width:number)=>{for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=Math.hypot(b.x-a.x,b.y-a.y);const g=new THREE.PlaneGeometry(len,width);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.35,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.rotation.z=-Math.atan2(b.y-a.y,b.x-a.x);m.position.set((a.x+b.x)/2,.025,(a.y+b.y)/2);world.add(m)}};
 route(scene.pedestrian,'#7ccab1',scene.clearance);route(scene.vehicle,'#dba354',VEHICLE_CLEARANCE);
 for(const f of findings.filter(f=>f.sightline&&f.itemId===selected)){
 const points=f.sightline!.map(p=>new THREE.Vector3(p.x,1.5,p.y));
 const sight=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:'#ffe0a0',dashSize:.2,gapSize:.12,depthTest:false}));sight.computeLineDistances();sight.renderOrder=10;world.add(sight);
 for(const p of points){const eye=new THREE.Mesh(new THREE.SphereGeometry(.16,12,12),material('#ffe0a0'));eye.position.copy(p);world.add(eye)}
 }
 for(const i of scene.items){const color=i.id===selected?'#b8d98c':i.kind==='rack'?'#607c6c':i.kind==='pallet'?'#b88c61':'#d1b461';
 if(i.kind==='rack'){for(const x of [i.x+.06,i.x+i.w-.16])for(const z of [i.y+.06,i.y+i.h-.16])box(x,0,z,.1,i.height,.1,color,i.id);for(const y of [.12,i.height*.5,i.height]){box(i.x,y,i.y,i.w,.1,i.h,color,i.id);if(y<i.height)for(let x=i.x+.18;x<i.x+i.w-.6;x+=.85)box(x,y+.12,i.y+.2,.65,.72,i.h-.4,'#ad9271',i.id)}}
 else{box(i.x,.07,i.y,i.w,.12,i.h,'#785638',i.id);box(i.x+.07,.19,i.y+.07,i.w-.14,Math.max(.1,i.height-.2),i.h-.14,color,i.id)}
 }
 for(const f of findings){const m=new THREE.Mesh(new THREE.RingGeometry(.45,.58,48),new THREE.MeshBasicMaterial({color:f.severity==='high'?'#ff876b':'#e9c36a',side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(f.point.x,.045,f.point.y);world.add(m);const stem=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,3,8),new THREE.MeshBasicMaterial({color:'#f39871',transparent:true,opacity:.45}));stem.position.set(f.point.x,1.5,f.point.y);world.add(stem);const beacon=new THREE.Mesh(new THREE.SphereGeometry(.18,16,16),material('#ff956d'));beacon.position.set(f.point.x,3.1,f.point.y);world.add(beacon)}
 const ray=new THREE.Raycaster();const pointer=new THREE.Vector2();let down={x:0,y:0};const start=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY}};const click=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(world.children).find(h=>h.object.userData.id);if(hit)onSelect(hit.object.userData.id)};
 renderer.domElement.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointerup',click);
 const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()});resize.observe(host);
 let frame=0;const loop=()=>{controls.update();renderer.render(world,camera);frame=requestAnimationFrame(loop)};loop();
 return()=>{cancelAnimationFrame(frame);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',start);renderer.domElement.removeEventListener('pointerup',click);world.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose())}});renderer.dispose();renderer.domElement.remove()};
 },[scene,findings,selected,onSelect]);
 return <div className="world" ref={ref} aria-label="Трёхмерная модель склада. Вращайте мышью, выбирайте объекты нажатием."/>;
}
