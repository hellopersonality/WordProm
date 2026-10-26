# Wubix

A word puzzle on a 3x3 letter cube. Trace words across faces, twist rows and columns, clear every letter,
or play Endless mode where every word is replaced by new letters.

Live at https://hellopersonality.github.io/WordProm/

## How the site is put together

Everything lives at the top level of the repository, and GitHub Pages serves it as is.

| File | What it is |
| --- | --- |
| `index.html` | The whole game: markup, styles, code and both word lists |
| `Figtree-*.ttf`, `OFL.txt` | The font and its licence |
| `favicon.svg`, `icon-192.png`, `icon-512.png` | Browser and home-screen icons |
| `manifest.webmanifest` | Lets players install the game as an app |
| `version.json` | The newest build's stamp. Players on an older build see an "Update" banner |
| `sw.js` | Offline cache, versioned with the same build stamp |
| `.nojekyll` | Tells GitHub Pages not to process the files |

Pages settings: Deploy from a branch, `main`, folder `/ (root)`.

Each release stamps the same build id into `index.html`, `version.json` and `sw.js`. Open games check
`version.json` on start, every 10 minutes and when the tab comes back to the front; updating saves the
game, reloads, and drops the player straight back where they were.

## Credits and licences

- Dictionary: ENABLE word list, public domain.
- Hidden-word list: built from the 12dicts core lists by Alan Beale (public domain; the author asks
  for acknowledgment), cross-checked against ENABLE and filtered to keep cube words family-friendly.
- Font: Figtree by Erik Kennedy, SIL Open Font License 1.1 (`OFL.txt`).
- Saves are stored in each player's browser.
