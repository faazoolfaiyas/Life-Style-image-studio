'use client';

import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,ImagePlus,LoaderCircle,Plus,UploadCloud,X} from 'lucide-react';
import {uploadShowcaseImages,type ShowcaseUploadProgress} from './cloud';

type Preview={file:File;url:string};

export default function GeneratedUpload({productId,onUploaded}:{productId:string;onUploaded:()=>void}){
 const input=useRef<HTMLInputElement>(null);
 const [files,setFiles]=useState<File[]>([]);
 const [previews,setPreviews]=useState<Preview[]>([]);
 const [uploading,setUploading]=useState(false);
 const [progress,setProgress]=useState<ShowcaseUploadProgress|null>(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');

 useEffect(()=>{
  const next=files.map(file=>({file,url:URL.createObjectURL(file)}));
  setPreviews(next);
  return()=>next.forEach(item=>URL.revokeObjectURL(item.url));
 },[files]);

 const selectFiles=(incoming:File[])=>{
  setError('');setNotice('');
  const valid=incoming.filter(file=>['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(file.type));
  if(valid.length!==incoming.length)setError('Unsupported files were skipped. Choose JPEG, PNG, WebP, GIF or AVIF images.');
  setFiles(previous=>{
   const unique=[...previous];
   for(const file of valid){
    if(!unique.some(other=>other.name===file.name&&other.size===file.size&&other.lastModified===file.lastModified))unique.push(file);
   }
   if(unique.length>20){
    setError('You can upload up to 20 showcase photos at once.');
    return unique.slice(0,20);
   }
   return unique;
  });
 };
 const upload=async()=>{
  if(uploading||!files.length)return;
  setUploading(true);setProgress(null);setError('');setNotice('');
  try{
   const result=await uploadShowcaseImages(productId,files,setProgress);
   setFiles([]);
   setNotice(result.warning||result.uploaded+' showcase '+(result.uploaded===1?'photo has':'photos have')+' been added to the public product gallery.');
  }catch(e){
   const completed=e instanceof Error?((e as Error&{uploaded?:number}).uploaded??0):0;
   if(completed>0)setFiles(previous=>previous.slice(completed));
   setError(e instanceof Error?e.message:'The images could not be uploaded.');
  }finally{
   setUploading(false);setProgress(null);
   // Also refresh on partial success, so already uploaded files are visible.
   onUploaded();
  }
 };
 const percent=progress?.percent??0;
 const completed=progress?.stage==='syncing';
 return <div className="showcase-uploader">
  <div className="showcase-uploader-intro">
   <span className="showcase-uploader-emblem"><UploadCloud size={22} aria-hidden="true"/></span>
   <div>
    <h3>Upload finished photos</h3>
    <p>Already have ready-to-publish images? Add them here. They appear in the public store without changing your original reference photos.</p>
   </div>
  </div>
  <input ref={input} className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" aria-label="Choose completed product photos" disabled={uploading}
   onChange={e=>{selectFiles(Array.from(e.currentTarget.files||[]));e.currentTarget.value='';}}/>
  <button type="button" className="showcase-uploader-picker" disabled={uploading} onClick={()=>input.current?.click()}>
   <span><ImagePlus size={19}/> {files.length?'Add more photos':'Choose finished photos'}</span><Plus size={17}/>
  </button>
  {previews.length>0&&<div className="showcase-upload-previews">
   <div className="showcase-upload-preview-heading"><strong>{files.length} selected</strong><button type="button" disabled={uploading} onClick={()=>setFiles([])}>Clear all</button></div>
   <div className="showcase-upload-preview-grid">
    {previews.map((item,index)=><div className="showcase-upload-preview" key={item.url}>
     <img src={item.url} alt={'Selected photo '+(index+1)} />
     <button type="button" aria-label={'Remove '+item.file.name} disabled={uploading} onClick={()=>setFiles(previous=>previous.filter((_,i)=>i!==index))}><X size={15}/></button>
     <span title={item.file.name}>{item.file.name}</span>
    </div>)}
   </div>
  </div>}
  {uploading&&progress&&<div className="showcase-upload-status" role="status" aria-live="polite">
   <div className="showcase-upload-status-label">
    <LoaderCircle size={17} className="ai-description-spin"/>
    <span>{completed?'Updating product records':progress.stage==='preparing'?'Preparing '+progress.filename:'Uploading '+progress.filename}</span>
    <strong>{completed?'Finishing':(progress.index+1)+' / '+progress.total}</strong>
   </div>
   <div className="showcase-upload-progress-track"><span style={{width:percent+'%'}}/></div>
  </div>}
  <button type="button" className="showcase-uploader-submit" disabled={uploading||files.length===0} onClick={upload}>
   {uploading?<LoaderCircle size={18} className="ai-description-spin"/>:<UploadCloud size={18}/>}
   {uploading?'Uploading photos…':'Upload '+(files.length?files.length+' ':'')+'to public gallery'}
  </button>
  {notice&&<p className="showcase-upload-notice" role="status"><CheckCircle2 size={16}/>{notice}</p>}
  {error&&<p className="showcase-upload-error" role="alert">{error}</p>}
 </div>;
}
