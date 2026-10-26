#!/usr/bin/env python3
"""Stamp a new build id into index.html, version.json and sw.js before pushing a release.

Open games compare their BUILD with version.json and offer an Update banner when they differ,
and the offline cache name changes so returning players get fresh files.
Run from the repo root:  python3 tools/release.py
"""
import datetime, json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
build = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')
idx = root / 'index.html'
html, n = re.subn(r"const BUILD='[^']*';", f"const BUILD='{build}';", idx.read_text(), count=1)
assert n == 1, 'BUILD constant not found in index.html'
idx.write_text(html)
(root / 'version.json').write_text(json.dumps({'build': build}) + '\n')
sw = root / 'sw.js'
s, n = re.subn(r"^const VERSION = .*$", f"const VERSION = 'wubix-{build}';", sw.read_text(), count=1, flags=re.M)
assert n == 1, 'VERSION line not found in sw.js'
sw.write_text(s)
print('build', build)
