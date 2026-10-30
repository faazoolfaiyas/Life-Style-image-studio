'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,ImagePlus,LayoutGrid,Plus,Search,Sparkles,Upload,X,WandSparkles,LoaderCircle} from 'lucide-react';
import AuthScreen from './auth-screen';
import ProductDetails from './product-details';
import {supabase,getUser,load,put,remove,type Kind,type Photo,type Product,type UploadProgress,type DeleteProgress} from './cloud';
const id=()=>crypto.randomUUID();
type StudioRoute={tab:'store'|'upload';selected:string|null};
function draftDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('lifestyle-studio-drafts',1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('drafts'))request.result.createObjectStore('drafts')};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });
}
async function readDraftPhotos():Promise<Photo[]>{
 const db=await draftDb();
 return new Promise(resolve=>{
  const transaction=db.transaction('drafts','readonly');
  const request=transaction.objectStore('drafts').get('photos');
  request.onsuccess=()=>resolve(Array.isArray(request.result)?request.result:[]);
  request.onerror=()=>resolve([]);
  transaction.oncomplete=()=>db.close();
 });
}
async function writeDraftPhotos(photos:Photo[]):Promise<void>{
 const db=await draftDb();
 return new Promise((resolve,reject)=>{
  const transaction=db.transaction('drafts','readwrite');
  transaction.objectStore('drafts').put(photos,'photos');
  transaction.oncomplete=()=>{db.close();resolve()};
  transaction.onerror=()=>{db.close();reject(transaction.error)};
 });
}
function routeFromUrl():StudioRoute{
 const url=new URL(window.location.href);
 const product=url.searchParams.get('product');
 return product?{tab:'store',selected:product}:url.searchParams.get('view')==='upload'?{tab:'upload',selected:null}:{tab:'store',selected:null};
}
function navigateStudio(route:StudioRoute,replace=false){
 const url=new URL(window.location.href);
 url.searchParams.delete('product');url.searchParams.delete('view');
 if(route.selected)url.searchParams.set('product',route.selected);
 else if(route.tab==='upload')url.searchParams.set('view','upload');
 const method=replace?'replaceState':'pushState';
 window.history[method]({studio:true},'',url.pathname+url.search+url.hash);
}

async function filesToPhotos(files:FileList|null,kind:Kind){if(!files)return [];return Promise.all(Array.from(files).filter(f=>f.type.startsWith('image/')).map(file=>new Promise<Photo>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({id:id(),kind,data:String(r.result),label:file.name});r.onerror=()=>reject(Error('Could not load image'));r.readAsDataURL(file)})))}
function ImageInput({label,kind,photos,onAdd,onRemove}:{label:string;kind:Kind;photos:Photo[];onAdd:(items:Photo[])=>void;onRemove:(id:string)=>void}){const ref=useRef<HTMLInputElement>(null);return <section><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">{label}</h3><span className="text-sm text-violet-200/75">{photos.length}</span></div><input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={async e=>{try{onAdd(await filesToPhotos(e.target.files,kind))}catch{alert('Could not load images')}e.target.value=''}}/><div className="grid grid-cols-3 gap-3 sm:grid-cols-5">{photos.map(p=><div key={p.id} className="image-tile relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/5"><img src={p.data} alt="" className="h-full w-full object-cover"/><button type="button" onClick={()=>onRemove(p.id)} aria-label="Remove image" className="image-remove absolute right-1 top-1 rounded-full bg-black/80 p-2"><X size={14}/></button></div>)}<button type="button" onClick={()=>ref.current?.click()} className="add-image-tile flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-300/30 bg-violet-400/5 text-violet-200 transition hover:bg-violet-400/15"><ImagePlus size={23}/><span className="text-xs">Add images</span></button></div></section>}
export default function Studio(){
const [user,setUser]=useState<string|null>(null),[ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false),[authBusy,setAuthBusy]=useState(false);
const [progress,setProgress]=useState<UploadProgress|null>(null);
const [generatingDescription,setGeneratingDescription]=useState(false),[descriptionError,setDescriptionError]=useState(''),[descriptionGenerated,setDescriptionGenerated]=useState(false);
const [uploadStep,setUploadStep]=useState<0|1|2>(0);

const [draftRestored,setDraftRestored]=useState(false);
const [products,setProducts]=useState<Product[]>([]),[tab,setTab]=useState<'store'|'upload'>('store'),[selected,setSelected]=useState<string|null>(null),[search,setSearch]=useState(''),[filter,setFilter]=useState<'all'|'main'|'color'|'other'>('all'),[slide,setSlide]=useState(0),[name,setName]=useState(''),[description,setDescription]=useState(''),[photos,setPhotos]=useState<Photo[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[copied,setCopied]=useState(false);
useEffect(()=>{
 const restore=()=>{const route=routeFromUrl();setTab(route.tab);setSelected(route.selected);setSlide(0);setFilter('all')};
 restore();
 window.addEventListener('popstate',restore);
 return()=>window.removeEventListener('popstate',restore);
},[]);
useEffect(()=>{
 try{const saved=sessionStorage.getItem('lifestyle-studio-draft');if(saved){const draft=JSON.parse(saved);setName(draft.name||'');setDescription(draft.description||'');setUploadStep(draft.step===1||draft.step===2?draft.step:0)}}catch{}
},[]);
useEffect(()=>{
 let active=true;
 readDraftPhotos().then(saved=>{if(active)setPhotos(saved)}).catch(()=>{}).finally(()=>{if(active)setDraftRestored(true)});
 return()=>{active=false};
},[]);
useEffect(()=>{if(!draftRestored)return;writeDraftPhotos(photos).catch(()=>{})},[photos,draftRestored]);
useEffect(()=>{try{sessionStorage.setItem('lifestyle-studio-draft',JSON.stringify({name,description,step:uploadStep}))}catch{}},[name,description,uploadStep]);
useEffect(()=>{if(!busy)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='Images are still uploading.'};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[busy]);
useEffect(()=>{
 let active=true;
 const timeout=window.setTimeout(()=>{if(active)setReady(true)},10000);
 getUser().then(u=>{if(active){setUser(u?.id??null);setReady(true)}}).catch(()=>{if(active)setReady(true)}).finally(()=>clearTimeout(timeout));
 const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
  if(!active)return;
  if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='INITIAL_SESSION'){
   const nextUser=session?.user.id??null;
   setUser(previous=>{
    if(previous!==nextUser){setProducts([]);setLoaded(false)}
    return nextUser;
   });
   setReady(true);
  }
 });
 return()=>{active=false;clearTimeout(timeout);subscription.unsubscribe()};
},[]);
useEffect(()=>{if(!ready||!user)return;let active=true;load().then(p=>{if(active)setProducts(p)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoaded(true)});return()=>{active=false}},[ready,user]);
useEffect(()=>{
 if(!ready||!user||busy)return;
 let active=true;
 const refresh=()=>{if(!active||document.visibilityState==='hidden')return;load().then(p=>{if(active){setProducts(p);setLoaded(true);setError('')}}).catch(e=>{if(active){setError(e instanceof Error?e.message:'Could not refresh products');setLoaded(true)}})};
 const onPageShow=(event:PageTransitionEvent)=>{if(event.persisted)refresh()};
 document.addEventListener('visibilitychange',refresh);
 window.addEventListener('focus',refresh);
 window.addEventListener('pageshow',onPageShow);
 return()=>{active=false;document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',onPageShow)};
},[ready,user,busy]);
const chosen=products.find(p=>p.id===selected);
const visible=useMemo(()=>products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase().trim())),[products,search]);
const images=chosen?.photos.filter(p=>filter==='all'||p.kind===filter)??[];
const current=images[Math.min(slide,Math.max(images.length-1,0))];
const add=(kind:Kind,items:Photo[])=>setPhotos(prev=>[...prev,...items.map(p=>({...p,kind}))]);
const go=(next:'store'|'upload')=>{if(busy)return;if(tab!==next||selected)navigateStudio({tab:next,selected:null});setTab(next);setSelected(null);setError('');setSlide(0);setFilter('all')};
const openProduct=(productId:string)=>{navigateStudio({tab:'store',selected:productId});setTab('store');setSelected(productId);setSlide(0);setFilter('all')};
const backToCollection=()=>{if(window.history.state?.studio){window.history.back()}else{navigateStudio({tab:'store',selected:null},true);setSelected(null)}};
const generateDescription=async()=>{
 if(generatingDescription)return;
 if(!name.trim()&&!description.trim()){setDescriptionError('Enter a product name or raw product details first.');return}
 setGeneratingDescription(true);setDescriptionError('');setDescriptionGenerated(false);
 try{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)throw Error('Please sign in again.');
  const response=await fetch('/api/description',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({name,notes:description})});
  const result=await response.json() as {description?:string;error?:string};
  if(!response.ok||!result.description)throw Error(result.error||'Could not generate a description.');
  setDescription(result.description);setDescriptionGenerated(true);
 }catch(e){setDescriptionError(e instanceof Error?e.message:'Description generation failed.')}
 finally{setGeneratingDescription(false)}
};
const save=async()=>{if(!name.trim()||!photos.some(p=>p.kind==='main')){setError('Product name and main image are required.');return}setBusy(true);setProgress({index:0,total:photos.length,percent:0,name:photos[0]?.label||'',phase:'uploading'});setError('');const p:Product={id:id(),name:name.trim(),description:description.trim(),createdAt:Date.now(),photos};try{await put(p,setProgress);setProducts(await load());setName('');setDescription('');setPhotos([]);setUploadStep(0);openProduct(p.id)}catch(e){setError(e instanceof Error?e.message:'Save failed')}finally{setBusy(false);setProgress(null)}};
const deleteOne=async(onProgress:(progress:DeleteProgress)=>void)=>{if(!chosen)return;await remove(chosen.id,onProgress);setProducts(p=>p.filter(x=>x.id!==chosen.id));navigateStudio({tab:'store',selected:null},true);setSelected(null)};
const copy=async()=>{if(!chosen)return;const url=location.origin+'/share/'+chosen.id;try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{prompt('Copy product URL',url)}};
if(!ready)return <main className="studio-bg flex min-h-screen items-center justify-center"><div className="loading-stage"><span className="brand-mark loading-logo"><Sparkles size={24}/></span><span className="loading-orbit"/><p className="mt-8 text-xs font-semibold tracking-[.3em] text-violet-200/60">LIFESTYLE STUDIO</p><div className="loading-track mt-5"><span/></div></div></main>;
if(!user)return <AuthScreen signup={signup} email={email} password={password} busy={authBusy} error={error} onEmailChange={setEmail} onPasswordChange={setPassword} onToggle={()=>{setSignup(v=>!v);setError('')}} onSubmit={async e=>{e.preventDefault();setAuthBusy(true);setError('');try{const {error}=signup?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});if(error)throw error;if(signup)setError('Account created. Check your email if confirmation is required.')}catch(e){setError(e instanceof Error?e.message:'Sign in failed')}finally{setAuthBusy(false)}}}/>;
return <main className="studio-bg min-h-screen text-white"><div className="workspace-shell">
<header className="app-bar"><button onClick={()=>go('store')} className="brand-button"><span className="brand-mark"><Sparkles size={19}/></span><span>LifeStyle <span className="text-violet-300">Studio</span></span></button><button disabled={busy} onClick={()=>supabase.auth.signOut()} className="signout-button">Sign out</button></header>
<nav className="workspace-nav" aria-label="Main navigation"><button disabled={busy} onClick={()=>go('store')} aria-current={tab==='store'?'page':undefined} className={`workspace-nav-link ${tab==='store'?'active':''}`}><LayoutGrid size={20}/><span>Collection</span></button><button disabled={busy} onClick={()=>go('upload')} aria-current={tab==='upload'?'page':undefined} className={`workspace-nav-link ${tab==='upload'?'active':''}`}><Plus size={20}/><span>Add product</span></button></nav>
<div className="workspace-content">
{tab==='store'&&!chosen&&<section className="mt-10"><div className="collection-heading"><p className="eyebrow">THE COLLECTION</p><div className="collection-title-row"><h1 className="page-title">Your <span className="gradient-text">showroom.</span></h1><span className="count-chip">{products.length} PRODUCTS</span></div><p className="supporting-copy">A curated home for your product imagery.</p></div><div className="collection-toolbar"><div><h2 className="section-title">All products</h2><p className="supporting-copy">Explore your collection</p></div><label className="search-box"><Search size={20} aria-hidden="true"/><input aria-label="Search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search"/></label></div>{!loaded?<div className="product-grid" aria-label="Loading products">{Array.from({length:8},(_,i)=><div key={i} className="product-card"><div className="skeleton aspect-[4/5] rounded-2xl"/><div className="skeleton mt-4 h-4 w-3/4 rounded-lg"/><div className="skeleton mt-2 h-3 w-1/3 rounded-lg"/></div>)}</div>:visible.length?<div className="product-grid">{visible.map(p=><button key={p.id} onClick={()=>openProduct(p.id)} className="product-card text-left"><div className="aspect-[4/5] overflow-hidden rounded-2xl bg-[#201631]"><img src={(p.photos.find(i=>i.kind==='main')??p.photos[0])?.data} alt={p.name} className="h-full w-full object-cover"/></div><div className="px-2 pb-1 pt-4"><div className="truncate text-sm font-semibold tracking-tight sm:text-base">{p.name}</div><p className="mt-1.5 text-xs tracking-wide text-violet-200/75">VIEW PRODUCT <span aria-hidden="true">↗</span></p></div></button>)}</div>:<div className="flex min-h-72 flex-col items-center justify-center gap-5 text-violet-200/50"><ImagePlus size={34}/><p className="text-sm">{search?'No products found':'No products yet'}</p>{!search&&<button onClick={()=>go('upload')} className="primary-btn"><Plus size={17}/> Upload product</button>}</div>}</section>}
{tab==='store'&&chosen&&<ProductDetails product={chosen} images={images} current={current} activeFilter={filter} activeSlide={slide} copied={copied} onBack={backToCollection} onCopy={copy} onDelete={deleteOne} onFilter={next=>{setFilter(next);setSlide(0)}} onSlide={setSlide}/>}
{tab==='upload'&&<section className="wizard-screen">
<div className="wizard-heading"><p className="eyebrow mb-3">PRODUCT STUDIO</p><h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Create a product</h1><p className="mt-3 text-sm text-violet-100/50">A simple, guided process to present your collection.</p></div>
<div className="wizard-steps" aria-label="Upload progress">{([{title:'Details',hint:'Name & description'},{title:'Photography',hint:'Product images'},{title:'Review',hint:'Ready to publish'}] as const).map((s,i)=><button key={s.title} type="button" aria-disabled={busy||i>uploadStep} onClick={()=>{if(!busy&&i<=uploadStep)setUploadStep(i as 0|1|2)}} className={`wizard-step ${uploadStep===i?'current':uploadStep>i?'complete':''}`}><span className="wizard-number">{uploadStep>i?<Check size={15}/>:String(i+1).padStart(2,'0')}</span><span className="min-w-0 text-left"><strong className="wizard-label">{s.title}</strong><small className="wizard-hint">{s.hint}</small></span></button>)}</div>
<div className="wizard-panel">
{uploadStep===0&&<div className="wizard-enter"><div className="mb-8"><p className="eyebrow mb-2">STEP 01 / 03</p><h2 className="text-2xl font-semibold tracking-tight">The essentials</h2><p className="mt-2 text-sm text-violet-100/50">Start with the information your customers will see.</p></div><label className="block text-sm font-medium text-violet-100/85">Product name <span className="text-amber-300">*</span><input className="field mt-3" value={name} onChange={e=>setName(e.target.value)} maxLength={120} placeholder="Enter product name" autoFocus/></label><div className="mt-7"><div className="flex flex-wrap items-center justify-between gap-3"><label htmlFor="product-description" className="block text-sm font-medium text-violet-100/85">Description <span className="font-normal text-violet-200/40">(optional)</span></label><button type="button" className="ai-description-button" disabled={generatingDescription||busy} onClick={generateDescription}>{generatingDescription?<LoaderCircle size={17} className="ai-description-spin"/>:<WandSparkles size={17}/>} {generatingDescription?'Generating…':descriptionGenerated?'Regenerate with AI':'Generate with AI'}</button></div><p className="mt-2 text-xs leading-5 text-violet-200/55">Enter messy product details, sizes, prices and colors below. AI will choose the suitable Life Style WhatsApp template and format it for you.</p><textarea id="product-description" className="field mt-3 min-h-48 resize-y" value={description} onChange={e=>{setDescription(e.target.value);setDescriptionGenerated(false)}} placeholder={'Example: Butterfly bra 32 34 36 300, 38 40 42 330\\nOr: polo frock pink green beige grey M 35x17 L 36x18 XL 37x19 price 950'} disabled={generatingDescription}/>{generatingDescription&&<div className="ai-description-progress" role="status" aria-live="polite"><div className="flex items-center gap-3"><span className="ai-description-orb"><WandSparkles size={19}/></span><div><strong>Crafting your product description</strong><p>Organizing sizes, prices and choosing your template…</p></div></div><div className="ai-description-progress-track"><span/></div></div>}{descriptionError&&<p role="alert" className="mt-3 text-sm text-rose-300">{descriptionError}</p>}{descriptionGenerated&&!generatingDescription&&<p role="status" className="mt-3 flex items-center gap-2 text-xs text-emerald-300"><Check size={15}/> Description generated. Review and edit before saving.</p>}</div></div>}
{uploadStep===1&&<div className="wizard-enter"><div className="mb-8"><p className="eyebrow mb-2">STEP 02 / 03</p><h2 className="text-2xl font-semibold tracking-tight">Product photography</h2><p className="mt-2 text-sm text-violet-100/50">Add a main image, then any color variations or additional views.</p></div><div className="space-y-8"><ImageInput label="Main product images *" kind="main" photos={photos.filter(p=>p.kind==='main')} onAdd={p=>add('main',p)} onRemove={id=>setPhotos(v=>v.filter(p=>p.id!==id))}/><div className="border-t border-white/10 pt-7"><ImageInput label="Color set images" kind="color" photos={photos.filter(p=>p.kind==='color')} onAdd={p=>add('color',p)} onRemove={id=>setPhotos(v=>v.filter(p=>p.id!==id))}/></div><div className="border-t border-white/10 pt-7"><ImageInput label="More images" kind="other" photos={photos.filter(p=>p.kind==='other')} onAdd={p=>add('other',p)} onRemove={id=>setPhotos(v=>v.filter(p=>p.id!==id))}/></div></div></div>}
{uploadStep===2&&<div className="wizard-enter"><div className="mb-8"><p className="eyebrow mb-2">STEP 03 / 03</p><h2 className="text-2xl font-semibold tracking-tight">Review your product</h2><p className="mt-2 text-sm text-violet-100/50">Check the details before saving to your collection.</p></div><div className="review-card flex flex-col gap-5 sm:flex-row"><div className="aspect-[4/5] w-full shrink-0 overflow-hidden rounded-2xl bg-[#21172e] sm:w-44">{photos.find(p=>p.kind==='main')?<img src={photos.find(p=>p.kind==='main')?.data} alt="Main product preview" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-violet-200/40"><ImagePlus size={32}/></div>}</div><div className="min-w-0 flex-1"><p className="eyebrow mb-2">PRODUCT PREVIEW</p><h3 className="break-words text-xl font-semibold">{name.trim()}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-violet-100/55">{description.trim()||'No description added'}</p><div className="mt-5 flex flex-wrap gap-2">{(['main','color','other'] as Kind[]).map(k=><span key={k} className="review-chip">{k==='main'?'Main':k==='color'?'Colors':'More'} · {photos.filter(p=>p.kind===k).length}</span>)}</div></div></div><div className="mt-6 flex gap-2 overflow-x-auto">{photos.map(p=><img key={p.id} src={p.data} alt={p.label} className="h-16 w-16 shrink-0 rounded-xl border border-white/10 object-cover"/>)}</div></div>}
{error&&<p role="alert" className="mt-6 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
<div className="wizard-actions"><div className="text-sm text-violet-100/75">Step {uploadStep+1} of 3</div><div className="flex items-center gap-3">{uploadStep>0&&<button type="button" disabled={busy} onClick={()=>{setError('');setUploadStep((uploadStep-1) as 0|1)}} className="ghost-btn"><ArrowLeft size={16}/> Back</button>}{uploadStep<2?<button type="button" onClick={()=>{if(uploadStep===0&&!name.trim()){setError('Enter a product name to continue.');return}if(uploadStep===1&&!photos.some(p=>p.kind==='main')){setError('Add at least one main product image.');return}setError('');setUploadStep((uploadStep+1) as 1|2)}} className="primary-btn">Continue <ArrowRight size={17}/></button>:<button disabled={busy} onClick={save} className="primary-btn disabled:opacity-50">{busy?<span className="mini-spinner"/>:<Upload size={17}/>} {busy?'Saving product':'Save product'}</button>}</div></div>
</div></section>}
{busy&&progress&&<div role="dialog" aria-modal="true" aria-label="Uploading product images" className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0714]/85 px-4 backdrop-blur-xl"><div className="upload-modal w-full max-w-md overflow-hidden rounded-[30px] border border-violet-300/20 bg-[#21162f] p-6 shadow-[0_30px_100px_rgba(0,0,0,.65)] sm:p-8"><div className="mb-5 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-200"><Upload size={22}/></span><div><h2 className="text-lg font-semibold">Uploading your images</h2><p className="text-sm text-violet-200/80">Please keep this page open until complete</p></div></div><div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">{progress.phase==='uploading'&&photos[progress.index]?<img src={photos[progress.index].data} alt="Current image" className="h-16 w-16 shrink-0 rounded-xl object-cover"/>:<span className="flex h-16 w-16 items-center justify-center rounded-xl bg-violet-400/15"><Sparkles size={25}/></span>}<div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{progress.phase==='saving'?'Saving product details':progress.name}</div><p className="mt-1 text-xs text-violet-200/50">{progress.phase==='saving'?'All images uploaded':`Image ${progress.index+1} of ${progress.total}`}</p></div><span className="text-lg font-semibold tabular-nums text-violet-200">{progress.percent}%</span></div><div className="mb-2 flex justify-between text-xs text-violet-200/60"><span>Overall progress</span><span className="tabular-nums">{Math.round((progress.index+(progress.phase==='saving'?0:progress.percent/100))/progress.total*100)}%</span></div><div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress.index+(progress.phase==='saving'?0:progress.percent/100))/progress.total*100)} className="h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-400 to-amber-300 transition-[width] duration-200" style={{width:`${Math.round((progress.index+(progress.phase==='saving'?0:progress.percent/100))/progress.total*100)}%`}}/></div><div className="mt-5 flex gap-1.5">{photos.map((photo,i)=><div key={photo.id} className={`h-1.5 min-w-0 flex-1 rounded-full transition-colors ${i<progress.index?'bg-amber-300':i===progress.index?'bg-violet-400':'bg-white/10'}`}/>)}</div><p className="mt-5 text-center text-xs text-violet-200/45">Images are uploaded one at a time. Do not close or refresh this tab.</p></div></div>}
{error&&tab==='store'&&<p role="alert" className="mt-6 text-sm text-rose-300">{error}</p>}
</div></div></main>}
