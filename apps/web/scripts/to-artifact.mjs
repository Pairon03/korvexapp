// Converte o HTML único do Vite no formato de página do Artifact (sem doctype/html/head/body).
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../dist-artifact/index.html', import.meta.url), 'utf8');
const head = src.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = src.match(/<body>([\s\S]*?)<\/body>/)[1];
const pick = (re) => [...head.matchAll(re)].map((m) => m[0]).join('\n');
const title = pick(/<title>[\s\S]*?<\/title>/g);
const metas = pick(/<meta name="(claude:viewport-fit-sides|description)"[^>]*>/g);
const links = pick(/<link rel="(stylesheet|preconnect)"[^>]*>/g);
const styles = pick(/<style[\s\S]*?<\/style>/g);
const scripts = pick(/<script[\s\S]*?<\/script>/g);
const out = [title, metas, links, styles, body.replace(/<script[\s\S]*?<\/script>/g, '').trim(), scripts].join('\n');
writeFileSync(new URL('../dist-artifact/korvex.html', import.meta.url), out);
console.log(`korvex.html: ${(out.length / 1024).toFixed(0)} KB`);
