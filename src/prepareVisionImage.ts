// Vercel's 4.5 MB request limit includes base64 and JSON overhead.
export const MAX_VISION_BODY_BYTES=4_000_000;
export async function prepareVisionImage(photo:string,signal:AbortSignal):Promise<string>{
 const response=await fetch(photo,{signal});if(!response.ok)throw Error('Не удалось прочитать снимок.');
 const bitmap=await createImageBitmap(await response.blob());
 try{
  signal.throwIfAborted();
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');if(!context)throw Error('Не удалось подготовить снимок.');
  for(const [edge,quality]of [[2048,.88],[1800,.8],[1500,.72],[1200,.65]]){
   signal.throwIfAborted();
   const scale=Math.min(1,edge/Math.max(bitmap.width,bitmap.height));
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const image=canvas.toDataURL('image/jpeg',quality);
   if(image.startsWith('data:image/jpeg;base64,')&&JSON.stringify({image}).length<=MAX_VISION_BODY_BYTES)return image;
  }
  throw Error('Не удалось уменьшить фото для отправки. Выберите другой снимок.');
 }finally{bitmap.close()}
}
