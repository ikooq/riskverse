import {analyze,pathLength,type Finding,type Point,type Scene} from './model';

const samePoint=(a:Point|undefined,b:Point|undefined)=>a?.x===b?.x&&a?.y===b?.y;
const samePath=(a:Point[],b:Point[])=>a.length===b.length&&a.every((p,i)=>samePoint(p,b[i]));

export function comparisonConditions(current:Scene,baseline:Scene):string[]{
 const reasons:string[]=[];
 if(current.width!==baseline.width||current.height!==baseline.height)reasons.push('Изменены размеры площадки.');
 if(current.clearance!==baseline.clearance)reasons.push('Изменена ширина пешеходного коридора.');
 if(!samePath(current.vehicle,baseline.vehicle))reasons.push('Изменён транспортный маршрут.');
 if(!samePoint(current.pedestrian[0],baseline.pedestrian[0])||!samePoint(current.pedestrian.at(-1),baseline.pedestrian.at(-1)))reasons.push('Изменены начало или конец пешеходного маршрута.');
 if(current.source?.id!==baseline.source?.id)reasons.push('Сцены относятся к разным исходным фотографиям.');
 if([current,baseline].some(s=>s.pedestrian.length<2||s.vehicle.length<2))reasons.push('В одной из сцен не заданы оба маршрута.');
 return reasons;
}

// Finding IDs contain traversal indexes. Match crossings by location instead,
// so removing an earlier crossing does not rename all subsequent findings.
function indexedFindings(findings:Finding[]){
 let crossing='';
 const occurrences=new Map<string,number>();
 return findings.map(f=>{
  if(f.type==='crossing')crossing=`${f.point.x.toFixed(6)},${f.point.y.toFixed(6)}`;
  const identity=f.type==='crossing'?`crossing:${f.point.x.toFixed(6)},${f.point.y.toFixed(6)}`:f.type==='visibility'?`visibility:${crossing}:${f.itemId}`:f.type==='overlap'?`overlap:${[f.itemId,f.otherItemId].sort().join(':')}`:`${f.type}:${f.itemId}`;
  const occurrence=occurrences.get(identity)??0;
  occurrences.set(identity,occurrence+1);
  return {key:`${identity}:${occurrence}`,finding:f};
 });
}

export function compareScenes(current:Scene,baseline:Scene){
 const before=analyze(baseline),after=analyze(current);
 const oldEntries=indexedFindings(before),newEntries=indexedFindings(after);
 const oldKeys=new Set(oldEntries.map(f=>f.key)),newKeys=new Set(newEntries.map(f=>f.key));
 const reasons=comparisonConditions(current,baseline);
 return {before,after,reasons,comparable:reasons.length===0,delta:after.length-before.length,
  resolved:oldEntries.filter(f=>!newKeys.has(f.key)).map(f=>f.finding),
  added:newEntries.filter(f=>!oldKeys.has(f.key)).map(f=>f.finding),
  remaining:newEntries.filter(f=>oldKeys.has(f.key)).map(f=>f.finding),
  lengthBefore:pathLength(baseline.pedestrian),lengthAfter:pathLength(current.pedestrian),
  removedObjects:baseline.items.filter(i=>!current.items.some(c=>c.id===i.id)).map(i=>i.name)};
}

export function comparisonTone(result:ReturnType<typeof compareScenes>){
 return !result.comparable?'neutral':result.delta>0?'worse':result.delta<0?'better':'neutral';
}

export function comparisonReport(result:ReturnType<typeof compareScenes>){
 const groups:[string,Finding[]][]=[['Устранены',result.resolved],['Появились',result.added],['Остались',result.remaining]];
 return [result.comparable?'Условия сравнения совпадают.':'Условия различаются. Разница количества не доказывает улучшение.',
  ...result.reasons,`До: ${result.before.length}. После: ${result.after.length}.`,
  ...groups.map(([label,findings])=>`${label}: ${findings.length}\n${findings.map(f=>`- ${f.title}: ${f.detail}`).join('\n')}`),
  `Длина пешеходного пути: ${result.lengthBefore.toFixed(1)} → ${result.lengthAfter.toFixed(1)} м.`,
  ...(result.removedObjects.length?[`Удалены из модели: ${result.removedObjects.join(', ')}. Подтвердите удаление на площадке.`]:[])].join('\n\n');
}
