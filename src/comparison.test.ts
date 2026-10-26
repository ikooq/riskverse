import {expect,it} from 'vitest';
import {clone,initialScene,type Scene} from './model';
import {compareScenes,comparisonTone} from './comparison';

it('shows a resolved problem and a new problem even when the total is unchanged',()=>{
 const current=clone(initialScene);
 current.items.find(i=>i.id==='p1')!.y=13;
 current.items.push({id:'new',name:'Новое препятствие',kind:'pallet',x:10,y:11,w:1,h:1,height:1});
 const result=compareScenes(current,initialScene);
 expect(result.delta).toBe(0);
 expect(result.resolved.map(f=>f.itemId)).toContain('p1');
 expect(result.added.map(f=>f.itemId)).toContain('new');
 expect(comparisonTone(result)).toBe('neutral');
});

it('marks an increase as worse and a decrease as better',()=>{
 const current=clone(initialScene);current.items.find(i=>i.id==='p1')!.y=13;
 expect(comparisonTone(compareScenes(current,initialScene))).toBe('better');
 expect(comparisonTone(compareScenes(initialScene,current))).toBe('worse');
});

it('explains changed constraints and never labels an incomplete comparison an improvement',()=>{
 for(const mutate of [
  (s:Scene)=>{s.width=25},(s:Scene)=>{s.clearance=2},
  (s:Scene)=>{s.vehicle[0].y=7},(s:Scene)=>{s.pedestrian[0].x=2},
  (s:Scene)=>{s.source={kind:'photo',id:'another',fileName:'another.jpg'}},
  (s:Scene)=>{s.pedestrian=[]},
 ]){
  const current=clone(initialScene);mutate(current);
  const result=compareScenes(current,initialScene);
  expect(result.comparable).toBe(false);expect(result.reasons.length).toBeGreaterThan(0);
  expect(comparisonTone(result)).toBe('neutral');
 }
});

it('matches surviving crossings and visibility findings after an earlier crossing disappears',()=>{
 const baseline:Scene={version:1,name:'Test',width:20,height:20,clearance:1,
  pedestrian:[{x:0,y:5},{x:10,y:5},{x:10,y:15},{x:0,y:15}],vehicle:[{x:5,y:0},{x:5,y:20}],
  items:[{id:'view',name:'Обзор',kind:'rack',x:6,y:13,w:1,h:1,height:2}]};
 const current=clone(baseline);current.pedestrian=[{x:10,y:5},{x:10,y:15},{x:0,y:15}];
 const result=compareScenes(current,baseline);
 expect(result.added.filter(f=>f.type==='visibility')).toHaveLength(0);
 expect(result.remaining.some(f=>f.type==='visibility')).toBe(true);
 expect(result.resolved.filter(f=>f.type==='crossing')).toHaveLength(1);
});

it('reports deleted objects and route lengths instead of hiding removal behind a lower count',()=>{
 const current=clone(initialScene);current.items=current.items.filter(i=>i.id!=='p1');
 const result=compareScenes(current,initialScene);
 expect(result.removedObjects).toEqual(['Паллеты 01']);
 expect(result.lengthBefore).toBe(31);expect(result.lengthAfter).toBe(31);
});
