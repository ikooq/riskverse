import {expect,it} from 'vitest';
import {auditProgress} from './auditProgress';
import {clone,initialScene,type Scene} from './model';

const empty:Scene={version:1,name:'Фото',width:24,height:16,clearance:1.2,items:[],pedestrian:[],vehicle:[],source:{kind:'photo',id:'photo-new',fileName:'floor.jpg'}};

it('guides a new audit through objects, both routes and a baseline before experimenting',()=>{
 const current=clone(empty);
 expect(auditProgress(current,empty,true).stage).toBe('objects');
 current.items=clone(initialScene.items);
 expect(auditProgress(current,empty,true).stage).toBe('routes');
 current.pedestrian=clone(initialScene.pedestrian);
 expect(auditProgress(current,empty,true).hasVehicle).toBe(false);
 current.vehicle=clone(initialScene.vehicle);
 expect(auditProgress(current,empty,true).stage).toBe('baseline');
 const baseline=clone(current);current.items[0].x=2;
 expect(auditProgress(current,baseline,true).stage).toBe('experiment');
});

it('does not reuse a complete baseline belonging to another photograph',()=>{
 const current={...clone(initialScene),source:empty.source};
 expect(auditProgress(current,initialScene,true).stage).toBe('baseline');
});

it('offers recovery of a missing photo without blocking a standalone geometric scene',()=>{
 expect(auditProgress(empty,empty,false).stage).toBe('photo');
 expect(auditProgress(initialScene,initialScene,false).stage).toBe('experiment');
});

it('preserves the baseline after a route change and explains the changed conditions',()=>{
 const current=clone(initialScene);current.vehicle[0].y=7;
 const result=auditProgress(current,initialScene,false);
 expect(result.stage).toBe('experiment');
 expect(result.differences).toContain('Изменён транспортный маршрут.');
});
