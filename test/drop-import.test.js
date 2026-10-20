import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ShareDialog, MAX_IMPORT_BYTES, firstDroppedFile } from '../src/share.js';

// A stand-in for a DOM element: records listeners so a test can fire them.
function fakeEl(extra = {}) {
  const handlers = {};
  return {
    ...extra,
    addEventListener(type, fn) {
      (handlers[type] ??= []).push(fn);
    },
    dispatch(type, event = {}) {
      for (const fn of handlers[type] ?? []) fn(event);
    },
  };
}

// An Event carrying a dataTransfer, as drag events do in a browser.
class DragEv extends Event {
  constructor(type, dataTransfer) {
    super(type, { cancelable: true });
    this.dataTransfer = dataTransfer;
  }
}

const files = (...names) => ({ types: ['Files'], files: names.map((name) => ({ name })) });
const text = { types: ['text/plain'], files: [] };

test('a drop uses only the first file, and a drag without files gives none', () => {
  const first = { name: 'glider.rle' };
  const second = { name: 'gun.cells' };
  assert.equal(firstDroppedFile({ files: [first, second] }), first);
  assert.equal(firstDroppedFile({ files: [], getData: () => 'https://example.com/glider.rle' }), null, 'text or a link');
  assert.equal(firstDroppedFile(null), null, 'no data transfer at all');
});

test('a chosen or dropped file is refused by size before it is read', async () => {
  let read = false;
  const huge = { size: MAX_IMPORT_BYTES + 1, text: async () => { read = true; return ''; } };
  let parsed = false;
  const ctx = { el: { text: { value: 'O' } }, actions: { parseImport: () => { parsed = true; return { ok: true }; } } };
  const result = await ShareDialog.prototype.checkImport.call(ctx, huge);
  assert.equal(result.ok, false);
  assert.match(result.message, /That file is 257 KiB; the limit is 256 KiB\./);
  assert.match(result.message, /Nothing was imported and your board is unchanged\.$/);
  assert.equal(read, false, 'not read');
  assert.equal(parsed, false, 'not parsed');
});

test('a valid dropped file is read and parsed; invalid or unreadable content is refused', async () => {
  const seen = [];
  const actions = {
    parseImport: (source) => {
      seen.push(source);
      return source === 'bad' ? { ok: false, message: 'Not a pattern.' } : { ok: true, pattern: { cells: [] } };
    },
  };
  const ctx = { el: { text: { value: 'pasted' } }, actions };

  const good = await ShareDialog.prototype.checkImport.call(ctx, { size: 3, text: async () => 'ok' });
  assert.equal(good.ok, true);
  assert.deepEqual(seen, ['ok'], 'the file text is parsed, not the pasted text');

  const bad = await ShareDialog.prototype.checkImport.call(ctx, { size: 3, text: async () => 'bad' });
  assert.deepEqual(bad, { ok: false, message: 'Not a pattern. Nothing was imported and your board is unchanged.' });

  const unreadable = await ShareDialog.prototype.checkImport.call(ctx, { size: 3, text: async () => { throw new Error('locked'); } });
  assert.match(unreadable.message, /^The file could not be read\. Nothing was imported/);
});

test('the drop indicator shows for file drags only and hides when the drag leaves or drops', () => {
  const root = new EventTarget();
  const dropped = [];
  const ctx = { el: { dropTarget: { hidden: true } }, importDropped: (file) => dropped.push(file) };
  ShareDialog.prototype.bindDrop.call(ctx, root);
  const { dropTarget } = ctx.el;

  const text1 = new DragEv('dragenter', text);
  root.dispatchEvent(text1);
  assert.equal(dropTarget.hidden, true, 'text drag ignored');
  assert.equal(text1.defaultPrevented, false);

  const enter = new DragEv('dragenter', files('a.rle'));
  root.dispatchEvent(enter);
  assert.equal(dropTarget.hidden, false);
  assert.equal(enter.defaultPrevented, true);

  root.dispatchEvent(new DragEv('dragenter', files('a.rle'))); // onto a child element
  root.dispatchEvent(new DragEv('dragleave', files('a.rle'))); // leaves the child
  assert.equal(dropTarget.hidden, false, 'still over the page');
  root.dispatchEvent(new DragEv('dragleave', files('a.rle')));
  assert.equal(dropTarget.hidden, true, 'left the page');

  const over = new DragEv('dragover', files('a.rle'));
  root.dispatchEvent(over);
  assert.equal(over.defaultPrevented, true, 'dragover allows the drop');
  assert.equal(over.dataTransfer.dropEffect, 'copy');

  root.dispatchEvent(new DragEv('dragenter', files('a.rle')));
  const drop = new DragEv('drop', files('glider.rle', 'gun.cells'));
  root.dispatchEvent(drop);
  assert.equal(drop.defaultPrevented, true);
  assert.equal(dropTarget.hidden, true, 'hidden on drop');
  assert.deepEqual(dropped.map((f) => f.name), ['glider.rle'], 'only the first file goes on');

  const textDrop = new DragEv('drop', text);
  root.dispatchEvent(textDrop);
  assert.equal(textDrop.defaultPrevented, false);
  assert.equal(dropped.length, 1, 'a text drop imports nothing');
});

// The Cancel and close behaviour, with the dialog and buttons faked.
function dialogWithCancel(pending) {
  const names = ['open', 'close', 'message', 'error', 'saved', 'save', 'loadSaved', 'exportRle', 'importOpen', 'link', 'fallback', 'field', 'file', 'text', 'review', 'back', 'reviewTitle', 'reviewPreview', 'reviewMeta', 'reviewLoad', 'reviewStamp', 'reviewCancel', 'dropTarget'];
  const el = Object.fromEntries(names.map((n) => [n, fakeEl({ focus() { this.focused = true; } })]));
  el.dialog = fakeEl({ closed: 0, close() { this.closed += 1; } });
  const views = [];
  const ctx = { el, actions: {}, pending, keepFocus: false, showView: (name) => views.push(name), clear() {} };
  ShareDialog.prototype.bind.call(ctx);
  return { ctx, el, views };
}

test('Cancel closes the dialog for a link or a dropped file, and returns to the import form otherwise', () => {
  for (const from of ['link', 'drop']) {
    const { ctx, el, views } = dialogWithCancel({ from, pattern: {}, name: 'x' });
    el.reviewCancel.dispatch('click');
    assert.equal(el.dialog.closed, 1, `${from}: dialog closed`);
    assert.deepEqual(views, [], `${from}: no view change`);
    assert.equal(ctx.pending, null);
  }
  for (const from of ['import', 'other']) {
    const { el, views } = dialogWithCancel({ from, pattern: {}, name: 'x' });
    el.reviewCancel.dispatch('click');
    assert.equal(el.dialog.closed, 0, `${from}: dialog stays open`);
    assert.deepEqual(views, ['import'], `${from}: back to the import form`);
  }
});

test('closing the dialog returns focus to the Share & save button', () => {
  const { el } = dialogWithCancel(null);
  el.dialog.dispatch('close');
  assert.equal(el.open.focused, true);
});

test('the drop indicator is hidden by a [hidden] rule that beats its display:grid', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.drop-target\[hidden\]\s*\{\s*display:\s*none;?\s*\}/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<div class="drop-target" id="drop-target" hidden>/);
});
