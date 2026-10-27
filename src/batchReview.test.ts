import {describe,expect,it} from 'vitest';
import {makeBatchItems,type BatchDraft} from './batchReview';
import {clone,initialScene,validScene} from './model';
const draft:BatchDraft={observation:{id:'one',label:'Паллета',kind:'pallet',region:{x:.1,y:.2,w:.3,h:.4},concern:'context',visibleEvidence:'Виден поддон.',uncertainty:'Нужны размеры.',recommendation:'Измерить.'},reviewed:true,name:'Паллета',kind:'pallet',x:'1',y:'1',w:'2',h:'2',height:'1'};
describe('batch photo confirmation',()=>{
 it('keeps image evidence and observation identity for each explicitly reviewed item',()=>{const scene=clone(initialScene);scene.items=[];const result=makeBatchItems([draft,{...draft,reviewed:false,name:'Не подтверждено'}],scene,'photo','scene.jpg');expect(result).toHaveLength(1);expect(result[0].evidence).toMatchObject({aiObservationId:'one',method:'ai_reviewed',region:draft.observation.region});expect(validScene({...scene,items:result})).toBe(true);expect(scene.items).toEqual([])});
 it('rejects the entire batch when one selected item is incomplete or outside the site',()=>{for(const bad of [{...draft,x:''},{...draft,x:'999'}])expect(()=>makeBatchItems([draft,bad],initialScene,'photo','scene.jpg')).toThrow()});
 it('requires confirmation and respects the total scene object limit',()=>{expect(()=>makeBatchItems([{...draft,reviewed:false}],initialScene,'photo','scene.jpg')).toThrow();expect(()=>makeBatchItems([draft],{...initialScene,items:Array.from({length:100},(_,i)=>({...initialScene.items[0],id:String(i)}))},'photo','scene.jpg')).toThrow()});
});
