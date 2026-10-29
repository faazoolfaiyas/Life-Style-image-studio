import { createClient, type User } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const supabase=createClient(url,key);
export type Kind='main'|'color'|'other';
export type Photo={id:string;kind:Kind;data:string;label:string;path?:string};
export type Product={id:string;name:string;description:string;createdAt:number;photos:Photo[]};
export const imageUrl=(path:string)=>path.startsWith('github:')?'https://raw.githubusercontent.com/lifestylekky/Life-Style-image-studio-store-/main/'+path.slice(7):supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
export async function getUser():Promise<User|null>{const {data,error}=await supabase.auth.getUser();if(error)return null;return data.user}
export async function load():Promise<Product[]>{const {data:rows,error}=await supabase.from('products').select('id,name,description,created_at,product_images(id,kind,storage_path,filename,sort_order)').order('created_at',{ascending:false});if(error)throw error;const products:Product[]=[];for(const row of rows??[]){const photos:Photo[]=[];for(const img of [...(row.product_images??[])].sort((a,b)=>a.sort_order-b.sort_order)){photos.push({id:img.id,kind:img.kind as Kind,data:imageUrl(img.storage_path),label:img.filename,path:img.storage_path})}products.push({id:row.id,name:row.name,description:row.description??'',createdAt:new Date(row.created_at).getTime(),photos})}return products}
async function api(path:string,init:RequestInit){const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('Please sign in first.');const res=await fetch(path,{...init,headers:{...init.headers,Authorization:'Bearer '+session.access_token}});const json=await res.json();if(!res.ok)throw Error(json.error||'Image storage request failed');return json}
export type UploadProgress={index:number;total:number;percent:number;name:string;phase:'uploading'|'saving'};
async function uploadWithProgress(form:FormData,token:string,onProgress:(percent:number)=>void):Promise<{path:string}>{return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST','/api/images');xhr.setRequestHeader('Authorization','Bearer '+token);xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.min(95,Math.round(e.loaded/e.total*95)))};xhr.onerror=()=>reject(Error('Network error while uploading image'));xhr.onload=()=>{let result:{path?:string;error?:string};try{result=JSON.parse(xhr.responseText) as {path?:string;error?:string}}catch{reject(Error('Invalid upload response'));return}if(xhr.status>=200&&xhr.status<300){if(!result.path){reject(Error('Missing uploaded image path'));return}onProgress(100);resolve({path:result.path})}else reject(Error(result.error||'Upload failed'))};xhr.send(form)})}
export async function put(p:Product,onProgress?:(progress:UploadProgress)=>void){const user=await getUser();if(!user)throw Error('Please sign in first.');const uploaded:string[]=[];let inserted=false;const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('Please sign in first.');try{for(let i=0;i<p.photos.length;i++){const photo=p.photos[i];const blob=await(await fetch(photo.data)).blob();const form=new FormData();form.append('file',blob,photo.label);form.append('productId',p.id);form.append('kind',photo.kind);onProgress?.({index:i,total:p.photos.length,percent:0,name:photo.label,phase:'uploading'});const result=await uploadWithProgress(form,session.access_token,percent=>onProgress?.({index:i,total:p.photos.length,percent,name:photo.label,phase:'uploading'}));uploaded.push(result.path)}onProgress?.({index:p.photos.length,total:p.photos.length,percent:100,name:'Saving product',phase:'saving'});const {error}=await supabase.from('products').insert({id:p.id,owner_id:user.id,name:p.name,description:p.description});if(error)throw error;inserted=true;for(let i=0;i<p.photos.length;i++){const photo=p.photos[i];const {error:rowError}=await supabase.from('product_images').insert({product_id:p.id,owner_id:user.id,kind:photo.kind,storage_path:uploaded[i],filename:photo.label,sort_order:i});if(rowError)throw rowError}}catch(e){if(inserted)await supabase.from('products').delete().eq('id',p.id);throw e}}
export type DeleteProgress = {
  phase: 'loading' | 'images' | 'record' | 'storage' | 'complete';
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
  const total=github.length+1+(legacy.length?1:0);
  let completed=0;
  for(const path of github){
    onProgress?.({phase:'images',completed,total,label:'Removing image '+(completed+1)+' of '+github.length});
    await api('/api/images?path='+encodeURIComponent(path),{method:'DELETE'});
    completed++;
    onProgress?.({phase:'images',completed,total,label:'Removed '+completed+' of '+github.length+' repository images'});
  }
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
