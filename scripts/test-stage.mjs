#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const input = process.argv[2];

if (!input || !/^\d+$/.test(input)) {
  console.error(
    'Uso: npm run test:p -- <numero-da-etapa>   (ex.: npm run test:p -- 3)',
  );
  process.exit(1);
}

const stage = input.padStart(2, '0');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

// Encontra qualquer spec cujo caminho contenha a etapa: p_00, p_01, p_02/, p_03/...
const stagePattern = new RegExp(`(^|[\\\\/])p_${stage}([^0-9]|$)`);
const files = walk('tests').filter(
  (file) => file.endsWith('.spec.ts') && stagePattern.test(file),
);

if (files.length === 0) {
  console.error(
    `Nenhum teste para a etapa ${stage} (procurei por p_${stage} em tests/).`,
  );
  process.exit(1);
}

const isPerf = (file) => file.split(/[\\/]/).includes('perf');
const run = (targets, config) => {
  if (targets.length === 0) {
    return 0;
  }
  const args = [
    'vitest',
    'run',
    ...(config ? ['--config', config] : []),
    ...targets,
  ];
  console.log(`> npx ${args.join(' ')}\n`);
  return spawnSync('npx', args, { stdio: 'inherit' }).status ?? 1;
};

let exitCode = run(files.filter((file) => !isPerf(file)));
exitCode = run(files.filter(isPerf), 'vitest.perf.config.ts') || exitCode;

process.exit(exitCode);
