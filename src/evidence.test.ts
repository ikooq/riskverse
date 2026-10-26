import {describe,it,expect} from 'vitest';
import {validEvidence,itemError} from './evidence';
import {initialScene,validScene,type Item} from './model';
const evidence={sourceId:'photo-1',fileName:'warehouse.jpg',method:'manual' as const,note:'Проход занят',region:{x:.1,y:.2,w:.3,h:.4}};
const item:Item={id:'new',name:'Паллета',kind:'pallet',x:1,y:1,w:2,h:2,height:1.7,evidence};
describe('photo evidence',()=>{
 it('preserves and validates perspective calibration provenance',()=>{const projection={corners:[{x:.2,y:.2},{x:.8,y:.2},{x:.9,y:.9},{x:.1,y:.9}],width:24,height:16,anchor:{x:.5,y:.6}};const source={...evidence,projection};expect(validEvidence(source)).toBe(true);expect(validScene(JSON.parse(JSON.stringify({...initialScene,items:[{...item,evidence:source}]})))).toBe(true);expect(validEvidence({...source,projection:{...projection,anchor:{x:0,y:0}}})).toBe(false)});
 it('preserves a confirmed observation through scene JSON',()=>{const scene=JSON.parse(JSON.stringify({...initialScene,items:[item]}));expect(validScene(scene)).toBe(true);expect(scene.items[0].evidence).toEqual(evidence)});
 it('rejects malformed and out-of-image rectangles',()=>{for(const v of [null,{}, {...evidence,region:{x:.9,y:0,w:.2,h:.2}},{...evidence,region:{x:0,y:0,w:0,h:1}},{...evidence,method:'ai'},{...evidence,region:{x:NaN,y:0,w:1,h:1}}]){expect(validEvidence(v)).toBe(false);expect(validScene({...initialScene,items:[{...item,evidence:v}]})).toBe(false)}});
 it('requires real scene coordinates within bounds',()=>{expect(itemError(item,initialScene)).toBeNull();expect(itemError({...item,x:23},initialScene)).toMatch('границы');expect(itemError({...item,w:NaN},initialScene)).toMatch('Заполните');expect(itemError({...item,name:' '},initialScene)).toMatch('название');expect(itemError({...item,evidence:undefined},initialScene)).toMatch('выделите')});
});
