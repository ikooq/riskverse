import {clone,type Scene} from './model';
import {defaultMotion,type AuditSnapshot} from './auditArchive';

/** A scene archive has no photo bytes: retain evidence only for the same source. */
export function workspaceForScene(scene:Scene,current:AuditSnapshot,baseline:Scene=scene):AuditSnapshot{
 const matching=!!scene.source&&scene.source.id===current.photoMeta.id;
 return clone({scene,baseline,photo:matching?current.photo:null,
  photoMeta:matching?current.photoMeta:{id:scene.source?.id??'',name:scene.source?.fileName??''},
  photoSession:matching?current.photoSession:null,motion:matching?current.motion:{...defaultMotion}});
}
