import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import Markdoc from '@markdoc/markdoc';
import { site, type Category } from './settings';

export interface Author { slug: string; name: string; role: string; bio: string }
export interface Post {
  slug: string;
  title: string;
  publishDate: string;
  updatedDate: string;
  author: string;
  bannerImage: string;
  bannerAlt: string;
  body: string;
  draft: boolean;
  excerpt: string;
  metaDescription: string;
  seoTitle: string;
  socialImage: string;
  category: Category;
  featured: boolean;
  sample: boolean;
}

export const contentRoot = () => process.env.CONTENT_ROOT ? path.resolve(process.env.CONTENT_ROOT) : process.cwd();

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
function date(value: unknown) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : text(value);
}
export function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function parsePost(slug: string, source: string): Post {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid post slug: ${slug}`);
  const { data, content } = matter(source);
  for (const key of ['draft', 'featured', 'sample']) {
    if (data[key] !== undefined && typeof data[key] !== 'boolean') throw new Error(`${slug}: ${key} must be a boolean.`);
  }
  return {
    slug, title: text(data.title), publishDate: date(data.publishDate), updatedDate: date(data.updatedDate),
    author: text(data.author), bannerImage: text(data.bannerImage), bannerAlt: text(data.bannerAlt),
    body: content.trim(), draft: data.draft !== false, excerpt: text(data.excerpt),
    metaDescription: text(data.metaDescription), seoTitle: text(data.seoTitle), socialImage: text(data.socialImage),
    category: text(data.category) as Category, featured: data.featured === true, sample: data.sample === true,
  };
}

export function isPublished(post: Post, includeSamples = process.env.INCLUDE_SAMPLE_POSTS === 'true') {
  return !post.draft && (!post.sample || includeSamples);
}

export function sortPosts(posts: Post[]) {
  return [...posts].sort((a, b) => Number(b.featured) - Number(a.featured) || b.publishDate.localeCompare(a.publishDate) || a.slug.localeCompare(b.slug));
}

export function readingTime(body: string) {
  const ast = Markdoc.parse(body);
  const words = [...ast.walk()].filter(n => n.type === 'text').map(n => n.attributes.content).join(' ').match(/\S+/g)?.length ?? 0;
  return Math.max(1, Math.ceil(words / 200));
}

export function description(post: Post) { return post.metaDescription || post.excerpt; }
export function socialImage(post: Post) { return post.socialImage || post.bannerImage; }

export function sourceImagePath(source: string, root = contentRoot()) {
  // Uploads live outside the web root. Never allow content to read arbitrary files.
  if (!/^\/images\/[a-zA-Z0-9_./-]+\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(source) || source.split('/').includes('..')) {
    throw new Error(`Image must be a repository upload under /images/: ${source}`);
  }
  return path.join(root, 'content', source.slice(1));
}

export function bodyImages(body: string) {
  return [...Markdoc.parse(body).walk()].filter(n => n.type === 'image').map(n => text(n.attributes.src));
}

export function validatePublishedPost(post: Post, authors: Author[]) {
  const errors: string[] = [];
  for (const field of ['title', 'publishDate', 'author', 'bannerImage', 'bannerAlt', 'body', 'excerpt'] as const) {
    if (!post[field]) errors.push(`${field} is required`);
  }
  if (!isDate(post.publishDate)) errors.push('publishDate must be a valid YYYY-MM-DD date');
  if (post.updatedDate && (!isDate(post.updatedDate) || post.updatedDate < post.publishDate)) errors.push('updatedDate must be a valid date on or after publishDate');
  if (!site.categories.includes(post.category)) errors.push('category must be Product, Macro, or Research');
  if (!authors.some(a => a.slug === post.author)) errors.push(`unknown author: ${post.author}`);
  for (const image of [post.bannerImage, post.socialImage, ...bodyImages(post.body)].filter(Boolean)) {
    try { sourceImagePath(image); } catch (error) { errors.push((error as Error).message); }
  }
  const ast = Markdoc.parse(post.body);
  for (const error of Markdoc.validate(ast)) errors.push(`body: ${error.error.message}`);
  for (const node of ast.walk()) {
    if (node.type === 'image' && !text(node.attributes.alt)) errors.push('body images require alternative text');
    if (node.type === 'link' && !isSafeLink(text(node.attributes.href))) errors.push('body contains an unsupported link URL');
  }
  if (errors.length) throw new Error(`${post.slug}:\n  - ${errors.join('\n  - ')}`);
}

export function isSafeLink(href: string) {
  return !/[\x00-\x20\\]/.test(href) && !href.startsWith('//') && /^(?:https?:\/\/|mailto:|\/|#|\.\.?\/)/i.test(href);
}

export async function loadContent(root = contentRoot(), includeSamples = process.env.INCLUDE_SAMPLE_POSTS === 'true') {
  const authorDirectory = path.join(root, 'content/authors');
  const authorFiles = (await readdir(authorDirectory)).filter(file => file.endsWith('.json')).sort();
  const authors: Author[] = await Promise.all(authorFiles.map(async file => {
    const data = JSON.parse(await readFile(path.join(authorDirectory, file), 'utf8'));
    if (!text(data.name)) throw new Error(`Author ${file} requires a name.`);
    return { slug: file.slice(0, -5), name: text(data.name), role: text(data.role), bio: text(data.bio) };
  }));
  const postDirectory = path.join(root, 'content/posts');
  const files = (await readdir(postDirectory)).filter(file => file.endsWith('.mdoc')).sort();
  const allPosts = await Promise.all(files.map(async file => parsePost(file.slice(0, -5), await readFile(path.join(postDirectory, file), 'utf8'))));
  const posts = sortPosts(allPosts.filter(post => isPublished(post, includeSamples)));
  for (const post of posts) validatePublishedPost(post, authors);
  return { posts, authors, allPosts };
}

export function paginate(posts: Post[], page = 1, size = site.pageSize) {
  return { items: posts.slice((page - 1) * size, page * size), total: Math.max(1, Math.ceil(posts.length / size)), page };
}

export function articleSchema(post: Post, author: Author, canonical: string, image: string) {
  return {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title,
    description: description(post), image: [image], datePublished: post.publishDate,
    dateModified: post.updatedDate || post.publishDate, articleSection: post.category,
    author: { '@type': 'Person', name: author.name },
    publisher: { '@type': 'Organization', name: 'Plether' }, mainEntityOfPage: canonical, url: canonical,
  };
}
