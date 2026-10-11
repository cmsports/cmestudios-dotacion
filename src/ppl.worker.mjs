// Corre el PPL de una comuna en segundo plano, para que la pantalla no se congele mientras HiGHS resuelve.
import loadHighs from 'highs';
import wasmUrl from 'highs/runtime?url';
import { buildData, solve } from './ppl.mjs';

let highs;
self.onmessage = async ({ data }) => {
  const { state, ids, settings, params, part } = data;
  try {
    highs ??= await loadHighs({ locateFile: () => wasmUrl });
    const D = buildData(state, new Set(ids), settings);
    const result = solve(highs, D, params, phase => self.postMessage({ type: 'phase', part, phase }), part);
    self.postMessage({ type: 'done', part, result });
  } catch (error) {
    self.postMessage({ type: 'error', part, message: String(error?.message || error) });
  }
};
