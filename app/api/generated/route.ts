import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const repo = 'lifestylekky/Life-Style-image-studio-store-';
const branch = 'main';
const validId = (id:string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const apiUrl = (path:string) => 'https://api.github.com/repos/'+repo+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
const ghHeaders = (token?:string) => ({'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(token?{'Authorization':'Bearer '+token}:{})});
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
async function owner(req:NextRequest,id:string){
 const bearer=req.headers.get('authorization')||'';
 if(!bearer.startsWith('Bearer '))return false;
 const client=db();
 const {data:{user},error}=await client.auth.getUser(bearer.slice(7));
 if(error||!user)return false;
 const {data:product}=await client.from('products').select('owner_id').eq('id',id).single();
 return product?.owner_id===user.id;
}
type GitHubFile = {name:string;path:string;sha:string;type:string;size:number};
async function list(id:string){
 const token=process.env.GITHUB_IMAGES_TOKEN;
 const response=await fetch(apiUrl('products/'+id+'/generated')+'?ref='+branch,{headers:ghHeaders(token),cache:'no-store'});
 if(response.status===404)return [] as GitHubFile[];
 if(!response.ok)throw Error('Could not read generated images from GitHub ('+response.status+')');
 const entries=await response.json() as GitHubFile[]|GitHubFile;
 if(!Array.isArray(entries))return [];
 return entries.filter(x=>x.type==='file');
}
const isImage=(name:string)=>/\.(jpe?g|png|webp|gif|avif)$/i.test(name);
export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get('productId')||'';
 if(!validId(id))return NextResponse.json({error:'Invalid product ID'},{status:400});
 const {data:product}=await db().from('products').select('id').eq('id',id).single();
 if(!product)return NextResponse.json({error:'Product not found'},{status:404});
 try{
  const entries=await list(id);
  return NextResponse.json({images:entries.filter(x=>isImage(x.name)).map(x=>({name:x.name,path:x.path,url:'https://raw.githubusercontent.com/'+repo+'/'+branch+'/'+x.path}))},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to list generated images'},{status:502})}
}
export async function POST(req:NextRequest){
 const id=String((await req.json().catch(()=>({}))).productId||'');
 if(!validId(id))return NextResponse.json({error:'Invalid product ID'},{status:400});
 if(!await owner(req,id))return NextResponse.json({error:'Forbidden'},{status:403});
 const token=process.env.GITHUB_IMAGES_TOKEN;
 if(!token)return NextResponse.json({error:'GitHub storage not configured'},{status:503});
 const path='products/'+id+'/generated/.gitkeep';
 try{
  const lookup=await fetch(apiUrl(path)+'?ref='+branch,{headers:ghHeaders(token),cache:'no-store'});
  if(lookup.ok)return NextResponse.json({ok:true});
  if(lookup.status!==404)return NextResponse.json({error:'Could not check generated folder'},{status:502});
  const created=await fetch(apiUrl(path),{method:'PUT',headers:{...ghHeaders(token),'Content-Type':'application/json'},body:JSON.stringify({message:'Create generated image folder for product '+id,content:Buffer.from('Generated product images go in this folder.\n').toString('base64'),branch})});
  if(!created.ok)return NextResponse.json({error:'Could not create generated folder'},{status:502});
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'GitHub request failed'},{status:502})}
}
export async function DELETE(req:NextRequest){
 const id=req.nextUrl.searchParams.get('productId')||'';
 if(!validId(id))return NextResponse.json({error:'Invalid product ID'},{status:400});
 if(!await owner(req,id))return NextResponse.json({error:'Forbidden'},{status:403});
 const token=process.env.GITHUB_IMAGES_TOKEN;
 if(!token)return NextResponse.json({error:'GitHub storage not configured'},{status:503});
 try{
  const entries=await list(id);
  for(const file of entries){
   const response=await fetch(apiUrl(file.path),{method:'DELETE',headers:{...ghHeaders(token),'Content-Type':'application/json'},body:JSON.stringify({message:'Remove generated product file',sha:file.sha,branch})});
   if(!response.ok)return NextResponse.json({error:'Could not delete generated file '+file.name},{status:502});
  }
  return NextResponse.json({ok:true,removed:entries.length});
 }catch{return NextResponse.json({error:'Could not remove generated images'},{status:502})}
}
