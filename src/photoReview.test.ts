// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import PhotoWorkspace from './PhotoWorkspace';
import {clone,initialScene} from './model';
import type {PhotoSession} from './auditArchive';
vi.mock('./FloorPlacement',()=>({default:()=>null}));
let root:Root|undefined,host:HTMLDivElement|undefined;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());host?.remove();vi.unstubAllGlobals()});
describe('rejected AI selection',()=>{
 it('clears the selected region and note so a rejected observation cannot be added as manual evidence',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({ready:true,provider:'gemini',model:'test'}))));
  const region={x:.1,y:.1,w:.2,h:.2};
  const initial:PhotoSession={region,note:'AI draft',draft:{name:'Паллета',kind:'pallet',x:'1',y:'1',w:'2',h:'2',height:'1'},dismissed:[],aiSourceId:'one',vision:{model:'test',analyzedAt:'2026-10-25T00:00:00Z',report:{summary:'Снимок',limitations:[],observations:[{id:'one',label:'Паллета',kind:'pallet',concern:'context',region,visibleEvidence:'Предмет',uncertainty:'',recommendation:'Проверить'}]}}};
  const persist=vi.fn();host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>{root!.render(createElement(PhotoWorkspace,{active:true,initialState:initial,onPersist:persist,photo:'data:image/png;base64,test',sourceId:'photo',fileName:'image.png',scene:clone(initialScene),selected:null,onSelect:vi.fn(),onUpload:vi.fn(),onConfirm:vi.fn()}))});
  const reject=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Отклонить');expect(reject).toBeTruthy();
  await act(async()=>reject!.click());
  expect(persist.mock.lastCall?.[0]).toMatchObject({region:null,note:'',aiSourceId:null,dismissed:['one']});
 });
});
