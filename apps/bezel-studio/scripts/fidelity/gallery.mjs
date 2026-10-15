// Reproducible, offline mockup/app review page. Run from apps/bezel-studio:
// node scripts/fidelity/gallery.mjs [--reuse] [--out absolute-directory]
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESIGN } from './serve-mock.mjs';

const APP = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const at = args.indexOf('--out');
const out = at < 0 ? fileURLToPath(new URL('../../../../.jdi/phases/studio-redesign-fidelity/gap/gallery/', import.meta.url)) : resolve(args[at + 1]);
mkdirSync(out, { recursive: true });
const shots = join(out, 'captures');
if (!args.includes('--reuse')) {
  const code = await new Promise((done, reject) => {
    const child = spawn(process.execPath, ['scripts/fidelity/shoot.mjs', '--scheme', 'both', '--out', shots], { cwd: APP, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', done);
  });
  if (code !== 0) throw new Error(`shoot.mjs exited ${code}`);
}
const manifest = JSON.parse(readFileSync(join(shots, 'manifest.json'), 'utf8'));
// Each reference is linked to every corresponding app state, rather than
// guessing from filenames or silently skipping an artboard.
const pairs = {
  Main: ['shell/main', 'shell/unsaved', 'shell/live', 'shell/grid', 'library/widgets', 'inspector/ring', 'inspector/ring-look'],
  Logo: ['shell/logo'],
  Sensors: ['library/sensors', 'library/sensors-libre', 'library/sensors-libre-detail'],
  Layers: ['library/layers', 'library/layers-default', 'library/layers-selection'],
  Media: ['library/media', 'library/media-filled', 'library/media-collection', 'library/media-icons', 'library/gif-search'],
  Themes: ['library/themes', 'library/themes-all', 'library/themes-panel'],
  Screen: ['screen/settings', 'screen/settings-advanced'],
  Storage: ['screen/storage', 'screen/storage-boot', 'screen/storage-boot-drop', 'screen/storage-sd'],
  SensorStatus: ['screen/sensor-ok', 'screen/sensor-status', 'screen/sensor-status-error', 'screen/sensor-chip-error', 'screen/sensor-restarting'],
  GraphData: ['inspector/graph', 'inspector/graph-auto'], GraphLook: ['inspector/graph-look'],
  PlayerData: ['inspector/player', 'inspector/player-custom', 'inspector/player-stopped'],
  PlayerLook: ['inspector/player-look', 'inspector/player-corners'],
  CardFaces: ['card/faces'], CardMotion: ['card/motion'], CardTriggers: ['card/triggers'],
};
const notes = {
  Main: 'Salva è secondario per decisione D-6. Dati, zoom e nomi provengono dal bridge. Il preview Ring resta dopo le proprietà; la geometria di Graph/Player segue i controlli.',
  Logo: 'Il riferimento è una tavola di identità visiva; l’app mostra il marchio nelle dimensioni reali della topbar.',
  Sensors: 'Sparklines da campioni reali; numero, nomi e stato dei sensori dipendono dal catalogo. Nessun valore del mockup viene inserito nel prodotto.',
  Layers: 'A 272 px i nomi lunghi occupano due righe per restare completi; la tavola autonoma usa 360 px. Filtro e selezione multipla restano disponibili.',
  Media: 'Il progresso compare solo durante un’importazione reale. I pannelli Collezione, Icone e ricerca sono stati aggiuntivi del prodotto.',
  Themes: 'Sono conservati ricerca, orientamento, metadati, aggiorna e Salva con nome. La griglia è la stessa nel pannello e nel dialogo.',
  Screen: 'Porta, protocollo, dimensioni e standby sono quelli del dispositivo demo, senza sostituirli con valori del riferimento.',
  Storage: 'Storage mantiene il layout a tutta larghezza del prodotto. Capacità, tipi, file e avvio provengono da managerOverview.',
  SensorStatus: 'Hardware, tempi e provider reali; i cinque stati aggiuntivi documentano letture riuscite, parziali, errore e riavvio.',
  GraphData: 'Anteprima isolata dal renderer; geometria dopo i controlli dati. Valori e finestra sono quelli effettivi del tema.',
  GraphLook: 'Anteprima isolata e opzioni reali; geometria dopo i controlli.',
  PlayerData: 'App dal campione activity.media, richiesto soltanto durante l’editing necessario. Testo libero disponibile con Altra…',
  PlayerLook: 'Opzioni effettive del Player e anteprima isolata. Nessuna app o copertina copiata dal mockup.',
  CardFaces: 'Due facce popolate tramite UI e miniature dal renderer. Conteggi e proporzioni riflettono il documento, non i tre esempi del mockup. Geometria e preview sono conservati dopo il contenuto Card.',
  CardMotion: 'Intervallo, durata e testi reali. Effetti illustrati a tratto; aiuto completo nel details nativo.',
  CardTriggers: 'Regole create nella UI, suggerimenti da activity e controlli nativi. Il badge “attiva ora” è escluso per decisione esplicita.',
};
const boards = Object.keys(JSON.parse(readFileSync(join(DESIGN, 'canvas.json'), 'utf8')).boards)
  .map(name => name.replace('.dc.html', '')).filter(name => !['Connect', 'LogoAlternatives'].includes(name));
for (const board of boards) if (!pairs[board]) throw new Error(`Missing gallery mapping: ${board}`);
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const img = (file, alt) => {
  const png = readFileSync(join(shots, file));
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  return `<a href="captures/${escape(file)}" target="_blank" rel="noopener"><img loading="lazy" width="${width}" height="${height}" src="captures/${escape(file)}" alt="${escape(alt)}"></a>`;
};
const sections = [];
for (const scheme of ['dark', 'light']) {
  for (const board of boards) {
    const mock = manifest.find(e => e.kind === 'mock' && e.scheme === scheme && e.artboard === board);
    if (!mock) throw new Error(`Missing mock: ${scheme}/${board}`);
    const states = pairs[board].map(state => {
      const app = manifest.find(e => e.kind === 'app' && e.scheme === scheme && `${e.area}/${e.state}` === state);
      if (!app) throw new Error(`Missing app: ${scheme}/${state}`);
      return `<article><h3>${escape(state)}</h3><div class="pair"><figure><figcaption>Mockup · ${mock.mode === 'static' ? `STATICO: ${escape(mock.reason)}` : 'DCLogic espanso'}</figcaption>${img(mock.file, `${board} riferimento`)}</figure><figure><figcaption>App · italiano · ${scheme}</figcaption>${img(app.detail ?? app.file, `${board} app ${scheme}`)}${app.detail ? `<details><summary>Finestra completa</summary>${img(app.file, `${state} finestra completa`)}</details>` : ''}</figure></div></article>`;
    }).join('\n');
    sections.push(`<section id="${board}-${scheme}" data-scheme="${scheme}"><h2>${board} · ${scheme}</h2><p>${escape(notes[board])}</p>${states}</section>`);
  }
}
writeFileSync(join(out, 'index.html'), `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Bezel Evo · Wave 2 · Galleria</title>
<style>body{margin:0;padding:24px;background:#16191d;color:#eef0f2;font:15px system-ui}h1{margin-top:0}a{color:#ffb786}nav{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}section{border-top:1px solid #59606a;padding:20px 0}section[data-scheme=light]{background:#f3f4f6;color:#20252c;padding:20px}section[data-scheme=light] a{color:#8e3e00}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}figure{margin:0;min-width:0}figcaption{font:13px monospace;margin-bottom:10px}img{display:block;max-width:100%;height:auto}article{padding:12px 0 24px}details{margin-top:12px}p{max-width:1000px;line-height:1.5}@media(max-width:750px){.pair{grid-template-columns:1fr}}</style>
<h1>Bezel Evo · Integrazione Wave 2</h1><p>${boards.length} artboard · dark e light · locale it. Connect e LogoAlternatives esclusi. Clic sulle immagini per la risoluzione originale. I riferimenti sono prevalentemente scuri: la modalità chiara usa i token dell’app. L’approvazione visiva dell’utente resta il gate manuale.</p>
<nav>${boards.map(b => `<a href="#${b}-dark">${b} scuro</a><a href="#${b}-light">chiaro</a>`).join('')}</nav>${sections.join('\n')}</html>`, 'utf8');
console.log(`Gallery: ${join(out, 'index.html')} (${boards.length} artboards × 2 schemes)`);
