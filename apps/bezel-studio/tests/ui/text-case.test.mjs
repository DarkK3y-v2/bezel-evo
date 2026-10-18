import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTextCase, TEXT_CASES } from '../../src/text-case.js';

test('Unicode case modes preserve source, punctuation, word boundaries and whitespace', () => {
  const source = '  «È GIÀ LUNEDÌ» — música NOVA\nhello-world';
  assert.equal(applyTextCase(source), source);
  assert.equal(applyTextCase('straße è già', 'upper'), 'STRASSE È GIÀ');
  assert.equal(applyTextCase('MÚSICA È GIÀ', 'lower'), 'música è già');
  assert.equal(applyTextCase(source, 'sentence'), '  «È già lunedì» — música nova\nhello-world');
  assert.equal(applyTextCase(source, 'title'), '  «È Già Lunedì» — Música Nova\nHello-World');
  assert.equal(applyTextCase("e\u0301COLE l'ACQUA", 'title'), "E\u0301cole L'acqua");
  for (const mode of TEXT_CASES) assert.equal(applyTextCase('', mode), '');
});
