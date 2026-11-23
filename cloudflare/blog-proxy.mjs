const publicOrigin = 'https://plether.com';
const publicPath = '/blog/';
const pagesOrigin = 'https://plether-fi.github.io';
const pagesPath = '/plether-blog/';

export async function handleRequest(request, fetchOrigin = fetch) {
  const url = new URL(request.url);
  // The route also matches /blog-prefixed paths; leave those with the main site.
  if (url.hostname !== 'plether.com' || (url.pathname !== '/blog' && !url.pathname.startsWith(publicPath))) {
    return fetchOrigin(request);
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  if (url.protocol !== 'https:' || url.pathname === '/blog') {
    return Response.redirect(`${publicOrigin}${url.pathname === '/blog' ? publicPath : url.pathname}${url.search}`, 308);
  }

  const upstream = new URL(pagesPath, pagesOrigin);
  upstream.pathname = pagesPath + url.pathname.slice(publicPath.length);
  upstream.search = url.search;
  if (!upstream.pathname.startsWith(pagesPath)) return new Response('Invalid path', { status: 400 });

  // Only forward public-content headers, never main-site cookies or credentials.
  const headers = new Headers();
  for (const name of ['accept', 'range', 'if-none-match', 'if-modified-since']) {
    if (request.headers.has(name)) headers.set(name, request.headers.get(name));
  }
  const response = await fetchOrigin(upstream.href, { method: request.method, headers, redirect: 'manual' });
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('set-cookie');
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  const location = responseHeaders.get('location');
  if (location && response.status >= 300 && response.status < 400) {
    const destination = new URL(location, upstream);
    if (destination.origin !== pagesOrigin || !destination.pathname.startsWith(pagesPath)) {
      return new Response('Unexpected origin redirect', { status: 502 });
    }
    responseHeaders.set('location', `${publicOrigin}${publicPath}${destination.pathname.slice(pagesPath.length)}${destination.search}${destination.hash}`);
  }
  if (responseHeaders.get('content-type')?.includes('text/html')) {
    responseHeaders.set('Cache-Control', 'public, max-age=60, s-maxage=60');
  }
  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export default { fetch: request => handleRequest(request) };
