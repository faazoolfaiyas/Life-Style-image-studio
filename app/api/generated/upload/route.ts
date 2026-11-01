import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

export const runtime='nodejs';
export const maxDuration=45;

const repository='lifestylekky/Life-Style-image-studio-store-';
const branch='main';
const validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const extensions:Record<string,string>={
 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'
};
const githubUrl=(path:string)=>'https://api.github.com/repos/'+repository+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
const githubHeaders=(token:string)=>({
 Authorization:'Bearer '+token,
 Accept:'application/vnd.github+json',
 'X-GitHub-Api-Version':'2022-11-28',
 'Content-Type':'application/json'
});

export async function POST(req:NextRequest){
 const authorization=req.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer '))return NextResponse.json({error:'Please sign in before uploading.'},{status:401});
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const supabaseKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!supabaseUrl||!supabaseKey)return NextResponse.json({error:'Database authentication is not configured.'},{status:503});
 const jwt=authorization.slice(7);
 const db=createClient(supabaseUrl,supabaseKey,{auth:{persistSession:false},global:{headers:{Authorization:'Bearer '+jwt}}});
 const {data:{user},error:authError}=await db.auth.getUser(jwt);
 if(authError||!user)return NextResponse.json({error:'Your session expired. Please sign in again.'},{status:401});
 const token=process.env.GITHUB_IMAGES_TOKEN;
 if(!token)return NextResponse.json({error:'Product image storage is unavailable.'},{status:503});

 try{
  const form=await req.formData();
  const file=form.get('file');
  const productId=String(form.get('productId')||'');
  if(!validId.test(productId)||!(file instanceof File))return NextResponse.json({error:'Invalid product or image.'},{status:400});
  const extension=extensions[file.type];
  if(!extension||!file.size||file.size>4*1024*1024)return NextResponse.json({error:'Use a JPEG, PNG, WebP or GIF image under 4 MB.'},{status:400});

  // Only the product owner can publish a photo to the customer-facing gallery.
  const {data:product,error:productError}=await db.from('products').select('id').eq('id',productId).eq('owner_id',user.id).maybeSingle();
  if(productError||!product)return NextResponse.json({error:'Product not found or permission denied.'},{status:403});

  const basename=file.name.replace(/\.[^.]+$/,'').normalize('NFKD').replace(/[^a-zA-Z0-9 _-]/g,'').trim().replace(/\s+/g,'-').slice(0,65)||'showcase-photo';
  const path='products/'+productId+'/generated/'+basename+'-'+crypto.randomUUID().slice(0,12)+'.'+extension;
  const data=Buffer.from(await file.arrayBuffer()).toString('base64');
  const result=await fetch(githubUrl(path),{
   method:'PUT',headers:githubHeaders(token),cache:'no-store',
   body:JSON.stringify({message:'Add finished showcase image for product '+productId,content:data,branch})
  });
  if(!result.ok){
   const error=await result.json().catch(()=>null) as {message?:string}|null;
   const detail=error?.message?.slice(0,160)||'GitHub rejected the image';
   console.error('Showcase upload failed',result.status,detail);
   return NextResponse.json({error:'Could not upload showcase image ('+result.status+'): '+detail},{status:502});
  }
  return NextResponse.json({path:'github:'+path,url:'https://raw.githubusercontent.com/'+repository+'/'+branch+'/'+path});
 }catch(error){
  console.error('Showcase upload failed',error instanceof Error?error.message:'Unknown error');
  return NextResponse.json({error:'Could not upload the image. Please retry.'},{status:500});
 }
}
