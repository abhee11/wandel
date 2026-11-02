import type {PageContext} from './schema';
/** Screenshot coordinates and masks use the same CSS viewport as the DOM capture. */
export async function redactPageScreenshot(data:string,context:PageContext){
 if(!context.viewport||!context.screenshotMasks)throw new Error('Screenshot privacy masks are unavailable.');
 if(!/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(data))throw new Error('Unexpected screenshot encoding.');
 const bytes=Uint8Array.from(atob(data.slice(data.indexOf(',')+1)),character=>character.charCodeAt(0));
 const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/jpeg'}));
 try{
  const {width,height}=context.viewport;if(width<=0||height<=0)throw new Error('The page viewport is unavailable.');
  // Reject a changed viewport rather than masking the wrong pixels.
  if(Math.abs(bitmap.width/bitmap.height-width/height)>.04)throw new Error('The page viewport changed during capture.');
  const scale=Math.min(1,1536/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Screenshot processing is unavailable.');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);ctx.fillStyle='#d9dde5';
  for(const mask of context.screenshotMasks)ctx.fillRect(Math.floor(mask.x*canvas.width/width),Math.floor(mask.y*canvas.height/height),Math.ceil(mask.width*canvas.width/width),Math.ceil(mask.height*canvas.height/height));
  for(const quality of [.75,.55,.35]){const image=canvas.toDataURL('image/jpeg',quality);if(image.length<=350000)return image;}
  throw new Error('The screenshot exceeds the image budget.');
 }finally{bitmap.close();}
}
