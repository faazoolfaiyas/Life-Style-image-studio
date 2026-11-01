import {createClient} from '@supabase/supabase-js';
import type {ReactNode} from 'react';
import Link from 'next/link';
import {ArrowRight, ArrowUpRight, CheckCircle2, MapPin, MessageCircle, Phone, ShoppingBag, Sparkles} from 'lucide-react';
import PublicImageGallery from '../../public-image-gallery';
import type {ViewImage} from '../../image-viewer';

export const dynamic='force-dynamic';

type Props={params:Promise<{id:string}>};
type GalleryFile={name:string;path:string;type:string};
const storeAddress='12, Main Street, Kattankudy 03';
const storePhone='0767051440';
const storePhoneOther='0768509808';
const imageRepo='lifestylekky/Life-Style-image-studio-store-';

// Render the WhatsApp formatting used by the studio while keeping description
// text safe: React escapes user-provided text rather than injecting HTML.
const inlineTokens=/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/[^\s<>()]+)/g;
function renderWhatsAppLine(line:string):ReactNode[]{
 const output:ReactNode[]=[];
 let last=0;
 for(const found of line.matchAll(inlineTokens)){
  const at=found.index??0;
  if(at>last)output.push(line.slice(last,at));
  const token=found[0];
  const key='piece-'+at;
  if(token.startsWith('http://')||token.startsWith('https://')){
   const url=token.replace(/[.,!?;:]+$/,'');
   output.push(<a key={key} href={url} target="_blank" rel="noopener noreferrer" className="lp-message-link">{url}<ArrowUpRight size={12} aria-hidden="true"/></a>);
   if(url.length<token.length)output.push(token.slice(url.length));
  }else if(token[0]==='*'){
   output.push(<strong key={key}>{token.slice(1,-1)}</strong>);
  }else if(token[0]==='_'){
   output.push(<em key={key}>{token.slice(1,-1)}</em>);
  }else if(token[0]==='~'){
   output.push(<s key={key}>{token.slice(1,-1)}</s>);
  }
  last=at+token.length;
 }
 if(last<line.length)output.push(line.slice(last));
 return output;
}
function WhatsAppMessage({message}:{message:string}){
 const lines=message.replace(/\r\n/g,'\n').split('\n');
 return <div className="lp-message-shell">
  <div className="lp-message-head"><span className="lp-message-avatar">LS</span><span><strong>Life Style</strong><small>Product information</small></span><MessageCircle size={19} aria-hidden="true"/></div>
  <div className="lp-message-area"><div className="lp-message-bubble">
   {lines.map((line,index)=><div key={index} className="lp-message-line">{line?renderWhatsAppLine(line):'\u00a0'}</div>)}
  </div></div>
 </div>;
}

export default async function SharedProduct({params}:Props){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){
  return <main className="lp-page lp-unavailable"><ShoppingBag size={34}/><h1>This product link is not valid</h1><p>Please ask the store for a fresh product link.</p></main>;
 }
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
 // Never load or render the original/reference photo records on public pages.
 const {data:product,error}=await db.from('products').select('id,name,description').eq('id',id).single();
 if(error||!product){
  return <main className="lp-page lp-unavailable"><ShoppingBag size={34}/><h1>Product unavailable</h1><p>This product may have been removed. Contact Life Style for assistance.</p><a href={'https://wa.me/94767051440'}>Contact the store <ArrowRight size={17}/></a></main>;
 }

 let files:GalleryFile[]=[];
 let photosUnavailable=false;
 try{
  const token=process.env.GITHUB_IMAGES_TOKEN;
  const endpoint='https://api.github.com/repos/'+imageRepo+'/contents/products/'+id+'/generated?ref=main';
  const response=await fetch(endpoint,{cache:'no-store',headers:{Accept:'application/vnd.github+json',...(token?{Authorization:'Bearer '+token}:{})}});
  if(response.ok){
   const data=await response.json() as GalleryFile[]|GalleryFile;
   if(Array.isArray(data))files=data.filter(file=>file.type==='file'&&/\.(jpe?g|png|webp|gif|avif)$/i.test(file.name));
  }else if(response.status!==404){photosUnavailable=true;}
 }catch{photosUnavailable=true;}

 const gallery:ViewImage[]=files.map((file,index)=>({
  url:'https://raw.githubusercontent.com/'+imageRepo+'/main/'+file.path.split('/').map(encodeURIComponent).join('/'),
  name:product.name+' — Photo '+(index+1)
 }));
 const enquiryText='Hello Life Style, I would like to enquire about '+product.name+'.\nProduct: https://life-style-image-studio-life-style4.vercel.app/share/'+id;
 const enquiryUrl='https://wa.me/94767051440?text='+encodeURIComponent(enquiryText);

 return <div className="lp-page">
  <div className="lp-announcement"><Sparkles size={13} aria-hidden="true"/> LIFE STYLE <span className="lp-announcement-dot">•</span> LADIESWEAR & ESSENTIALS</div>
  <header className="lp-header">
   <div className="lp-header-inner">
    <div className="lp-brand" aria-label="Life Style"><span className="lp-brand-icon">LS</span><span className="lp-brand-wordmark">Life Style<small>THE COLLECTION</small></span></div>
    <nav className="lp-top-links" aria-label="Page navigation"><Link href="/store">Shop all</Link><a href="#product-details">Details</a><a href="#store-contact">Contact</a></nav>
    <a className="lp-header-enquire" href={enquiryUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={17}/> <span>Ask about this item</span><ArrowUpRight size={15}/></a>
   </div>
  </header>
  <main className="lp-main">
   <div className="lp-breadcrumb"><span>Life Style</span><span className="lp-chevron">/</span><Link href="/store">Collection</Link><span className="lp-chevron">/</span><strong>{product.name}</strong></div>
   <div className="lp-product-layout">
    <section className="lp-gallery-column" aria-label="Product photography">
     {photosUnavailable?<div className="lp-gallery-empty"><ShoppingBag size={30}/><strong>Photos temporarily unavailable</strong><p>Please try again later or ask our team for product details.</p></div>:<PublicImageGallery images={gallery} productName={product.name}/>}
     <div className="lp-gallery-footnote"><CheckCircle2 size={17}/><span>Browse the product views, then message our team if you need more information.</span></div>
    </section>
    <div className="lp-info-column">
     <div className="lp-product-intro"><div className="lp-product-eyebrow"><span className="lp-eyebrow-line"/> THE LIFE STYLE COLLECTION</div><h1>{product.name}</h1><p>Explore this item and its details. Questions about sizing, colours or availability? We are happy to help.</p></div>
     <div className="lp-info-divider"/>
     <section id="product-details" className="lp-details-section">
      <div className="lp-section-heading"><span>01 / PRODUCT DETAILS</span><h2>Everything about this piece.</h2><p>Product information, as shared by our store.</p></div>
      {product.description?.trim()?<WhatsAppMessage message={product.description}/>:<div className="lp-no-description">For sizes, colours, pricing and more, message our store directly.</div>}
     </section>
     <section className="lp-enquiry" id="store-contact">
      <span className="lp-enquiry-kicker"><MessageCircle size={15}/> HERE TO HELP</span>
      <h2>Have a question?</h2>
      <p>Ask us about the product, available options or placing an order.</p>
      <a className="lp-whatsapp-button" href={enquiryUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={21}/> Enquire on WhatsApp <ArrowUpRight size={18}/></a>
      <a className="lp-call-link" href={'tel:+94'+storePhone.slice(1)}><Phone size={16}/> Prefer a call? {storePhone}</a>
     </section>
    </div>
   </div>
   <section className="lp-store-information" aria-label="Store information">
    <div className="lp-store-info-item"><div className="lp-store-info-icon"><ShoppingBag size={21}/></div><div><strong>Life Style</strong><p>Specialist in ladieswear and essentials.</p></div></div>
    <div className="lp-store-info-item"><div className="lp-store-info-icon"><MapPin size={21}/></div><div><strong>Visit our store</strong><p>{storeAddress}</p></div></div>
    <div className="lp-store-info-item"><div className="lp-store-info-icon"><Phone size={20}/></div><div><strong>Speak with us</strong><p><a href={'tel:+94'+storePhone.slice(1)}>{storePhone}</a> / <a href={'tel:+94'+storePhoneOther.slice(1)}>{storePhoneOther}</a></p></div></div>
   </section>
  </main>
  <a className="lp-mobile-enquire" href={enquiryUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> Ask about this item <ArrowUpRight size={17}/></a>
  <footer className="lp-footer"><div><span className="lp-footer-logo">LS</span><span><strong>Life Style</strong><small>Kattankudy, Sri Lanka</small></span></div><span>Thoughtful style, simply presented.</span><Link href="/store">Shop more <ArrowRight size={15}/></Link></footer>
 </div>;
}
