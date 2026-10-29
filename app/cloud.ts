import { createClient, type User } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const supabase=createClient(url,key);
export type Kind='main'|'color'|'other'|'generated';
export type Photo={id:string;kind:Kind;data:string;label:string;path?:string};
export type Product={id:string;name:string;description:string;createdAt:number;photos:Photo[]};
export type GeneratedImage={name:string;path:string;url:string};
export async function generatedImages(productId:string):Promise<GeneratedImage[]>{const response=await fetch('/api/generated?productId='+encodeURIComponent(productId),{cache:'no-store'});const json=await response.json();if(!response.ok)throw Error(json.error||'Could not load generated images');return json.images as GeneratedImage[];}
export const imageUrl=(path:string)=>path.startsWith('github:')?'https://raw.githubusercontent.com/lifestylekky/Life-Style-image-studio-store-/main/'+path.slice(7):supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
export async function getUser():Promise<User|null>{const {data,error}=await supabase.auth.getUser();if(error)return null;return data.user}
export async function load():Promise<Product[]>{const {data:rows,error}=await supabase.from('products').select('id,name,description,created_at,product_images(id,kind,storage_path,filename,sort_order)').order('created_at',{ascending:false});if(error)throw error;const products:Product[]=[];for(const row of rows??[]){const photos:Photo[]=[];for(const img of [...(row.product_images??[])].sort((a,b)=>a.sort_order-b.sort_order)){photos.push({id:img.id,kind:img.kind as Kind,data:imageUrl(img.storage_path),label:img.filename,path:img.storage_path})}products.push({id:row.id,name:row.name,description:row.description??'',createdAt:new Date(row.created_at).getTime(),photos})}return products}
async function api(path:string,init:RequestInit){const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('Please sign in first.');const res=await fetch(path,{...init,headers:{...init.headers,Authorization:'Bearer '+session.access_token}});const json=await res.json();if(!res.ok)throw Error(json.error||'Image storage request failed');return json}
export type UploadProgress={index:number;total:number;percent:number;name:string;phase:'uploading'|'saving'};
async function uploadWithProgress(form:FormData,token:string,onProgress:(percent:number)=>void):Promise<{path:string}>{
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();
  xhr.open('POST','/api/images');
  xhr.timeout=120000;
  xhr.setRequestHeader('Authorization','Bearer '+token);
  xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.min(95,Math.round(e.loaded/e.total*95)))};
  xhr.onerror=()=>reject(Error('Network error while uploading image. Check your connection and try again.'));
  xhr.ontimeout=()=>reject(Error('Image upload timed out. Please retry.'));
  xhr.onload=()=>{
   const status=xhr.status;
   let result:{path?:string;error?:string}|null=null;
   try{result=JSON.parse(xhr.responseText) as {path?:string;error?:string}}catch{}
   if(status>=200&&status<300&&result?.path){onProgress(100);resolve({path:result.path});return}
   if(result?.error){reject(Error(result.error));return}
   if(status===413){reject(Error('Image exceeds the server upload limit. Choose a smaller image (under 4 MB).'));return}
   if(status===401||status===403){reject(Error('Your session has expired or upload access was denied. Sign in again.'));return}
   if(status===502||status===503||status===504){reject(Error('Image storage is temporarily unavailable (HTTP '+status+'). Please retry.'));return}
   if(status===200){reject(Error('Upload succeeded but no image path was returned. Please retry.'));return}
   reject(Error('Upload failed (HTTP '+status+'). The server returned an unexpected response. Please retry.'));
  };
  xhr.send(form);
 });
}
async function prepareUpload(blob:Blob):Promise<{file:Blob;extension:string}>{
 const extension=blob.type==='image/jpeg'?'jpg':blob.type==='image/png'?'png':blob.type==='image/gif'?'gif':'webp';
 if(blob.size<=3*1024*1024&&['image/jpeg','image/png','image/webp','image/gif'].includes(blob.type))return {file:blob,extension};
 const bitmap=await createImageBitmap(blob);
 try{
  const scale=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext('2d');
  if(!context)throw Error('Could not prepare the image');
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  for(const quality of [0.85,0.7,0.55]){
   const file=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));
   if(file&&file.size<=3*1024*1024)return {file,extension:'webp'};
  }
  throw Error('This image is too large to upload. Try a smaller image.');
 }finally{bitmap.close()}
}
export async function put(p:Product,onProgress?:(progress:UploadProgress)=>void){const user=await getUser();if(!user)throw Error('Please sign in first.');const uploaded:string[]=[];let inserted=false;const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('Please sign in first.');try{for(let i=0;i<p.photos.length;i++){const photo=p.photos[i];const blob=await(await fetch(photo.data)).blob();const prepared=await prepareUpload(blob);const form=new FormData();form.append('file',prepared.file,photo.label.replace(/\.[^.]+$/,'')+'.'+prepared.extension);form.append('productId',p.id);form.append('kind',photo.kind);onProgress?.({index:i,total:p.photos.length,percent:0,name:photo.label,phase:'uploading'});const result=await uploadWithProgress(form,session.access_token,percent=>onProgress?.({index:i,total:p.photos.length,percent,name:photo.label,phase:'uploading'}));uploaded.push(result.path)}onProgress?.({index:p.photos.length,total:p.photos.length,percent:100,name:'Saving product',phase:'saving'});const {error}=await supabase.from('products').insert({id:p.id,owner_id:user.id,name:p.name,description:p.description});if(error)throw error;inserted=true;for(let i=0;i<p.photos.length;i++){const photo=p.photos[i];const {error:rowError}=await supabase.from('product_images').insert({product_id:p.id,owner_id:user.id,kind:photo.kind,storage_path:uploaded[i],filename:photo.label,sort_order:i});if(rowError)throw rowError}await api('/api/generated',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:p.id})})}catch(e){if(inserted)await supabase.from('products').delete().eq('id',p.id);throw e}}
export type DeleteProgress = {
  phase: 'loading' | 'images' | 'generated' | 'record' | 'storage' | 'complete';
  completed: number;
  total: number;
  label: string;
};
export async function remove(id:string,onProgress?:(progress:DeleteProgress)=>void){
  onProgress?.({phase:'loading',completed:0,total:0,label:'Finding product images'});
  const {data,error}=await supabase.from('product_images').select('storage_path').eq('product_id',id);
  if(error)throw error;
  const paths=(data||[]).map(x=>x.storage_path);
  const github=paths.filter(x=>x.startsWith('github:'));
  const legacy=paths.filter(x=>!x.startsWith('github:'));
  const total=github.length+2+(legacy.length?1:0);
  let completed=0;
  for(const path of github){
    onProgress?.({phase:'images',completed,total,label:'Removing image '+(completed+1)+' of '+github.length});
    await api('/api/images?path='+encodeURIComponent(path),{method:'DELETE'});
    completed++;
    onProgress?.({phase:'images',completed,total,label:'Removed '+completed+' of '+github.length+' repository images'});
  }
  onProgress?.({phase:'generated',completed,total,label:'Removing generated images and folder'});
  await api('/api/generated?productId='+encodeURIComponent(id),{method:'DELETE'});
  completed++;
  onProgress?.({phase:'record',completed,total,label:'Deleting product record'});
  const {error:delError}=await supabase.from('products').delete().eq('id',id);
  if(delError)throw delError;
  completed++;
  onProgress?.({phase:'record',completed,total,label:'Product record deleted'});
  if(legacy.length){
    onProgress?.({phase:'storage',completed,total,label:'Removing stored images'});
    const {error:storageError}=await supabase.storage.from('product-images').remove(legacy);
    if(storageError)throw storageError;
    completed++;
  }
  onProgress?.({phase:'complete',completed:total,total,label:'Product deleted'});
}
