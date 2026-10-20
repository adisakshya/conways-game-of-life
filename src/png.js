// The board as a PNG image: the whole board at a fixed scale, in the theme's board
// and cell colours, with no gridlines, ghost or hover. boardToPixels is pure; only
// boardToPNG touches a canvas to encode the result.

export const PNG_SCALE = 4;

// The theme colours are #rgb, #rrggbb or rgb(r, g, b). Anything else is refused.
export function parseColor(value) {
  const text = String(value).trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(text);
  if (rgb) return rgb.slice(1, 4).map(Number);
  throw new TypeError(`Unsupported colour: ${text}`);
}

// RGBA pixels for the whole board, width × height × scale. A blank board gives a
// blank image of the board colour. Reads the cells only; nothing is changed.
export function boardToPixels(engine, colors, scale = PNG_SCALE) {
  const width = engine.width * scale;
  const height = engine.height * scale;
  const board = parseColor(colors.board);
  const cell = parseColor(colors.cell);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / scale) * engine.width;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = engine.cells[row + Math.floor(x / scale)] ? cell : board;
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

// Encodes the board as a PNG Blob. Rejects if the browser cannot encode it.
export function boardToPNG(engine, colors, scale = PNG_SCALE) {
  const { width, height, data } = boardToPixels(engine, colors, scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The browser could not encode the image.'))), 'image/png');
  });
}
