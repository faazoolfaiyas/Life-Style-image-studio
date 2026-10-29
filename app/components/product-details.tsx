'use client';
import { useRef, useState, type TouchEvent } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Trash2 } from 'lucide-react';
import type { Kind, Photo, Product } from '../cloud';

type PhotoFilter = 'all' | Kind;
type ProductDetailsProps = {
  product: Product;
  images: Photo[];
  filter: PhotoFilter;
  slide: number;
  copied: boolean;
  onBack: () => void;
  onCopy: () => void;
  onDelete: () => Promise<void>;
  onFilterChange: (value: PhotoFilter) => void;
  onSlideChange: (index: number) => void;
};

const categories: { id: PhotoFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'main', label: 'Main' },
  { id: 'color', label: 'Colors' },
  { id: 'other', label: 'More' },
];

export default function ProductDetails({
  product, images, filter, slide, copied, onBack, onCopy, onDelete, onFilterChange, onSlideChange,
}: ProductDetailsProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const currentIndex = Math.max(0, Math.min(slide, images.length - 1));
  const current = images[currentIndex];

  const moveImage = (delta: number) => {
    if (images.length > 1) onSlideChange((currentIndex + delta + images.length) % images.length);
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch || images.length < 2) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.35) moveImage(dx < 0 ? 1 : -1);
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete();
      dialogRef.current?.close();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="detail-page" aria-label="Product details">
      <div className="detail-back-row">
        <button type="button" onClick={onBack} className="detail-back-button">
          <ArrowLeft size={19} aria-hidden="true" />Products
        </button>
      </div>
      <div className="detail-layout">
        <div className="detail-info">
          <div className="detail-heading">
            <p className="eyebrow">PRODUCT DETAILS</p>
            <h1 className="detail-title">{product.name}</h1>
          </div>
          <div className="detail-actions">
            <button type="button" onClick={onCopy} className="detail-copy-action">
              <Copy size={18} aria-hidden="true" />{copied ? 'Copied' : 'Copy link'}
            </button>
            <button
              ref={deleteTriggerRef}
              type="button"
              aria-label="Delete product"
              title="Delete product"
              onClick={() => dialogRef.current?.showModal()}
              className="detail-delete-action"
            >
              <Trash2 size={19} aria-hidden="true" />
            </button>
          </div>
          <div className="detail-filters" role="tablist" aria-label="Image categories">
            {categories.map(category => (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={filter === category.id}
                className={filter === category.id ? 'detail-filter active' : 'detail-filter'}
                onClick={() => onFilterChange(category.id)}
              >{category.label}</button>
            ))}
          </div>
        </div>

        <div className="detail-gallery">
          <div
            className="detail-viewer"
            role="group"
            aria-label="Product image viewer"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {current ? (
              <img
                key={current.id}
                src={current.data}
                alt={current.label || product.name}
                className="detail-viewer-image"
                loading="eager"
                decoding="async"
              />
            ) : <div className="detail-viewer-empty">No images</div>}
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => moveImage(-1)} className="detail-gallery-arrow previous" aria-label="Previous">
                  <ChevronLeft size={24} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => moveImage(1)} className="detail-gallery-arrow next" aria-label="Next">
                  <ChevronRight size={24} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          {images.length > 0 && (
            <div className="detail-thumbnail-strip" aria-label="Product image thumbnails">
              {images.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  className={index === currentIndex ? 'detail-thumbnail active' : 'detail-thumbnail'}
                  onClick={() => onSlideChange(index)}
                  aria-label={photo.label || 'Product image ' + (index + 1)}
                  aria-current={index === currentIndex ? 'true' : undefined}
                >
                  <img src={photo.data} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
        </div>
        {product.description && (
          <section className="detail-description">
            <h2>Description</h2>
            <p>{product.description}</p>
          </section>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className="delete-dialog"
        aria-labelledby="delete-dialog-heading"
        onClose={() => deleteTriggerRef.current?.focus()}
      >
        <h2 id="delete-dialog-heading">Delete product?</h2>
        <div className="delete-dialog-actions">
          <button type="button" className="ghost-btn" disabled={deleting} onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button type="button" className="delete-confirm-button" disabled={deleting} onClick={confirmDelete}>
            {deleting ? <span className="mini-spinner" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}
            Delete product
          </button>
        </div>
      </dialog>
    </section>
  );
}
