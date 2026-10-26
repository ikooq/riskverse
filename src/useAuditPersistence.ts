import {useCallback,useEffect,useRef,useState} from 'react';
import {sameWorkspace,type AuditWorkspace,type AuditArchive} from './auditArchive';
import {AuditConflictError,readAuditDatabase,readAuditBackup,writeAuditDatabase} from './auditDatabase';
import {createArchiveCapture,readArchiveFile,verifyArchiveImages} from './auditFiles';
import './auditPersistence.css';

function failureMessage(e:unknown){
 if(e&&typeof e==='object'&&'name' in e&&e.name==='QuotaExceededError')return 'Хранилище заполнено. Скачайте архив аудита и освободите место.';
 return e instanceof Error?e.message:'Не удалось сохранить аудит. Скачайте архив.';
}
export function useAuditPersistence(snapshot:AuditWorkspace,onRestore:(s:AuditWorkspace)=>void){
 const [ready,setReady]=useState(false),[status,setStatus]=useState('Загрузка аудита…'),[problem,setProblem]=useState(false),[dirty,setDirty]=useState(false);
 const [hasImportBackup,setHasImportBackup]=useState(false);
 const latest=useRef(snapshot),restore=useRef(onRestore),revision=useRef(0),lastSavedAt=useRef<string|null>(null),writable=useRef(false),pending=useRef(false),mounted=useRef(false);
 const writeQueue=useRef<Promise<void>>(Promise.resolve()),timer=useRef<ReturnType<typeof setTimeout>|null>(null),capture=useRef(createArchiveCapture()),cleanSnapshot=useRef<AuditWorkspace|null>(null);
 const writing=useRef(0);
 latest.current=snapshot;restore.current=onRestore;
 const cancelTimer=()=>{if(timer.current!==null){clearTimeout(timer.current);timer.current=null}};
 const failed=(e:unknown)=>{if(mounted.current){setProblem(true);setStatus(e instanceof AuditConflictError?e.message:failureMessage(e))}};
 const enqueue=<T,>(operation:()=>Promise<T>):Promise<T>=>{const result=writeQueue.current.catch(()=>{}).then(operation);writeQueue.current=result.then(()=>{},()=>{});return result};
 const write=async(a:AuditArchive,backup?:AuditArchive|null)=>{writing.current++;try{a.savedAt=new Date(Math.max(Date.now(),Date.parse(lastSavedAt.current??'')+1||0)).toISOString();await writeAuditDatabase(a,lastSavedAt.current,backup);lastSavedAt.current=a.savedAt}finally{writing.current--}};
 const load=useCallback(async()=>{
  cancelTimer();const stamp=++revision.current;writable.current=false;setReady(false);
  try{
   await writeQueue.current;const saved=await readAuditDatabase(),backup=await readAuditBackup().catch(()=>null);if(saved)await verifyArchiveImages(saved);
   if(!mounted.current||stamp!==revision.current)return;
   lastSavedAt.current=saved?.savedAt??null;cleanSnapshot.current=saved;pending.current=false;writable.current=true;
   if(saved)restore.current(saved);
   setHasImportBackup(!!backup);setDirty(false);setProblem(false);setStatus(saved?'Аудит восстановлен':'Сохранение на устройстве');
  }catch(e){if(stamp===revision.current)failed(e)}finally{if(mounted.current&&stamp===revision.current)setReady(true)}
 },[]);
 useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false;cancelTimer();++revision.current}},[load]);
 const persist=(s:AuditWorkspace,stamp:number,archived:Promise<AuditArchive>)=>enqueue(async()=>{
  if(stamp!==revision.current||!writable.current)return;
  const a=await archived;if(stamp!==revision.current)return;
  await write(a);
  if(stamp===revision.current&&mounted.current){cleanSnapshot.current=s;pending.current=false;setDirty(false);setProblem(false);setStatus('Аудит сохранён на устройстве')}
 });
 useEffect(()=>{
  if(!ready||!writable.current)return;
  if(writing.current===0&&sameWorkspace(snapshot,cleanSnapshot.current)){if(pending.current){++revision.current;pending.current=false;setDirty(false);setStatus('Аудит сохранён на устройстве')}return}
  const stamp=++revision.current;pending.current=true;setDirty(true);setStatus('Есть несохранённые изменения…');
  // Start photo reading now, before a replaced blob URL can be released.
  const archived=capture.current(snapshot);void archived.catch(()=>{});
  timer.current=setTimeout(()=>{timer.current=null;setStatus('Сохраняем…');void persist(snapshot,stamp,archived).catch(failed)},350);
  return cancelTimer;
 },[snapshot,ready]);
 const saveNow=async()=>{
  if(!ready)throw Error('Дождитесь загрузки аудита.');
  if(!writable.current)throw Error('Сначала восстановите доступ к хранилищу или скачайте архив.');
  cancelTimer();const s=latest.current,stamp=++revision.current;pending.current=true;setDirty(true);setStatus('Сохраняем…');
  try{await persist(s,stamp,capture.current(s))}catch(e){failed(e);throw e}
 };
 useEffect(()=>{
  const leave=(e:BeforeUnloadEvent)=>{if(pending.current){e.preventDefault();e.returnValue=''}};
  const hidden=()=>{if(document.visibilityState==='hidden'&&pending.current&&writable.current)void saveNow().catch(()=>{})};
  window.addEventListener('beforeunload',leave);document.addEventListener('visibilitychange',hidden);
  return()=>{window.removeEventListener('beforeunload',leave);document.removeEventListener('visibilitychange',hidden)};
 },[ready]);
 async function exportAudit(){
  const archived=await capture.current(latest.current),url=URL.createObjectURL(new Blob([JSON.stringify(archived)],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download='riskverse-audit.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function importAudit(file:File){
  // Validate and decode before changing either the workspace or its stored record.
  const archived=await readArchiveFile(file),current=await capture.current(latest.current);
  cancelTimer();++revision.current;
  await enqueue(async()=>{await write(archived,current);writable.current=true});
  cleanSnapshot.current=archived;restore.current(archived);pending.current=false;
  setHasImportBackup(true);setDirty(false);setProblem(false);setStatus('Аудит импортирован и сохранён на устройстве');
 }
 async function undoImport(){
  const backup=await readAuditBackup();if(!backup)throw Error('Резервная копия до импорта недоступна.');await verifyArchiveImages(backup);
  cancelTimer();++revision.current;await enqueue(()=>write(backup,null));
  cleanSnapshot.current=backup;restore.current(backup);pending.current=false;
  setHasImportBackup(false);setDirty(false);setProblem(false);setStatus('Восстановлен аудит до импорта');
 }
 return{ready,status,problem,dirty,hasImportBackup,saveNow,reloadSaved:load,exportAudit,importAudit,undoImport};
}
