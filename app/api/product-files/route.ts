import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

export const runtime='nodejs';
export const maxDuration=45;

const repository='lifestylekky/Life-Style-image-studio-store-';
const branch='main';
const validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers=(token:string)=>({
 Authorization:'Bearer '+token,
 Accept:'application/vnd.github+json',
 'X-GitHub-Api-Version':'2022-11-28',
 'Content-Type':'application/json'
});
const fileUrl=(path:string)=>'https://api.github.com/repos/'+repository+'/contents/'+path.split('/').map(encodeURIComponent).join('/');

type ImageRow={id:string;kind:string;filename:string;storage_path:string;sort_order:number};
type GitHubText={sha:string;content:string;encoding:string};

// Read and merge each time so updating the description does not overwrite
// upload history, and retries do not produce duplicate upload entries.
async function updateText(token:string,path:string,merge:(current:string)=>string){
 const url=fileUrl(path);
 for(let attempt=0;attempt<4;attempt++){
  const lookup=await fetch(url+'?ref='+branch,{headers:headers(token),cache:'no-store'});
  let sha:string|undefined;
  let previous='';
  if(lookup.ok){
   const file=await lookup.json() as GitHubText;
   if(file.encoding!=='base64')throw Error('Cannot read existing product file '+path);
   sha=file.sha;
   previous=Buffer.from(file.content.replace(/\s/g,''),'base64').toString('utf8');
  }else if(lookup.status!==404){
   throw Error('GitHub file lookup failed ('+lookup.status+')');
  }
  const next=merge(previous);
  if(sha&&next===previous)return;
  const result=await fetch(url,{
   method:'PUT',headers:headers(token),cache:'no-store',
   body:JSON.stringify({message:'Sync product information '+path,branch,content:Buffer.from(next,'utf8').toString('base64'),...(sha?{sha}:{})})
  });
  if(result.ok)return;
  if(result.status===409||result.status===422)continue;
  throw Error('GitHub rejected product file update ('+result.status+')');
 }
 throw Error('GitHub file changed during sync. Please retry.');
}
async function authenticate(req:NextRequest){
 const authorization=req.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer '))return null;
 const jwt=authorization.slice(7);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return null;
 const client=createClient(url,key,{auth:{persistSession:false},global:{headers:{Authorization:'Bearer '+jwt}}});
 const {data:{user},error}=await client.auth.getUser(jwt);
 return !error&&user?{client,user}:null;
}

export async function POST(req:NextRequest){
 const auth=await authenticate(req);
 if(!auth)return NextResponse.json({error:'Please sign in.'},{status:401});
 const token=process.env.GITHUB_IMAGES_TOKEN;
 if(!token)return NextResponse.json({error:'GitHub image repository is not configured.'},{status:503});
 let body:{action?:unknown;productId?:unknown;description?:unknown;imageIds?:unknown};
 try{body=await req.json()}catch{return NextResponse.json({error:'Invalid request'},{status:400})}
 const id=typeof body.productId==='string'?body.productId:'';
 const action=body.action;
 if(!validId.test(id)||!['sync','images','description'].includes(String(action)))return NextResponse.json({error:'Invalid product or action'},{status:400});
 const {data:product,error:readError}=await auth.client.from('products').select('id,owner_id,description').eq('id',id).eq('owner_id',auth.user.id).maybeSingle();
 if(readError||!product)return NextResponse.json({error:'Product not found or access denied'},{status:403});

 const folder='products/'+id+'/';
 let storedDescription=String(product.description??'');
 let databaseSaved=false;
 if(action==='description'){
  if(typeof body.description!=='string'||body.description.length>12000)return NextResponse.json({error:'Invalid product description'},{status:400});
  storedDescription=body.description;
  const {data:updated,error}=await auth.client.from('products').update({description:storedDescription}).eq('id',id).eq('owner_id',auth.user.id).select('id').maybeSingle();
  if(error||!updated)return NextResponse.json({error:error?.message||'Unable to save product description'},{status:500});
  databaseSaved=true;
 }
 try{
  if(action==='sync'||action==='description'){
   await updateText(token,folder+'description.txt',()=>storedDescription);
  }
  if(action==='sync'||action==='images'){
   let imageIds:string[]|undefined;
   if(action==='images'){
    if(!Array.isArray(body.imageIds)||body.imageIds.length>100||body.imageIds.some(x=>typeof x!=='string'||!validId.test(x))){
     return NextResponse.json({error:'Invalid image IDs'},{status:400});
    }
    imageIds=body.imageIds as string[];
   }
   let query=auth.client.from('product_images').select('id,kind,filename,storage_path,sort_order').eq('product_id',id).eq('owner_id',auth.user.id).order('sort_order',{ascending:true});
   if(imageIds)query=query.in('id',imageIds.length?imageIds:['00000000-0000-0000-0000-000000000000']);
   const {data,error}=await query;
   if(error)throw Error('Could not retrieve saved image metadata: '+error.message);
   const entries=(data??[]) as ImageRow[];
   await updateText(token,folder+'updates.txt',current=>{
    const existing=current||'Life Style product image uploads\n';
    const lines=entries.filter(image=>!existing.includes('['+image.id+']')).map(image=>{
     const name=(image.filename||'image').replace(/[\r\n\t]/g,' ').slice(0,200);
     const path=image.storage_path.replace(/[\r\n\t]/g,' ');
     return new Date().toISOString()+' ['+image.id+'] '+image.kind+' | '+name+' | '+path;
    });
    return existing.replace(/\s*$/,'\n')+(lines.length?lines.join('\n')+'\n':'');
   });
  }
  return NextResponse.json({ok:true});
 }catch(error){
  const reason=error instanceof Error?error.message:'Could not sync repository files';
  return NextResponse.json({error:(databaseSaved?'Description saved in the database, but repository sync failed: ':'Repository sync failed: ')+reason,saved:databaseSaved},{status:502});
 }
}
