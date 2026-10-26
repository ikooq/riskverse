export type Point={x:number;y:number};
import {validEvidence,type Evidence} from './evidence';
export type Item={id:string;name:string;kind:'rack'|'pallet'|'barrier';x:number;y:number;w:number;h:number;height:number;evidence?:Evidence};
export type Scene={version:1;name:string;width:number;height:number;items:Item[];pedestrian:Point[];vehicle:Point[];clearance:number;source?:{kind:'photo';id:string;fileName:string}};
export type Finding={id:string;type:'blocked'|'vehicleBlocked'|'overlap'|'crossing'|'visibility';severity:'high'|'medium';title:string;detail:string;evidence:string;action:string;point:Point;itemId?:string;otherItemId?:string;sightline?:[Point,Point]};
export const VEHICLE_CLEARANCE=1;
export const initialScene:Scene={version:1,name:'Склад · участок А',width:24,height:16,items:[
{id:'r1',name:'Стеллаж A',kind:'rack',x:3,y:2,w:6,h:2,height:2.4},
{id:'r2',name:'Стеллаж B',kind:'rack',x:3,y:5,w:6,h:2,height:2.4},
{id:'r3',name:'Стеллаж C',kind:'rack',x:18,y:10,w:3,h:4,height:2.4},
{id:'p1',name:'Паллеты 01',kind:'pallet',x:6,y:11,w:3,h:2,height:1.3},
{id:'p2',name:'Паллеты 02',kind:'pallet',x:12,y:9,w:2,h:2,height:1.7}],pedestrian:[{x:1,y:12},{x:15,y:12},{x:15,y:3},{x:23,y:3}],vehicle:[{x:1,y:8},{x:23,y:8}],clearance:1.2};
export function clone<T>(a:T):T{return structuredClone(a)}
export function intersection(a:Point,b:Point,c:Point,d:Point):Point|null{
 const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
 if(Math.abs(den)<1e-9){
 const on=(p:Point,q:Point,r:Point)=>Math.abs((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x))<1e-9&&r.x>=Math.min(p.x,q.x)&&r.x<=Math.max(p.x,q.x)&&r.y>=Math.min(p.y,q.y)&&r.y<=Math.max(p.y,q.y);
 return [a,b,c,d].find(p=>on(a,b,p)&&on(c,d,p))??null;
 }
 const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/den;
 return t>=0&&t<=1&&u>=0&&u<=1?{x:a.x+t*rx,y:a.y+t*ry}:null;
}
export function segmentRect(a:Point,b:Point,r:{x:number;y:number;w:number;h:number},padding=0):boolean{
 const x=r.x-padding,y=r.y-padding,w=r.w+padding*2,h=r.h+padding*2;
 const inside=(p:Point)=>p.x>=x&&p.x<=x+w&&p.y>=y&&p.y<=y+h;
 if(inside(a)||inside(b))return true;
 const p=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
 return p.some((v,i)=>!!intersection(a,b,v,p[(i+1)%4]));
}
export function rectanglesOverlap(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number},minimumArea=.04):boolean{
 const width=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),height=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
 return width>0&&height>0&&width*height>=minimumArea;
}
export function segments(points:Point[]):[Point,Point][]{return points.slice(1).map((p,i)=>[points[i],p])}
export function pathLength(points:Point[]){return segments(points).reduce((s,[a,b])=>s+Math.hypot(a.x-b.x,a.y-b.y),0)}
export function analyze(scene:Scene):Finding[]{
 const findings:Finding[]=[];
 for(const item of scene.items){
 const hit=segments(scene.pedestrian).some(([a,b])=>segmentRect(a,b,item,scene.clearance/2));
 if(hit)findings.push({id:`blocked-${item.id}`,type:'blocked',severity:'high',title:'Пешеходный коридор занят',detail:`«${item.name}» пересекает коридор шириной ${scene.clearance.toFixed(1)} м.`,evidence:'Геометрия объекта пересекает маршрут с заданным запасом по ширине.',action:'Переместите объект или измените маршрут и повторно проверьте всю сцену.',point:{x:item.x+item.w/2,y:item.y+item.h/2},itemId:item.id});
 const vehicleHit=segments(scene.vehicle).some(([a,b])=>segmentRect(a,b,item,VEHICLE_CLEARANCE/2));
 if(vehicleHit)findings.push({id:`vehicle-blocked-${item.id}`,type:'vehicleBlocked',severity:'high',title:'Маршрут транспорта занят',detail:`«${item.name}» пересекает транспортный коридор шириной ${VEHICLE_CLEARANCE.toFixed(1)} м.`,evidence:'Основание объекта пересекает заданный маршрут транспорта с фиксированным модельным запасом по ширине.',action:'Переместите объект или измените транспортный маршрут, затем повторно проверьте сцену.',point:{x:item.x+item.w/2,y:item.y+item.h/2},itemId:item.id});
 }
 for(let i=0;i<scene.items.length;i++)for(let j=i+1;j<scene.items.length;j++){
 const a=scene.items[i],b=scene.items[j];
 if(rectanglesOverlap(a,b))findings.push({id:`overlap-${a.id}-${b.id}`,type:'overlap',severity:'high',title:'Объекты занимают одно место',detail:`«${a.name}» и «${b.name}» пересекаются по площади основания.`,evidence:'Пересечение прямоугольных оснований не менее 0,04 м²; касание границ не считается наложением.',action:'Разведите объекты на плане и повторно проверьте проходы и обзор.',point:{x:(Math.max(a.x,b.x)+Math.min(a.x+a.w,b.x+b.w))/2,y:(Math.max(a.y,b.y)+Math.min(a.y+a.h,b.y+b.h))/2},itemId:b.id,otherItemId:a.id});
 }
 let n=0;
 for(const [a,b] of segments(scene.pedestrian))for(const [c,d] of segments(scene.vehicle)){
 const p=intersection(a,b,c,d);if(!p)continue;
 findings.push({id:`crossing-${n++}`,type:'crossing',severity:'high',title:'Маршруты пересекаются',detail:`Общий участок движения в точке ${p.x.toFixed(1)} / ${p.y.toFixed(1)} м.`,evidence:'Пересечение осевых линий. Скорости, приоритет и время движения не моделируются.',action:'Разведите маршруты или отдельно согласуйте организацию перехода.',point:p});
 const approach=(from:Point,to:Point)=>{const len=Math.hypot(to.x-from.x,to.y-from.y);return len?{x:to.x+(from.x-to.x)*Math.min(3/len,1),y:to.y+(from.y-to.y)*Math.min(3/len,1)}:to};
 const eyeA=approach(a,p),eyeB=approach(c,p);
 for(const item of scene.items)if(item.height>=1.5&&segmentRect(eyeA,eyeB,item))findings.push({id:`visibility-${n}-${item.id}`,type:'visibility',severity:'medium',title:'Возможное ограничение обзора',detail:`«${item.name}» перекрывает модельную линию обзора перед пересечением.`,evidence:'Линия между точками за 3 м до пересечения, препятствие высотой ≥ 1,5 м. Это допущение модели.',action:'Проверьте обзор на месте. Измените расположение препятствия и сравните результат.',point:{x:item.x+item.w/2,y:item.y+item.h/2},itemId:item.id,sightline:[eyeA,eyeB]});
 }
 return findings;
}
export type PlacementSuggestion={x:number;y:number;score:number;distance:number;findings:Finding[]};
export function suggestPlacements(scene:Scene,itemId:string,limit=3,step=.5):PlacementSuggestion[]{
 const item=scene.items.find(candidate=>candidate.id===itemId);if(!item||limit<1||step<=0)return[];
 const before=analyze(scene),issuesFor=(findings:Finding[])=>findings.filter(f=>(f.itemId===itemId||f.otherItemId===itemId)&&(f.type==='blocked'||f.type==='vehicleBlocked'||f.type==='overlap'||f.type==='visibility'));
 const weight=(f:Finding)=>f.severity==='high'?100:10,initialScore=issuesFor(before).reduce((total,f)=>total+weight(f),0);if(initialScore===0)return[];
 step=Math.max(step,Math.sqrt(scene.width*scene.height/2500));
 const candidates:PlacementSuggestion[]=[];
 for(let y=0;y<=scene.height-item.h+1e-8;y+=step)for(let x=0;x<=scene.width-item.w+1e-8;x+=step){
  if(Math.abs(x-item.x)<1e-8&&Math.abs(y-item.y)<1e-8)continue;
  const rect={...item,x,y},others=scene.items.filter(candidate=>candidate.id!==itemId);
  if(others.some(other=>rectanglesOverlap(rect,other)))continue;
  if(segments(scene.pedestrian).some(([a,b])=>segmentRect(a,b,rect,scene.clearance/2))||segments(scene.vehicle).some(([a,b])=>segmentRect(a,b,rect,VEHICLE_CLEARANCE/2)))continue;
  const next={...scene,items:scene.items.map(candidate=>candidate.id===itemId?{...candidate,x:Number(x.toFixed(3)),y:Number(y.toFixed(3))}:candidate)};
  const findings=analyze(next),itemFindings=issuesFor(findings),score=itemFindings.reduce((total,f)=>total+weight(f),0);
  if(score>=initialScore)continue;
  const distance=Math.hypot(x-item.x,y-item.y);
  if(candidates.some(c=>Math.hypot(c.x-x,c.y-y)<Math.max(item.w,item.h)*.75))continue;
  candidates.push({x:Number(x.toFixed(3)),y:Number(y.toFixed(3)),score,distance,findings});
 }
 return candidates.sort((a,b)=>a.score-b.score||a.distance-b.distance||a.y-b.y||a.x-b.x).slice(0,limit);
}
export function validScene(v:unknown):v is Scene{
 if(!v||typeof v!=='object')return false;const s=v as Scene;
 const num=(x:unknown)=>typeof x==='number'&&Number.isFinite(x);
 if(s.source!==undefined&&(!s.source||s.source.kind!=='photo'||typeof s.source.id!=='string'||!s.source.id.length||s.source.id.length>100||typeof s.source.fileName!=='string'||s.source.fileName.length>255))return false;
 if(s.version!==1||typeof s.name!=='string'||s.name.length>120||!num(s.width)||!num(s.height)||s.width<5||s.width>100||s.height<5||s.height>100||!num(s.clearance)||s.clearance<0.2||s.clearance>5)return false;
 const point=(p:Point)=>p&&num(p.x)&&num(p.y)&&p.x>=0&&p.y>=0&&p.x<=s.width&&p.y<=s.height;
 if(![s.pedestrian,s.vehicle].every(p=>Array.isArray(p)&&(p.length===0||p.length>=2)&&p.length<=50&&p.every(point)))return false;
 return Array.isArray(s.items)&&s.items.length<=100&&s.items.every(i=>i&&(i.evidence===undefined||validEvidence(i.evidence))&&typeof i.id==='string'&&typeof i.name==='string'&&i.name.length<120&&['rack','pallet','barrier'].includes(i.kind)&&[i.x,i.y,i.w,i.h,i.height].every(num)&&i.x>=0&&i.y>=0&&i.w>0&&i.h>0&&i.height>=0&&i.x+i.w<=s.width&&i.y+i.h<=s.height)&&new Set(s.items.map(i=>i.id)).size===s.items.length;
}


