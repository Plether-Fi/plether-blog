import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const editor = args.includes('--editor');
const forwarded = args.filter(arg => arg !== '--editor');
if (editor) forwarded.push('--mode', 'editor');
// Astro tracks one dev server per root. The editor intentionally runs beside it.
if (editor && args[0] === 'dev') forwarded.push('--ignore-lock');
const astroPackage = require.resolve('astro/package.json');
const bin = require(astroPackage).bin.astro;
const child = spawn(process.execPath, [path.resolve(path.dirname(astroPackage), bin), ...forwarded], {
  stdio: 'inherit', env: {
    ...process.env, ASTRO_TELEMETRY_DISABLED: '1',
    BUILD_TARGET: editor ? 'editor' : 'public',
    KEYSTATIC_LOCAL_MODE: args[0] === 'dev' ? 'true' : 'false',
  },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
