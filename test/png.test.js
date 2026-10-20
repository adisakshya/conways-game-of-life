import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.js';
import { boardToPixels } from '../src/png.js';

const LIGHT = { board: '#fbfdfa', cell: '#166534' };
const DARK = { board: 'rgb(21, 26, 24)', cell: '#c3f56b' };
const RGB = { [LIGHT.board]: [251, 253, 250], [LIGHT.cell]: [22, 101, 52], [DARK.board]: [21, 26, 24], [DARK.cell]: [195, 245, 107] };

test('the PNG pixels show exactly the live cells at the chosen scale, in either theme', () => {
  const board = new Engine(3, 3);
  board.set(1, 0, 1);
  board.set(2, 2, 1);
  for (const colors of [LIGHT, DARK]) {
    const { width, height, data } = boardToPixels(board, colors, 2);
    assert.equal(width, 6);
    assert.equal(height, 6);
    assert.equal(data.length, width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const alive = board.get(Math.floor(x / 2), Math.floor(y / 2)) === 1;
        const want = RGB[alive ? colors.cell : colors.board];
        assert.deepEqual([...data.slice(i, i + 4)], [...want, 255], `pixel ${x},${y} ${alive ? 'live' : 'dead'}`);
      }
    }
  }
  // A blank board still exports: every pixel is the board colour.
  const blank = boardToPixels(new Engine(3, 3), LIGHT, 4);
  assert.equal(blank.width, 12);
  assert.equal(blank.height, 12);
  for (let i = 0; i < blank.data.length; i += 4) assert.deepEqual([...blank.data.slice(i, i + 4)], [...RGB[LIGHT.board], 255]);
});
