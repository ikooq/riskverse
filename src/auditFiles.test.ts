import {afterEach,describe,expect,it,vi} from 'vitest';
import {createArchiveCapture,readArchiveFile,verifyArchiveImages} from './auditFiles';
import {defaultMotion,MAX_ARCHIVE_BYTES,type AuditArchive,type AuditWorkspace} from './auditArchive';
import {clone,initialScene} from './model';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=';
function workspace():AuditWorkspace{return {scene:clone(initialScene),baseline:clone(initialScene),photo:image,photoMeta:{id:'source',name:'test.png'},photoSession:null,motion:{...defaultMotion}}}
function archive():AuditArchive{return {...workspace(),format:'riskverse-audit',version:1,savedAt:'2026-10-24T12:00:00.000Z'}}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()});

describe('portable audit files',()=>{
 it('captures both audits while preserving source IDs and dropping recursive history',async()=>{
  const current=workspace();current.recovery={...workspace(),photoMeta:{id:'previous',name:'before.png'},scene:{...initialScene,name:'Предыдущая работа'}};
  const result=await createArchiveCapture()(current);
  expect(result.photo).toBe(image);expect(result.recovery?.photo).toBe(image);expect(result.photoMeta.id).toBe('source');expect(result.recovery?.photoMeta.id).toBe('previous');
  expect(result.recovery).not.toHaveProperty('recovery');
 });
 it('releases decoded bitmap resources and checks both stored photographs',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Blob(['image'],{type:'image/png'}))));const close=vi.fn();const decode=vi.fn(async()=>({close}));vi.stubGlobal('createImageBitmap',decode);
  await verifyArchiveImages({...workspace(),recovery:{...workspace(),photo:image+'different'}});
  expect(decode).toHaveBeenCalledTimes(2);expect(close).toHaveBeenCalledTimes(2);
 });
 it('rejects a corrupt image before an import can be applied',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Blob(['broken']))));vi.stubGlobal('createImageBitmap',vi.fn(async()=>{throw Error('decode failed')}));
  await expect(readArchiveFile(new File([JSON.stringify(archive())],'broken.json'))).rejects.toThrow('Фото повреждено');
 });
 it('rejects malformed JSON and oversized archives before decoding or writing anything',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  await expect(readArchiveFile(new File(['{'],'broken.json'))).rejects.toThrow('прочитать JSON');
  await expect(readArchiveFile({size:MAX_ARCHIVE_BYTES+1} as File)).rejects.toThrow('26 МБ');
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('deduplicates a photograph shared by current and recovery snapshots during verification',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Blob(['image']))));const decode=vi.fn(async()=>({close:vi.fn()}));vi.stubGlobal('createImageBitmap',decode);
  await verifyArchiveImages({...workspace(),recovery:workspace()});expect(decode).toHaveBeenCalledTimes(1);
 });
 it('imports without replacing a source ID or recalculating confirmed geometry',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Blob(['image']))));vi.stubGlobal('createImageBitmap',vi.fn(async()=>({close:vi.fn()})));
  const a=archive();a.scene.items[0].x=8;
  expect(await readArchiveFile(new File([JSON.stringify(a)],'audit.json'))).toEqual(a);
 });
});
