// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,createElement,StrictMode,useState,type Dispatch,type SetStateAction} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {defaultMotion,snapshotOnly,type AuditArchive,type AuditWorkspace} from './auditArchive';
import {clone,initialScene} from './model';
import {useAuditPersistence} from './useAuditPersistence';

const mocked=vi.hoisted(()=>({read:vi.fn(),backup:vi.fn(),write:vi.fn(),capture:vi.fn(),images:vi.fn(),file:vi.fn()}));
vi.mock('./auditDatabase',async original=>({...await original<typeof import('./auditDatabase')>(),readAuditDatabase:mocked.read,readAuditBackup:mocked.backup,writeAuditDatabase:mocked.write}));
vi.mock('./auditFiles',()=>({createArchiveCapture:()=>mocked.capture,verifyArchiveImages:mocked.images,readArchiveFile:mocked.file}));

function workspace(name='A'):AuditWorkspace{return {scene:{...clone(initialScene),name},baseline:clone(initialScene),photo:null,photoMeta:{id:'',name:''},photoSession:null,motion:{...defaultMotion},recovery:null}}
function archive(s=workspace()):AuditArchive{return {...clone(s),format:'riskverse-audit',version:1,savedAt:'2026-10-24T12:00:00.000Z'}}
let stored:AuditArchive|null,root:Root,host:HTMLDivElement,api:ReturnType<typeof useAuditPersistence>,edit:Dispatch<SetStateAction<AuditWorkspace>>;
function Harness(){const [value,setValue]=useState<AuditWorkspace>(workspace());edit=setValue;api=useAuditPersistence(value,setValue);return createElement('p',null,api.status)}
async function mount(){await act(async()=>{root.render(createElement(StrictMode,null,createElement(Harness)))});expect(api.ready).toBe(true)}
async function tick(ms=400){await act(async()=>{await vi.advanceTimersByTimeAsync(ms)})}
beforeEach(()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);stored=archive();
 mocked.read.mockReset().mockImplementation(async()=>clone(stored));mocked.backup.mockReset().mockResolvedValue(null);
 mocked.write.mockReset().mockImplementation(async(a:AuditArchive)=>{stored=clone(a)});
 mocked.capture.mockReset().mockImplementation(async(s:AuditWorkspace)=>archive(s));mocked.images.mockReset().mockResolvedValue(undefined);mocked.file.mockReset();
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals()});

describe('audit autosave lifecycle',()=>{
 it('restores in React StrictMode without creating an edit or replacing the stored version',async()=>{
  await mount();await tick(1000);expect(mocked.write).not.toHaveBeenCalled();expect(api.dirty).toBe(false);
 });
 it('coalesces rapid edits and saves the last snapshot',async()=>{
  await mount();await act(async()=>{edit(workspace('B'))});await tick(100);await act(async()=>{edit(workspace('C'))});await tick();
  expect(mocked.write).toHaveBeenCalledTimes(1);expect(stored?.scene.name).toBe('C');expect(api.dirty).toBe(false);
 });
 it('preserves an undo made while an older write is already in flight',async()=>{
  let complete!:()=>void;mocked.write.mockImplementationOnce((a:AuditArchive)=>new Promise<void>(resolve=>{complete=()=>{stored=clone(a);resolve()}}));
  await mount();await act(async()=>{edit(workspace('B'))});await tick();expect(mocked.write).toHaveBeenCalledTimes(1);
  await act(async()=>{edit(workspace('A'))});expect(api.dirty).toBe(true);
  await act(async()=>{complete()});await tick();expect(mocked.write).toHaveBeenCalledTimes(2);expect(stored?.scene.name).toBe('A');expect(api.dirty).toBe(false);
 });
 it('does not mark failed writes saved or replace the previous stored audit',async()=>{
  mocked.write.mockRejectedValue(new DOMException('Хранилище заполнено','QuotaExceededError'));
  await mount();await act(async()=>{edit(workspace('B'))});await tick();
  expect(api.dirty).toBe(true);expect(api.problem).toBe(true);expect(api.status).toContain('заполнено');expect(stored?.scene.name).toBe('A');
 });
 it('does not overwrite unreadable storage with the initial demo scene',async()=>{
  mocked.read.mockRejectedValue(Error('Повреждён сохранённый архив'));await mount();await tick();expect(mocked.write).not.toHaveBeenCalled();expect(api.problem).toBe(true);
 });
 it('imports the archive recovery intact and stores the replaced work separately',async()=>{
  const incoming=archive(workspace('Imported'));incoming.recovery=snapshotOnly(workspace('Previous in file'));mocked.file.mockResolvedValue(incoming);
  await mount();await act(async()=>{await api.importAudit(new File(['{}'],'audit.json'))});
  expect(stored?.scene.name).toBe('Imported');expect(stored?.recovery?.scene.name).toBe('Previous in file');
  expect(mocked.write.mock.calls.at(-1)?.[2].scene.name).toBe('A');expect(api.hasImportBackup).toBe(true);
 });
 it('keeps the current work untouched if file validation fails',async()=>{
  mocked.file.mockRejectedValue(Error('Фото повреждено'));await mount();
  await act(async()=>{await expect(api.importAudit(new File(['{}'],'broken.json'))).rejects.toThrow('Фото повреждено')});
  expect(mocked.write).not.toHaveBeenCalled();expect(stored?.scene.name).toBe('A');expect(api.dirty).toBe(false);
 });
});
