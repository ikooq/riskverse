import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const apiBase = process.env.RISKVERSE_API_URL || 'http://127.0.0.1:5173';
const allCases = [
  {
    id: 'forklift-loading',
    file: 'output/ai-evaluation/images/forklift-loading.jpg',
    source: 'Wikimedia Commons · Container loading with forklift at warehouse in Thailand',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Container_loading_with_forklift_at_warehouse_in_Thailand.jpg',
    expected: 'Forklift loading cargo into a container; a worker is visible near the cargo.',
  },
  {
    id: 'aisle-control',
    file: 'output/ai-evaluation/images/aisle-control.jpg',
    source: 'Wikimedia Commons · Ikea Brooklyn warehouse aisles',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ikea-Brooklyn-Warehouse-Aisles.jpg',
    expected: 'Long warehouse aisle with stocked shelves and people; no obvious vehicle conflict in the central aisle.',
  },
];
const selectedCase = process.argv[2];
const cases = selectedCase ? allCases.filter(({ id }) => id === selectedCase) : allCases;
if (!cases.length) throw new Error(`Unknown evaluation case: ${selectedCase}`);

const healthResponse = await fetch(`${apiBase}/api/health`);
if (!healthResponse.ok) throw new Error(`Health check failed: HTTP ${healthResponse.status}`);
const health = await healthResponse.json();
if (!health.ready || health.provider !== 'gemini') {
  throw new Error(`Expected a ready Gemini API; received ${JSON.stringify({ ready: health.ready, provider: health.provider })}`);
}

const results = [];
for (const testCase of cases) {
  const file = resolve(testCase.file);
  const bytes = await readFile(file);
  const mime = extname(file).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
  const started = performance.now();
  const response = await fetch(`${apiBase}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image: `data:${mime};base64,${bytes.toString('base64')}` }),
  });
  const durationMs = Math.round(performance.now() - started);
  const body = await response.json();
  if (!response.ok) {
    results.push({ id: testCase.id, source: testCase.source, sourceUrl: testCase.sourceUrl, expected: testCase.expected, httpStatus: response.status, durationMs, error: body.error || 'AI request failed' });
    continue;
  }
  results.push({
    id: testCase.id,
    source: testCase.source,
    sourceUrl: testCase.sourceUrl,
    expected: testCase.expected,
    httpStatus: response.status,
    durationMs,
    provider: body.provider,
    model: body.model,
    analyzedAt: body.analyzedAt,
    report: body.report,
  });
}

const output = { evaluatedAt: new Date().toISOString(), provider: health.provider, model: health.model, apiBase, cases: results };
const outPath = resolve(process.env.RISKVERSE_EVAL_OUTPUT || 'output/ai-evaluation/results.json');
await mkdir(resolve('output/ai-evaluation'), { recursive: true });
await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
const summary = results.map(({ id, httpStatus, durationMs, model, report, error }) => ({
  id,
  httpStatus,
  durationMs,
  model,
  observations: report?.observations?.length ?? 0,
  concerns: report?.observations?.filter((item) => item.concern === 'potential_hazard').length ?? 0,
  summary: report?.summary,
  limitations: report?.limitations,
  error,
}));
console.log(JSON.stringify({ evaluatedAt: output.evaluatedAt, provider: output.provider, model: output.model, resultsPath: outPath, cases: summary }, null, 2));
