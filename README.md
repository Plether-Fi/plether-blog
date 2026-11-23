# Plether Journal

An Astro blog with a file-based Keystatic editor. The public site builds to static files for **GitHub Pages**. A separate **Netlify** build serves only the editor and its API routes.

Repository: [Plether-Fi/plether-blog](https://github.com/Plether-Fi/plether-blog). Verified builds deploy automatically from `main` to [GitHub Pages](https://plether-fi.github.io/plether-blog/). The prepared integration will serve the blog at [plether.com/blog/](https://plether.com/blog/) once the Cloudflare route and build URL settings below are activated.

## Local development

Use Node 24 (see `.nvmrc`).

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4321`. Local development includes any remaining sample articles. Production excludes articles marked as samples automatically. You can delete sample posts and their images without breaking the tests, which use independent fixtures.

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
4. When activating `/blog/`, set these repository Actions variables to configure the public URL independently of the GitHub Pages origin. Until activation, leave them unset to keep the existing Pages URL working:

   | Variable | Value for `/blog/` |
   | --- | --- |
   | `SITE_URL` | `https://plether.com` |
   | `BASE_PATH` | `/blog` |
   | `PAGES_CUSTOM_DOMAIN` | Unset |

   `SITE_URL` must be an origin without a path; the public path belongs in `BASE_PATH`. Without these variables the workflow falls back to `https://OWNER.github.io/REPOSITORY/`.

5. Leave GitHub Pages' custom domain empty: `plether.com` belongs to the existing landing site. The prepared Cloudflare Worker `plether-blog-proxy` routes `plether.com/blog*`, handles only `/blog` and `/blog/…`, and fetches the corresponding files from `https://plether-fi.github.io/plether-blog/`. Other matching paths pass through to the main website. Existing DNS remains in place. `/blog` redirects to `/blog/`; upstream redirects retain the public URL, and missing articles retain their 404 status. Main-site cookies and authorization headers are never forwarded to GitHub.
6. Publish a real test article through Cloud and confirm that its commit triggers the Pages workflow. Build time depends on the queue and content size; measure the actual save-to-live time during onboarding.

For equivalent local builds, copy `.env.example` to `.env` and set the same values. `.env` files are ignored. No API token belongs in the public build.

Worker source and deployment configuration are in `cloudflare/`. To deploy manually without authorizing a CLI:

1. In Cloudflare **Workers & Pages → Create application → Start with Hello World**, create `plether-blog-proxy`. Do not attach a route to the placeholder.
2. Open **Edit code**, replace the entire starter script with [`cloudflare/blog-proxy.mjs`](cloudflare/blog-proxy.mjs), and **Deploy**.
3. In the Worker's **Settings → Domains & Routes → Add → Route**, select zone `plether.com` and pattern `plether.com/blog*`. If shown, choose **Fail closed** so a proxy failure cannot accidentally serve the landing page as a blog article.
4. Activate the two Actions variables above, then run **Publish blog to GitHub Pages** on `main`. The new public path requires this rebuild; the route alone does not change the generated links or assets.
5. Verify the index, an article, its banner, RSS, sitemap, `/blog` redirect, and a missing-article 404 at `https://plether.com/blog/`. Confirm the main homepage still works.

For later CLI deployments, an authorized operator can run `npx wrangler deploy --config cloudflare/wrangler.jsonc`. Regular article saves only rebuild GitHub Pages; they do not require redeploying the Worker. HTML caching is limited to 60 seconds at the proxy. The GitHub Pages address remains the upstream origin; after activation, share the public `/blog/` URL with readers.

To remove this integration, remove the `plether.com/blog*` Worker route and restore or delete the two Actions variables before rebuilding for the GitHub Pages address. Disabling the route restores the landing site's handling of `/blog`; no DNS changes are needed. The Netlify editor URL and Keystatic Cloud project do not change.

GitHub Pages supports public source repositories on GitHub Free; private source requires an eligible GitHub plan. A public source repository exposes drafts through GitHub even though the generated website excludes them. See [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Keystatic Cloud and Netlify setup

The editor is deployed at [plether-blog-editor.netlify.app/keystatic/](https://plether-blog-editor.netlify.app/keystatic/), connected to Cloud project [`plether-blog/journal`](https://keystatic.cloud/teams/plether-blog/project/journal) and `Plether-Fi/plether-blog`. The [Netlify project](https://app.netlify.com/projects/plether-blog-editor) belongs to the Plether Blog team. The production editor login page is **publicly reachable**, while deploy previews remain **private to the Netlify team**. Use **Log in with Keystatic Cloud** in the editor. Writers need an invitation to the [Keystatic Cloud team](https://keystatic.cloud/teams/plether-blog/users); they do not need Netlify or GitHub accounts. Cloud authentication still controls repository editing and publishing.

For recreating this setup:

1. Create a dedicated Keystatic Cloud team and project for the blog. Connect only the blog repository. Cloud team membership covers all projects in that team, so keep unrelated application projects out of it.
2. Invite authors to the Cloud team. They can sign in without GitHub accounts. Copy the project's exact `team/project` identifier from Cloud settings.
3. Import this repository into a separate Netlify site. `netlify.toml` supplies `npm run build:editor`, `dist-editor`, and Node 24.
4. Set these environment variables in Netlify, including the build scope:

   | Variable | Value |
   | --- | --- |
   | `PUBLIC_KEYSTATIC_PROJECT` | `plether-blog/journal` |
   | `EDITOR_URL` | Optional on Netlify: its assigned `URL` is detected automatically. Set explicitly when using a custom editor domain. |
   | `SITE_URL` | `https://plether-fi.github.io` |

5. Deploy and open `/keystatic/`. Verify Cloud login, banner/body uploads, saving, and logout using an invited author account. Production editor builds fail if the Cloud project identifier is missing. The fixture build uses `build-check/editor` solely to check compilation; it is not an active Cloud project.
6. Set the Cloud project's Primary URL to the deployed editor origin, currently `https://plether-blog-editor.netlify.app`.
   In Netlify's **Project configuration → General → Visitor access → Project visibility**, customize this project's visibility as **Private**, applying to **Previews only**. This leaves production public and deploy previews private. Keep Cloud authentication enabled in `keystatic.config.ts`.
7. Optionally add `editor.plether.com` to Netlify and configure its DNS using Netlify's displayed target. Update `EDITOR_URL` and Cloud's allowed URL. An HTTP redirect from `https://plether.com/keystatic` must be installed on the existing main website; DNS cannot redirect a URL path. Custom domains and that redirect are not configured by this repository.

For a local production editor compilation, copy `.env.editor.example` to `.env.editor` and fill in the real project identifier. Development always uses local storage; only production editor builds use Cloud. This avoids exposing unauthenticated filesystem writes in production. The editor deployment contains no public article routes, RSS, or sitemap, and emits noindex headers plus a disallow-all robots file. These indexing controls are not authentication; Cloud protects repository editing.

The Netlify ignore script skips content-only commits because the editor reads current content from GitHub through Cloud. Schema, code, asset, and dependency changes rebuild the editor. When changing environment variables, trigger a fresh editor deployment. Netlify account eligibility and usage quotas determine whether a paid plan is needed.

## Publishing guide

1. Open the [editor](https://plether-blog-editor.netlify.app/keystatic/), sign in with Keystatic Cloud, and open **Posts → Add**.
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

## Deployment verification and remaining setup

The GitHub repository, GitHub Pages workflow, Netlify editor, Cloud repository connection, and current owner's access are configured. `/blog/` proxy code and checks are prepared; manual Cloudflare deployment and activation of the build URL settings remain pending. Cloud login and saving a temporary draft to `main` were verified through the deployed editor. The draft triggered the Pages workflow while remaining excluded from public output. The production editor login page was verified to return HTTP 200 without Netlify cookies; deploy previews remain private. Automated remote image-upload verification was blocked by the browser extension's local-file access setting; image controls are enabled, and local uploads were verified during implementation. Invite additional writers only to the Keystatic Cloud team. A custom editor domain or main-site editor redirect remains optional follow-up work.

## References

- [Keystatic Astro integration](https://keystatic.com/docs/installation-astro)
- [Keystatic Cloud authentication and team access](https://keystatic.com/docs/cloud)
- [Astro on GitHub Pages](https://docs.astro.build/en/guides/deploy/github/)
- [Astro on Netlify](https://docs.astro.build/en/guides/integrations-guide/netlify/)

The public templates follow the PLETHER Figma file's [Main Page Blog](https://www.figma.com/design/5Suf3OWzHU3pcqVrhqat89/PLETHER?node-id=2932-4978) and [Article Page](https://www.figma.com/design/5Suf3OWzHU3pcqVrhqat89/PLETHER?node-id=2932-5249). The index uses nine cards per page; featured posts sort first. Categories and RSS remain available below the grid. Articles use a banner-first layout and previous/next links through the published collection. Mobile layouts adapt the desktop frames to narrow screens.

The header/footer logos, header rule, and three sample banner images are original Figma exports saved locally. Real article imagery always comes from each post's uploaded banner. Sample content remains excluded from production. Uncut Sans and Instrument Sans are self-hosted; their original licenses are included under `static/fonts/`. The demo blog's code was not copied.
