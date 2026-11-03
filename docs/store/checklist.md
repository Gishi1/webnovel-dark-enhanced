# Publishing checklist

## Chrome Web Store
1. Create a developer account at <https://chrome.google.com/webstore/devconsole> (one-time US$5 fee).
2. Zip the extension: `./tools/package.sh` → `dist/webnovel-dark-enhanced-<version>.zip`.
3. Upload the zip, then paste the fields from `chrome-web-store.md`.
4. Upload the 1280×800 screenshots in order, the 440×280 promo tile, and the 1280×128 icon.
5. Set the privacy policy URL and the data-usage answers.
6. Submit for review (usually hours to a few days).

## Edge Add-ons (free, same package)
1. <https://partner.microsoft.com/dashboard/microsoftedge> → create an app.
2. Upload the same zip; Edge accepts Chromium MV3 packages.
3. Copy the listing copy and screenshots; submit.

## Firefox (optional, needs code work)
Firefox supports MV3 but not the `world: "MAIN"` content script used for SPA navigation, so it needs a
small compatibility pass before publishing on addons.mozilla.org.

## After approval
- Add store badges/links to the README and landing page.
- Update both gists with a link to the extension.
- Post in the communities listed in `../promo.md`.
- Add the store link to the popup? No — keep the popup clean; the landing page carries it.
