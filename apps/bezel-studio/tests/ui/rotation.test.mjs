import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeDegrees, rotatedBounds, rotatedCorners, rotatePoint, centerOf, toLocal, containsRotated, snapAngle, canRotate } from '../../src/editor/rotation.js';
import { hitTest, marqueeSelect, resize } from '../../src/editor/geometry.js';
import { createStore } from '../../src/editor/store.js';
const fixture = JSON.parse(readFileSync(new URL('../../../../crates/bezel-core/tests/fixtures/rotation-parity.json', import.meta.url)));
const element = (id = 1) => ({ id, name: `Box ${id}`, frame: { ...fixture.frame }, visible: true, opacity: 1, locked: false, kind: { type: 'shape', shape: 'rect', fill: '#ff0000ff' } });
const theme = () => ({ schema: 1, name: 'Rotation', canvas: fixture.canvas, orientation: 'portrait', background: { type: 'color', color: '#00000000' }, elements: [element(), element(2)] });

test('normalization and geometry match the shared Rust parity fixture', () => {
  for (const [input, expected] of [[180,180],[-180,180],[540,180],[190,-170],[-0,0],[Infinity,0]]) assert.equal(normalizeDegrees(input), expected);
  const bounds = rotatedBounds(fixture.frame, fixture.rotation);
  for (const key of Object.keys(bounds)) assert.ok(Math.abs(bounds[key] - fixture.bounds[key]) < 1e-3);
  assert.deepEqual(rotatedBounds(fixture.frame, 0), fixture.frame);
  for (const p of fixture.ink) assert.ok(containsRotated(fixture.frame,30,...p));
  for (const p of fixture.empty) assert.ok(!containsRotated(fixture.frame,30,...p));
  const point = {x: 50,y: 45};
  const roundtrip = toLocal(fixture.frame,30,rotatePoint(point,centerOf(fixture.frame),30));
  assert.ok(Math.hypot(roundtrip.x-point.x,roundtrip.y-point.y)<1e-9);
  assert.equal(rotatedCorners(fixture.frame,90).length,4);
  assert.equal(snapAngle(23),30); assert.equal(snapAngle(-23),-30);
  const e = {...element(),rotation:30};
  assert.equal(hitTest([e],...fixture.ink[1]),1);
  assert.equal(hitTest([e],...fixture.empty[0]),null);
  assert.deepEqual(marqueeSelect([e],{x:101,y:77,width:2,height:2}),[1]);
});

test('containers, members and video windows cannot rotate', () => {
  for (const patch of [{isGroup:true},{groupParent:2},{card:{}},{cardMember:{parent:2}},{kind:{type:'shape',videoWindow:true}}]) assert.equal(canRotate(theme(),{...element(),...patch}),false);
  assert.ok(canRotate(theme(),element())); assert.equal(canRotate(theme(),null),false);
});

test('local resize keeps the opposite corner fixed on screen', () => {
  for (const angle of [30,90,-45]) for (const h of ['nw','ne','sw','se','n','s','e','w']) {
    const b = fixture.frame, next = resize(b,h,12,9,false,angle);
    const opposite = f => ({x:f.x+f.width*(h.includes('w')?1:h.includes('e')?0:.5),y:f.y+f.height*(h.includes('n')?1:h.includes('s')?0:.5)});
    const a = rotatePoint(opposite(b),centerOf(b),angle), z = rotatePoint(opposite(next),centerOf(next),angle);
    assert.ok(Math.hypot(a.x-z.x,a.y-z.y)<1e-8);
  }
});

test('one drag is one undo, zero removes the key, paste and duplicate retain rotation', () => {
  const s = createStore(theme());
  s.beginGesture(); for (const rotation of [5,20,200]) s.dispatch('rotate',{id:1,rotation}); s.endGesture();
  assert.equal(s.getState().theme.elements[0].rotation,-160);
  s.undo(); assert.equal(s.getState().theme.elements[0].rotation,undefined); assert.equal(s.canUndo(),false);
  s.redo(); s.select([1]); s.copySelection(); s.paste();
  assert.equal(s.getState().theme.elements.at(-1).rotation,-160);
  s.dispatch('duplicate',{ids:[1]}); assert.equal(s.getState().theme.elements.at(-1).rotation,-160);
  s.dispatch('rotate',{id:1,rotation:360}); assert.ok(!('rotation' in s.getState().theme.elements[0]));
});

test('grouping and attaching to a Card clear rotation and undo restores it', () => {
  const s = createStore(theme()); s.dispatch('rotate',{id:1,rotation:30});
  s.dispatch('groupSelection',{ids:[1,2]});
  assert.equal(s.getState().theme.elements.find(e=>e.id===1).rotation,undefined);
  s.undo(); assert.equal(s.getState().theme.elements[0].rotation,30);
  s.dispatch('cardFromSelection',{ids:[1]});
  assert.equal(s.getState().theme.elements.find(e=>e.id===1).rotation,undefined);
  s.undo(); assert.equal(s.getState().theme.elements[0].rotation,30);
  s.dispatch('update',{id:1,patch:{locked:true}});
  s.dispatch('rotate',{id:1,rotation:80}); assert.equal(s.getState().theme.elements[0].rotation,30);
  s.dispatch('rotate',{id:2,rotation:NaN}); assert.equal(s.getState().theme.elements[1].rotation,undefined);
});

