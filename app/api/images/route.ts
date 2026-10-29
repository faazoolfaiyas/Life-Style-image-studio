import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
const repo='lifestylekky/Life-Style-image-studio-store-';
const branch='main';
const gh=(path:string)=>'https://api.github.com/repos/'+repo+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
async function authenticate(req:NextRequest){
 const auth=req.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer '))return null;
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
 const {data,error}=await db.auth.getUser(auth.slice(7));
 return error?null:data.user;
}
const headers=(token:string)=>({'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'});
export async function POST(req:NextRequest){
 const user=await authenticate(req);
 if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const token=process.env.GITHUB_IMAGES_TOKEN;
 if(!token)return NextResponse.json({error:'GitHub image storage is not configured. Set GITHUB_IMAGES_TOKEN in Vercel.'},{status:503});
 try{
  const form=await req.formData(),file=form.get('file'),productId=String(form.get('productId')||''),kind=String(form.get('kind')||'');
  if(!(file instanceof File)||!['main','color','other'].includes(kind)||!/^[0-9a-f-]{36}$/i.test(productId))return NextResponse.json({error:'Invalid image upload'},{status:400});
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||file.size>4*1024*1024)return NextResponse.json({error:'Use JPEG, PNG, WebP or GIF under 4 MB'},{status:400});
  const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'} as Record<string,string>)[file.type];
  const path='products/'+productId+'/'+(kind==='color'?'colors':kind)+'/'+crypto.randomUUID()+'.'+ext;
  const content=Buffer.from(await file.arrayBuffer()).toString('base64');
  const res=await fetch(gh(path),{method:'PUT',headers:headers(token),body:JSON.stringify({message:'Upload product image '+productId,content,branch}),cache:'no-store'});
  if(!res.ok){const detail=await res.json().catch(()=>({})) as {message?:string};const reason=typeof detail.message==='string'?detail.message.slice(0,180):'GitHub rejected the upload';console.error('GitHub image upload failed',res.status,reason);return NextResponse.json({error:'GitHub upload failed ('+res.status+'): '+reason},{status:502});}
  return NextResponse.json({path:'github:'+path,url:'https://raw.githubusercontent.com/'+repo+'/'+branch+'/'+path});
 }catch{return NextResponse.json({error:'Unable to upload image'},{status:500})}
}
export async function DELETE(req:NextRequest){
 const user=await authenticate(req);
 if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const token=process.env.GITHUB_IMAGES_TOKEN;
 if(!token)return NextResponse.json({error:'GitHub image storage is not configured'},{status:503});
 const path=req.nextUrl.searchParams.get('path')||'';
 if(!/^github:products\/[0-9a-f-]{36}\/(main|colors|other)\/[0-9a-f-]+\.(jpg|png|webp|gif)$/i.test(path))return NextResponse.json({error:'Invalid path'},{status:400});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
 const {data}=await db.from('product_images').select('product_id,products!inner(owner_id)').eq('storage_path',path).limit(1);
 const row=data?.[0] as unknown as {products:{owner_id:string}}|undefined;
 if(!row||row.products.owner_id!==user.id)return NextResponse.json({error:'Forbidden'},{status:403});
 const url=gh(path.slice(7)),lookup=await fetch(url+'?ref='+branch,{headers:headers(token),cache:'no-store'});
 if(lookup.status===404)return NextResponse.json({ok:true});
 if(!lookup.ok)return NextResponse.json({error:'GitHub lookup failed'},{status:502});
 const file=await lookup.json();
 const del=await fetch(url,{method:'DELETE',headers:headers(token),body:JSON.stringify({message:'Delete product image',sha:file.sha,branch})});
 if(!del.ok)return NextResponse.json({error:'GitHub delete failed'},{status:502});
 return NextResponse.json({ok:true});
}
