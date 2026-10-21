import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickImportSource } from '../src/share.js';

test('the most recently edited import source wins', () => {
  const file = { name: 'pattern.rle', text: async () => 'bo?$3o!' };
  const text = 'x = 3, y = 3\nbo$2bo$3o!';

  assert.deepEqual(pickImportSource(file, text, 'text'), { type: 'text', value: text });
  assert.deepEqual(pickImportSource(file, text, 'file'), { type: 'file', value: file });
  assert.deepEqual(pickImportSource(null, text, 'file'), { type: 'text', value: text });
});
