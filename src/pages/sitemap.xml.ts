import type { APIRoute } from 'astro';
import { loadContent, paginate } from '../lib/content';
import { absoluteUrl, collectionPath, site as settings } from '../lib/settings';
import { xml } from '../lib/xml';

export const GET: APIRoute = async ({ site }) => {
  const { posts } = await loadContent();
  const routes: { path: string; modified?: string }[] = Array.from({ length: paginate(posts).total }, (_, i) => ({ path: collectionPath(undefined, i + 1) }));
  for (const category of settings.categories) {
    const filtered = posts.filter(p => p.category === category);
    for (let page = 1; page <= paginate(filtered).total; page++) routes.push({ path: collectionPath(category, page) });
  }
  routes.push(...posts.map(post => ({ path: `posts/${post.slug}/`, modified: post.updatedDate || post.publishDate })));
  const urls = routes.map(route => `<url><loc>${xml(absoluteUrl(route.path, site!, import.meta.env.BASE_URL))}</loc>${route.modified ? `<lastmod>${route.modified}</lastmod>` : ''}</url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
