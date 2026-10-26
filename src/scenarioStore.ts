import {comparisonConditions} from './comparison';
import {analyze,pathLength,validScene,type Scene} from './model';
export type Scenario={id:string;name:string;createdAt:string;scene:Scene};
export function validScenarios(value:unknown):value is Scenario[]{return Array.isArray(value)&&value.length<=8&&value.every(s=>s&&typeof s.id==='string'&&s.id.length>0&&s.id.length<100&&typeof s.name==='string'&&s.name.trim().length>0&&s.name.length<=60&&typeof s.createdAt==='string'&&Number.isFinite(Date.parse(s.createdAt))&&validScene(s.scene))&&new Set(value.map(s=>s.id)).size===value.length}
export function comparable(a:Scene,b:Scene){return comparisonConditions(a,b).length===0}
export function metrics(s:Scene){const f=analyze(s);return{blocked:f.filter(f=>f.type==='blocked').length,crossing:f.filter(f=>f.type==='crossing').length,visibility:f.filter(f=>f.type==='visibility').length,total:f.length,length:pathLength(s.pedestrian)}}
