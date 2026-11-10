# Plether Journal

An Astro blog with a file-based Keystatic editor. The public site builds to static files for **GitHub Pages**. A separate **Netlify** build serves only the editor and its API routes.

Repository: [Plether-Fi/plether-blog](https://github.com/Plether-Fi/plether-blog). GitHub Pages is configured at [plether-fi.github.io/plether-blog](https://plether-fi.github.io/plether-blog/), with verified builds deployed automatically from `main`. The proposed custom domains are not connected yet.

## Local development

Use Node 24 (see `.nvmrc`).

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4321`. Local development includes seven clearly marked sample articles. Production builds exclude them automatically and show an empty state until you publish a real article. You can delete the sample posts and their images without breaking the tests, which use independent fixtures.

Run the local file editor separately:

```sh
npm run dev:editor
```

Open `http://127.0.0.1:4322/keystatic/`. Local mode writes to files on your computer; commit and push those changes yourself. It does not authenticate through Keystatic Cloud. Never expose this local file-writing server publicly.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Public site with content/image live reload and sample articles |
| `npm run dev:editor` | Local Keystatic editor on port 4322 |
| `npm run build` | Production static site in `dist/`; samples excluded |
| `npm run preview` | Serve the public build locally |
| `npm run build:editor` | Cloud editor bundle in `dist-editor/` and Netlify function output |
| `npm run verify` | Type checks, unit tests, production build, and generated output checks |
| `npm run verify:fixtures` | Build independent fixtures at a Pages subpath, check pagination/SEO/links, and compile the Netlify editor |

Astro builds and development use a small cross-platform launcher that selects the public/editor target and disables telemetry. For a manual check in a restricted environment, use `ASTRO_TELEMETRY_DISABLED=1 npm run check`.

The lockfile pins the toolchain. Overrides keep `glob` and `minimatch` on patched versions; the full build and reader tests cover their integration. At implementation time, npm still reports low-severity upstream advisories in the Netlify tooling dependency chain; no moderate, high, or critical advisories remain. Recheck with `npm audit` when updating dependencies.

## Content and publication

- `keystatic.config.ts`: post and author schemas.
- `content/posts/<slug>.mdoc`: article metadata and Markdoc body.
- `content/authors/<slug>.json`: author records.
- `content/images/`: original uploaded banners, social cards, and body images.
- `static/`: shared logos, favicon, and default social-card illustration.
- `src/`: public routes, components, metadata, and publishing pipeline.
- `editor/`: separate route tree for the editor deployment.

The `draft` flag defaults to true, including when omitted from an existing file. Drafts can be incomplete. Published posts must have a title, valid publication date, known author, supported category, excerpt, body, banner, and banner alt text. Body images also require alt text. Invalid published content fails the build; the last successful deployment stays live.

The publication filter is shared by pages, pagination, category listings, related articles, RSS, sitemap, and generated media. Originals are outside the web root. Only referenced images from published articles are emitted as responsive WebP files and social-compatible JPEG cards. Draft content and its unreferenced images are not copied to the public artifact.

Featured articles appear before other articles, followed by newest publication date. RSS remains chronological. Reading time is calculated from body text at 200 words per minute. Publication dates are display dates; there is no scheduled-publishing job. Updated dates cannot precede publication dates.

SEO description falls back to the excerpt, SEO title to the article title, and social image to the banner. Social images are cropped to 1200 × 630. The public site generates RSS, sitemap, canonical URLs, Open Graph/Twitter metadata, and BlogPosting structured data.

Samples carry `sample: true`. Production always excludes them unless `INCLUDE_SAMPLE_POSTS=true` is deliberately supplied for a preview. The Pages deployment explicitly sets this flag to false. When converting a sample to a real article, replace its content and images, clear its Sample article toggle, and leave Draft enabled until ready.

## GitHub Pages setup

1. This project uses the dedicated `Plether-Fi/plether-blog` repository, separate from the application. Push changes to `main` to publish.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. The included `Publish blog to GitHub Pages` workflow builds and verifies the site before deploying `dist/`. It runs on pushes to `main` and can also be run manually. PRs run the separate checks workflow without deployment permissions.
4. By default the workflow uses `https://OWNER.github.io/REPOSITORY/`. It derives both the origin and base path from the repository. Set repository Actions variables when using a custom domain:

   | Variable | Value for the proposed custom domain |
   | --- | --- |
   | `SITE_URL` | `https://blog.plether.com` |
   | `BASE_PATH` | `/` |
   | `PAGES_CUSTOM_DOMAIN` | `blog.plether.com` |

   For an `OWNER.github.io` repository, also set `BASE_PATH=/`. `SITE_URL` must be an origin without a path; the repository path belongs in `BASE_PATH`.

5. For the custom domain, add `blog.plether.com` in Pages settings, point the `blog` DNS CNAME to `OWNER.github.io`, verify domain ownership as requested by GitHub, and enable HTTPS after certificate provisioning. Keep the existing apex website's DNS in place.
6. Publish a real test article through Cloud and confirm that its commit triggers the Pages workflow. Build time depends on the queue and content size; measure the actual save-to-live time during onboarding.

For equivalent local builds, copy `.env.example` to `.env` and set the same values. `.env` files are ignored. No API token belongs in the public build.

GitHub Pages supports public source repositories on GitHub Free; private source requires an eligible GitHub plan. A public source repository exposes drafts through GitHub even though the generated website excludes them. See [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Keystatic Cloud and Netlify setup

1. Create a dedicated Keystatic Cloud team and project for the blog. Connect only the blog repository. Cloud team membership covers all projects in that team, so keep unrelated application projects out of it.
2. Invite authors to the Cloud team. They can sign in without GitHub accounts. Copy the project's exact `team/project` identifier from Cloud settings.
3. Import this repository into a separate Netlify site. `netlify.toml` supplies `npm run build:editor`, `dist-editor`, and Node 24.
4. Set these environment variables in Netlify, including the build scope:

   | Variable | Value |
   | --- | --- |
   | `PUBLIC_KEYSTATIC_PROJECT` | The real `team/project` from Keystatic Cloud |
   | `EDITOR_URL` | The actual `https://…netlify.app` origin, later `https://editor.plether.com` |
   | `SITE_URL` | `https://blog.plether.com` |

5. Deploy and open `/keystatic/`. Verify Cloud login, banner/body uploads, saving, and logout using an invited author account. Production editor builds fail if the Cloud project identifier is missing. The fixture build uses `build-check/editor` solely to check compilation; it is not an active Cloud project.
6. Add `editor.plether.com` to Netlify and configure its DNS using Netlify's displayed target. Update `EDITOR_URL` and any allowed URLs requested by Cloud.
7. Add an HTTP redirect from `https://plether.com/keystatic` to `https://editor.plether.com/keystatic/` on the existing main website. DNS cannot redirect a URL path. This repository cannot install a redirect on that separate website.

For a local production editor compilation, copy `.env.editor.example` to `.env.editor` and fill in the real project identifier. Development always uses local storage; only production editor builds use Cloud. This avoids exposing unauthenticated filesystem writes in production. The editor deployment contains no public article routes, RSS, or sitemap, and emits noindex headers plus a disallow-all robots file. These indexing controls are not authentication; Cloud protects repository editing.

The Netlify ignore script skips content-only commits because the editor reads current content from GitHub through Cloud. Schema, code, asset, and dependency changes rebuild the editor. When changing environment variables, trigger a fresh editor deployment. Netlify account eligibility and usage quotas determine whether a paid plan is needed.

## Publishing guide

1. Sign in to the deployed editor and open **Posts → Create entry**.
2. Enter the title, review the generated slug, and keep **Draft** enabled.
3. Set the author, category, publication date, excerpt, banner, and banner alt text.
4. Write the body. Insert images using the editor's image tool and describe each image in its alt text. Use heading levels 2–4 beneath the page title.
5. Add optional SEO overrides, social image, updated date, or Featured toggle.
6. Save unfinished work as a draft. To publish, disable Draft and save to the publishing branch (`main`). Watch GitHub Actions for build status. A failed build does not update the public site; correct the validation error and save again.

There is no authenticated visual draft-preview service in this first version. Local development renders published sample/real articles; draft articles remain excluded. For pre-publication review, use the rich text editor or an explicitly separate review deployment. GitHub Pages itself has no private per-PR preview service configured here.

To unpublish, enable Draft and save. To remove an article, delete its entry in Keystatic; unreferenced uploads stop appearing in subsequent public builds. Keep published slugs stable: changing one changes the URL, and GitHub Pages does not automatically redirect the old address.

## Review and rollback

The initial workflow permits direct publishing within the isolated blog repository. For mandatory review, protect `main`, require passing checks and a reviewer, and verify that the Keystatic installation cannot bypass those rules. Have authors save to content branches and open PRs. A branch prefix is a convenience, not an access boundary.

To undo a bad publication, revert the content commit on GitHub and let Pages rebuild. For an emergency recovery, check out a known-good commit on `main` through a reviewed revert and rerun the deployment workflow. Never store application secrets or credentials in this repository.

## What requires account access

The GitHub repository and GitHub Pages publishing are configured. The separate editor still needs its Keystatic Cloud project and author invitations, Netlify site/environment variables, and any custom-domain DNS changes. Cloud authentication and the remote editor save-to-deploy cycle can only be verified after those services are connected.

## References

- [Keystatic Astro integration](https://keystatic.com/docs/installation-astro)
- [Keystatic Cloud authentication and team access](https://keystatic.com/docs/cloud)
- [Astro on GitHub Pages](https://docs.astro.build/en/guides/deploy/github/)
- [Astro on Netlify](https://docs.astro.build/en/guides/integrations-guide/netlify/)

Plether logos are reused from the neighboring Plether app. Sample illustrations and copy were created for this project; the demo blog's code was not copied.
