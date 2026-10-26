import {describe,expect,it} from 'vitest';
import {analyze,clone,initialScene,validScene,type Scene} from './model';
import {planRoute} from './planner';
import {searchSolutions} from './solutionSearch';

const scene:Scene={version:1,name:'Два связанных изменения',width:16,height:12,clearance:1.2,source:{kind:'photo',id:'photo',fileName:'scene.jpg'},items:[{id:'pallet',name:'Паллета у начала пути',kind:'pallet',x:1,y:9,w:2,h:2,height:1,evidence:{sourceId:'photo',fileName:'scene.jpg',method:'manual',region:{x:.1,y:.1,w:.2,h:.2},note:'Подтверждено вручную'}}],pedestrian:[{x:2,y:10},{x:8,y:10},{x:8,y:2},{x:14,y:2}],vehicle:[{x:5,y:6},{x:11,y:6}]};
describe('combined layout search',()=>{
 it('finds a joint move and route when the initial route search cannot start',()=>{
  const original=clone(scene);expect(planRoute(scene).ok).toBe(false);
  const result=searchSolutions(scene);const joint=result.options.find(o=>o.actions.some(a=>a.type==='move')&&o.actions.some(a=>a.type==='route'));
  expect(joint).toBeDefined();expect(joint!.findings).toBe(0);expect(scene).toEqual(original);
  for(const option of result.options){expect(validScene(option.scene)).toBe(true);expect(option.findings).toBe(analyze(option.scene).length);expect(option.scene.vehicle).toEqual(scene.vehicle);expect(option.scene.pedestrian[0]).toEqual(scene.pedestrian[0]);expect(option.scene.pedestrian.at(-1)).toEqual(scene.pedestrian.at(-1));expect(option.scene.items[0].evidence).toEqual(scene.items[0].evidence)}
 });
 it('keeps fixed racks and every original object while improving a demo',()=>{const result=searchSolutions(initialScene);expect(result.options.length).toBeGreaterThan(0);for(const option of result.options){expect(option.scene.items.map(i=>i.id)).toEqual(initialScene.items.map(i=>i.id));expect(option.scene.items.filter(i=>i.kind==='rack')).toEqual(initialScene.items.filter(i=>i.kind==='rack'));expect(option.findings).toBeLessThan(analyze(initialScene).length)}});
 it('explains incomplete input without constructing a substitute scene',()=>{expect(searchSolutions({...scene,pedestrian:[]})).toMatchObject({options:[],evaluated:0});expect(searchSolutions({...scene,items:[],pedestrian:[]})).toMatchObject({options:[]})});
});
