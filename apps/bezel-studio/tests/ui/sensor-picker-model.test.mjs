import test from 'node:test';
import assert from 'node:assert/strict';
import { sensorChoices, sensorChoiceReading, sensorNativeUnit } from '../../src/sensor-picker-model.js';
const catalog = [
  {key:'gpu.0.fan',label:'Ventola gráfica',category:'gpu',source:'NVML',quantity:'rpm'},
  {key:'gpu.fan',label:'Ventola principale',category:'gpu',source:'gpu.0.fan (NVML)',quantity:'rpm'},
  {key:'cpu.usage',label:'Carico CPU',category:'cpu',source:'sysinfo',quantity:'percent'},
  {key:'system.hostname',label:'Nome host',category:'system',source:'Windows',quantity:'text'},
];
test('search combines words across name, key, probe and translated category with numeric scope',()=>{
  assert.deepEqual(sensorChoices(catalog,'NVML ventola').flatMap(([,s])=>s.map(s=>s.key)),['gpu.0.fan','gpu.fan']);
  assert.equal(sensorChoices(catalog,'grafica')[0][1][0].key,'gpu.0.fan');
  assert.equal(sensorChoices(catalog,'rete',{categoryLabel:()=> 'Rete'}).length,3);
  assert.equal(sensorChoices(catalog,'host',{numeric:true}).length,0);
  assert.equal(sensorChoices(catalog,'windows cpu')[0][1][0].key,'cpu.usage');
  assert.deepEqual(sensorChoices(catalog,'unknown'),[]);
  assert.deepEqual(sensorChoices(catalog,'').map(([c])=>c),['cpu','gpu','system']);
  assert.equal(sensorNativeUnit('rpm'),'RPM');
  assert.equal(sensorNativeUnit('percent'),'%');
});
test('readings distinguish zero, text, pending and explicit failure without fabricating values',()=>{
  assert.equal(sensorChoiceReading(catalog[2],{'cpu.usage':{value:0,display:'0%'}}).state,'available');
  assert.equal(sensorChoiceReading(catalog[3],{'system.hostname':{text:'PC',display:'PC'}}).value,'PC');
  assert.equal(sensorChoiceReading(catalog[0],{}).state,'pending');
  assert.equal(sensorChoiceReading(catalog[0],{'gpu.0.fan':{unavailable:'No reply'}}).reason,'No reply');
});
