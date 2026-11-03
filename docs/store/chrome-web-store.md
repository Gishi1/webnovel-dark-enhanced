# Chrome Web Store listing pack

Copy/paste these fields into the Chrome Web Store developer dashboard.
Screenshots (1280×800), promo tile (440×280) and marquee (1400×560) live next to this file.

## Name (45 chars max)
WebNovel Dark & Enhanced

## Short description (132 chars max)
Dark theme, card listings, tag/book/author filters and a searchable table of contents for webnovel.com.

## Category
Tools

## Language
English

## Single purpose
Improve reading and browsing on webnovel.com with a dark theme, cleaner listings, local filters and a better reader.

## Detailed description
WebNovel Dark & Enhanced makes webnovel.com comfortable to read.

DARK THEME
• Dark, Midnight and Dim palettes with four accent colours
• Covers the header, listings, search, book pages, catalogue, dialogs and the reader
• No inverted images or broken brand colours

CLEANER LISTINGS
• Responsive cover grid capped at five books per row
• Tag chips, descriptions and ratings without the cramped fixed-height rows
• Optional match badge for your preferred tags

FILTERS YOU CONTROL ON THE PAGE
• Click a tag chip to hide it, prefer it, or open its tag page
• Hide / Prefer buttons on tag pages
• Block books from a card or the book page
• Block an author from their book page or profile — their whole catalogue is imported and refreshed
• Keyword and minimum-rating filters, dimmed or removed results

READER
• Width, font, size, line height, justification and paragraph-comment hiding
• Reading progress bar and per-book scroll memory
• ← / → chapter navigation, + / = / - font size
• Searchable table of contents with volume grouping and locked badges

PRIVACY
• No account, analytics, telemetry, ads or remote code
• Settings stay in your browser; export/import from the options page
• Reads only public release tags to tell you about updates

Free and open source (MIT). The sign-in dialog is a cross-origin iframe and keeps its own styling.
Not affiliated with WebNovel or Cloudary.

Support development: https://ko-fi.com/gishi
Source: https://github.com/Gishi1/webnovel-dark-enhanced

## Screenshot order and captions
1. `screenshots/home-1280x800.png` — “A dark theme for every page”
2. `screenshots/listing-1280x800.png` — “Card listings, five per row”
3. `screenshots/book-1280x800.png` — “Block authors and books in place”
4. `screenshots/reader-1280x800.png` — “A reader that respects your eyes”
5. `screenshots/toc-1280x800.png` — “Searchable table of contents”

## Graphics
- Store icon: `icons/icon128.png`
- Small promo tile: `store/promo-tile-440x280.png`
- Marquee: `store/marquee-1400x560.png`

## Permission justifications
- **storage** — save theme, filter lists, reading positions and the last update check locally.
- **alarms** — schedule the twice-daily update check and the daily author-catalogue refresh.
- **https://www.webnovel.com/*** — inject the theme and page controls on WebNovel only.
- **https://api.github.com/*** and **https://gitlab.com/api/*** — read the latest release tag for the update notifier. No user data is sent.

## Data usage answers
- Collects user data? **No**
- Uses remote code? **No**
- Sells data? **No**
- Uses data for unrelated purposes? **No**
- Privacy policy URL: `https://gishi1.github.io/webnovel-dark-enhanced/privacy.html`

## Review notes
This extension only modifies the page it is injected into on webnovel.com. The author-catalogue feature
fetches the public author profile on webnovel.com and stores the book ids locally; it does not scrape or
transmit anything off-device.
