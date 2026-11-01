'use client';

import { useEffect, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, ExternalLink, LoaderCircle, RefreshCw, Trash2, Pencil, Share2, Check, X, Save, WandSparkles, UploadCloud, ImagePlus, FolderSync, Eye, Plus } from 'lucide-react';
import { supabase } from './cloud';
import ImageViewer, {SharePopup, type ViewImage} from './image-viewer';
import GeneratedUpload from './generated-upload';
import { generatedImages, type GeneratedImage, type DeleteProgress, type Photo, type Product, type AddImagesProgress } from './cloud';

type Filter = 'all' | 'main' | 'color' | 'other';
type Props = {
  product: Product;
  images: Photo[];
  current?: Photo;
  activeFilter: Filter;
  activeSlide: number;
  copied: boolean;
  onBack: () => void;
  onCopy: () => void;
  onSaveDescription: (description:string) => Promise<void>;
  onAddImages:(files:File[],kind:'main'|'color'|'other',onProgress:(p:AddImagesProgress)=>void)=>Promise<{warning:string}>;
  onSyncFiles:()=>Promise<void>;
  onDelete: (onProgress: (progress: DeleteProgress) => void) => Promise<void>;
  onFilter: (filter: Filter) => void;
  onSlide: (index: number) => void;
};

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'main', label: 'Main' },
  { id: 'color', label: 'Colors' },
  { id: 'other', label: 'More' },
];

export default function ProductDetails({
  product,
  images,
  current,
  activeFilter,
  activeSlide,
  copied,
  onBack,
  onCopy,
  onSaveDescription,
  onAddImages,
  onSyncFiles,
  onDelete,
  onFilter,
  onSlide,
}: Props) {
  const [editingDescription,setEditingDescription]=useState(false);
  const [descriptionDraft,setDescriptionDraft]=useState(product.description);
  const [descriptionSaving,setDescriptionSaving]=useState(false);
  const [descriptionGenerating,setDescriptionGenerating]=useState(false);
  const [descriptionError,setDescriptionError]=useState('');
  const [descriptionCopied,setDescriptionCopied]=useState(false);
  const [descriptionNotice,setDescriptionNotice]=useState('');
  useEffect(()=>{setDescriptionDraft(product.description);setEditingDescription(false);setDescriptionError('');setDescriptionNotice('')},[product.id,product.description]);
  const generateDescription=async()=>{
    if(descriptionGenerating||descriptionSaving)return;
    setDescriptionGenerating(true);setDescriptionError('');setDescriptionNotice('');
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)throw Error('Please sign in again.');
      const response=await fetch('/api/description',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({name:product.name,notes:descriptionDraft})});
      const result=await response.json() as {description?:string;error?:string};
      if(!response.ok||!result.description)throw Error(result.error||'Could not generate description.');
      setDescriptionDraft(result.description);
      setDescriptionNotice('AI description generated. Review it and tap Save changes to update this product.');
    }catch(e){setDescriptionError(e instanceof Error?e.message:'Description generation failed.')}
    finally{setDescriptionGenerating(false)}
  };
  const saveDescription=async()=>{setDescriptionSaving(true);setDescriptionError('');try{await onSaveDescription(descriptionDraft);setEditingDescription(false);setDescriptionNotice('Description saved successfully.')}catch(e){setDescriptionError(e instanceof Error?e.message:'Could not save description.')}finally{setDescriptionSaving(false)}};
  const copyDescription=async()=>{try{await navigator.clipboard.writeText(product.description);setDescriptionCopied(true);setDescriptionNotice('Description copied to clipboard.');window.setTimeout(()=>setDescriptionCopied(false),2000)}catch{setDescriptionError('Copy unavailable. Select and copy the description manually.')}};
  const shareDescription=async()=>{setDescriptionError('');if(!navigator.share){try{await navigator.clipboard.writeText(product.description);setDescriptionNotice('Sharing is unavailable on this device. Description copied instead.')}catch{setDescriptionError('Sharing is not supported in this browser.')}}else{try{await navigator.share({text:product.description})}catch(e){if(e instanceof Error&&e.name!=='AbortError')setDescriptionError('Could not share description. Please try copying it instead.')}}};
  const [newImageKind,setNewImageKind]=useState<'main'|'color'|'other'>('main');
  const [pendingFiles,setPendingFiles]=useState<File[]>([]);
  const [uploadingImages,setUploadingImages]=useState(false);
  const [imageProgress,setImageProgress]=useState<AddImagesProgress|null>(null);
  const [imageUploadError,setImageUploadError]=useState('');
  const [imageUploadNotice,setImageUploadNotice]=useState('');
  const [syncingFiles,setSyncingFiles]=useState(false);
  const uploadInput=useRef<HTMLInputElement>(null);
  const addImages=async()=>{
   if(!pendingFiles.length||uploadingImages)return;
   setImageUploadError('');setImageUploadNotice('');setUploadingImages(true);
   try{
    const result=await onAddImages(pendingFiles,newImageKind,setImageProgress);
    setImageUploadNotice(result.warning||pendingFiles.length+' image(s) added. updates.txt is current.');
    setPendingFiles([]);
    if(uploadInput.current)uploadInput.current.value='';
   }catch(error){setImageUploadError(error instanceof Error?error.message:'Could not upload images.')}
   finally{setUploadingImages(false);setImageProgress(null)}
  };
  const syncFiles=async()=>{
   if(syncingFiles)return;
   setSyncingFiles(true);setImageUploadError('');setImageUploadNotice('');
   try{await onSyncFiles();setImageUploadNotice('Repository files are up to date.')}
   catch(error){setImageUploadError(error instanceof Error?error.message:'Could not sync repository files.')}
   finally{setSyncingFiles(false)}
  };
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<DeleteProgress | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [shareTarget,setShareTarget] = useState<{url:string;title:string}|null>(null);
  const [viewerIndex,setViewerIndex] = useState<number|null>(null);
  const [generated, setGenerated] = useState<GeneratedImage[]>([]);
  const [generatedLoading, setGeneratedLoading] = useState(true);
  const [generatedError, setGeneratedError] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  useEffect(() => {
    let active = true;
    generatedImages(product.id).then(items => { if(active){setGenerated(items);setGeneratedError('');} }).catch(error => { if(active)setGeneratedError(error instanceof Error ? error.message : 'Could not load generated images'); }).finally(() => { if(active)setGeneratedLoading(false); });
    return () => { active = false; };
  }, [product.id, refreshCount]);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const count = images.length;
  const githubImage = product.photos.find(photo => photo.path?.startsWith('github:products/'));
  const githubFolder = githubImage?.path?.slice('github:'.length).split('/').slice(0, 2).join('/');
  const folderUrl = githubFolder ? `https://github.com/lifestylekky/Life-Style-image-studio-store-/tree/main/${githubFolder.split('/').map(encodeURIComponent).join('/')}` : null;
  const allImages:ViewImage[]=[...product.photos.map(photo=>({url:photo.data,name:photo.label||product.name})),...generated.map(image=>({url:image.url,name:image.name}))];
  const openImage=(url:string)=>{const index=allImages.findIndex(image=>image.url===url);if(index>=0)setViewerIndex(index)};

  const move = (direction: number) => {
    if (count > 1) onSlide((activeSlide + direction + count) % count);
  };

  const startSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const endSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const first = touchStart.current;
    touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!first || !touch || count < 2) return;
    const dx = touch.clientX - first.x;
    const dy = touch.clientY - first.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      move(dx < 0 ? 1 : -1);
    }
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleteError('');
    setDeleteProgress({phase:'loading',completed:0,total:0,label:'Finding product images'});
    setDeleting(true);
    try {
      await onDelete(setDeleteProgress);
      dialogRef.current?.close();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete product');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="details-screen" aria-labelledby="details-title">
      <div className="details-toolbar">
        <button type="button" className="details-back" onClick={onBack}>
          <ArrowLeft size={19} aria-hidden="true" />
          Products
        </button>
        <div className="details-actions">
          <button type="button" onClick={onCopy} className="details-copy">
            <Copy size={18} aria-hidden="true" />
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <a href={'/share/'+product.id} target="_blank" rel="noopener noreferrer" className="details-copy details-public-link"><Eye size={17} aria-hidden="true"/> Public page <ExternalLink size={14}/></a>
          {folderUrl && (
            <button type="button" onClick={() => setShareTarget({url:folderUrl!,title:'product folder'})} className="details-copy" aria-label="Copy product GitHub folder URL">
              <Copy size={18} aria-hidden="true" />
              Copy folder
            </button>
          )}
          <span className="details-action-separator" aria-hidden="true" />
          <button
            ref={deleteButton}
            type="button"
            className="details-delete"
            aria-label="Delete product"
            title="Delete product"
            onClick={() => { setDeleteError(''); setDeleteProgress(null); dialogRef.current?.showModal(); }}
          >
            <Trash2 size={19} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="details-layout">
        <div className="details-summary">
          <p className="eyebrow">PRODUCT WORKSPACE · EDIT & MANAGE</p>
          <h1 id="details-title" className="details-title">{product.name}</h1>
          <div className="details-stats"><span><ImagePlus size={15}/>{product.photos.length} reference photos</span><span><Eye size={15}/>{generated.length} public photos</span><span><FolderSync size={15}/> GitHub synced files</span></div>
          <div className="details-filters" role="group" aria-label="Product image filters">
            {filters.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={activeFilter === id}
                className={`details-filter ${activeFilter === id ? 'is-active' : ''}`}
                onClick={() => onFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="details-gallery">
          <div
            className="details-viewer"
            tabIndex={count > 1 ? 0 : undefined}
            aria-label="Product image viewer"
            onTouchStart={startSwipe}
            onTouchEnd={endSwipe}
            onTouchCancel={() => { touchStart.current = null; }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                move(event.key === 'ArrowRight' ? 1 : -1);
              }
            }}
          >
            {current ? (
              <img
                onClick={() => openImage(current.data)}
                role="button"
                tabIndex={0}
                onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openImage(current.data)}}}
                title="View full image"
                key={current.id}
                className="details-current-image"
                src={current.data}
                alt={current.label || product.name}
                loading="eager"
                decoding="async"
              />
            ) : (
              <span className="details-no-images">No images</span>
            )}
            {count > 1 && (
              <>
                <button type="button" aria-label="Previous" className="details-arrow details-arrow-prev" onClick={() => move(-1)}>
                  <ChevronLeft size={24} aria-hidden="true" />
                </button>
                <button type="button" aria-label="Next" className="details-arrow details-arrow-next" onClick={() => move(1)}>
                  <ChevronRight size={24} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          {count > 0 && (
            <div className="details-thumbnails" aria-label="Product image thumbnails">
              {images.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  aria-label={photo.label || `Image ${index + 1}`}
                  aria-pressed={index === activeSlide}
                  className={`details-thumb ${index === activeSlide ? 'is-active' : ''}`}
                  onClick={() => onSlide(index)}
                >
                  <img src={photo.data} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
        </div>

        <section className="generated-gallery" aria-labelledby="generated-gallery-title">
          <div className="generated-gallery-header">
            <div>
              <p className="eyebrow">CUSTOMER-FACING IMAGES</p>
              <h2 id="generated-gallery-title">Public showcase <span className="generated-count">{generated.length}</span></h2>
            </div>
            <button type="button" className="details-copy" disabled={generatedLoading} onClick={() => {setGeneratedLoading(true);setRefreshCount(x=>x+1);}} aria-label="Refresh generated images">
              <RefreshCw size={17} aria-hidden="true" /> Refresh
            </button>
          </div>
          <GeneratedUpload key={product.id} productId={product.id} onUploaded={()=>{setGeneratedLoading(true);setRefreshCount(x=>x+1);}}/>
          {generatedLoading ? <p className="generated-empty" role="status">Checking finished photos…</p> :
            generatedError ? <p className="generated-error" role="alert">{generatedError}</p> :
            generated.length ? <div className="generated-grid">{generated.map(image => (
              <button type="button" key={image.path} onClick={()=>openImage(image.url)} className="generated-image-card" title={'View '+image.name}>
                <img src={image.url} alt={image.name} loading="lazy" />
                <span>{image.name} <ExternalLink size={13} aria-hidden="true" /></span>
              </button>
            ))}</div> : <p className="generated-empty">No public photos yet. Choose the finished photos above and upload them straight to this product’s customer gallery.</p>}
        </section>

        <section className="details-description" aria-labelledby="details-description-title">
          <div className="details-description-heading"><h2 id="details-description-title">Description</h2><div className="details-description-actions">{!editingDescription&&<><button type="button" onClick={()=>{setDescriptionDraft(product.description);setDescriptionError('');setDescriptionNotice('');setEditingDescription(true)}} className="details-description-action"><Pencil size={16}/> Edit</button><button type="button" disabled={!product.description} onClick={copyDescription} className="details-description-action">{descriptionCopied?<Check size={16}/>:<Copy size={16}/>} {descriptionCopied?'Copied':'Copy'}</button><button type="button" disabled={!product.description} onClick={shareDescription} className="details-description-action"><Share2 size={16}/> Share</button></>}</div></div>
          {editingDescription?<div className="details-description-editor"><label htmlFor="edit-product-description" className="sr-only">Edit product description</label><textarea id="edit-product-description" className="field details-description-textarea" value={descriptionDraft} onChange={e=>setDescriptionDraft(e.target.value)} disabled={descriptionSaving||descriptionGenerating} placeholder="Add product details or notes for AI generation…" rows={9}/><button type="button" className="ai-description-button details-description-generate" disabled={descriptionSaving||descriptionGenerating} onClick={generateDescription}>{descriptionGenerating?<LoaderCircle size={18} className="ai-description-spin"/>:<WandSparkles size={18}/>} {descriptionGenerating?'Generating description…':'Generate with AI'}</button>{descriptionGenerating&&<p className="details-description-ai-status" role="status">Creating your WhatsApp description with emoji prices…</p>}{descriptionNotice&&<p role="status" className="details-description-success">{descriptionNotice}</p>}<div className="details-description-editor-actions"><button type="button" className="details-description-action" disabled={descriptionSaving||descriptionGenerating} onClick={()=>{setEditingDescription(false);setDescriptionDraft(product.description);setDescriptionError('')}}><X size={16}/> Cancel</button><button type="button" className="primary-btn" disabled={descriptionSaving||descriptionGenerating||descriptionDraft===product.description} onClick={saveDescription}>{descriptionSaving?<LoaderCircle size={16} className="ai-description-spin"/>:<Save size={16}/>} {descriptionSaving?'Saving…':'Save changes'}</button></div></div>:product.description?<p className="details-description-text">{product.description}</p>:<p className="details-description-empty">No description yet. Tap Edit to add one.</p>}
          {descriptionError&&<p role="alert" className="details-description-error">{descriptionError}</p>}
          {descriptionNotice&&!editingDescription&&<p role="status" className="details-description-success">{descriptionNotice}</p>}
        </section>
        <section className="details-upload" aria-labelledby="details-upload-title">
          <div className="details-upload-head">
            <div><p className="eyebrow">GROW YOUR PRODUCT GALLERY</p><h2 id="details-upload-title">Add more photos</h2></div>
            <span className="details-upload-icon"><ImagePlus size={20}/></span>
          </div>
          <p className="details-upload-intro">Upload new reference photos without replacing any existing images.</p>
          <div className="details-upload-types" role="group" aria-label="Photo type">
            {([{id:'main',label:'Main'},{id:'color',label:'Colors'},{id:'other',label:'More'}] as const).map(item=><button key={item.id} type="button" disabled={uploadingImages} aria-pressed={newImageKind===item.id} onClick={()=>setNewImageKind(item.id)}>{item.label}</button>)}
          </div>
          <input ref={uploadInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" aria-label="Choose new product images" disabled={uploadingImages} onChange={e=>{setPendingFiles(Array.from(e.target.files||[]));setImageUploadError('');setImageUploadNotice('')}}/>
          <button type="button" className="details-upload-picker" disabled={uploadingImages} onClick={()=>uploadInput.current?.click()}><Plus size={18}/>{pendingFiles.length?pendingFiles.length+' image(s) selected':'Choose photos from device'}<span>JPEG · PNG · WebP · GIF</span></button>
          {pendingFiles.length>0&&<div className="details-upload-selected" aria-label="Pending photos">{pendingFiles.map((file,i)=><span key={file.name+i}>{file.name}</span>)}</div>}
          {uploadingImages&&imageProgress&&<div className="details-upload-progress" role="status"><div><LoaderCircle size={17} className="ai-description-spin"/><span>{imageProgress.stage==='syncing'?'Updating repository records':imageProgress.stage==='saving'?'Saving image record':'Uploading '+imageProgress.filename}</span><strong>{imageProgress.stage==='syncing'?'Syncing':(imageProgress.index+1)+' / '+imageProgress.total}</strong></div><div className="delete-progress-track"><span style={{width:imageProgress.percent+'%'}}/></div></div>}
          <button type="button" className="primary-btn details-upload-submit" disabled={uploadingImages||pendingFiles.length===0} onClick={addImages}>{uploadingImages?<LoaderCircle size={18} className="ai-description-spin"/>:<UploadCloud size={18}/>} {uploadingImages?'Saving photos…':'Upload to product'}</button>
          <div className="details-sync-row"><span>Keep description.txt and updates.txt current.</span><button type="button" disabled={syncingFiles||uploadingImages} onClick={syncFiles}>{syncingFiles?<LoaderCircle size={16} className="ai-description-spin"/>:<FolderSync size={16}/>} Sync files</button></div>
          {imageUploadError&&<p className="details-upload-error" role="alert">{imageUploadError}</p>}
          {imageUploadNotice&&<p className="details-upload-success" role="status">{imageUploadNotice}</p>}
        </section>
      </div>

      {viewerIndex!==null&&<ImageViewer images={allImages} index={viewerIndex} onClose={()=>setViewerIndex(null)}/>}
      {shareTarget&&<SharePopup url={shareTarget.url} title={shareTarget.title} onClose={()=>setShareTarget(null)}/>}
      <dialog
        ref={dialogRef}
        className="details-dialog"
        aria-labelledby="delete-dialog-title"
        onClose={() => deleteButton.current?.focus()}
        onCancel={event => { if (deleting) event.preventDefault(); }}
      >
        <span className="details-dialog-icon" aria-hidden="true"><Trash2 size={23} /></span>
        <h2 id="delete-dialog-title">{deleting ? 'Deleting product' : 'Delete product?'}</h2>
        {deleteProgress && (
          <div className="delete-progress" role="status" aria-live="polite" aria-atomic="true">
            <div className="delete-progress-heading">
              {deleting && <LoaderCircle className="delete-progress-spinner" size={20} aria-hidden="true" />}
              <span>{deleteProgress.label}</span>
            </div>
            {deleteProgress.total > 0 ? (
              <>
                <div
                  className="delete-progress-track"
                  role="progressbar"
                  aria-label="Deletion progress"
                  aria-valuemin={0}
                  aria-valuemax={deleteProgress.total}
                  aria-valuenow={deleteProgress.completed}
                >
                  <span style={{width:`${Math.round(deleteProgress.completed / deleteProgress.total * 100)}%`}} />
                </div>
                <p className="delete-progress-count">{deleteProgress.completed} of {deleteProgress.total} steps completed</p>
              </>
            ) : <div className="delete-progress-track delete-progress-indeterminate"><span /></div>}
            {deleting && <p className="delete-progress-note">Please keep this page open until deletion finishes.</p>}
          </div>
        )}
        {deleteError && <p className="delete-progress-error" role="alert">{deleteError}</p>}
        <div className="details-dialog-actions">
          <button type="button" className="details-dialog-cancel" disabled={deleting} onClick={() => dialogRef.current?.close()}>{deleteError ? 'Close' : 'Cancel'}</button>
          <button type="button" className="details-dialog-confirm" disabled={deleting} onClick={confirmDelete}>
            {deleting ? 'Deleting…' : deleteError ? 'Retry deletion' : 'Delete product'}
          </button>
        </div>
      </dialog>
    </section>
  );
}
