import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import PublicImageGallery from '../../public-image-gallery';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };
type ImageKind = 'main' | 'color' | 'other';
type ReferenceImage = {
  id: string;
  kind: string;
  storage_path: string;
  filename: string | null;
  sort_order: number;
};

export default async function SharedProduct({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return <main className="studio-bg share-state">Invalid product link.</main>;
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: product, error } = await db
    .from('products')
    .select('id,name,description,created_at,product_images(id,kind,storage_path,filename,sort_order)')
    .eq('id', id)
    .single();

  if (error || !product) {
    return (
      <main className="studio-bg share-state">
        <h1>Product not found</h1>
        <Link href="/">Open studio</Link>
      </main>
    );
  }

  const photos: ReferenceImage[] = [...(product.product_images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order);

  const sourceUrl = (path: string) =>
    path.startsWith('github:')
      ? 'https://raw.githubusercontent.com/lifestylekky/Life-Style-image-studio-store-/main/' + path.slice(7)
      : db.storage.from('product-images').getPublicUrl(path).data.publicUrl;

  type GeneratedFile = { name:string; path:string; type:string };
  let generated: GeneratedFile[] = [];
  let generatedUnavailable = false;
  try {
    const url = 'https://api.github.com/repos/lifestylekky/Life-Style-image-studio-store-/contents/products/'+id+'/generated?ref=main';
    const token = process.env.GITHUB_IMAGES_TOKEN;
    const response = await fetch(url, {cache:'no-store',headers:{'Accept':'application/vnd.github+json',...(token?{'Authorization':'Bearer '+token}:{})}});
    if (response.ok) {
      const files = await response.json() as GeneratedFile[] | GeneratedFile;
      if (Array.isArray(files)) generated = files.filter(file => file.type === 'file' && /\\.(jpe?g|png|webp|gif|avif)$/i.test(file.name));
    } else if (response.status !== 404) generatedUnavailable = true;
  } catch { generatedUnavailable = true; }

  const groups: { kind: ImageKind; title: string }[] = [
    { kind: 'main', title: 'Main product images' },
    { kind: 'color', title: 'Color set images' },
    { kind: 'other', title: 'Additional images' },
  ];

  return (
    <main className="studio-bg share-screen">
      <div className="share-content">
        <header className="share-header">
          <div className="share-brand">
            <span className="brand-mark" aria-hidden="true"><Sparkles size={19} strokeWidth={1.8} /></span>
            <span>LifeStyle Image Studio</span>
          </div>
          <Link href="/" className="share-studio-link">
            <ArrowLeft size={18} aria-hidden="true" />
            Studio
          </Link>
        </header>

        <div className="share-intro">
          <p className="eyebrow">SHARED PRODUCT REFERENCE</p>
          <h1 className="share-title">{product.name}</h1>
          <p className="share-summary">{photos.length} reference images · {generated.length} generated images</p>
        </div>

        <div className="share-sections">
          {groups.map(({ kind, title }) => {
            const items = photos.filter((image) => image.kind === kind);
            if (!items.length) return null;

            return (
              <section key={kind} className="share-section" aria-labelledby={`share-${kind}`}>
                <h2 id={`share-${kind}`} className="share-section-title">{title}</h2>
                <PublicImageGallery images={items.map(image=>({url:sourceUrl(image.storage_path),name:image.filename||product.name}))}/>
              </section>
            );
          })}
          <section className="share-section" aria-labelledby="share-generated-title">
            <h2 id="share-generated-title" className="share-section-title">Generated images ({generated.length})</h2>
            {generatedUnavailable ? <p className="generated-error">Generated images are temporarily unavailable.</p> :
              generated.length ? <PublicImageGallery images={generated.map(file=>({url:'https://raw.githubusercontent.com/lifestylekky/Life-Style-image-studio-store-/main/'+file.path.split('/').map(encodeURIComponent).join('/'),name:file.name}))}/> : <p className="generated-empty">No generated images yet.</p>}
          </section>
        </div>

        <section className="share-description" aria-labelledby="share-description-title">
          <h2 id="share-description-title">Product description</h2>
          <p>{product.description || 'No description provided.'}</p>
        </section>

        <footer className="share-footer">
          Public product reference. Original reference images and generated images are displayed in separate sections.
        </footer>
      </div>
    </main>
  );
}
