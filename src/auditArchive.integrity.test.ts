import {describe,expect,it} from 'vitest';
import {clone,initialScene} from './model';
import {defaultMotion,parseArchive,validPhotoSession,sameWorkspace,type AuditArchive,type PhotoSession} from './auditArchive';

const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=';
function session():PhotoSession{return {
 region:{x:.1,y:.2,w:.3,h:.4},note:'Проверить проход',
 draft:{name:'Паллеты',kind:'pallet',x:'2',y:'3',w:'2',h:'1',height:'1.7'},
 vision:{model:'test-provider',analyzedAt:'2026-10-24T12:00:00.000Z',report:{summary:'Тестовые данные',limitations:[],observations:[{id:'p1',label:'Паллеты',kind:'pallet',region:{x:.1,y:.2,w:.3,h:.4},concern:'potential_hazard',visibleEvidence:'Предмет на проходе',uncertainty:'Размеры неизвестны',recommendation:'Измерить'}]}},
 dismissed:[],aiSourceId:'p1',
 calibration:{corners:[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}],anchor:{x:.5,y:.5},dimensions:{width:'24',height:'16'}},
 projection:{corners:[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}],anchor:{x:.5,y:.5},width:24,height:16},
}}
function archive():AuditArchive{return {format:'riskverse-audit',version:1,savedAt:'2026-10-24T12:00:00.000Z',scene:clone(initialScene),baseline:clone(initialScene),photo,photoMeta:{id:'photo-test',name:'склад.png'},photoSession:session(),motion:{...defaultMotion,delay:4.2}}}

describe('full audit archive integrity',()=>{
 it('rejects a photograph attached to a scene with a different source ID',()=>{const a=archive();a.scene.source={kind:'photo',id:'different-photo',fileName:'other.png'};expect(()=>parseArchive(a)).toThrow();});
 it('round trips the image, AI provenance, calibration, edits, baseline and motion together',()=>{
  const a=archive();a.scene.items[0].x=1;
  const restored=parseArchive(JSON.parse(JSON.stringify(a)));
  expect(restored).toEqual(a);
  expect(restored.baseline.items[0].x).toBe(3);
 });
 it('supports a geometry-only legacy workspace with no invented photograph or AI result',()=>{
  const a=archive();a.photo=null;a.photoSession=null;a.photoMeta={id:'',name:''};
  expect(parseArchive(a)).toEqual(a);
 });
 it('does not treat reopening or remounting the same audit as an edit',()=>{
  const a=archive(),b=JSON.parse(JSON.stringify(a));expect(sameWorkspace(a,b)).toBe(true);
  b.photoSession.draft.name='Изменение';expect(sameWorkspace(a,b)).toBe(false);
  expect(sameWorkspace(a,{...a,recovery:{...a,motion:{...a.motion,delay:9}}})).toBe(false);
 });
 it('rejects missing required photo-session fields instead of restoring a broken component state',()=>{
  for(const field of ['region','vision','aiSourceId','dismissed','draft','note']){
   const s:any=session();delete s[field];expect(validPhotoSession(s),field).toBe(false);
  }
 });
 it('rejects falsy or malformed region and vision values',()=>{
  for(const region of [false,0,'',{},[],{x:0,y:0,w:2,h:1}])expect(validPhotoSession({...session(),region})).toBe(false);
  for(const vision of [false,0,'',{},[]])expect(validPhotoSession({...session(),vision})).toBe(false);
 });
 it('rejects a selected observation that is absent from the saved AI report',()=>{
  expect(validPhotoSession({...session(),aiSourceId:'missing'})).toBe(false);
 });
 it('rejects duplicate or unknown dismissed observations',()=>{
  for(const dismissed of [['p1','p1'],['missing']])expect(validPhotoSession({...session(),dismissed})).toBe(false);
 });
 it('rejects invalid version, routes, speeds and image payloads before replacing the workspace',()=>{
  for(const patch of [{version:2},{motion:{...defaultMotion,walking:0}},{scene:{...initialScene,pedestrian:[{x:1,y:1}]}},{photo:'blob:expired'},{photo:'data:image/png;base64,bm90IGFuIGltYWdl'}])expect(()=>parseArchive({...archive(),...patch})).toThrow();
 });
});
