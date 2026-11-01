'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,ArrowUpRight,ChevronDown,Instagram,MapPin,MessageCircle,Search,ShoppingBag,SlidersHorizontal,Sparkles,X} from 'lucide-react';

export type PublicStoreItem={id:string;name:string;description:string;createdAt:string;photos:string[]};
type Category='all'|'ladies'|'intimates'|'other';
function categoryOf(product:PublicStoreItem):Exclude<Category,'all'>{
 const words=(product.name+' '+product.description).toLowerCase();
 if(/undergarments|underwear|brassiere|\bbra\b|panty|lingerie|shapewear|skinny|camisole/.test(words))return 'intimates';
 if(/ladies wear|ladieswear|frock|dress|blouse|shirt|top|skirt|trouser|kurti|tunic/.test(words))return 'ladies';
 return 'other';
}
const filters:{id:Category;label:string}[]=[
 {id:'all',label:'All products'},{id:'ladies',label:'Ladies wear'},{id:'intimates',label:'Undergarments'},{id:'other',label:'Other'}
];
export default function PublicStore({products,error}:{products:PublicStoreItem[];error?:string}){
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState<Category>('all');
 const [sort,setSort]=useState('newest');
 const [showAll,setShowAll]=useState(false);
 const visible=useMemo(()=>{
  const q=query.toLocaleLowerCase().trim();
  const list=products.filter(p=>(category==='all'||categoryOf(p)===category)&&(!q||(p.name+' '+p.description).toLocaleLowerCase().includes(q)));
  return [...list].sort((a,b)=>sort==='az'?a.name.localeCompare(b.name):sort==='za'?b.name.localeCompare(a.name):new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
 },[products,query,category,sort]);
 const displayed=showAll?visible:visible.slice(0,24);
 return <div className="lp-page lp-store-page">
  <div className="lp-announcement"><Sparkles size={13}/> LIFE STYLE <span className="lp-announcement-dot">•</span> LADIESWEAR & ESSENTIALS</div>
  <header className="lp-header"><div className="lp-header-inner">
   <Link href="/store" className="lp-brand"><span className="lp-brand-icon">LS</span><span className="lp-brand-wordmark">Life Style<small>THE COLLECTION</small></span></Link>
   <a className="lp-header-enquire" href="https://wa.me/94767051440" target="_blank" rel="noopener noreferrer"><MessageCircle size={17}/> <span>Contact us</span><ArrowUpRight size={15}/></a>
  </div></header>
  <main className="lp-store-main">
   <section className="lp-store-heading">
    <div className="lp-product-eyebrow"><span className="lp-eyebrow-line"/> YOUR STYLE, YOUR WAY</div>
    <h1>The Collection<span>.</span></h1>
    <p>Discover something lovely.</p>
   </section>
   <section className="lp-store-controls" aria-label="Browse and filter products">
    <label className="lp-store-search"><Search size={20}/><input value={query} onChange={e=>{setQuery(e.target.value);setShowAll(false)}} placeholder="Search products..." aria-label="Search products"/>{query&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear search"><X size={17}/></button>}</label>
    <div className="lp-store-filters">
     <div className="lp-store-chips" role="group" aria-label="Product categories">{filters.map(f=><button type="button" key={f.id} aria-pressed={category===f.id} className={category===f.id?'is-active':''} onClick={()=>{setCategory(f.id);setShowAll(false)}}>{f.label}</button>)}</div>
     <label className="lp-store-sort"><SlidersHorizontal size={16}/><select value={sort} onChange={e=>{setSort(e.target.value);setShowAll(false)}} aria-label="Sort products"><option value="newest">Newest first</option><option value="az">Name A–Z</option><option value="za">Name Z–A</option></select><ChevronDown size={14}/></label>
    </div>
   </section>
   <div className="lp-store-result-count"><strong>{visible.length}</strong> {visible.length===1?'product':'products'} <span>in the collection</span></div>
   {error?<div className="lp-store-empty"><ShoppingBag size={29}/><h2>We could not load the collection</h2><p>{error}</p></div>:displayed.length?
    <div className="lp-store-grid">{displayed.map(product=><Link href={'/share/'+product.id} className="lp-store-card" key={product.id}>
     <div className="lp-store-card-photo">{product.photos[0]?<img src={product.photos[0]} alt={product.name} loading="lazy" decoding="async"/>:<div className="lp-store-card-fallback"><ShoppingBag size={29}/><span>Photo coming soon</span></div>}<span className="lp-store-card-go"><ArrowUpRight size={17}/></span></div>
     <div className="lp-store-card-info"><h2>{product.name}</h2><span>View product <ArrowRight size={15}/></span></div>
    </Link>)}</div>:
    <div className="lp-store-empty"><Search size={29}/><h2>No matches found</h2><p>Try a different search or choose another category.</p><button type="button" onClick={()=>{setQuery('');setCategory('all')}}>View all products</button></div>}
   {!showAll&&visible.length>24&&<div className="lp-store-more"><button type="button" onClick={()=>setShowAll(true)}>Show more products <ArrowRight size={17}/></button></div>}
   <div className="lp-store-contact"><div><MapPin size={20}/><span>12, Main Street, Kattankudy 03</span></div><a href="https://wa.me/94767051440" target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/> Ask on WhatsApp <ArrowUpRight size={15}/></a></div>
  </main>
  <footer className="lp-footer"><div><span className="lp-footer-logo">LS</span><span><strong>Life Style</strong><small>Kattankudy, Sri Lanka</small></span></div><span>Specialist in ladieswear and essentials.</span><a href="tel:+94767051440">0767051440 <ArrowRight size={15}/></a></footer>
 </div>;
}
