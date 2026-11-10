import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import netlify from '@astrojs/netlify';
import { normalizeBase } from './src/lib/settings';
import { prepareAssets } from './src/lib/assets';

const editor = process.env.BUILD_TARGET === 'editor';
const localEditor = process.env.KEYSTATIC_LOCAL_MODE === 'true';
const env = { ...loadEnv(editor ? 'editor' : 'production', process.cwd(), ''), ...process.env };
const project = env.PUBLIC_KEYSTATIC_PROJECT?.trim();
if (editor && !localEditor && !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(project ?? '')) {
  throw new Error('Editor builds require PUBLIC_KEYSTATIC_PROJECT=team/project. Copy .env.editor.example to .env.editor or set it in Netlify.');
}
const origin = env.SITE_URL || 'https://blog.plether.com';
const url = new URL(origin);
if (!['https:', 'http:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) throw new Error('SITE_URL must be an HTTP(S) origin without a path. Use BASE_PATH for a repository path.');
process.env.INCLUDE_SAMPLE_POSTS = env.INCLUDE_SAMPLE_POSTS ?? (localEditor ? 'true' : 'false');
process.env.PAGES_CUSTOM_DOMAIN = env.PAGES_CUSTOM_DOMAIN ?? '';
export default defineConfig({
  site: editor ? env.EDITOR_URL || env.URL || 'https://editor.plether.com' : origin,
  base: editor ? '/' : normalizeBase(env.BASE_PATH),
  srcDir: editor ? './editor' : './src',
  publicDir: editor ? './static' : './.generated/public',
  outDir: editor ? './dist-editor' : './dist',
  cacheDir: editor ? './.astro/editor' : './.astro/public',
  output: editor ? 'server' : 'static',
  adapter: editor ? netlify() : undefined,
  // Keystatic calls extensionless API URLs without trailing slashes.
  trailingSlash: editor ? 'ignore' : 'always',
  integrations: editor ? [react(), keystatic()] : [{
    name: 'plether-published-assets',
    hooks: {
      'astro:config:setup': async ({ updateConfig }) => {
        await prepareAssets();
        updateConfig({ vite: { plugins: [{
          name: 'plether-content-reload',
          configureServer(server) {
            server.watcher.add(['content', 'static']);
            let timer: ReturnType<typeof setTimeout>;
            server.watcher.on('all', (_event, file) => {
              if (!/\/(content|static)\//.test(file.replaceAll('\\', '/'))) return;
              clearTimeout(timer);
              timer = setTimeout(async () => {
                try { await prepareAssets(); server.ws.send({ type: 'full-reload' }); }
                catch (error) { server.config.logger.error(String(error)); }
              }, 150);
            });
          },
        }] } });
      },
    },
  }],
  vite: { define: {
    'import.meta.env.PUBLIC_KEYSTATIC_LOCAL': JSON.stringify(localEditor ? 'true' : 'false'),
    'import.meta.env.PUBLIC_KEYSTATIC_PROJECT': JSON.stringify(project || ''),
  } },
  devToolbar: { enabled: false },
});
