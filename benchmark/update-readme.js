'use strict';

// Injects the latest benchmark results into the README between the
// <!-- BENCHMARK:START --> / <!-- BENCHMARK:END --> markers. Idempotent.
// Fails loudly if results.json or the markers are missing rather than guessing.

const fs = require('fs');
const path = require('path');
const { toMarkdownTable, metaLine } = require('./report');

const README = path.join(__dirname, '..', 'README.md');
const RESULTS = path.join(__dirname, 'results.json');
const START = '<!-- BENCHMARK:START -->';
const END = '<!-- BENCHMARK:END -->';

function main() {
  if (!fs.existsSync(RESULTS)) {
    throw new Error(`Missing ${RESULTS}. Run the benchmark first (npm run benchmark).`);
  }
  const { meta, rows } = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  const readme = fs.readFileSync(README, 'utf8');

  const startIdx = readme.indexOf(START);
  const endIdx = readme.indexOf(END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`README is missing the ${START} / ${END} markers.`);
  }

  const section = [
    START,
    '',
    `_${metaLine(meta)}_`,
    '',
    toMarkdownTable(rows),
    '',
    'See [`benchmark/`](benchmark/) for the harness and methodology. Numbers come from a',
    'single host (LocalStack Lambda + MySQL in Docker) and illustrate the connection-management',
    'mechanism and relative behavior, not absolute production SLAs.',
    '',
    END
  ].join('\n');

  const updated = readme.slice(0, startIdx) + section + readme.slice(endIdx + END.length);
  fs.writeFileSync(README, updated);
  console.log('README benchmark section updated.');
}

main();
