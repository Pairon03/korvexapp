import { useEffect, useState } from 'react';
import type { PhotoCategory } from '@korvex/core';
import { cloudEnabled, supabase } from './cloud';

// Fotos de acompanhamento no Supabase Storage (bucket privado "fitcore-fotos", ver supabase/fitcore.sql).
// O estado do app guarda só a chave do arquivo; a imagem abre por link assinado que expira.
// Sem Supabase, as fotos não são enviadas nem salvas.
const BUCKET = 'fitcore-fotos';
const MAX_SIDE = 1600;
const LINK_SECONDS = 600;

export const photosEnabled = cloudEnabled;

/**
 * Reduz a foto e regrava em JPEG antes de enviar. Além de economizar espaço,
 * a regravação descarta os metadados do arquivo (como a localização do GPS).
 */
export async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível processar a foto.'))), 'image/jpeg', 0.85),
  );
}

export async function uploadPhoto(studentId: string, assessmentId: string, category: PhotoCategory, image: Blob): Promise<string> {
  const { data } = await supabase!.auth.getUser();
  if (!data.user) throw new Error('Entre na sua conta para enviar fotos.');
  const key = `${data.user.id}/${studentId}/${assessmentId}/${category}-${Date.now()}.jpg`;
  const { error } = await supabase!.storage.from(BUCKET).upload(key, image, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`Não foi possível enviar a foto (${error.message}).`);
  return key;
}

/** Apaga arquivos do armazenamento. Devolve false se algum não pôde ser apagado. */
export async function deletePhotos(keys: (string | null | undefined)[]): Promise<boolean> {
  const list = keys.filter((k): k is string => !!k);
  if (!supabase || !list.length) return true;
  for (const k of list) links.delete(k);
  const { error } = await supabase.storage.from(BUCKET).remove(list);
  return !error;
}

const links = new Map<string, { url: string; expires: number }>();

/** Link temporário para exibir a foto; renova sozinho quando está perto de expirar. */
export function usePhotoUrl(key: string | null): string | null {
  const cached = key ? links.get(key) : undefined;
  const [url, setUrl] = useState<string | null>(cached && cached.expires > Date.now() ? cached.url : null);
  useEffect(() => {
    if (!key || !supabase) return;
    const hit = links.get(key);
    if (hit && hit.expires > Date.now() + 30_000) {
      setUrl(hit.url);
      return;
    }
    let alive = true;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(key, LINK_SECONDS)
      .then(({ data }) => {
        if (!alive || !data) return;
        links.set(key, { url: data.signedUrl, expires: Date.now() + LINK_SECONDS * 1000 });
        setUrl(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return url;
}
