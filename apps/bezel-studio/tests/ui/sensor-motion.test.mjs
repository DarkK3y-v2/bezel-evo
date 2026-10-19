import test from 'node:test';
import assert from 'node:assert/strict';
import { createSensorMotion, defaultSensorMotion, stepRotor, supportsSensorMotion } from '../../src/sensor-motion.js';
import { sampledSensorKeys } from '../../src/sensor-sampling.js';
const settings = { sensor: 'gpu.fan', reference: 3000, turnsPerSecond: 1, inertiaMs: 600, reverse: false };

test('rotor inertia follows elapsed time, coasts to zero and handles unavailable readings', () => {
  const advance = step => {
    let state = stepRotor(null, settings, 0, 3000);
    for (let ms=step;ms<=1000;ms+=step) state=stepRotor(state,settings,ms/1000,3000);
    return state;
  };
  let fast=advance(20),slow=advance(100);
  assert.ok(Math.abs(fast.phase-slow.phase)<1e-8);
  assert.ok(fast.speed>.8 && fast.speed<1);
  const coast=stepRotor(fast,settings,1.02,0);
  assert.ok(coast.speed>0 && coast.speed<fast.speed);
  fast=coast;
  for(let ms=1040;ms<=10000;ms+=20) fast=stepRotor(fast,settings,ms/1000,undefined);
  assert.equal(fast.active,false);
  assert.equal(stepRotor(fast,settings,10.02,0).phase,fast.phase);
  const reverse={...settings,inertiaMs:0,reverse:true};
  let state=stepRotor(null,reverse,0,1500);
  state=stepRotor(state,reverse,.1,1500);
  assert.equal(state.phase,342);
  assert.equal(stepRotor(state,reverse,.2,NaN).active,false);
});

test('custom shapes/images and card members animate with isolated display state and unchanged document', () => {
  const e={id:1,kind:{type:'image'},frame:{x:0,y:0,width:60,height:30},cardMember:{parent:2,face:0},sensorMotion:settings};
  const theme={elements:[e]},before=structuredClone(theme);
  const animate=createSensorMotion();
  animate(theme,0,()=>3000,true,'display-a');
  const moving=animate(theme,.2,()=>3000,true,'display-a');
  assert.ok(moving.theme.elements[0].rotation>0);
  assert.equal(animate(theme,.2,()=>3000,true,'display-b').theme.elements[0].rotation,0);
  assert.equal(animate(theme,.4,()=>3000,false,'display-a').nextMs,null);
  assert.deepEqual(theme,before);
  assert.equal(supportsSensorMotion(e),true);
  for(const patch of [{isGroup:true},{card:{}},{kind:{type:'shape',videoWindow:true}}]) assert.equal(supportsSensorMotion({...e,...patch}),false);
  assert.equal(defaultSensorMotion([{key:'board.fan',quantity:'rpm'}],e).sensor,'board.fan');
  assert.deepEqual(sampledSensorKeys([], {theme,selection:[1]}),['gpu.fan']);
  assert.deepEqual(sampledSensorKeys([], {theme,selection:[1]},false),[]);
});
