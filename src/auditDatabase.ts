import {parseArchive,type AuditArchive} from './auditArchive';

export class AuditConflictError extends Error{
 constructor(){super('Аудит изменён в другой вкладке. Скачайте свою версию или загрузите сохранённую.');this.name='AuditConflictError'}
}
async function openDatabase():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(Error('Локальное хранилище недоступно.'));return}
  const request=indexedDB.open('riskverse',1);let expired=false;
  const timer=setTimeout(()=>{expired=true;reject(Error('Хранилище не отвечает. Закройте старые вкладки RISKVERSE и повторите.'))},5000);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('audits'))request.result.createObjectStore('audits')};
  request.onerror=()=>{clearTimeout(timer);reject(request.error??Error('Не удалось открыть хранилище.'))};
  request.onsuccess=()=>{clearTimeout(timer);const db=request.result;if(expired){db.close();return}db.onversionchange=()=>db.close();resolve(db)};
 });
}
async function readRecord(key:string):Promise<AuditArchive|null>{
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('audits','readonly'),request=tx.objectStore('audits').get(key);let value:AuditArchive|null=null,problem:unknown;
  request.onsuccess=()=>{try{value=request.result===undefined?null:parseArchive(request.result)}catch(e){problem=e;tx.abort()}};
  tx.oncomplete=()=>{db.close();resolve(value)};
  tx.onabort=()=>{db.close();reject(problem??tx.error??Error('Чтение аудита прервано.'))};
 });
}
export const readAuditDatabase=()=>readRecord('current');
export const readAuditBackup=()=>readRecord('before-import');
// Compare and write share a transaction, so two tabs cannot silently replace each other.
export async function writeAuditDatabase(value:AuditArchive,expectedSavedAt?:string|null,backup?:AuditArchive|null):Promise<void>{
 const archive=parseArchive(value);if(backup)parseArchive(backup);const db=await openDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('audits','readwrite'),store=tx.objectStore('audits');let problem:unknown;
  const put=()=>{try{store.put(archive,'current');if(backup===null)store.delete('before-import');else if(backup)store.put(backup,'before-import')}catch(e){problem=e;tx.abort()}};
  if(expectedSavedAt===undefined)put();else{
   const read=store.get('current');read.onsuccess=()=>{
    if((read.result?.savedAt??null)!==expectedSavedAt){problem=new AuditConflictError();tx.abort();return}put();
   };
  }
  tx.oncomplete=()=>{db.close();resolve()};
  tx.onabort=()=>{db.close();reject(problem??tx.error??Error('Запись аудита прервана.'))};
 });
}
