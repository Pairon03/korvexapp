import { ImageOff } from 'lucide-react';
import { usePhotoUrl } from '../state/photos';
import { cx } from './ui';

/** Foto privada aberta por link temporário. */
export function PhotoThumb({ storageKey, alt, className }: { storageKey: string; alt: string; className?: string }) {
  const url = usePhotoUrl(storageKey);
  return url ? (
    <img src={url} alt={alt} className={cx('h-full w-full object-cover', className)} />
  ) : (
    <span className={cx('flex h-full w-full items-center justify-center bg-surface-2 text-faint', className)} role="status" aria-label="Carregando foto">
      <ImageOff size={16} className="animate-pulse" aria-hidden />
    </span>
  );
}
