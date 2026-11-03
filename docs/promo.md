# Getting traffic

The extension is free, open source and solves a visible problem (bright UI, cramped listings, no author
blocking, broken TOC). Traffic comes from **where WebNovel readers already are**, not from the Git host.

## Priority order

| Priority | Channel | Effort | Why |
| --- | --- | --- | --- |
| 1 | **Chrome Web Store** | ~1 hour + review | The only channel with built-in search and install intent. “dark mode”, “webnovel” queries. |
| 2 | **Edge Add-ons** | ~20 min | Same zip, free, another store + search listing. |
| 3 | **Existing gists** | ~10 min | They already have readers; add a top line linking to the extension. |
| 4 | **r/Webnovel + r/webnovels** | 15 min | Exact audience. Use the dedicated self-promotion thread where required. |
| 5 | **Reader Discords** | 20 min | Post once in the self-promo/showcase channel of WebNovel/webfiction servers. |
| 6 | **Landing page + search** | done | `docs/index.html` on GitHub Pages; indexed for “webnovel dark mode extension”. |
| 7 | **GreasyFork mirror** | 30 min | Publish the original userscript (or a light mirror of it) and link the extension. Huge install base for site tweaks. |
| 8 | **Show HN / Product Hunt** | 1 hour | Long shots, but a good screenshot and a clear “why” can land. |
| 9 | **Short video** | 1–2 hours | A 20-second before/after clip for TikTok/YouTube Shorts/Reddit. |

Store listing copy and graphics are ready in `store/`.

## One-time actions

1. Publish on the Chrome Web Store (`store/checklist.md`).
2. Publish on Edge Add-ons with the same zip.
3. Edit both gists and add, at the top:
   > This userscript now has a full Chrome extension version: https://github.com/Gishi1/webnovel-dark-enhanced
4. Put the store link and landing page in the GitHub repo **Website** field and the README top.
5. Add topics to the repo: `chrome-extension`, `webnovel`, `dark-theme`, `reader`, `filters`, `manifest-v3`.

## Ready-to-post copy

### r/Webnovel — use the dedicated self-promotion thread
> **Free dark theme + filters for WebNovel (Chrome/Edge/Brave)**
>
> I read a lot on WebNovel and got tired of the bright UI, cramped listings and the catalogue dialog that
> never loads. I turned my old userscripts into an extension:
> • Dark/Midnight/Dim themes, four accents
> • Card listings, five per row
> • Hide/prefer tags, block books, block authors (imports their whole catalogue)
> • Reader typography, progress, chapter hotkeys, searchable table of contents
>
> Free, MIT, no tracking. Screenshots and install: https://github.com/Gishi1/webnovel-dark-enhanced
> Feedback welcome — especially pages that still look wrong.

### r/webnovels
> **I made a free WebNovel dark-mode + filtering extension**
>
> Former userscripts, now a proper Chrome extension: dark theme for every page, card-based listings,
> tag/book/author filters and a working table of contents (the site's own dialog stays on a spinner).
> No account, no telemetry. Chrome/Edge/Brave 111+.
> https://github.com/Gishi1/webnovel-dark-enhanced
> Happy to take feedback or add a site section you read often.

### Discord (self-promo channel)
> **WebNovel Dark & Enhanced** — free Chrome extension for reading webnovel.com at night.
> Dark theme, cleaner listings, hide tags you don't read, block authors (whole catalogue), better reader
> with a searchable TOC. Open source, no tracking: https://github.com/Gishi1/webnovel-dark-enhanced

### Show HN
> **Show HN: Dark theme and filters for WebNovel (Chrome MV3)**
>
> I rebuilt two userscripts as a Manifest V3 extension because the site's reader was hard on the eyes and
> its catalogue dialog never finishes loading. Theme is built on the site's CSS variables rather than
> `filter: invert`, listings are a capped cover grid, and author blocking resolves the author's public
> profile into book ids that refresh daily. Free/MIT, no tracking.
> https://github.com/Gishi1/webnovel-dark-enhanced

## Etiquette (avoid a ban)

- Read each community's rules first; several only allow promotion in a pinned/self-promo thread.
- Disclose that you are the author.
- Answer questions and take feedback; don't drop a link and leave.
- Don't ask for stars/votes; don't cross-post the same text to five subreddits in an hour.
- One post per community, then participate normally.

## Measuring

- GitHub → Insights → Traffic (views/clones/referrers) and stars.
- Chrome Web Store dashboard: impressions, installs, uninstalls, ratings.
- Add a UTM-tagged link for social posts: `?utm_source=reddit&utm_medium=post&utm_campaign=launch`.
- Ko-fi page views/conversions.
