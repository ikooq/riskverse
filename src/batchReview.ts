import type {Item,Scene} from './model';
import {itemError} from './evidence';
import type {Observation} from './visionSchema';
import type {FloorProjection} from './projection';
export type BatchDraft={observation:Observation;reviewed:boolean;name:string;kind:Item['kind'];x:string;y:string;w:string;h:string;height:string;projection?:FloorProjection};
export function makeBatchItems(drafts:BatchDraft[],scene:Scene,sourceId:string,fileName:string):Item[]{
 const selected=drafts.filter(d=>d.reviewed);if(!selected.length)throw Error('Отметьте хотя бы одно проверенное наблюдение.');
 if(selected.length+scene.items.length>100)throw Error('В модели может быть не больше 100 объектов.');
 const items:Item[]=[];
 for(const draft of selected){
  if([draft.x,draft.y,draft.w,draft.h,draft.height].some(value=>!value.trim()))throw Error(`«${draft.name}»: заполните координаты и все размеры.`);
  const item:Item={id:crypto.randomUUID(),name:draft.name.trim(),kind:draft.kind,x:Number(draft.x),y:Number(draft.y),w:Number(draft.w),h:Number(draft.h),height:Number(draft.height),evidence:{sourceId,fileName,region:{...draft.observation.region},method:'ai_reviewed',aiObservationId:draft.observation.id,note:[draft.observation.visibleEvidence,draft.observation.uncertainty,draft.observation.recommendation].filter(Boolean).join(' ').slice(0,500),...(draft.projection?{projection:draft.projection}:{})}};
  const problem=itemError(item,{...scene,items:[...scene.items,...items]});if(problem)throw Error(`«${draft.name}»: ${problem}`);items.push(item);
 }
 return items;
}
