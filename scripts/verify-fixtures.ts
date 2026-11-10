import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { verifyPublicBuild } from './verify-build';

function run(args: string[], env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', ...env } });
  if (result.status !== 0) throw new Error(`Command failed: node ${args.join(' ')}`);
}

const fixtureEnv = { SITE_URL: 'https://Example.github.io', BASE_PATH: '/plether-blog/', INCLUDE_SAMPLE_POSTS: 'true', PAGES_CUSTOM_DOMAIN: '', CONTENT_ROOT: 'tests/fixtures' };
run(['scripts/astro.mjs', 'build'], fixtureEnv);
const oldEnv = { ...process.env };
Object.assign(process.env, fixtureEnv);
await verifyPublicBuild();
assert.match(await readFile('dist/page/2/index.html', 'utf8'), /Page 2 of 2/);
assert.match(await readFile('dist/category/research/index.html', 'utf8'), /Research articles/);
Object.keys(fixtureEnv).forEach(key => { if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key]; });

// Placeholder verifies server bundling only; it does not claim a working Cloud connection.
run(['scripts/astro.mjs', 'build', '--editor'], { PUBLIC_KEYSTATIC_PROJECT: 'build-check/editor', EDITOR_URL: 'https://editor.example.com' });
const editorFiles = await readdir('dist-editor');
assert.ok(!editorFiles.includes('posts') && !editorFiles.includes('category'));
assert.ok(!editorFiles.includes('rss.xml') && !editorFiles.includes('sitemap.xml'));
assert.ok((await readFile('dist-editor/robots.txt', 'utf8')).includes('Disallow: /'));
const functions = await readdir('.netlify/v1/functions');
assert.ok(functions.length > 0, 'Netlify editor function was not generated.');
console.log('Verified repository-path publishing, pagination, categories, and the isolated Netlify editor build.');

// Leave the default public artifact ready for deployment, with samples disabled.
run(['scripts/astro.mjs', 'build'], { INCLUDE_SAMPLE_POSTS: 'false' });
