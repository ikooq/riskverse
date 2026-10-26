import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {readAuditDatabase,readAuditBackup,writeAuditDatabase,AuditConflictError} from './auditDatabase';
import {defaultMotion,type AuditArchive} from './auditArchive';
import {clone,initialScene} from './model';

function audit(savedAt='2026-10-24T12:00:00.000Z'):AuditArchive{return {format:'riskverse-audit',version:1,savedAt,scene:clone(initialScene),baseline:clone(initialScene),photo:null,photoMeta:{id:'',name:''},photoSession:null,motion:{...defaultMotion}}}
beforeEach(()=>vi.stubGlobal('indexedDB',new IDBFactory()));
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()});

describe('transactional audit storage',()=>{
 it('preserves archive recovery and a separate complete undo of an import',async()=>{
  const original=audit(),incoming=audit('2026-10-24T12:01:00.000Z');original.scene.name='До импорта';incoming.scene.name='Из файла';incoming.recovery={...audit(),scene:{...initialScene,name:'Предыдущий из файла'}};
  await writeAuditDatabase(original,null);await writeAuditDatabase(incoming,original.savedAt,original);
  expect((await readAuditDatabase())?.recovery?.scene.name).toBe('Предыдущий из файла');expect(await readAuditBackup()).toEqual(original);
  const restored={...original,savedAt:'2026-10-24T12:02:00.000Z'};await writeAuditDatabase(restored,incoming.savedAt,null);
  expect(await readAuditDatabase()).toEqual(restored);expect(await readAuditBackup()).toBeNull();
 });
 it('starts empty and restores a committed audit including the previous workspace',async()=>{
  expect(await readAuditDatabase()).toBeNull();const a=audit();a.recovery={...audit(),scene:{...initialScene,name:'Предыдущий аудит'}};
  await writeAuditDatabase(a,null);expect(await readAuditDatabase()).toEqual(a);
 });
 it('does not mutate an already saved snapshot when the editor changes later',async()=>{
  const a=audit();await writeAuditDatabase(a,null);a.scene.items[0].x=10;
  expect((await readAuditDatabase())?.scene.items[0].x).toBe(3);
 });
 it('allows only one of two tabs to replace the same saved version',async()=>{
  const original=audit();await writeAuditDatabase(original,null);
  const a=audit('2026-10-24T12:01:00.000Z'),b=audit('2026-10-24T12:02:00.000Z');a.scene.name='Вкладка A';b.scene.name='Вкладка B';
  const results=await Promise.allSettled([writeAuditDatabase(a,original.savedAt),writeAuditDatabase(b,original.savedAt)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const failure=results.find(r=>r.status==='rejected');expect(failure?.status==='rejected'&&failure.reason).toBeInstanceOf(AuditConflictError);
  expect((await readAuditDatabase())?.scene.name).toBe('Вкладка A');
 });
 it('rejects stale autosaves without replacing a newer audit',async()=>{
  const a=audit();await writeAuditDatabase(a,null);const next=audit('2026-10-24T12:01:00.000Z');await writeAuditDatabase(next,a.savedAt);
  await expect(writeAuditDatabase(a,a.savedAt)).rejects.toBeInstanceOf(AuditConflictError);expect(await readAuditDatabase()).toEqual(next);
 });
 it('keeps the previous record when writing fails because storage is full',async()=>{
  const a=audit();await writeAuditDatabase(a,null);
  const put=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(()=>{throw new DOMException('No space','QuotaExceededError')});
  await expect(writeAuditDatabase(audit('2026-10-24T12:01:00.000Z'),a.savedAt)).rejects.toMatchObject({name:'QuotaExceededError'});
  put.mockRestore();expect(await readAuditDatabase()).toEqual(a);
 });
 it('rejects an invalid import before opening a write transaction',async()=>{
  const a=audit();await writeAuditDatabase(a,null);
  await expect(writeAuditDatabase({...a,photo:'https://invalid.example/photo.png'},a.savedAt)).rejects.toThrow();expect(await readAuditDatabase()).toEqual(a);
 });
 it('reports corrupt stored data instead of treating it as an empty database',async()=>{
  await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('riskverse',1);request.onupgradeneeded=()=>request.result.createObjectStore('audits');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('audits','readwrite');tx.objectStore('audits').put({format:'broken'},'current');tx.oncomplete=()=>{db.close();resolve()}}});
  await expect(readAuditDatabase()).rejects.toThrow('некорректные');
 });
 it('reports unavailable browser storage explicitly',async()=>{
  vi.stubGlobal('indexedDB',undefined);await expect(readAuditDatabase()).rejects.toThrow('недоступно');
 });
});
