import test from 'node:test';
import assert from 'node:assert/strict';
import { createReader } from '@keystatic/core/reader';
import config from '../keystatic.config';
import { parsePost, isPublished, sortPosts, validatePublishedPost, description, socialImage, readingTime, paginate, sourceImagePath, loadContent, articleSchema } from '../src/lib/content';
import { renderBody } from '../src/lib/markdoc';
import { normalizeBase, pathWithBase, collectionPath } from '../src/lib/settings';

const authors = [{ slug: 'team', name: 'The team', role: 'Research', bio: '' }];
const source = `---\ntitle: Test article\ndraft: false\npublishDate: '2026-11-01'\nauthor: team\nbannerImage: /images/test.png\nbannerAlt: Test diagram\nexcerpt: An example description.\ncategory: Research\n---\n\n## A question\n\nA clear explanation.\n`;
const post = () => parsePost('test-article', source);

test('missing draft flags fail closed; samples require explicit opt-in', () => {
  assert.equal(isPublished(parsePost('draft', '---\ntitle: Draft\n---\nUnfinished')), false);
  assert.equal(isPublished({ ...post(), sample: true }, false), false);
  assert.equal(isPublished({ ...post(), sample: true }, true), true);
  assert.throws(() => parsePost('oops', source.replace('draft: false', 'draft: "false"')), /boolean/);
});
test('published posts require complete, valid metadata; incomplete drafts remain savable', () => {
  assert.doesNotThrow(() => validatePublishedPost(post(), authors));
  assert.throws(() => validatePublishedPost({ ...post(), bannerAlt: '', author: 'missing', publishDate: '2026-02-30', updatedDate: '2025-01-01' }, authors), /bannerAlt.*required[\s\S]*valid[\s\S]*unknown author/);
  assert.doesNotThrow(() => parsePost('unfinished', '---\ndraft: true\n---\n'));
});
test('unsafe image paths and links cannot become published markup', () => {
  for (const input of ['/images/../package.json', '/images/../../secret.png', 'https://external.example/test.png', '/images/%2e%2e/test.png']) assert.throws(() => sourceImagePath(input));
  // Markdoc leaves unsafe schemes as literal text rather than creating a link.
  assert.doesNotMatch(renderBody('[click](javascript:alert)', {}).html, /href=/);
  assert.throws(() => validatePublishedPost({ ...post(), body: '![](/images/test.png)' }, authors), /alternative text/);
  assert.throws(() => validatePublishedPost({ ...post(), body: '[click](//external.example)' }, authors), /unsupported link/);
});
test('featured ordering is deterministic and pagination does not drop posts', () => {
  const posts = Array.from({ length: 14 }, (_, index) => ({ ...post(), slug: `post-${index}`, publishDate: `2026-11-${String(index + 1).padStart(2, '0')}`, featured: index === 1 }));
  const sorted = sortPosts(posts);
  assert.equal(sorted[0].slug, 'post-1');
  assert.equal(sorted[1].slug, 'post-13');
  assert.equal(paginate(sorted).total, 2);
  const pages = [1, 2].flatMap(page => paginate(sorted, page).items);
  assert.equal(new Set(pages.map(p => p.slug)).size, 14);
  assert.equal(collectionPath('Research', 2), 'category/research/page/2/');
});
test('SEO fallbacks and structured data use editorial values', () => {
  assert.equal(description(post()), post().excerpt);
  assert.equal(description({ ...post(), metaDescription: 'Custom' }), 'Custom');
  assert.equal(socialImage(post()), post().bannerImage);
  assert.equal(socialImage({ ...post(), socialImage: '/images/social.png' }), '/images/social.png');
  const schema = articleSchema(post(), authors[0], 'https://example.com/posts/test/', 'https://example.com/media/test.jpg');
  assert.equal(schema.dateModified, post().publishDate);
  assert.equal(schema.author.name, 'The team');
  assert.equal(readingTime('word '.repeat(401)), 3);
});
test('Markdoc produces unique anchors and responsive images under a Pages base path', () => {
  const asset = { src: '/media/test.webp', social: '/media/test.jpg', srcset: '/media/test.webp 800w', width: 800, height: 500 };
  const { html, headings } = renderBody('## Same title\n\n## Same title\n\n![A chart](/images/test.png)\n\n[Home](/)\n', { '/images/test.png': asset }, '/plether-blog/');
  assert.deepEqual(headings.map(h => h.id), ['same-title', 'same-title-2']);
  assert.match(html, /id="same-title-2"/);
  assert.match(html, /src="\/plether-blog\/media\/test.webp"/);
  assert.match(html, /href="\/plether-blog\/"/);
  assert.match(html, /alt="A chart"/);
  assert.equal(pathWithBase('/posts/test/', '/plether-blog/'), '/plether-blog/posts/test/');
  assert.throws(() => normalizeBase('/../oops'));
});
test('fixture files round-trip through the Keystatic Reader and public parser', async () => {
  const root = new URL('./fixtures', import.meta.url).pathname;
  const reader = createReader(root, config);
  const { allPosts, posts } = await loadContent(root, true);
  assert.equal(posts.length, 10);
  const entry = await reader.collections.posts.read('fixture-1');
  assert.ok(entry);
  assert.equal(entry.title, allPosts.find(p => p.slug === 'fixture-1')!.title);
  assert.equal(entry.bannerImage, '/images/test.svg');
  const body = await entry.body();
  assert.ok(body.node);
  const author = await reader.collections.authors.read('plether');
  assert.equal(author?.name, 'Plether team');
  const draft = await reader.collections.posts.read('unpublished-draft');
  assert.equal(draft?.draft, true);
});
