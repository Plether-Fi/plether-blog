import { spawnSync } from 'node:child_process';

const { CACHED_COMMIT_REF: previous, COMMIT_REF: current } = process.env;
// Netlify interprets exit 0 as skip and exit 1 as build.
if (!previous || !current) process.exit(1);
const result = spawnSync('git', ['diff', '--quiet', previous, current, '--',
  'astro.config.ts', 'keystatic.config.ts', 'package.json', 'package-lock.json',
  'netlify.toml', 'tsconfig.json', '.nvmrc', 'editor/', 'src/', 'static/', 'scripts/',
], { stdio: 'inherit' });
process.exit(result.status === 0 ? 0 : 1);
