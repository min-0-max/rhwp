import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateProgressMessage } from '../src/ui/load-progress.ts';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

function message(visible: boolean, observedOptions?: CheckVisibilityOptions[]) {
  return {
    textContent: '',
    checkVisibility: (options?: CheckVisibilityOptions) => {
      if (observedOptions) observedOptions.push(options ?? {});
      return visible;
    },
  } satisfies Parameters<typeof updateProgressMessage>[0];
}

test('updates hidden progress text without waiting for a paint', { timeout: 5000 }, async () => {
  const visibilityOptions: CheckVisibilityOptions[] = [];
  const target = message(false, visibilityOptions);
  let waitCount = 0;

  await updateProgressMessage(target, 'Loading document', async () => {
    waitCount += 1;
  });

  assert.equal(target.textContent, 'Loading document');
  assert.equal(waitCount, 0, 'hidden progress must not block document loading');
  assert.deepEqual(visibilityOptions, [{ checkOpacity: true, checkVisibilityCSS: true }]);
});

test('keeps the existing paint wait while progress text is visible', { timeout: 5000 }, async () => {
  const target = message(true);
  let openPaintGate: (() => void) | undefined;
  let completed = false;
  const paintGate = new Promise<void>(resolve => { openPaintGate = resolve; });

  const update = updateProgressMessage(target, 'Loading document', () => paintGate).then(() => {
    completed = true;
  });

  assert.equal(target.textContent, 'Loading document');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, false, 'visible progress must wait for the paint gate');
  assert.ok(openPaintGate);
  openPaintGate();
  await update;
  assert.equal(completed, true);
});

test('reports a visible progress paint-wait failure to its caller', { timeout: 5000 }, async () => {
  const target = message(true);
  const failure = new Error('paint wait failed');

  await assert.rejects(
    updateProgressMessage(target, 'Loading document', async () => { throw failure; }),
    error => error === failure,
  );
});

test('the compact embedded CSS rule hides the status bar containing progress', { timeout: 5000 }, () => {
  const responsive = readFileSync(join(rootDir, 'src/styles/responsive.css'), 'utf8');
  const html = readFileSync(join(rootDir, 'index.html'), 'utf8');
  const statusBar = html.match(/<footer id="status-bar">([\s\S]*?)<\/footer>/)?.[1];
  assert.ok(statusBar, 'the status bar footer must exist');
  assert.match(statusBar, /<span id="sb-message"/);
  assert.match(
    responsive,
    /@media \(max-height: 500px\) and \(max-width: 767px\)\s*\{[\s\S]*?#status-bar\s*\{\s*display:\s*none;/,
  );
});
