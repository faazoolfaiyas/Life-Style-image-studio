'use client';

import { useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, LoaderCircle, Trash2 } from 'lucide-react';
import type { DeleteProgress, Kind, Photo, Product } from './cloud';

type Filter = 'all' | Kind;
type Props = {
  product: Product;
  images: Photo[];
  current?: Photo;
  activeFilter: Filter;
  activeSlide: number;
  copied: boolean;
  onBack: () => void;
  onCopy: () => void;
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
  onDelete,
  onFilter,
  onSlide,
}: Props) {
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<DeleteProgress | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [folderCopied, setFolderCopied] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const count = images.length;
  const githubImage = product.photos.find(photo => photo.path?.startsWith('github:products/'));
  const githubFolder = githubImage?.path?.slice('github:'.length).split('/').slice(0, 2).join('/');
  const folderUrl = githubFolder ? `https://github.com/lifestylekky/Life-Style-image-studio-store-/tree/main/${githubFolder.split('/').map(encodeURIComponent).join('/')}` : null;
  const copyFolder = async () => {
    if (!folderUrl) return;
    try {
      await navigator.clipboard.writeText(folderUrl);
      setFolderCopied(true);
      window.setTimeout(() => setFolderCopied(false), 1800);
    } catch {
      window.prompt('Copy product folder URL', folderUrl);
    }
  };

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
          {folderUrl && (
            <button type="button" onClick={copyFolder} className="details-copy" aria-label="Copy product GitHub folder URL">
              <Copy size={18} aria-hidden="true" />
              {folderCopied ? 'Copied' : 'Copy folder'}
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
          <p className="eyebrow">PRODUCT DETAILS</p>
          <h1 id="details-title" className="details-title">{product.name}</h1>
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

        {product.description && (
          <section className="details-description" aria-labelledby="details-description-title">
            <h2 id="details-description-title">Description</h2>
            <p>{product.description}</p>
          </section>
        )}
      </div>

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
