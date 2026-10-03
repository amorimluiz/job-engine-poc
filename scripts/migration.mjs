#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const [command, title] = process.argv.slice(2);
const COMMANDS = ['generate', 'create'];

if (!COMMANDS.includes(command) || !title) {
  console.error('Uso: npm run typeorm:migration:<generate|create> -- <Titulo>');
  console.error('  npm run typeorm:migration:generate -- AddedJobIndexes');
  console.error('  npm run typeorm:migration:create   -- AddedJobIndexes');
  process.exit(1);
}

// Todas as migrations ficam em src/db/migrations; o TypeORM adiciona o
// timestamp no nome do arquivo.
const target = `src/db/migrations/${title}`;
const needsDataSource = command === 'generate';

const args = [
  'typeorm-ts-node-commonjs',
  `migration:${command}`,
  ...(needsDataSource ? ['-d', 'src/db/data-source.ts'] : []),
  target,
];

console.log(`> npx ${args.join(' ')}\n`);
process.exit(spawnSync('npx', args, { stdio: 'inherit' }).status ?? 1);
