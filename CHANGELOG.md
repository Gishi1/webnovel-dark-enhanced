# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-11-03

### Added
- Update notifier: checks GitHub (fallback GitLab) release feeds twice a day, sets an `↑` toolbar badge
  and shows a popup banner with a release link, plus a manual **Check for updates** button.
- Ko-fi link in the popup footer and settings sidebar.
- `tools/update.sh` and `tools/reload-extension.mjs` to pull, reload the unpacked extension and refresh tabs.

### Changed
- Manifest permissions now include `alarms` and read-only access to the GitHub/GitLab release APIs.

## [1.1.0] - 2026-11-03

### Added
- Search results now use the card grid.
- Searchable table of contents overlay (the site's own dialog never leaves its spinner),
  with volume grouping, current-chapter marker, locked badges, filter-as-you-type and prefetching.
- Inline filter controls: tag chips open a Hide / Prefer / Open menu, tag pages get
  Hide / Prefer buttons, book pages get Block author and Block book.
- Filter bar toggle to remove filtered books (or dim them), mirrored in the popup.
- Audit tooling: `tools/audit.sh`, `tools/audit-toc.js`, luminance-based light-surface detection.

### Fixed
- Near-white zebra rows on the catalogue page under light text.
- Listing grid no longer grows past five columns on wide displays.
- Book pages with canonical `/book/<id>` URLs are recognised by all controls.
- Font shorthands that were silently invalid in inline, popup and options styles.
- Exact book matching in block lists (ids, slugs, paths and URLs).
- MutationObserver feedback loop caused by rewriting filter-bar text and badges.
- Null-safe settings merge so malformed imports cannot break the UI.

## [1.0.0] - 2026-11-03

### Added
- Dark, Midnight and Dim themes with four accents, built on the site's CSS variables.
- Cookie, app-download, ad and promo cleanup.
- Card grid for `/stories`, `/tags/*` and search results.
- Tag, book, author, keyword and rating filters with dim/hide modes.
- Reader typography, progress bar, keyboard chapter navigation and scroll memory.
- Popup and options page with import/export, plus bookmarkable settings.
