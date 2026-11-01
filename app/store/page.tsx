import {createClient} from '@supabase/supabase-js';
import type {Metadata} from 'next';
import PublicStore, {type PublicStoreItem} from './public-store';

export const metadata:Metadata={
 title:'Life Style | Shop the Collection',
 description:'Discover the Life Style collection in Kattankudy, Sri Lanka. Explore product photos and enquire directly on WhatsApp.'
};
export const revalidate=120;

type TreeItem={path:string;type:string};
type GitHubTree={tree:TreeItem[];truncated?:boolean};

export default async function StorePage(){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
 const {data:products,error}=await db.from('products').select('id,name,description,created_at').order('created_at',{ascending:false}).limit(1000);
 if(error){
  return <PublicStore products={[]} error="The collection is temporarily unavailable. Please try again shortly."/>;
 }
 const imageMap=new Map<string,string[]>();
 try{
  const token=process.env.GITHUB_IMAGES_TOKEN;
  const response=await fetch('https://api.github.com/repos/lifestylekky/Life-Style-image-studio-store-/git/trees/main?recursive=1',{
   headers:{Accept:'application/vnd.github+json',...(token?{Authorization:'Bearer '+token}:{})},
   next:{revalidate:120}
  });
  if(response.ok){
   const tree=await response.json() as GitHubTree;
   for(const item of tree.tree||[]){
    if(item.type!=='blob')continue;
    const match=item.path.match(/^products\/([0-9a-f-]{36})\/generated\/[^/]+\.(jpe?g|png|webp|gif|avif)$/i);
    if(!match)continue;
    const url='https://raw.githubusercontent.com/lifestylekky/Life-Style-image-studio-store-/main/'+item.path.split('/').map(encodeURIComponent).join('/');
    imageMap.set(match[1],[...(imageMap.get(match[1])||[]),url]);
   }
  }
 }catch{
  // Show products without photos rather than leaking reference image paths.
 }
 const catalog:PublicStoreItem[]=(products||[]).map(item=>({
  id:item.id,name:item.name,description:item.description||'',
  createdAt:item.created_at,
  photos:imageMap.get(item.id)||[]
 }));
 return <PublicStore products={catalog}/>;
}
