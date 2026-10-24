# Twistword

A word puzzle on a 3x3 letter cube. Trace words across faces, twist rows and columns, clear every letter.
Plain HTML, CSS and JavaScript. No build step, no dependencies.

## Publish on GitHub Pages

1. Create a new public repository on GitHub, for example `twistword`.
2. Upload everything in this folder to the root of the repository (Add file > Upload files,
   drag the folder's contents in, commit). Include the hidden `.nojekyll` file if you can;
   it's optional.
3. In the repository go to Settings > Pages. Under Build and deployment choose
   Source: Deploy from a branch, Branch: `main`, folder `/ (root)`, and Save.
4. After a minute the game is live at `https://<your-username>.github.io/twistword/`.

Or from a terminal:

```
git init && git add . && git commit -m "Twistword"
git branch -M main
git remote add origin https://github.com/<your-username>/twistword.git
git push -u origin main
```

Every later push republishes the site. When you publish a change, also edit `VERSION` in `sw.js`
so returning players' offline copy is refreshed.

A custom domain can be set in Settings > Pages > Custom domain.

## Play locally

Open `index.html` directly, or serve the folder: `python -m http.server 8000` and visit
http://localhost:8000. Offline install only works over http(s).

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Page markup |
| `css/style.css` | All styles, including the bundled font faces |
| `js/game.js` | Game code |
| `data/words.js` | Word lists (dictionary and hidden-word list) |
| `fonts/` | Figtree font files and licence |
| `icons/` | Favicon and app icons |
| `manifest.webmanifest`, `sw.js` | Install as an app and play offline |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

## Credits and licences

- Dictionary: ENABLE word list, public domain.
- Hidden-word list: built from the 12dicts core lists by Alan Beale (public domain; the author asks
  for acknowledgment), cross-checked against ENABLE and filtered to keep cube words family-friendly.
- Font: Figtree by Erik Kennedy, SIL Open Font License 1.1 (`fonts/OFL.txt`).
- Saves are stored in each player's browser for the site they play on.
