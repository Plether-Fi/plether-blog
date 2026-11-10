export const site = {
  name: 'Plether Journal',
  description: 'Perspectives on the dollar, onchain markets, and the ideas behind Plether.',
  categories: ['Product', 'Macro', 'Research'] as const,
  pageSize: 9,
};

export type Category = (typeof site.categories)[number];

export function normalizeBase(value = '/') {
  const base = `/${value.replace(/^\/+|\/+$/g, '')}`;
  if (base.includes('..') || !/^\/[a-zA-Z0-9/_-]*$/.test(base)) throw new Error('BASE_PATH must be a simple URL path.');
  return base === '/' ? '/' : `${base}/`;
}

export function pathWithBase(path: string, base = import.meta.env?.BASE_URL ?? '/') {
  return `${normalizeBase(base)}${path.replace(/^\/+/, '')}`;
}

export function absoluteUrl(path: string, origin: string | URL, base = '/') {
  return new URL(pathWithBase(path, base), origin).href;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}

export function collectionPath(category: string | undefined, page = 1) {
  const root = category ? `category/${category.toLowerCase()}/` : '';
  return page === 1 ? root : `${root}page/${page}/`;
}
