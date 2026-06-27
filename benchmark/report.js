'use strict';

// Shared formatting so bench.js (results.md) and update-readme.js (README section)
// always render the same table.

function toMarkdownTable(rows) {
  const header = '| Driver | Concurrency | Success rate | Throughput (inv/s) | p50 (ms) | p95 (ms) | p99 (ms) | Peak conns | Failures |';
  const sep = '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |';
  const body = rows.map((r) => {
    const fails = r.failed
      ? Object.entries(r.failuresByCode).map(([c, n]) => `${c}×${n}`).join(', ')
      : '—';
    return `| ${r.driver} | ${r.concurrency} | ${r.successRate}% | ${r.throughput} | ${r.p50} | ${r.p95} | ${r.p99} | ${r.peakConnections} | ${fails} |`;
  }).join('\n');
  return `${header}\n${sep}\n${body}`;
}

function metaLine(meta) {
  return `Generated: ${meta.generatedAt} · MySQL \`max_connections=${meta.maxConnections}\` · ` +
    `query \`SELECT SLEEP(${meta.querySleepSeconds})\` · ${meta.durationMsPerLevel / 1000}s per level · Node ${meta.node}`;
}

module.exports = { toMarkdownTable, metaLine };
