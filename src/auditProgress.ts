import {comparisonConditions} from './comparison';
import type {Scene} from './model';

export type AuditStage='photo'|'objects'|'routes'|'baseline'|'experiment';
export function auditProgress(scene:Scene,baseline:Scene,hasPhoto:boolean){
 const photoRequired=scene.source?.kind==='photo';
 const linkedObjects=scene.items.filter(i=>i.evidence?.sourceId===scene.source?.id&&!!scene.source).length;
 const hasObjects=scene.items.length>0;
 const hasPedestrian=scene.pedestrian.length>=2,hasVehicle=scene.vehicle.length>=2;
 const hasBaseline=baseline.items.length>0&&baseline.pedestrian.length>=2&&baseline.vehicle.length>=2&&
  baseline.source?.id===scene.source?.id&&baseline.width===scene.width&&baseline.height===scene.height;
 const stage:AuditStage=photoRequired&&!hasPhoto?'photo':!hasObjects?'objects':!hasPedestrian||!hasVehicle?'routes':!hasBaseline?'baseline':'experiment';
 return {stage,photoRequired,linkedObjects,hasObjects,hasPedestrian,hasVehicle,hasBaseline,
  differences:hasBaseline?comparisonConditions(scene,baseline):[]};
}
