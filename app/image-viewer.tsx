'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Download,Share2,X,Copy,Check,CheckSquare,Square} from 'lucide-react';
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

// Build a standards-compliant ZIP (store method) without an extra dependency.
function zipFiles(files:File[]):Promise<Blob>{
 const encoder=new TextEncoder();
 const crc=(data:Uint8Array)=>{let value=0xffffffff;for(const byte of data){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0)}return (value^0xffffffff)>>>0};
 const short=(view:DataView,offset:number,value:number)=>view.setUint16(offset,value,true);
 const long=(view:DataView,offset:number,value:number)=>view.setUint32(offset,value>>>0,true);
 return Promise.all(files.map(async file=>({name:encoder.encode(file.name),bytes:new Uint8Array(await file.arrayBuffer())}))).then(entries=>{
  const chunks:Uint8Array[]=[];const central:Uint8Array[]=[];let offset=0;
  for(const entry of entries){
   const size=entry.bytes.byteLength;const checksum=crc(entry.bytes);
   const local=new Uint8Array(30+entry.name.length);const l=new DataView(local.buffer);
   long(l,0,0x04034b50);short(l,4,20);short(l,6,0x0800);short(l,8,0);long(l,14,checksum);long(l,18,size);long(l,22,size);short(l,26,entry.name.length);local.set(entry.name,30);
   chunks.push(local,entry.bytes);
   const directory=new Uint8Array(46+entry.name.length);const d=new DataView(directory.buffer);
   long(d,0,0x02014b50);short(d,4,20);short(d,6,20);short(d,8,0x0800);long(d,16,checksum);long(d,20,size);long(d,24,size);short(d,28,entry.name.length);long(d,42,offset);directory.set(entry.name,46);central.push(directory);
   offset+=local.length+size;
  }
  const directorySize=central.reduce((sum,part)=>sum+part.length,0);
  const end=new Uint8Array(22);const e=new DataView(end.buffer);
  long(e,0,0x06054b50);short(e,8,entries.length);short(e,10,entries.length);long(e,12,directorySize);long(e,16,offset);
  return new Blob([...chunks,...central,end].map(part=>Uint8Array.from(part).buffer),{type:'application/zip'});
 });
}
function saveBlob(blob:Blob,name:string){
 const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),3000);
}
export default function ImageViewer({images,index,onClose}:{images:ViewImage[];index:number;onClose:()=>void}){
 const [active,setActive]=useState(index);
 const [selectionMode,setSelectionMode]=useState(false);
 const [selected,setSelected]=useState<number[]>([]);
 const [working,setWorking]=useState(false);
 const [shareError,setShareError]=useState('');
 const [shareReady,setShareReady]=useState<{key:string;files:File[]}|null>(null);
 const [sharePreparing,setSharePreparing]=useState(false);
 const current=images[active];
 const chosenIndices=selectionMode?selected:[active];
 const toggle=(i:number)=>setSelected(previous=>previous.includes(i)?previous.filter(x=>x!==i):[...previous,i]);
 const prepareFiles=async()=>{
  const names=new Set<string>();
  const files:File[]=[];
  for(const i of chosenIndices){
   const image=images[i];const file=await imageAsFile(image.url,image.name);
   let name=file.name;let number=2;
   while(names.has(name)){name=file.name.replace(/(\\.[^.]+)?$/,match=>'_'+number++ +match)}
   names.add(name);files.push(name===file.name?file:new File([file],name,{type:file.type}));
  }
  return files;
 };
 const selectionKey=chosenIndices.map(i=>images[i]?.url+'#'+i).join('|');
 // Fetch image blobs before the user taps Share. navigator.share must run
 // synchronously inside the click handler to retain transient user activation.
 useEffect(()=>{
  let cancelled=false;
  setShareReady(null);
  setShareError('');
  if(!chosenIndices.length){setSharePreparing(false);return}
  setSharePreparing(true);
  const names=new Set<string>();
  Promise.all(chosenIndices.map(async i=>{
   const image=images[i];
   return imageAsFile(image.url,image.name);
  })).then(files=>{
   if(cancelled)return;
   const unique=files.map(file=>{
    let name=file.name;let n=2;
    while(names.has(name)){name=file.name.replace(/(\.[^.]+)?$/,(_,ext:string)=>'_'+n+++(ext||''))}
    names.add(name);
    return name===file.name?file:new File([file],name,{type:file.type});
   });
   setShareReady({key:selectionKey,files:unique});
  }).catch(error=>{
   if(!cancelled)setShareError(error instanceof Error?error.message:'Could not prepare images for sharing.');
  }).finally(()=>{if(!cancelled)setSharePreparing(false)});
  return()=>{cancelled=true};
 // Selection key captures the current selected images and avoids refetching on unrelated renders.
 },[selectionKey]);
 const runDownload=async()=>{
  if(working||!chosenIndices.length)return;
  setWorking(true);setShareError('');
  try{
   const files=shareReady?.key===selectionKey?shareReady.files:await prepareFiles();
   if(files.length===1)saveBlob(files[0],files[0].name);
   else saveBlob(await zipFiles(files),'LifeStyle-images.zip');
  }catch(error){setShareError(error instanceof Error?error.message:'Could not download images.')}
  finally{setWorking(false)}
 };
 const runShare=()=>{
  if(working||sharePreparing||shareReady?.key!==selectionKey||!shareReady.files.length)return;
  setShareError('');
  const files=shareReady.files;
  if(typeof navigator.share!=='function'||!navigator.canShare?.({files})){
   setShareError('This browser cannot share the selected image files directly. Download them instead and share from your gallery.');
   return;
  }
  // Do not await fetch, state updates or any other promise before this call.
  try{
   const sharePromise=navigator.share({files});
   setWorking(true);
   sharePromise.catch(error=>{
    if((error as Error).name!=='AbortError')setShareError(error instanceof Error?error.message:'Could not share the selected images.');
   }).finally(()=>setWorking(false));
  }catch(error){setShareError(error instanceof Error?error.message:'Could not share the selected images.')}
 };
 const closeRef=useRef<HTMLButtonElement>(null);
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
   <div className="image-selection-toolbar">
    <button type="button" disabled={working} onClick={()=>{setSelectionMode(v=>!v);setSelected([])}}>{selectionMode?'Cancel selection':'Select multiple'}</button>
    {selectionMode&&<><span>{selected.length} selected</span><button type="button" onClick={()=>setSelected(images.map((_,i)=>i))}>Select all</button><button type="button" onClick={()=>setSelected([])}>Clear</button></>}
   </div>
   {selectionMode&&<div className="image-selection-strip" aria-label="Select images to download or share">
    {images.map((image,i)=><button type="button" key={image.url+i} aria-label={'Select '+image.name} aria-pressed={selected.includes(i)} className={selected.includes(i)?'is-selected':''} onClick={()=>toggle(i)}>
     <img src={image.url} alt={image.name}/>{selected.includes(i)?<CheckSquare size={20}/>:<Square size={20}/>}
    </button>)}
   </div>}
   <div className="image-fullscreen-actions">
    <button type="button" disabled={working||chosenIndices.length===0} onClick={runDownload}><Download size={19}/> {working?'Preparing…':selectionMode?'Download selected':'Download'}</button>
    <button type="button" disabled={working||sharePreparing||shareReady?.key!==selectionKey||chosenIndices.length===0} onClick={runShare}><Share2 size={19}/> {sharePreparing?'Loading images…':working?'Sharing…':selectionMode?'Share selected':'Share image'}</button>
   </div>
   {shareError&&<p role="alert" className="image-share-error">{shareError}</p>}
  </section>
 </div>
}
