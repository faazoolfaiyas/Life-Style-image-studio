'use client';
import {useState} from 'react';
import {ExternalLink} from 'lucide-react';
import ImageViewer,{type ViewImage} from './image-viewer';
export default function PublicImageGallery({images}:{images:ViewImage[]}){
 const [selected,setSelected]=useState<number|null>(null);
 return <>
  <div className="share-image-grid">
   {images.map((image,index)=><button type="button" key={image.url+index} className="share-image-card" onClick={()=>setSelected(index)} aria-label={'View '+image.name+' full screen'}>
    <div className="share-image-frame"><img src={image.url} alt={image.name} loading="lazy" decoding="async"/></div>
    <div className="share-image-caption"><span className="share-image-filename" title={image.name}>{image.name}</span><span className="share-open-original">View full image <ExternalLink size={15} aria-hidden="true"/></span></div>
   </button>)}
  </div>
  {selected!==null&&<ImageViewer images={images} index={selected} onClose={()=>setSelected(null)}/>}
 </>;
}
