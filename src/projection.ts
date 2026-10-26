import type {Point} from './model';
type Matrix=number[];
export type FloorProjection={corners:Point[];width:number;height:number;anchor:Point};
const EPS=1e-9;
const turn=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
const normalized=(p:Point)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=1&&p.y<=1;
export function validQuad(points:Point[]){
 if(points.length!==4||!points.every(normalized))return false;
 const turns=points.map((p,i)=>turn(p,points[(i+1)%4],points[(i+2)%4]));
 const area=Math.abs(points.reduce((s,p,i)=>s+p.x*points[(i+1)%4].y-p.y*points[(i+1)%4].x,0))/2;
 return area>=.002&&turns.every(t=>Math.abs(t)>1e-5)&&turns.every(t=>Math.sign(t)===Math.sign(turns[0]));
}
function solve(rows:number[][]):number[]{
 for(let col=0;col<8;col++){
 let pivot=col;for(let row=col+1;row<8;row++)if(Math.abs(rows[row][col])>Math.abs(rows[pivot][col]))pivot=row;
 if(Math.abs(rows[pivot][col])<EPS)throw Error('Точки почти лежат на одной линии. Выберите более широкий участок пола.');
 [rows[col],rows[pivot]]=[rows[pivot],rows[col]];const divisor=rows[col][col];for(let j=col;j<=8;j++)rows[col][j]/=divisor;
 for(let row=0;row<8;row++)if(row!==col){const factor=rows[row][col];for(let j=col;j<=8;j++)rows[row][j]-=factor*rows[col][j]}
 }
 return rows.map(r=>r[8]);
}
function fit(source:Point[],target:Point[]):Matrix{
 const rows=source.flatMap(({x,y},i)=>{const {x:u,y:v}=target[i];return[[x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]]});
 return [...solve(rows),1];
}
function transform(matrix:Matrix,p:Point):Point{
 const d=matrix[6]*p.x+matrix[7]*p.y+matrix[8];if(Math.abs(d)<EPS)throw Error('Точка слишком близка к горизонту изображения.');
 return{x:(matrix[0]*p.x+matrix[1]*p.y+matrix[2])/d,y:(matrix[3]*p.x+matrix[4]*p.y+matrix[5])/d};
}
export function pointInQuad(p:Point,quad:Point[]){
 if(!normalized(p))return false;
 const turns=quad.map((q,i)=>turn(q,quad[(i+1)%4],p));return turns.every(t=>t>=-EPS)||turns.every(t=>t<=EPS);
}
export function calibrateFloor(corners:Point[],width:number,height:number){
 if(!validQuad(corners))throw Error('Нужны четыре угла выпуклого участка пола по периметру. Точки не должны пересекаться или лежать на одной линии.');
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>100||height>100)throw Error('Некорректный размер участка.');
 const unit=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],forward=fit(corners,unit),reverse=fit(unit,corners);
 return {
 toFloor(p:Point){if(!pointInQuad(p,corners))throw Error('Точка опоры находится вне откалиброванного участка.');const t=transform(forward,p);return{x:Math.max(0,Math.min(width,t.x*width)),y:Math.max(0,Math.min(height,t.y*height))}},
 toPhoto(p:Point){return transform(reverse,{x:p.x/width,y:p.y/height})},
 };
}
export function validProjection(v:unknown):v is FloorProjection{
 if(!v||typeof v!=='object')return false;const p=v as FloorProjection;
 if(!Array.isArray(p.corners)||!normalized(p.anchor))return false;
 try{const calibration=calibrateFloor(p.corners,p.width,p.height);calibration.toFloor(p.anchor);return true}catch{return false}
}
export function footprintAt(center:Point,width:number,depth:number){return{x:center.x-width/2,y:center.y-depth/2}}
