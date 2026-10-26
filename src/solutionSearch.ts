import {analyze,clone,pathLength,suggestPlacements,validScene,type Scene} from './model';
import {planRoute} from './planner';
import {compareScenes} from './comparison';

export type SolutionAction={type:'move';id:string;name:string;from:{x:number;y:number};to:{x:number;y:number};distance:number}|{type:'route'};
export type Solution={scene:Scene;actions:SolutionAction[];findings:number;high:number;resolved:number;added:number;routeLength:number;movement:number};
export type SolutionSearch={options:Solution[];evaluated:number;reason?:string};
const signature=(s:Scene)=>JSON.stringify([s.items.map(i=>[i.id,i.x,i.y]),s.pedestrian]);
const samePath=(a:Scene,b:Scene)=>JSON.stringify(a.pedestrian)===JSON.stringify(b.pedestrian);
function describe(scene:Scene,source:Scene):Solution{
 const findings=analyze(scene),comparison=compareScenes(scene,source);
 const actions:SolutionAction[]=scene.items.flatMap(item=>{const old=source.items.find(i=>i.id===item.id)!;const distance=Math.hypot(item.x-old.x,item.y-old.y);return distance>.001?[{type:'move' as const,id:item.id,name:item.name,from:{x:old.x,y:old.y},to:{x:item.x,y:item.y},distance}]:[]});
 if(!samePath(scene,source))actions.push({type:'route'});
 return{scene,actions,findings:findings.length,high:findings.filter(f=>f.severity==='high').length,resolved:comparison.resolved.length,added:comparison.added.length,routeLength:pathLength(scene.pedestrian),movement:actions.reduce((sum,a)=>sum+(a.type==='move'?a.distance:0),0)};
}
const order=(a:Solution,b:Solution)=>a.high-b.high||a.findings-b.findings||a.added-b.added||a.actions.length-b.actions.length||a.movement-b.movement||a.routeLength-b.routeLength;

/** Bounded beam search: up to two movable objects and a pedestrian route.
 * Fixed racks, vehicle route, scene dimensions, evidence and endpoints are preserved.
 * This is a discrete heuristic, never a globally optimal or certified layout. */
export function searchSolutions(source:Scene):SolutionSearch{
 if(!validScene(source)||!source.items.length||source.pedestrian.length<2||source.vehicle.length<2)return{options:[],evaluated:0,reason:'Подтвердите объекты и задайте оба маршрута перед поиском решения.'};
 const initial=describe(clone(source),source);
 if(!initial.findings)return{options:[],evaluated:1,reason:'Исходные геометрические проверки уже пройдены. Дополнительное улучшение по этой модели не найдено.'};
 const pool=new Map<string,Solution>();pool.set(signature(source),initial);
 const add=(scene:Scene)=>{const key=signature(scene);if(pool.has(key))return pool.get(key)!;const option=describe(scene,source);pool.set(key,option);return option};
 const reroute=(scene:Scene)=>{const result=planRoute(scene);if(result.ok)add({...scene,pedestrian:result.path})};
 reroute(initial.scene);
 let beam=[...pool.values()].sort(order).slice(0,4);
 for(let depth=0;depth<2;depth++){
  for(const current of beam){
   const findings=analyze(current.scene),moved=new Set(current.actions.filter(a=>a.type==='move').map(a=>a.id));
   const targets=current.scene.items.filter(item=>item.kind!=='rack'&&!moved.has(item.id)&&findings.some(f=>f.itemId===item.id||f.otherItemId===item.id)).slice(0,3);
   for(const item of targets){
    const placements=suggestPlacements(current.scene,item.id,2,Math.max(.5,Math.sqrt(source.width*source.height/400)));
    for(const place of placements){
     const next={...current.scene,items:current.scene.items.map(i=>i.id===item.id?{...i,x:place.x,y:place.y}:i)};
     add(next);reroute(next);
    }
   }
  }
  beam=[...pool.values()].filter(s=>s.actions.filter(a=>a.type==='move').length<=depth+1).sort(order).slice(0,4);
 }
 const improved=[...pool.values()].filter(s=>s.actions.length&&s.findings<initial.findings&&s.high<=initial.high).sort(order);
 const options:Solution[]=[],families=new Set<string>();
 for(const option of improved){const family=option.actions.map(a=>a.type==='route'?'route':a.id).sort().join(',');if(families.has(family))continue;families.add(family);options.push(option);if(options.length===3)break}
 return{options,evaluated:pool.size,...(!options.length?{reason:'В ограниченном поиске улучшение не найдено. Попробуйте изменить исходные маршруты или вручную проверить другие перестановки.'}:{})};
}
