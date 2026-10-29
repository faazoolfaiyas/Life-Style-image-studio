import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{id:string}> };
type SharedImage = {id:string;kind:string;storage_path:string;filename:string|null;sort_order:number};

export default async function SharedProduct({params}:Props) {
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))return <main className="studio-bg share-status"><p>Invalid product link.</p></main>;

  const db=createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {auth:{persistSession:false}}
  );
  const {data:p,error}=await db.from('products')
    .select('id,name,description,created_at,product_images(id,kind,storage_path,filename,sort_order)')
    .eq('id',id).single();

  if(error||!p)return <main className="studio-bg share-status"><h1>Product not found</h1><Link href="/">Open studio</Link></main>;

  const photos:SharedImage[]=[...(p.product_images??[])].sort((a,b)=>a.sort_order-b.sort_order);
  const url=(path:string)=>path.startsWith('github:')
    ?'https://raw.githubusercontent.com/lifestylekky/Life-Style-image-studio-store-/main/'+path.slice(7)
    :db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  const groups=[
    {kind:'main',title:'Main product images'},
    {kind:'color',title:'Color set images'},
    {kind:'other',title:'Additional images'}
  ];

  return <main className="studio-bg share-screen">
    <div className="share-container">
      <header className="share-appbar">
        <div className="share-brand"><span className="brand-mark" aria-hidden="true"><Sparkles size={20}/></span><span>LifeStyle Image Studio</span></div>
        <Link href="/" className="share-studio-link"><ArrowLeft size={18} aria-hidden="true"/>Studio</Link>
      </header>

      <div className="share-intro">
        <p className="eyebrow">SHARED PRODUCT REFERENCE</p>
        <h1 className="share-title gradient-text">{p.name}</h1>
        <p className="share-summary">{photos.length} original reference images · Main photos and color variants</p>
      </div>

      <div className="share-body">
        {groups.map(group=>{
          const items=photos.filter(photo=>photo.kind===group.kind);
          if(!items.length)return null;
          return <section key={group.kind} className="share-group" aria-label={group.title}>
            <h2 className="share-group-title">{group.title}</h2>
            <div className="share-image-grid">
              {items.map((img,index)=><a key={img.id} href={url(img.storage_path)} target="_blank" rel="noopener noreferrer" className="share-image-card" aria-label={`${img.filename||p.name}, Open original`}>
                <div className="share-image-frame"><img src={url(img.storage_path)} alt={img.filename||p.name} width={540} height={540} loading={index===0&&group.kind==='main'?'eager':'lazy'} decoding="async"/></div>
                <div className="share-image-caption"><span className="share-image-filename" title={img.filename||p.name}>{img.filename||p.name}</span><span className="share-open-original">Open original <ArrowUpRight size={16} aria-hidden="true"/></span></div>
              </a>)}
            </div>
          </section>
        })}
        <section className="share-description" aria-label="Product description">
          <h2>Product description</h2>
          <p>{p.description||'No description provided.'}</p>
        </section>
      </div>
      <footer className="share-footer">Public product reference. Images are original uploaded references, not AI-generated output.</footer>
    </div>
  </main>;
}
