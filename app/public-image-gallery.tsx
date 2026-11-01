'use client';

import {useState} from 'react';
import {ArrowUpRight, Check, ChevronLeft, ChevronRight, Expand, Images, Share2} from 'lucide-react';
import ImageViewer,{type ViewImage} from './image-viewer';

type Props={images:ViewImage[];productName:string};

export default function PublicImageGallery({images,productName}:Props){
 const [active,setActive]=useState(0);
 const [viewerOpen,setViewerOpen]=useState(false);
 const [copied,setCopied]=useState(false);
 const [shareMessage,setShareMessage]=useState('');
 const current=images[active];
 const move=(delta:number)=>setActive(previous=>(previous+delta+images.length)%images.length);
 const shareProduct=()=>{
  const url=window.location.href;
  setShareMessage('');
  if(typeof navigator.share==='function'){
   // Call directly in the click handler while user activation is present.
   navigator.share({title:productName,url}).catch(async error=>{
    if((error as Error).name==='AbortError')return;
    try{await navigator.clipboard.writeText(url);setCopied(true)}catch{setShareMessage('Copy the page address from your browser to share it.')}
   });
   return;
  }
  navigator.clipboard.writeText(url).then(()=>setCopied(true)).catch(()=>setShareMessage('Copy the page address from your browser to share it.'));
 };
 if(!current)return <div className="lp-gallery-empty"><Images size={29}/><strong>Product photos coming soon</strong><p>Check back shortly for photos of this item, or contact us for details.</p></div>;
 return <div className="lp-gallery" aria-label="Product photo gallery">
  <div className="lp-hero-frame">
   <button type="button" className="lp-hero-zoom" onClick={()=>setViewerOpen(true)} aria-label={'Open '+productName+' image full screen'}>
    <img src={current.url} alt={current.name} fetchPriority="high" decoding="async"/>
    <span className="lp-hero-zoom-hint"><Expand size={16}/> Tap to view larger</span>
   </button>
   <span className="lp-gallery-count">{String(active+1).padStart(2,'0')} / {String(images.length).padStart(2,'0')}</span>
   {images.length>1&&<>
    <button type="button" className="lp-gallery-arrow lp-gallery-prev" onClick={()=>move(-1)} aria-label="Previous product photo"><ChevronLeft size={22}/></button>
    <button type="button" className="lp-gallery-arrow lp-gallery-next" onClick={()=>move(1)} aria-label="Next product photo"><ChevronRight size={22}/></button>
   </>}
  </div>
  <div className="lp-gallery-bottom">
   <div className="lp-gallery-thumbs" aria-label="Choose a product photo">
    {images.map((image,index)=><button type="button" key={image.url+index} aria-label={'Show photo '+(index+1)} aria-pressed={active===index} className={'lp-thumb '+(active===index?'lp-thumb-active':'')} onClick={()=>setActive(index)}>
     <img src={image.url} alt="" loading="lazy" decoding="async"/>
    </button>)}
   </div>
  </div>
  <div className="lp-gallery-meta"><span><Images size={16}/>{images.length} {images.length===1?'photo':'photos'} to explore</span><button type="button" onClick={shareProduct}><Share2 size={16}/>{copied?'Link copied':'Share product'} {copied?<Check size={14}/>:<ArrowUpRight size={14}/>}</button></div>
  {shareMessage&&<p role="status" className="lp-share-message">{shareMessage}</p>}
  {viewerOpen&&<ImageViewer images={images} index={active} onClose={()=>setViewerOpen(false)}/>}
 </div>;
}
