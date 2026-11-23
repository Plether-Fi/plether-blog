import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { loadEnv } from 'vite';
import { loadContent, description } from '../src/lib/content';
import { normalizeBase } from '../src/lib/settings';

export async function verifyPublicBuild() {
  const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
  const origin = new URL(env.SITE_URL || 'https://blog.plether.com').origin;
  const base = normalizeBase(env.BASE_PATH);
  const { posts, allPosts } = await loadContent(undefined, env.INCLUDE_SAMPLE_POSTS === 'true');
  async function filesIn(directory: string): Promise<string[]> {
    return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
  }
  const files = await filesIn('dist');
  const htmlFiles = files.filter(file => file.endsWith('.html'));
  const sitemap = await readFile('dist/sitemap.xml', 'utf8');
  const rss = await readFile('dist/rss.xml', 'utf8');
  assert.match(await readFile('dist/robots.txt', 'utf8'), /Sitemap:/);
  assert.ok(!files.some(file => /keystatic|\.mdoc$|\.env|images\.json/.test(file)), 'Public build must exclude editor routes and source files.');
  for (const post of allPosts.filter(post => !posts.some(p => p.slug === post.slug))) {
    assert.ok(!files.includes(`dist/posts/${post.slug}/index.html`), `Excluded article ${post.slug} has a page.`);
    assert.ok(!sitemap.includes(`/posts/${post.slug}/`), 'Excluded post leaked into sitemap.');
    assert.ok(!rss.includes(`/posts/${post.slug}/`), 'Excluded post leaked into RSS.');
  }
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    assert.ok(!html.includes('DRAFT_FIXTURE_PRIVATE_CONTENT_DO_NOT_PUBLISH'));
    const $ = load(html);
    assert.equal($('h1').length, 1, `${file} needs exactly one h1.`);
    assert.ok($('title').text().trim(), `${file} is missing its title.`);
    const canonical = $('link[rel="canonical"]').attr('href')!;
    assert.ok(canonical.startsWith(`${origin}${base}`), `Canonical has the wrong origin or base: ${canonical}`);
    for (const element of $('[href], [src]').toArray()) {
      const value = $(element).attr('href') || $(element).attr('src');
      if (!value || value.startsWith('#') || /^(mailto:|tel:|data:)/.test(value)) continue;
      const url = new URL(value, canonical);
      if (url.origin !== origin) continue;
      assert.ok(url.pathname.startsWith(base), `${file}: missing base path in ${value}`);
      const relative = decodeURIComponent(url.pathname.slice(base.length));
      const destination = path.join('dist', relative.endsWith('/') || relative === '' ? `${relative}index.html` : relative);
      assert.ok((await stat(destination).catch(() => null))?.isFile(), `${file}: broken local URL ${value}`);
    }
    for (const image of $('img').toArray()) {
      assert.ok($(image).attr('alt')?.trim(), `${file}: image needs alternative text.`);
    }
    for (const script of $('script[type="application/ld+json"]').toArray()) assert.equal(JSON.parse($(script).text())['@type'], 'BlogPosting');
  }
  for (const post of posts) {
    const file = `dist/posts/${post.slug}/index.html`;
    assert.ok(files.includes(file), `Missing published article: ${post.slug}`);
    const $ = load(await readFile(file, 'utf8'));
    assert.equal($('meta[name="description"]').attr('content'), description(post));
    assert.ok($('meta[property="og:image"]').attr('content')?.endsWith('.jpg'));
    assert.equal($('h1').text(), post.title);
    const schema = JSON.parse($('script[type="application/ld+json"]').text());
    assert.equal(schema.datePublished, post.publishDate);
    assert.ok(sitemap.includes(`/posts/${post.slug}/`));
    assert.ok(rss.includes(`/posts/${post.slug}/`));
  }
  const rssXml = load(rss, { xmlMode: true });
  assert.equal(rssXml('item').length, posts.length);
  const sitemapXml = load(sitemap, { xmlMode: true });
  assert.equal(sitemapXml('urlset').length, 1);
  assert.equal(sitemapXml('loc').filter((_, el) => sitemapXml(el).text().includes('/posts/')).length, posts.length);
  console.log(`Verified ${htmlFiles.length} public pages, ${posts.length} articles, local links, SEO, RSS, sitemap, and draft exclusion (${base}).`);
}

if (process.argv[1]?.endsWith('verify-build.ts')) await verifyPublicBuild();
