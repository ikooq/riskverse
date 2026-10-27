// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import NewAudit from './NewAudit';
let host:HTMLDivElement,root:Root;
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();vi.unstubAllGlobals()});
async function render(){vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);const create=vi.fn();await act(async()=>root.render(createElement(NewAudit,{onCreate:create,onClose:vi.fn()})));return create}
describe('new audit public samples',()=>{
 it('loads an image file and creates an empty model without making an AI request',async()=>{const fetcher=vi.fn(async(_url:unknown,_init?:unknown)=>({ok:true,blob:async()=>new Blob([new Uint8Array([255,216,255])],{type:'image/jpeg'})}));vi.stubGlobal('fetch',fetcher);const create=await render();await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Выбрать пример: Склад с погрузчиком"]')!.click());expect(create).not.toHaveBeenCalled();await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Создать рабочее пространство')!.click());expect(create).toHaveBeenCalledOnce();expect(create.mock.calls[0][0]).toMatchObject({items:[],pedestrian:[],vehicle:[]});expect(create.mock.calls[0][1]).toBeInstanceOf(File);expect(create.mock.calls[0][1].type).toBe('image/jpeg');expect(fetcher.mock.calls[0][0]).toBe('/demo/samples/forklift-warehouse.jpg')});
 it('keeps the current audit unchanged if a sample download fails',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>({ok:false})));const create=await render();await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Выбрать пример: Склад с погрузчиком"]')!.click());expect(host.querySelector('[role="alert"]')?.textContent).toContain('Не удалось');expect(create).not.toHaveBeenCalled()});
});
