'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Download,Share2,X,Copy,Check} from 'lucide-react';
export type ViewImage={url:string;name:string};
export async function shareLink(url:string,title:string){
 if(typeof navigator.share==='function'){
  try{await navigator.share({title,url});return}catch(error){if((error as Error).name==='AbortError')return}
 }
 try{await navigator.clipboard.writeText(url);return}catch{window.prompt('Copy link',url)}
}
export async function downloadImage(url:string,name:string){
 try{
  const response=await fetch(url);
  if(!response.ok)throw Error('Download failed');
  const blob=await response.blob();
  const objectUrl=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=objectUrl;link.download=name||'image';document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(objectUrl),1500);
 }catch{
  const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.download=name||'image';document.body.appendChild(link);link.click();link.remove();
 }
}
export function SharePopup({url,title,onClose}:{url:string;title:string;onClose:()=>void}){
 const [copied,setCopied]=useState(false);
 const copy=async()=>{try{await navigator.clipboard.writeText(url);setCopied(true)}catch{window.prompt('Copy link',url)}};
 return <div className="image-modal-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section role="dialog" aria-modal="true" aria-label="Share link" className="share-popup">
   <div className="image-modal-top"><h2>Share {title}</h2><button type="button" aria-label="Close share dialog" onClick={onClose}><X size={21}/></button></div>
   <p>Share this link or copy it to your clipboard.</p>
   <input readOnly aria-label="Share URL" value={url} onFocus={e=>e.target.select()}/>
   <div className="share-popup-actions"><button type="button" onClick={copy}>{copied?<Check size={18}/>:<Copy size={18}/>} {copied?'Copied':'Copy link'}</button><button type="button" onClick={()=>shareLink(url,title)}><Share2 size={18}/> Share</button></div>
  </section>
 </div>
}
export default function ImageViewer({images,index,onClose}:{images:ViewImage[];index:number;onClose:()=>void}){
 const [active,setActive]=useState(index);
 const [shareOpen,setShareOpen]=useState(false);
 const closeRef=useRef<HTMLButtonElement>(null);
 const current=images[active];
 useEffect(()=>{closeRef.current?.focus()},[]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{if(shareOpen)return;if(event.key==='Escape')onClose();if(event.key==='ArrowLeft')setActive(v=>(v+images.length-1)%images.length);if(event.key==='ArrowRight')setActive(v=>(v+1)%images.length)};
  window.addEventListener('keydown',key);const old=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=old};
 },[images.length,onClose,shareOpen]);
 if(!current)return null;
 return <div className="image-modal-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section role="dialog" aria-modal="true" aria-label="Full image viewer" className="image-fullscreen">
   <div className="image-modal-top"><span title={current.name}>{current.name} <small>{active+1} / {images.length}</small></span><button ref={closeRef} type="button" aria-label="Close image viewer" onClick={onClose}><X size={22}/></button></div>
   <div className="image-fullscreen-stage">
    {images.length>1&&<button type="button" className="image-fullscreen-prev" aria-label="Previous image" onClick={()=>setActive(v=>(v+images.length-1)%images.length)}><ChevronLeft size={24}/></button>}
    <img src={current.url} alt={current.name}/>
    {images.length>1&&<button type="button" className="image-fullscreen-next" aria-label="Next image" onClick={()=>setActive(v=>(v+1)%images.length)}><ChevronRight size={24}/></button>}
   </div>
   <div className="image-fullscreen-actions">
    <button type="button" onClick={()=>downloadImage(current.url,current.name)}><Download size={19}/> Download</button>
    <button type="button" onClick={()=>setShareOpen(true)}><Share2 size={19}/> Share</button>
   </div>
  </section>
  {shareOpen&&<SharePopup title="image" url={current.url} onClose={()=>setShareOpen(false)}/>}
 </div>
}
