// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {MAX_VISION_BODY_BYTES,prepareVisionImage} from './prepareVisionImage';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()});
describe('photo upload hosting limit',()=>{
 it('re-encodes a large photo to fit the complete JSON request and releases the bitmap',async()=>{
  const close=vi.fn(),bitmap={width:6000,height:4000,close};
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('image')));vi.stubGlobal('createImageBitmap',vi.fn(async()=>bitmap));
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:vi.fn(),drawImage:vi.fn()} as unknown as CanvasRenderingContext2D);
  const encode=vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValueOnce('data:image/jpeg;base64,'+'A'.repeat(MAX_VISION_BODY_BYTES)).mockReturnValue('data:image/jpeg;base64,AAAA');
  const image=await prepareVisionImage('blob:photo',new AbortController().signal);
  expect(JSON.stringify({image}).length).toBeLessThanOrEqual(MAX_VISION_BODY_BYTES);expect(encode).toHaveBeenCalledTimes(2);expect(close).toHaveBeenCalledOnce();
 });
 it('stops before encoding an aborted upload and closes the decoded bitmap',async()=>{
  const close=vi.fn(),controller=new AbortController();
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('image')));vi.stubGlobal('createImageBitmap',vi.fn(async()=>{controller.abort();return{width:10,height:10,close}}));
  await expect(prepareVisionImage('blob:photo',controller.signal)).rejects.toThrow();expect(close).toHaveBeenCalledOnce();
 });
});
