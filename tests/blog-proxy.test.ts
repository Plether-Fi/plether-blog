import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../cloudflare/blog-proxy.mjs';

test('blog proxy maps article and asset paths to Pages without forwarding credentials', async () => {
  for (const path of ['posts/arbitrum-node/', 'media/banner.webp', '_astro/style.css', 'sitemap.xml', 'rss.xml']) {
    const response = await handleRequest(new Request(`https://plether.com/blog/${path}?review=1`, {
      headers: { Cookie: 'session=private', Authorization: 'Bearer private', Referer: 'https://plether.com/private', Accept: '*/*', Range: 'bytes=0-99' },
    }), async (url, init) => {
      assert.equal(url, `https://plether-fi.github.io/plether-blog/${path}?review=1`);
      assert.equal(init?.redirect, 'manual');
      const forwardedHeaders = new Headers(init?.headers);
      assert.equal(forwardedHeaders.get('cookie'), null);
      assert.equal(forwardedHeaders.get('authorization'), null);
      assert.equal(forwardedHeaders.get('referer'), null);
      assert.equal(forwardedHeaders.get('range'), 'bytes=0-99');
      return new Response('public content', { headers: { 'Set-Cookie': 'upstream=value' } });
    });
    assert.equal(await response.text(), 'public content');
    assert.equal(response.headers.get('set-cookie'), null);
  }
});

test('canonical redirects preserve query parameters without fetching the origin', async () => {
  for (const [input, output] of [
    ['https://plether.com/blog?review=1', 'https://plether.com/blog/?review=1'],
    ['http://plether.com/blog/posts/test/', 'https://plether.com/blog/posts/test/'],
  ]) {
    const response = await handleRequest(new Request(input), () => { throw new Error('Unexpected fetch'); });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), output);
  }
});

test('Pages trailing-slash redirects stay on the public blog; other origins are rejected', async () => {
  const response = await handleRequest(new Request('https://plether.com/blog/posts/test'), async () =>
    new Response(null, { status: 301, headers: { Location: 'https://plether-fi.github.io/plether-blog/posts/test/?review=1' } }));
  assert.equal(response.headers.get('location'), 'https://plether.com/blog/posts/test/?review=1');
  const unexpected = await handleRequest(new Request('https://plether.com/blog/'), async () =>
    new Response(null, { status: 302, headers: { Location: 'https://example.com/' } }));
  assert.equal(unexpected.status, 502);
});

test('unrelated main-site paths pass through and writes never reach Pages', async () => {
  for (const path of ['/', '/blogger', '/blog-post', '/manifesto']) {
    const request = new Request(`https://plether.com${path}`);
    const response = await handleRequest(request, async forwarded => {
      assert.equal(forwarded, request);
      return new Response('main website');
    });
    assert.equal(await response.text(), 'main website');
  }
  const response = await handleRequest(new Request('https://plether.com/blog/posts/test/', { method: 'POST' }), () => { throw new Error('Unexpected fetch'); });
  assert.equal(response.status, 405);
});

test('missing pages remain 404 and HEAD responses have no body', async () => {
  const missing = await handleRequest(new Request('https://plether.com/blog/missing/'), async () =>
    new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/html' } }));
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('cache-control'), 'public, max-age=60, s-maxage=60');
  const head = await handleRequest(new Request('https://plether.com/blog/', { method: 'HEAD' }), async (_url, init) => {
    assert.equal(init?.method, 'HEAD');
    return new Response(null, { headers: { 'Content-Length': '123' } });
  });
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('content-length'), '123');
});
