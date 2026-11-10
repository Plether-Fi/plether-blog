import type { APIRoute } from 'astro';
import { loadContent, description } from '../lib/content';
import { absoluteUrl, site as settings } from '../lib/settings';
import { xml } from '../lib/xml';

export const GET: APIRoute = async ({ site }) => {
  const { posts, authors } = await loadContent();
  const link = (path: string) => absoluteUrl(path, site!, import.meta.env.BASE_URL);
  const items = [...posts].sort((a, b) => b.publishDate.localeCompare(a.publishDate)).map(post => `<item><title>${xml(post.title)}</title><link>${xml(link(`posts/${post.slug}/`))}</link><guid isPermaLink="true">${xml(link(`posts/${post.slug}/`))}</guid><description>${xml(description(post))}</description><pubDate>${new Date(`${post.publishDate}T00:00:00Z`).toUTCString()}</pubDate><category>${post.category}</category><dc:creator>${xml(authors.find(a => a.slug === post.author)!.name)}</dc:creator></item>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>${settings.name}</title><link>${xml(link(''))}</link><description>${xml(settings.description)}</description><language>en</language><atom:link href="${xml(link('rss.xml'))}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
