import {pathLength,type Point} from './model';
export type Actor={path:Point[];speed:number;delay:number};
export function duration(a:Actor){return a.delay+pathLength(a.path)/a.speed}
export function positionAt(a:Actor,time:number):Point{
 let remaining=Math.max(0,time-a.delay)*a.speed;
 for(let i=1;i<a.path.length;i++){const p=a.path[i-1],q=a.path[i],len=Math.hypot(q.x-p.x,q.y-p.y);if(len>0&&remaining<len){const t=remaining/len;return{x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t}}remaining-=len}
 return a.path.at(-1)!;
}
function breaks(a:Actor){let t=a.delay;const result=[0,t];for(let i=1;i<a.path.length;i++){t+=Math.hypot(a.path[i].x-a.path[i-1].x,a.path[i].y-a.path[i-1].y)/a.speed;result.push(t)}return result}
export function simulate(a:Actor,b:Actor,threshold:number){
 const end=Math.max(duration(a),duration(b)),times=[...new Set([...breaks(a),...breaks(b),end])].sort((x,y)=>x-y);
 let minDistance=Infinity,closestAt=0;const windows:{start:number;end:number}[]=[];
 for(let i=1;i<times.length;i++){
 const start=times[i-1],dt=times[i]-start;if(dt<=0)continue;
 const p=positionAt(a,start),q=positionAt(b,start),pn=positionAt(a,times[i]),qn=positionAt(b,times[i]);
 const rx=p.x-q.x,ry=p.y-q.y,vx=(pn.x-qn.x-rx)/dt,vy=(pn.y-qn.y-ry)/dt;
 const aa=vx*vx+vy*vy,bb=2*(rx*vx+ry*vy),cc=rx*rx+ry*ry-threshold*threshold;
 const t=aa>1e-12?Math.max(0,Math.min(dt,-bb/(2*aa))):0,dist=Math.hypot(rx+vx*t,ry+vy*t);
 if(dist<minDistance){minDistance=dist;closestAt=start+t}
 let from=0,to=dt;
 if(aa<1e-12){if(cc>0)continue}else{const disc=bb*bb-4*aa*cc;if(disc<0)continue;from=Math.max(0,(-bb-Math.sqrt(disc))/(2*aa));to=Math.min(dt,(-bb+Math.sqrt(disc))/(2*aa));if(from>to)continue}
 const previous=windows.at(-1);if(previous&&start+from<=previous.end+1e-8)previous.end=Math.max(previous.end,start+to);else windows.push({start:start+from,end:start+to});
 }
 if(!Number.isFinite(minDistance)){const p=positionAt(a,0),q=positionAt(b,0);minDistance=Math.hypot(p.x-q.x,p.y-q.y);if(minDistance<=threshold)windows.push({start:0,end:0})}
 return{end,minDistance,closestAt,windows};
}
