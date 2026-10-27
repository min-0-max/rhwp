import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeStudioStartup } from '../dist/startup-tests/studio-startup.js';

after(() => {
  rmSync(fileURLToPath(new URL('../dist/startup-tests', import.meta.url)), { recursive: true, force: true });
});

function deferred() {
  let resolve;
  const promise = new Promise(accept => { resolve = accept; });
  return { promise, resolve };
}

test('starts WebAssembly while fonts are pending and waits for both', { timeout: 1000 }, async () => {
  const fonts = deferred();
  const wasm = deferred();
  let fontsStarted = false;
  let wasmStarted = false;
  let startupSettled = false;
  const startup = initializeStudioStartup(
    () => { fontsStarted = true; return fonts.promise; },
    () => { wasmStarted = true; return wasm.promise; },
  );
  void startup.then(() => { startupSettled = true; }, () => { startupSettled = true; });

  assert.equal(fontsStarted, true);
  assert.equal(wasmStarted, true);
  wasm.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(startupSettled, false);
  fonts.resolve();
  await startup;
  assert.equal(startupSettled, true);
});

test('waits for WebAssembly to settle after font initialization rejects', { timeout: 1000 }, async () => {
  const wasm = deferred();
  const fontError = new Error('font setup failed');
  let startupSettled = false;
  const startup = initializeStudioStartup(
    () => { throw fontError; },
    () => wasm.promise,
  );
  void startup.then(() => { startupSettled = true; }, () => { startupSettled = true; });

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(startupSettled, false);
  wasm.resolve();
  await assert.rejects(startup, error => error === fontError);
});

test('preserves both startup errors when both operations reject', { timeout: 1000 }, async () => {
  const fontError = new Error('font setup failed');
  const wasmError = new Error('WASM initialization failed');
  let fontsStarted = false;
  let wasmStarted = false;

  await assert.rejects(
    initializeStudioStartup(
      () => { fontsStarted = true; throw fontError; },
      () => { wasmStarted = true; throw wasmError; },
    ),
    error => error instanceof AggregateError
      && error.errors.length === 2
      && error.errors[0] === fontError
      && error.errors[1] === wasmError
      && String(error).includes(fontError.toString())
      && String(error).includes(wasmError.toString()),
  );
  assert.equal(fontsStarted, true);
  assert.equal(wasmStarted, true);
});

test('preserves the original WebAssembly error when fonts succeed', { timeout: 1000 }, async () => {
  const wasmError = new Error('WASM initialization failed');
  await assert.rejects(
    initializeStudioStartup(async () => {}, async () => { throw wasmError; }),
    error => error === wasmError,
  );
});
