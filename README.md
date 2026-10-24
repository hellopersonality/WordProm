# WordProm

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
| `sw.js` | Offline cache. Change `VERSION` in it on every release so returning players get the update |
| `.nojekyll` | Tells GitHub Pages not to process the files |

Pages settings: Deploy from a branch, `main`, folder `/ (root)`.

## Credits and licences

- Dictionary: ENABLE word list, public domain.
- Hidden-word list: built from the 12dicts core lists by Alan Beale (public domain; the author asks
  for acknowledgment), cross-checked against ENABLE and filtered to keep cube words family-friendly.
- Font: Figtree by Erik Kennedy, SIL Open Font License 1.1 (`OFL.txt`).
- Saves are stored in each player's browser.
