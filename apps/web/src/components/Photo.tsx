import { useEffect, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, EyeOff, ImageOff } from 'lucide-react';
import { usePhotoUrl } from '../state/photos';
import type { PhotoCategory } from '@korvex/core';
import { cx } from './ui';

const ORDER: PhotoCategory[] = ['frente', 'perfil', 'costas'];
/** Frente, perfil e costas, sempre nessa ordem. */
export function sortPhotos<T extends { category: PhotoCategory }>(photos: T[]): T[] {
  return [...photos].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));
}

// Proteções contra salvar as fotos: a imagem vira fundo de um bloco (sem "Salvar imagem como"),
// o menu do botão direito, arrastar e o toque longo ficam desligados e a impressão esconde as fotos.
// Num navegador não dá para impedir um print de verdade; a marca d'água identifica quem viu.
const guard: CSSProperties = { WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' };
const block = (e: { preventDefault: () => void }) => e.preventDefault();

/** Foto privada aberta por link temporário. */
export function PhotoThumb({ storageKey, alt, className, contain }: { storageKey: string; alt: string; className?: string; contain?: boolean }) {
  const url = usePhotoUrl(storageKey);
  return url ? (
    <span
      role="img"
      aria-label={alt}
      onContextMenu={block}
      onDragStart={block}
      className={cx('photo-protected block h-full w-full bg-center bg-no-repeat', contain ? 'bg-contain' : 'bg-cover', className)}
      style={{ ...guard, backgroundImage: `url("${url}")` }}
    />
  ) : (
    <span className={cx('flex h-full w-full items-center justify-center bg-surface-2 text-faint', className)} role="status" aria-label="Carregando foto">
      <ImageOff size={16} className="animate-pulse" aria-hidden />
    </span>
  );
}

/** Texto repetido na diagonal por cima da foto. */
function Watermark({ text }: { text: string }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="150"><text x="0" y="90" transform="rotate(-24 130 75)" fill="white" fill-opacity="0.22" font-family="sans-serif" font-size="13">${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')}</text></svg>`;
  return <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")` }} />;
}

export interface ViewerPhoto {
  storageKey: string;
  label: string;
}

/** Esconde as fotos quando a janela perde o foco (ferramentas de captura costumam roubar o foco). */
function useHideOnBlur(): [boolean, () => void] {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const hide = () => setHidden(true);
    const onVisibility = () => document.visibilityState === 'hidden' && hide();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'PrintScreen') return;
      hide();
      navigator.clipboard?.writeText('').catch(() => undefined);
    };
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keyup', onKey);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  return [hidden, () => setHidden(false)];
}

/** Uma foto por vez (setas ou teclado), com opção de ver todas lado a lado. */
export function PhotoViewer({ photos, start = 0, watermark }: { photos: ViewerPhoto[]; start?: number; watermark?: string }) {
  const [index, setIndex] = useState(Math.min(start, photos.length - 1));
  const [sideBySide, setSideBySide] = useState(false);
  const [hidden, show] = useHideOnBlur();
  const count = photos.length;
  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  useEffect(() => {
    if (sideBySide || count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!count) return null;
  const current = photos[index];

  const frame = (p: ViewerPhoto, big: boolean) => (
    <div className={cx('relative overflow-hidden rounded-lg border border-line bg-black', big ? 'mx-auto aspect-[3/4] h-[min(62vh,640px)] max-w-full' : 'aspect-[3/4]')}>
      <PhotoThumb storageKey={p.storageKey} alt={`Foto ${p.label}`} contain />
      {watermark && <Watermark text={watermark} />}
    </div>
  );

  return (
    <div className="relative flex flex-col gap-3" onContextMenu={block} style={guard}>
      {count > 1 && (
        <div className="flex justify-end gap-1 text-[12px]" role="group" aria-label="Modo de exibição">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={sideBySide === v}
              onClick={() => setSideBySide(v)}
              className={cx('rounded-md px-2.5 py-1 font-semibold', sideBySide === v ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg')}
            >
              {v ? 'Lado a lado' : 'Uma por vez'}
            </button>
          ))}
        </div>
      )}
      {sideBySide ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <figure key={p.storageKey} className="flex flex-col gap-1">
              {frame(p, false)}
              <figcaption className="text-center text-[12px] text-muted">{p.label}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <figure className="flex flex-col gap-2">
          <div className="relative">
            {frame(current, true)}
            {count > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80" aria-label="Foto anterior">
                  <ChevronLeft size={20} />
                </button>
                <button type="button" onClick={() => go(1)} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80" aria-label="Próxima foto">
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
          <figcaption className="text-center text-[13px] text-muted">
            {current.label}
            {count > 1 && ` · ${index + 1} de ${count}`}
          </figcaption>
        </figure>
      )}
      {hidden && (
        <button type="button" onClick={show} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-surface text-sm text-muted">
          <EyeOff size={22} />
          Fotos ocultas enquanto a janela está fora de foco.
          <span className="font-semibold text-accent">Clique para mostrar</span>
        </button>
      )}
    </div>
  );
}
