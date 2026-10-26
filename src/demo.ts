import {clone,initialScene,type Scene} from './model';
export const demoPhotoId='demo-axisadman-warehouse';
export function demonstrationScene():Scene{
 const s=clone(initialScene);s.name='Учебный аудит · реальное фото склада';s.source={kind:'photo',id:demoPhotoId,fileName:'warehouse-demo.jpg'};
 s.items=s.items.map(item=>item.id==='p1'?{...item,height:1.7}:item.id==='p2'?{...item,x:18,y:0}:item);
 const regions=[{x:.02,y:.32,w:.45,h:.29},{x:.57,y:.34,w:.4,h:.28},{x:.7,y:.57,w:.28,h:.14},{x:.22,y:.59,w:.25,h:.12},{x:.51,y:.59,w:.14,h:.08}];
 s.items=s.items.map((item,i)=>({...item,evidence:{sourceId:demoPhotoId,fileName:'warehouse-demo.jpg',region:regions[i],method:'manual',note:'Ручная учебная привязка к фотографии. Размеры, размещение и маршруты условные; не результат AI и не измерение реального склада.'}}));
 return s;
}
export const demoPlacements=[
 {id:'original',label:'Исходное размещение',caption:'Паллеты в пешеходном коридоре',x:6,y:11},
 {id:'nearby',label:'Убрать с прохода',caption:'Перенос ближе к пересечению',x:11,y:9},
 {id:'alternative',label:'Проверить другое место',caption:'Перенос к свободной стене',x:10,y:0},
] as const;
export function placeDemoPallet(scene:Scene,placement:typeof demoPlacements[number]):Scene{
 const item=scene.items.find(i=>i.id==='p1');
 if(!item||placement.x+item.w>scene.width||placement.y+item.h>scene.height)return scene;
 return {...scene,items:scene.items.map(i=>i.id==='p1'?{...i,x:placement.x,y:placement.y}:i)};
}
