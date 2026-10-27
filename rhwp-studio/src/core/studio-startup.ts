export async function initializeStudioStartup(
  loadCriticalFonts: () => Promise<void>,
  initializeWasm: () => Promise<void>,
): Promise<void> {
  const start = (operation: () => Promise<void>): Promise<void> => {
    try {
      return Promise.resolve(operation());
    } catch (error) {
      return Promise.reject(error);
    }
  };
  const [fonts, wasm] = await Promise.allSettled([
    start(loadCriticalFonts),
    start(initializeWasm),
  ]);
  if (fonts.status === 'rejected' && wasm.status === 'rejected') {
    const describe = (error: unknown): string => {
      try {
        return String(error);
      } catch {
        return '[unprintable error]';
      }
    };
    throw new AggregateError(
      [fonts.reason, wasm.reason],
      `Critical startup failed: web font loading: ${describe(fonts.reason)}; `
        + `WebAssembly initialization: ${describe(wasm.reason)}`,
    );
  }
  if (fonts.status === 'rejected') throw fonts.reason;
  if (wasm.status === 'rejected') throw wasm.reason;
}
