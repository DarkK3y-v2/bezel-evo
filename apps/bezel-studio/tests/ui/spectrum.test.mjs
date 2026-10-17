import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECTRUM_DEFAULTS, SPECTRUM_STYLES, followedPlayer, spectrumOf, spectrumPatch, demoSpectrum } from '../../src/spectrum.js';
import { createWidget, widgetOf } from '../../src/editor/widgets.js';
import { createStore } from '../../src/editor/store.js';
import { DEMO_THEME } from '../../src/demo-theme.js';
import { canFitContent } from '../../src/editor/fit-content.js';
import { supportsValueColor, colorAt } from '../../src/value-color.js';
import { createDemoBackend, demoNextChange } from '../../src/demo-backend.js';
const player = id => ({ id, kind: { type: 'text', content: { type: 'player' } } });
test('automatic link is allowed only for one Player; explicit missing references never fall back', () => {
  const theme = { elements: [] };
  assert.equal(followedPlayer(theme, {}), null);
  theme.elements.push(player(1)); assert.equal(followedPlayer(theme, {}), theme.elements[0]);
  theme.elements.push(player(2)); assert.equal(followedPlayer(theme, {}), null);
  assert.equal(followedPlayer(theme, { player: 2 }), theme.elements[1]);
  assert.equal(followedPlayer(theme, { player: 99 }), null);
});
test('defaults, range boundaries and non-finite edits cannot escape JSON bounds', () => {
  assert.equal(spectrumOf({}).motion, 'balanced'); assert.equal(spectrumOf({}).peaks, true);
  assert.deepEqual(spectrumPatch({}, { bands: Infinity, low: NaN, high: Infinity, thickness: NaN, gap: NaN, corners: null, motion: 'unknown' }), SPECTRUM_DEFAULTS);
  const c = spectrumPatch({}, { bands: 80, low: 25000, high: 10, thickness: 0, gap: -1, corners: [-1, Infinity, 800, 1] });
  assert.deepEqual([c.bands,c.low,c.high,c.thickness,c.gap],[64,23999,24000,1,0]); assert.deepEqual(c.corners,[0,2,256,1]);
  assert.equal(spectrumPatch({}, { bands: 7 }).bands, 8);
  assert.equal(spectrumPatch({}, { motion: 'smooth' }).motion, 'smooth');
  assert.equal(spectrumPatch({}, { motion: 'snappy' }).motion, 'snappy');
});
test('styles default to mirrored; unknown styles and style bounds cannot escape the file format', () => {
  assert.equal(spectrumOf({}).style, 'mirrored');
  for (const style of SPECTRUM_STYLES) assert.equal(spectrumPatch({}, { style }).style, style);
  assert.equal(spectrumPatch({}, { style: 'spiral' }).style, 'mirrored');
  const c = spectrumPatch({}, { block: 0, stroke: 99, inner: 95, fill: false });
  assert.deepEqual([c.block, c.stroke, c.inner, c.fill], [1, 32, 90, false]);
  assert.deepEqual(spectrumPatch({}, { block: NaN, stroke: NaN, inner: NaN }), SPECTRUM_DEFAULTS);
});
test('spectrum is standalone, uses band thresholds and remains one Undo step per edit', () => {
  const store = createStore(DEMO_THEME); store.dispatch('add', { widget: 'spectrum' });
  const e = store.getState().theme.elements.at(-1);
  assert.equal(widgetOf(e),'spectrum'); assert.equal(canFitContent(store.getState().theme,e.id),false);
  assert.equal(supportsValueColor(e),true);
  store.dispatch('update', { id:e.id, patch:{ kind:{ content:{ bands:64 } } } });
  store.undo(); assert.equal(store.getState().theme.elements.at(-1).kind.content.bands,32);
  const saved = JSON.parse(JSON.stringify(e)); assert.equal(saved.kind.content.player,null); assert.equal(saved.kind.content.demo,false);
  assert.equal(colorAt({base:'blue',thresholds:[{value:50,color:'red'}]},60),'red');
  assert.equal(createWidget('spectrum',{width:480,height:1920}).kind.content.peaks,true);
});
test('demo is bounded, explicit and animates independently of sensor refresh', () => {
  const e = { id:1,visible:true,kind:{type:'text',content:{type:'spectrum',demo:true}} };
  const theme={elements:[e]}; assert.equal(demoNextChange(theme,0),50);
  e.kind.content.demo=false; assert.equal(demoNextChange(theme,0),null);
  const a=demoSpectrum({},0), b=demoSpectrum({},.5); assert.equal(a.length,32);assert.notDeepEqual(a,b); assert.ok(a.every(v=>v>=0 && v<=1));
});
test('audio capture is a local preference, on by default and independent from imported themes',async()=>{
  const demo=createDemoBackend('turing88'); assert.equal((await demo.preferences()).audioCapture,true);
  await demo.setAudioCapture(false); assert.equal((await demo.preferences()).audioCapture,false);
  await demo.setAudioCapture(true); assert.equal((await demo.preferences()).audioCapture,true);
});
