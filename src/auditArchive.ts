import {validScene,type Scene,type Point} from './model';
import {validProjection,type FloorProjection} from './projection';
import {parseVision,type VisionReport} from './visionSchema';
import type {Region} from './evidence';

export type VisionRecord={report:VisionReport;model:string;analyzedAt:string};
export type CalibrationDraft={corners:Point[];anchor:Point|null;dimensions:{width:string;height:string}};
export type PhotoSession={region:Region|null;note:string;draft:{name:string;kind:'rack'|'pallet'|'barrier';x:string;y:string;w:string;h:string;height:string};vision:VisionRecord|null;dismissed:string[];aiSourceId:string|null;projection?:FloorProjection;calibration?:CalibrationDraft};
export type MotionSettings={walking:number;driving:number;delay:number;threshold:number};
export const defaultMotion:MotionSettings={walking:1.4,driving:2,delay:0,threshold:1.5};
export type AuditSnapshot={scene:Scene;baseline:Scene;photo:string|null;photoMeta:{id:string;name:string};photoSession:PhotoSession|null;motion:MotionSettings};
// A single non-recursive recovery snapshot accompanies the current audit.
export type AuditWorkspace=AuditSnapshot&{recovery?:AuditSnapshot|null};
export type AuditArchive=AuditWorkspace&{format:'riskverse-audit';version:1;savedAt:string};
export const MAX_ARCHIVE_BYTES=26*1024*1024;
const MAX_PHOTO_BYTES=8*1024*1024;
const str=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v));
const point=(p:unknown):p is Point=>object(p)&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=1&&p.y<=1;

export function validPhotoSession(v:unknown):v is PhotoSession{
 if(!object(v))return false;
 const s=v as unknown as PhotoSession,d=s.draft;
 if(!str(s.note,500)||!object(d)||!str(d.name,119)||!['rack','pallet','barrier'].includes(d.kind)||!(['x','y','w','h','height'] as const).every(k=>str(d[k],32)))return false;
 if(s.region!==null&&(!point(s.region)||![s.region.w,s.region.h].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)||s.region.x+s.region.w>1.000001||s.region.y+s.region.h>1.000001))return false;
 if(s.projection!==undefined&&!validProjection(s.projection))return false;
 if(s.calibration!==undefined){const c=s.calibration;if(!object(c)||!Array.isArray(c.corners)||c.corners.length>4||!c.corners.every(point)||(c.anchor!==null&&!point(c.anchor))||!object(c.dimensions)||!str(c.dimensions.width,12)||!str(c.dimensions.height,12))return false}
 if(!Array.isArray(s.dismissed)||s.dismissed.length>12||!s.dismissed.every(id=>str(id,40)&&id.length>0)||new Set(s.dismissed).size!==s.dismissed.length||s.aiSourceId!==null&&(!str(s.aiSourceId,40)||!s.aiSourceId.length))return false;
 if(s.vision!==null){
  if(!object(s.vision)||!str(s.vision.model,100)||!s.vision.model.length||!date(s.vision.analyzedAt))return false;
  try{const report=parseVision(s.vision.report),ids=new Set(report.observations.map(o=>o.id));if(s.dismissed.some(id=>!ids.has(id))||s.aiSourceId!==null&&!ids.has(s.aiSourceId))return false}catch{return false}
 }else if(s.dismissed.length||s.aiSourceId!==null)return false;
 return true;
}
export function validMotion(v:unknown):v is MotionSettings{if(!object(v))return false;const s=v as MotionSettings;return [[s.walking,.3,3],[s.driving,.3,5],[s.delay,0,30],[s.threshold,.5,4]].every(([n,min,max])=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max)}

export function validPhotoData(value:unknown):value is string{
 if(!str(value,Math.ceil(MAX_PHOTO_BYTES/3)*4+64))return false;
 const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
 if(!match||match[2].length%4!==0)return false;
 const encoded=match[2],size=encoded.length/4*3-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0);
 if(size<4||size>MAX_PHOTO_BYTES)return false;
 try{const head=atob(encoded.slice(0,16));return match[1]==='png'?head.startsWith('\x89PNG\r\n\x1a\n'):match[1]==='jpeg'?head.startsWith('\xff\xd8\xff'):head.startsWith('RIFF')&&head.slice(8,12)==='WEBP'}catch{return false}
}
function validSnapshot(v:unknown):v is AuditSnapshot{
 if(!object(v))return false;const a=v as unknown as AuditSnapshot;
 if(!validScene(a.scene)||!validScene(a.baseline)||!validMotion(a.motion)||!object(a.photoMeta)||!str(a.photoMeta.id,100)||!str(a.photoMeta.name,255)||(a.photoSession!==null&&!validPhotoSession(a.photoSession)))return false;
 if(a.photo!==null&&(!validPhotoData(a.photo)||!a.photoMeta.id.length||!a.photoMeta.name.length))return false;
 if(a.photo!==null&&a.scene.source&&a.scene.source.id!==a.photoMeta.id)return false;
 return true;
}
export function parseArchive(v:unknown):AuditArchive{
 try{
  if(!object(v)||v.format!=='riskverse-audit'||v.version!==1||!date(v.savedAt))throw Error();
  const recovery=v.recovery;if(!validSnapshot(v)||(recovery!==undefined&&recovery!==null&&!validSnapshot(recovery)))throw Error();
  return v as unknown as AuditArchive;
 }catch{throw Error('Архив содержит некорректные или неполные данные. Текущий аудит не изменён.')}
}
export function snapshotOnly(a:AuditSnapshot):AuditSnapshot{return {scene:a.scene,baseline:a.baseline,photo:a.photo,photoMeta:a.photoMeta,photoSession:a.photoSession,motion:a.motion}}
export function sameWorkspace(a:AuditWorkspace,b:AuditWorkspace|null):boolean{
 const same=(x:AuditSnapshot,y:AuditSnapshot)=>x.photo===y.photo&&JSON.stringify({scene:x.scene,baseline:x.baseline,photoMeta:x.photoMeta,photoSession:x.photoSession,motion:x.motion})===JSON.stringify({scene:y.scene,baseline:y.baseline,photoMeta:y.photoMeta,photoSession:y.photoSession,motion:y.motion});
 return !!b&&same(a,b)&&(!a.recovery&&!b.recovery||!!a.recovery&&!!b.recovery&&same(a.recovery,b.recovery));
}
export {readAuditDatabase,writeAuditDatabase} from './auditDatabase';
