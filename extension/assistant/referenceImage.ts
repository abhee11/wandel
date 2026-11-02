/** Resize locally. Only the explicitly attached, compressed image is uploaded on Send. */
export async function prepareReferenceImage(file:File){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Use a PNG, JPEG or WebP image under 10 MB.');
 const bitmap=await createImageBitmap(file);try{
  if(bitmap.width*bitmap.height>40000000)throw new Error('Use an image smaller than 40 megapixels.');
  const canvas=document.createElement('canvas'),scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image preview is unavailable.');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  for(const quality of [.8,.65,.45]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=350000)return data;}throw new Error('This image is too detailed. Crop to the block you want to recreate.');
 }finally{bitmap.close();}
}
