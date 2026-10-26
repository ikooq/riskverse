import {MAX_ARCHIVE_BYTES,parseArchive,snapshotOnly,validPhotoData,type AuditArchive,type AuditWorkspace} from './auditArchive';

export function blobDataUrl(blob:Blob):Promise<string>{
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Не удалось прочитать фото.'));reader.readAsDataURL(blob)});
}
export async function verifyArchiveImages(a:Pick<AuditWorkspace,'photo'|'recovery'>):Promise<void>{
 const photos=[...new Set([a.photo,a.recovery?.photo].filter((p):p is string=>!!p))];
 for(const photo of photos){
  try{const blob=await(await fetch(photo)).blob();const bitmap=await createImageBitmap(blob);bitmap.close()}
  catch{throw Error('Фото повреждено или не поддерживается. Текущий аудит не изменён.')}
 }
}
export async function readPhotoFile(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Выберите JPG, PNG или WebP до 8 МБ.');
 const data=await blobDataUrl(file);
 if(!validPhotoData(data))throw Error('Содержимое файла не соответствует JPG, PNG или WebP.');
 await verifyArchiveImages({photo:data});
 return data;
}
export function createArchiveCapture(){
 const photos=new Map<string,Promise<string>>();
 async function capturePhoto(url:string|null){
  if(!url||url.startsWith('data:'))return url;
  if(!photos.has(url)){
   const value=fetch(url).then(r=>{if(!r.ok)throw Error('Не удалось сохранить фото.');return r.blob()}).then(blobDataUrl);
   photos.set(url,value);void value.catch(()=>photos.delete(url));
  }
  return photos.get(url)!;
 }
 return async(s:AuditWorkspace):Promise<AuditArchive>=>{
  const [photo,recoveryPhoto]=await Promise.all([capturePhoto(s.photo),capturePhoto(s.recovery?.photo??null)]);
  // Retain only current and recovery photo buffers.
  for(const key of photos.keys())if(key!==s.photo&&key!==s.recovery?.photo)photos.delete(key);
  return parseArchive({...snapshotOnly(s),photo,recovery:s.recovery?{...snapshotOnly(s.recovery),photo:recoveryPhoto}:null,format:'riskverse-audit',version:1,savedAt:new Date().toISOString()});
 };
}
export async function readArchiveFile(file:File):Promise<AuditArchive>{
 if(file.size>MAX_ARCHIVE_BYTES)throw Error('Архив слишком большой: максимум 26 МБ.');
 let raw:unknown;try{raw=JSON.parse(await file.text())}catch{throw Error('Не удалось прочитать JSON. Текущий аудит не изменён.')}
 const archive=parseArchive(raw);await verifyArchiveImages(archive);return archive;
}
