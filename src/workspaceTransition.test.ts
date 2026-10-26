import {describe,expect,it} from 'vitest';
import {workspaceForScene} from './workspaceTransition';
import {clone,initialScene} from './model';
import {defaultMotion,type AuditSnapshot} from './auditArchive';
const current:AuditSnapshot={scene:{...clone(initialScene),source:{kind:'photo',id:'a',fileName:'a.jpg'}},baseline:clone(initialScene),photo:'data:image/jpeg;base64,test',photoMeta:{id:'a',name:'a.jpg'},photoSession:null,motion:{...defaultMotion,delay:7}};
describe('workspace scene transitions',()=>{
 it('never attaches the old photograph or AI result to another source',()=>{const next=workspaceForScene({...clone(initialScene),source:{kind:'photo',id:'b',fileName:'b.jpg'}},current);expect(next.photo).toBeNull();expect(next.photoSession).toBeNull();expect(next.photoMeta).toEqual({id:'b',name:'b.jpg'});expect(next.motion.delay).toBe(0)});
 it('clears the old photo when importing a geometry-only demo',()=>{const next=workspaceForScene(clone(initialScene),current);expect(next.photo).toBeNull();expect(next.photoMeta.id).toBe('');expect(next.baseline).toEqual(initialScene)});
 it('preserves same-source work and keeps an independent recovery snapshot',()=>{const next=workspaceForScene(current.scene,current,current.baseline);expect(next.photo).toBe(current.photo);expect(next.motion.delay).toBe(7);next.scene.items[0].x=20;expect(current.scene.items[0].x).not.toBe(20)});
});
