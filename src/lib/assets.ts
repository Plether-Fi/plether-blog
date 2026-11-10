import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { loadContent, bodyImages, sourceImagePath } from './content';

export interface ImageAsset { src: string; srcset: string; width: number; height: number; social: string }
export type ImageManifest = Record<string, ImageAsset>;
const generated = path.resolve('.generated/public');

export async function prepareAssets() {
  const { posts } = await loadContent();
  await rm(generated, { recursive: true, force: true });
  await mkdir(path.join(generated, 'media'), { recursive: true });
  await cp('static', generated, { recursive: true });
  await sharp('static/social-card.svg').jpeg({ quality: 90 }).toFile(path.join(generated, 'social-card.jpg'));
  const sources = new Set(posts.flatMap(post => [post.bannerImage, post.socialImage, ...bodyImages(post.body)].filter(Boolean)));
  const manifest: ImageManifest = {};
  for (const source of sources) {
    const bytes = await readFile(sourceImagePath(source));
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    const meta = await sharp(bytes).rotate().metadata();
    const widths = [...new Set([480, 800, 1200, 1600].map(w => Math.min(w, meta.autoOrient?.width ?? meta.width ?? 1600)))];
    const variants: { url: string; width: number; height: number }[] = [];
    for (const width of widths) {
      const file = `${hash}-${width}.webp`;
      const result = await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 84 }).toFile(path.join(generated, 'media', file));
      variants.push({ url: `/media/${file}`, width: result.width, height: result.height });
    }
    const largest = variants.at(-1)!;
    // JPEG is broadly supported by social crawlers, including Telegram.
    const social = `/media/${hash}-social.jpg`;
    await sharp(bytes).rotate().resize({ width: 1200, height: 630, fit: 'cover' }).flatten({ background: '#102621' }).jpeg({ quality: 88 }).toFile(path.join(generated, social));
    manifest[source] = { src: largest.url, srcset: variants.map(v => `${v.url} ${v.width}w`).join(', '), width: largest.width, height: largest.height, social };
  }
  const domain = process.env.PAGES_CUSTOM_DOMAIN?.trim();
  if (domain) {
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) throw new Error('PAGES_CUSTOM_DOMAIN must be a hostname.');
    await writeFile(path.join(generated, 'CNAME'), `${domain}\n`);
  }
  await writeFile(path.join(generated, '.nojekyll'), '');
  await writeFile('.generated/images.json', JSON.stringify(manifest, null, 2));
  console.log(`[content] Prepared ${posts.length} published posts and ${sources.size} images.`);
}

export async function loadImages(): Promise<ImageManifest> {
  return JSON.parse(await readFile('.generated/images.json', 'utf8'));
}

export function imageWithBase(image: ImageAsset, base: string): ImageAsset {
  const prefix = base.replace(/\/$/, '');
  return { ...image, src: prefix + image.src, social: prefix + image.social,
    srcset: image.srcset.split(', ').map(item => prefix + item).join(', ') };
}
