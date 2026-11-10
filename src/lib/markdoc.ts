import Markdoc from '@markdoc/markdoc';
import { imageWithBase, type ImageManifest } from './assets';
import { pathWithBase } from './settings';

export function renderBody(body: string, images: ImageManifest, base = '/') {
  const ast = Markdoc.parse(body);
  const headings: { id: string; title: string; level: number }[] = [];
  const used = new Map<string, number>();
  for (const node of ast.walk()) {
    if (node.type !== 'heading') continue;
    const title = [...node.walk()].filter(n => n.type === 'text').map(n => n.attributes.content).join('');
    const root = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    const count = (used.get(root) ?? 0) + 1;
    used.set(root, count);
    const id = count === 1 ? root : `${root}-${count}`;
    node.attributes.id = id;
    if (node.attributes.level === 2 || node.attributes.level === 3) headings.push({ id, title, level: node.attributes.level });
  }
  const tree = Markdoc.transform(ast, {
    nodes: {
      heading: { ...Markdoc.nodes.heading, attributes: { ...Markdoc.nodes.heading.attributes, id: { type: String } } },
      link: {
        ...Markdoc.nodes.link,
        transform(node, config) {
          const attrs = node.transformAttributes(config);
          if (attrs.href?.startsWith('/') && !attrs.href.startsWith('//')) attrs.href = pathWithBase(attrs.href, base);
          return new Markdoc.Tag('a', attrs, node.transformChildren(config));
        },
      },
      image: {
        ...Markdoc.nodes.image,
        transform(node) {
          const image = images[node.attributes.src];
          if (!image) throw new Error(`Missing image in published asset manifest: ${node.attributes.src}`);
          const asset = imageWithBase(image, base);
          return new Markdoc.Tag('a', { href: asset.src, class: 'body-image-link', 'aria-label': `Open full image: ${node.attributes.alt}` }, [
            new Markdoc.Tag('img', { src: asset.src, srcset: asset.srcset, sizes: '(max-width: 800px) 100vw, 760px', width: asset.width, height: asset.height, alt: node.attributes.alt, title: node.attributes.title, loading: 'lazy', decoding: 'async' }),
          ]);
        },
      },
    },
  });
  return { html: Markdoc.renderers.html(tree), headings };
}
