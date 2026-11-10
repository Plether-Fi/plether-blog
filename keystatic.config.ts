import { collection, config, fields } from '@keystatic/core';

const project = import.meta.env?.PUBLIC_KEYSTATIC_PROJECT || '';
const local = import.meta.env?.PUBLIC_KEYSTATIC_LOCAL === 'true';

export default config({
  storage: local ? { kind: 'local' } : { kind: 'cloud' },
  ...(local ? {} : { cloud: { project: project as `${string}/${string}` } }),
  ui: { brand: { name: 'Plether Journal' } },
  collections: {
    posts: collection({
      label: 'Posts',
      columns: ['title', 'draft', 'category', 'publishDate'],
      path: 'content/posts/*',
      slugField: 'title',
      format: { contentField: 'body' },
      entryLayout: 'content',
      schema: {
        title: fields.slug({
          name: { label: 'Title' },
          slug: { label: 'URL slug', description: 'Generated from the title. Keep existing slugs unchanged to preserve published links.', validation: { pattern: { regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Use lowercase words separated by hyphens.' } } },
        }),
        draft: fields.checkbox({ label: 'Draft', defaultValue: true, description: 'Keep enabled while writing. Turn off to publish after the next successful build.' }),
        publishDate: fields.date({ label: 'Publish date', description: 'Required to publish. This is a display date, not a publishing schedule.' }),
        updatedDate: fields.date({ label: 'Updated date', description: 'Optional. Set this when substantially revising an article.' }),
        author: fields.relationship({ label: 'Author', collection: 'authors' }),
        category: fields.select({ label: 'Category', options: ['Product', 'Macro', 'Research'].map(label => ({ label, value: label })), defaultValue: 'Product' }),
        featured: fields.checkbox({ label: 'Featured', defaultValue: false, description: 'Place this post before ordinary posts on the journal index.' }),
        bannerImage: fields.image({ label: 'Banner image', directory: 'content/images/posts', publicPath: '/images/posts/' }),
        bannerAlt: fields.text({ label: 'Banner alt text', description: 'Describe what the image conveys. Required to publish.' }),
        excerpt: fields.text({ label: 'Excerpt', multiline: true, description: 'Summary for article cards. Also used for search descriptions unless overridden.' }),
        seoTitle: fields.text({ label: 'SEO title (optional)', description: 'Leave blank to use the article title.' }),
        metaDescription: fields.text({ label: 'Meta description (optional)', multiline: true, description: 'Aim for about 150 characters. Leave blank to use the excerpt.' }),
        socialImage: fields.image({ label: 'Social share image (optional)', description: 'Leave empty to use the banner. Social cards are cropped to 1200 × 630.', directory: 'content/images/social', publicPath: '/images/social/' }),
        sample: fields.checkbox({ label: 'Sample article', defaultValue: false, description: 'Sample articles are excluded from production builds. Leave off for real articles.' }),
        body: fields.markdoc({
          label: 'Body',
          description: 'Add headings, links, lists, tables, charts, and diagrams. Give every image descriptive alternative text.',
          options: {
            heading: [2, 3, 4], bold: true, italic: true, strikethrough: true, code: true,
            codeBlock: true, blockquote: true, orderedList: true, unorderedList: true,
            table: true, link: true, divider: true,
            image: { directory: 'content/images/body', publicPath: '/images/body/' },
          },
        }),
      },
    }),
    authors: collection({
      label: 'Authors', path: 'content/authors/*', slugField: 'name', format: { data: 'json' },
      schema: {
        name: fields.slug({ name: { label: 'Name', validation: { isRequired: true } } }),
        role: fields.text({ label: 'Role' }),
        bio: fields.text({ label: 'Short biography', multiline: true }),
      },
    }),
  },
});
