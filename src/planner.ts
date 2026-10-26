import {intersection,segmentRect,segments,type Point,type Scene} from './model';
export type RouteResult={ok:true;path:Point[];separated:boolean;step:number;visited:number}|{ok:false;reason:string;step:number;visited:number};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
function pointDistance(p:Point,a:Point,b:Point){const len=(b.x-a.x)**2+(b.y-a.y)**2;const t=len?Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/len)):0;return distance(p,{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)})}
export function segmentDistance(a:Point,b:Point,c:Point,d:Point){return intersection(a,b,c,d)?0:Math.min(pointDistance(a,c,d),pointDistance(b,c,d),pointDistance(c,a,b),pointDistance(d,a,b))}
class Heap{
 data:{id:number;cost:number}[]=[];
 push(v:{id:number;cost:number}){let i=this.data.length;this.data.push(v);while(i>0){const p=(i-1)>>1;if(this.data[p].cost<=v.cost)break;this.data[i]=this.data[p];i=p}this.data[i]=v}
 pop(){const root=this.data[0],last=this.data.pop()!;if(this.data.length){let i=0;while(i*2+1<this.data.length){let c=i*2+1;if(c+1<this.data.length&&this.data[c+1].cost<this.data[c].cost)c++;if(last.cost<=this.data[c].cost)break;this.data[i]=this.data[c];i=c}this.data[i]=last}return root}
}
/** Grid search; rectangle obstacles inflated by half the pedestrian width.
 * First disallow the transport corridor (assumed width 1.2m), then allow it
 * with a length penalty. No claim of a globally optimal continuous route. */
export function planRoute(scene:Scene):RouteResult{
 if(scene.pedestrian.length<2)return{ok:false,reason:'Сначала задайте начало и конец пешеходного пути на плане.',step:.5,visited:0};
 const step=.5,margin=scene.clearance/2,start=scene.pedestrian[0],end=scene.pedestrian.at(-1)!;
 let visited=0;
 const inside=(p:Point)=>p.x>=margin&&p.y>=margin&&p.x<=scene.width-margin&&p.y<=scene.height-margin;
 const free=(a:Point,b:Point)=>inside(a)&&inside(b)&&!scene.items.some(i=>segmentRect(a,b,i,margin));
 if(!free(start,start)||!free(end,end))return{ok:false,reason:'Начало или конец пути занят объектом либо слишком близок к границе. Освободите точку с учётом ширины прохода.',step,visited};
 if(distance(start,end)<1e-8)return{ok:false,reason:'Начало и конец маршрута совпадают. Задайте разные точки.',step,visited};
 const vehicle=segments(scene.vehicle),near=(a:Point,b:Point)=>vehicle.some(([c,d])=>segmentDistance(a,b,c,d)<=margin+.6);
 const nx=Math.floor(scene.width/step)+1,ny=Math.floor(scene.height/step)+1,n=nx*ny,goal=n+1;
 const point=(id:number):Point=>id===n?start:id===goal?end:{x:(id%nx)*step,y:Math.floor(id/nx)*step};
 const startNodes:number[]=[];
 // Connect exact endpoints to nearby grid nodes; never snap the destinations.
 for(let y=Math.max(0,Math.floor(start.y/step)-2);y<=Math.min(ny-1,Math.ceil(start.y/step)+2);y++)for(let x=Math.max(0,Math.floor(start.x/step)-2);x<=Math.min(nx-1,Math.ceil(start.x/step)+2);x++)startNodes.push(y*nx+x);
 for(const strict of [true,false]){
 const g=new Float64Array(n+2).fill(Infinity),prev=new Int32Array(n+2).fill(-1),closed=new Uint8Array(n+2),heap=new Heap();g[n]=0;heap.push({id:n,cost:distance(start,end)});
 while(heap.data.length){const id=heap.pop().id;if(closed[id])continue;closed[id]=1;visited++;const a=point(id);
 if(id===goal){const raw:Point[]=[];for(let cur=goal;cur!==-1;cur=prev[cur])raw.push(point(cur));raw.reverse();
 // Remove only collinear nodes: no new edge may cut an obstacle or traffic corridor.
 const path:Point[]=[];for(const p of raw){if(path.length&&distance(path.at(-1)!,p)<1e-9)continue;while(path.length>=2){const b=path.at(-1)!,c=path.at(-2)!;if(Math.abs((b.x-c.x)*(p.y-b.y)-(b.y-c.y)*(p.x-b.x))>1e-8)break;path.pop()}path.push(p)}
 if(path.length>50)return{ok:false,reason:'Обход содержит больше 50 поворотов. Упростите сцену или проложите маршрут вручную.',step,visited};
 return{ok:true,path,separated:!segments(path).some(([a,b])=>near(a,b)),step,visited};}
 let neighbors:number[];
 if(id===n)neighbors=[...startNodes,...(distance(start,end)<=step*3?[goal]:[])];else{neighbors=[];const x=id%nx,y=Math.floor(id/nx);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<nx&&y+dy>=0&&y+dy<ny)neighbors.push((y+dy)*nx+x+dx);if(distance(a,end)<=step*3)neighbors.push(goal)}
 for(const next of neighbors){if(closed[next])continue;const b=point(next);if(!free(a,b))continue;const traffic=near(a,b);if(strict&&traffic)continue;const cost=g[id]+distance(a,b)*(traffic?9:1);if(cost>=g[next])continue;g[next]=cost;prev[next]=id;heap.push({id:next,cost:cost+distance(b,end)})}
 }
 }
 return{ok:false,reason:'На сетке 0,5 м обход с заданной шириной не найден. Переместите препятствия или проверьте маршрут вручную; это не доказательство отсутствия любого возможного пути.',step,visited};
}
