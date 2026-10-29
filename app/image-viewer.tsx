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
function imageFilename(name:string,type:string){
 const extension=type==='image/png'?'png':type==='image/webp'?'webp':type==='image/gif'?'gif':type==='image/avif'?'avif':'jpg';
 const base=(name||'image').replace(/[^a-zA-Z0-9._-]/g,'_').replace(/\\.[^.]+$/,'');
 return (base||'image')+'.'+extension;
}
async function imageAsFile(url:string,name:string):Promise<File>{
 const response=await fetch(url,{cache:'no-store'});
 if(!response.ok)throw Error('Could not retrieve the image for sharing.');
 const blob=await response.blob();
 if(!blob.type.startsWith('image/'))throw Error('The image could not be loaded as a shareable file.');
 return new File([blob],imageFilename(name,blob.type),{type:blob.type});
}
export default function ImageViewer({images,index,onClose}:{images:ViewImage[];index:number;onClose:()=>void}){
 const [active,setActive]=useState(index);
 const [sharing,setSharing]=useState(false);
 const [shareError,setShareError]=useState('');
 const shareImage=async()=>{
  if(sharing)return;
  setSharing(true);
  setShareError('');
  try{
   const file=await imageAsFile(current.url,current.name);
   if(typeof navigator.share!=='function'||!navigator.canShare?.({files:[file]})){
    setShareError('This browser cannot share image files directly. Download the image and share it from your gallery.');
    return;
   }
   await navigator.share({files:[file]});
  }catch(error){
   if((error as Error).name!=='AbortError')setShareError(error instanceof Error?error.message:'Could not share this image.');
  }finally{setSharing(false)}
 };
 const closeRef=useRef<HTMLButtonElement>(null);
 const current=images[active];
 useEffect(()=>{closeRef.current?.focus()},[]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();if(event.key==='ArrowLeft')setActive(v=>(v+images.length-1)%images.length);if(event.key==='ArrowRight')setActive(v=>(v+1)%images.length)};
  window.addEventListener('keydown',key);const old=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=old};
 },[images.length,onClose]);
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
    <button type="button" disabled={sharing} onClick={shareImage}><Share2 size={19}/> {sharing?'Preparing image…':'Share image'}</button>
   </div>
   {shareError&&<p role="alert" className="image-share-error">{shareError}</p>}
  </section>
 </div>
}
