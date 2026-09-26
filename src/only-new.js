// Remembers which posts were already checked, so you never get the same gig twice
// and never pay the AI twice for it.
// NOTE: n8n only saves this memory for automatic (production) runs. When you click
// "Test workflow" by hand, everything counts as new – that's expected.
const cfg = $('Config').first().json;
const memory = $getWorkflowStaticData('global');
memory.seen = memory.seen || {};

// Forget entries older than 30 days so the memory stays small.
const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
for (const [key, ts] of Object.entries(memory.seen)) {
  if (ts < cutoff) delete memory.seen[key];
}

const fresh = [];
const seenThisRun = new Set();
for (const item of $input.all()) {
  const key = item.json.link;
  if (memory.seen[key] || seenThisRun.has(key)) continue;
  seenThisRun.add(key);
  fresh.push(item);
}

// Newest first, then apply the cost guard. Posts beyond the limit are NOT marked
// as seen, so the next run picks them up.
fresh.sort((a, b) => String(b.json.postedAt || '').localeCompare(String(a.json.postedAt || '')));
const batch = fresh.slice(0, cfg.maxAiChecksPerRun || 15);
for (const item of batch) memory.seen[item.json.link] = Date.now();

return batch.map((item) => ({ json: item.json }));
