import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPreset } from '../src/patterns.js';

// Sparse, unbounded B3/S23 simulation; this does not wrap cells at board edges.
function runUnbounded(preset, generations) {
  let live = new Set(preset.cells.map(([x, y]) => `${x},${y}`));
  for (let generation = 0; generation < generations; generation++) {
    const neighbors = new Map();
    for (const key of live) {
      const [x, y] = key.split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const neighbor = `${x + dx},${y + dy}`;
        neighbors.set(neighbor, (neighbors.get(neighbor) || 0) + 1);
      }
    }
    const next = new Set();
    for (const [key, count] of neighbors) {
      if (count === 3 || (count === 2 && live.has(key))) next.add(key);
    }
    live = next;
  }
  return [...live].map((key) => key.split(',').map(Number));
}

function normalized(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => `${x - minX},${y - minY}`).sort().join(' ');
}

function origin(cells) {
  return [Math.min(...cells.map(([x]) => x)), Math.min(...cells.map(([, y]) => y))];
}

test('MWSS and HWSS move two cells left after four generations on an unbounded board', () => {
  for (const [id, population] of [['mwss', 11], ['hwss', 13]]) {
    const preset = getPreset(id);
    assert.ok(preset, `${id} preset exists`);
    assert.equal(preset.category, 'spaceship');
    assert.equal(preset.period, 4);
    assert.equal(preset.cells.length, population);

    const after = runUnbounded(preset, 4);
    assert.equal(normalized(after), normalized(preset.cells), `${id} repeats after 4`);
    assert.deepEqual(origin(after), [origin(preset.cells)[0] - 2, origin(preset.cells)[1]], `${id} moves two cells left`);
  }
});
