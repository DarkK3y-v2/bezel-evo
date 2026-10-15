import test from 'node:test';
import assert from 'node:assert/strict';
import { joinWords, joinsPrevious, sentenceParts } from '../../src/sentence.js';

test('a template splits into its words and slots, in order', () => {
  assert.deepEqual(sentenceParts('Show {last} {duration} {durationUnit}, with one point every {interval} {intervalUnit}'), [
    { word: 'Show' }, { slot: 'last' }, { slot: 'duration' }, { slot: 'durationUnit' },
    { word: ', with one point every' }, { slot: 'interval' }, { slot: 'intervalUnit' },
  ]);
});

test('a template may start or end with a slot, or hold no slot at all', () => {
  assert.deepEqual(sentenceParts('{n} points'), [{ slot: 'n' }, { word: 'points' }]);
  assert.deepEqual(sentenceParts('every {n}'), [{ word: 'every' }, { slot: 'n' }]);
  assert.deepEqual(sentenceParts('  just words  '), [{ word: 'just words' }]);
  assert.deepEqual(sentenceParts(''), []);
});

test('a word starting with punctuation sticks to the token before it', () => {
  assert.equal(joinsPrevious(', with one point every'), true);
  assert.equal(joinsPrevious('.'), true);
  assert.equal(joinsPrevious('with'), false);
  assert.equal(joinsPrevious(''), false);
});

test('words that follow each other read as one, tokens kept between them', () => {
  const token = { token: 'n' };
  assert.deepEqual(joinWords(['Show', 'the last', token, 'hours', ', with', token]), ['Show the last', token, 'hours, with', token]);
  assert.deepEqual(joinWords([token, token]), [token, token]);
  assert.deepEqual(joinWords([]), []);
});
