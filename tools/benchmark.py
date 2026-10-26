#!/usr/bin/env python3
"""Rebuild the score benchmark shown on the level-cleared card.

The card plots a player's level score against a histogram of simulated runs. This script plays
levels with three simple bots (casual, average, skilled) using the game's own scoring, word finder,
collapse, tray and end-early (sweep) rules, then writes the resulting histograms into index.html
between the /*BENCH:start*/ and /*BENCH:end*/ markers.

It is a model, not data from real players. Re-run it after changing the economy (coin values,
bonuses, costs), the level generator or the word lists, otherwise the curve drifts from the game.

    pip install playwright && playwright install chromium
    python3 tools/benchmark.py                 # defaults
    python3 tools/benchmark.py --runs 3000     # smoother curves, slower
"""
import argparse, json, os, re, sys, tempfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / 'index.html'
LEVELS = [1, 2, 3, 4, 5, 6, 8, 10, 13, 17, 25]   # a level uses the nearest benchmark at or below it
MIX = {'casual': .25, 'average': .45, 'skilled': .30}
LO, BIN, NBINS = 100, 10, 40                      # score axis: 100..500 in steps of 10

HOOK = r"""
window.__bench=(lv,skill)=>{
  newLevel(lv,0,'classic');G.found=[];G.collapses=0;
  let earned=0,spent=0,swept=0,coll=0;const tray=G.tray.slice();
  const filled=()=>G.stickers.filter(s=>s.ch);
  const val=w=>{const nf=facesIn(w.path);return w.w.length*cfg.coinsPerLetter+(w.w.length>=6?cfg.longBonus:0)+(nf-1)*cfg.crossBonus};
  const doneF=new Set();
  const take=w=>{earned+=val(w);G.found.push({w:w.w});
    new Set(w.path.map(s=>key(s.n))).forEach(fk=>{if(!doneF.has(fk)&&G.stickers.every(s=>key(s.n)!==fk||!s.ch||w.path.includes(s))){doneF.add(fk);earned+=cfg.faceBonus}});
    w.path.forEach(s=>s.ch=null)};
  const choose=ws=>{
    if(skill==='casual') return ws[rnd(ws.length)];
    if(skill==='average'){const wt=ws.map(w=>Math.pow(w.w.length,1.5));let r=Math.random()*wt.reduce((a,b)=>a+b,0);for(let i=0;i<ws.length;i++){r-=wt[i];if(r<=0)return ws[i]}return ws[ws.length-1]}
    let best=-1,pk=[];for(const w of ws){const v=val(w);if(v>best){best=v;pk=[w]}else if(v===best)pk.push(w)}return pk[rnd(pk.length)];
  };
  for(let guard=0;guard<300;guard++){
    const left=filled().length;if(!left)break;
    const ws=cubeWords(false);
    if(ws.length){take(choose(ws));continue}
    if(skill!=='casual'&&tray.length&&left<=10){            /* stuck: try a free tray letter next to what's left */
      const nb=neighbours();let done=false;
      const empt=G.stickers.filter(s=>!s.ch&&nb[s.id].some(id=>G.stickers[id].ch));
      outer:for(let ti=0;ti<tray.length;ti++){for(const e of empt){e.ch=tray[ti];const w2=cubeWords(false).filter(w=>w.path.includes(e));if(w2.length){tray.splice(ti,1);take(choose(w2));done=true;break outer}e.ch=null}}
      if(done)continue;
    }
    if(skill!=='casual'&&coll<cfg.freeCollapses){coll++;collapseLetters();if(anyWord())continue}
    if(left<=cfg.sweepMax){spent+=left*cfg.sweepCost;swept+=left;filled().forEach(s=>s.ch=null);break}
    return null;                                             /* unwinnable without a restart: not counted */
  }
  if(filled().length) return null;
  return earned+cfg.levelBonus+cfg.clearBonus+(swept?0:cfg.cleanBonus)-spent;
};
"""

def build_page(src):
    k = src.index('function tutStep')
    i = src.rindex('})();', k, src.index('</script>', k))
    return src[:i] + HOOK + src[i:]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--runs', type=int, default=2400, help='simulated runs per level')
    ap.add_argument('--levels', default=','.join(map(str, LEVELS)))
    ap.add_argument('--dry', action='store_true', help='print stats, do not touch index.html')
    a = ap.parse_args()
    levels = [int(x) for x in a.levels.split(',')]
    from playwright.sync_api import sync_playwright
    src = INDEX.read_text(encoding='utf-8')
    tmp = Path(tempfile.mkdtemp()) / 'bench.html'
    tmp.write_text(build_page(src), encoding='utf-8')
    for f in ROOT.glob('Figtree-*.ttf'):
        (tmp.parent / f.name).write_bytes(f.read_bytes())
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.goto(tmp.as_uri()); pg.evaluate("localStorage.setItem('twistword-seen','1')")
        pg.goto(tmp.as_uri()); pg.wait_for_timeout(500)
        for lv in levels:
            t0 = time.time(); scores = []
            for sk, w in MIX.items():
                need = int(a.runs * w); got = []
                while len(got) < need:
                    got += [s for s in pg.evaluate("([lv,s,n])=>{const o=[];for(let i=0;i<n;i++){const r=__bench(lv,s);if(r!==null)o.push(r)}return o}", [lv, sk, 40])]
                scores += got[:need]
            scores.sort(); n = len(scores)
            hist = [0] * NBINS
            for s in scores:
                hist[max(0, min(NBINS - 1, (s - LO) // BIN))] += 1
            out[lv] = [round(1000 * h / n) for h in hist]
            q = lambda f: scores[min(n - 1, int(f * n))]
            print(f'level {lv:>2}: n={n} p5/25/50/75/95 = {q(.05)}/{q(.25)}/{q(.5)}/{q(.75)}/{q(.95)}  ({time.time()-t0:.0f}s)', flush=True)
        b.close()
    if a.dry: return
    block = '/*BENCH:start*/\nconst BENCH={\n' + ',\n'.join(f'{lv}:[{",".join(map(str, h))}]' for lv, h in out.items()) + '\n};\n/*BENCH:end*/'
    new, c = re.subn(r'/\*BENCH:start\*/.*?/\*BENCH:end\*/', lambda m: block, src, flags=re.S)
    if c != 1:
        sys.exit('BENCH markers not found in index.html')
    INDEX.write_text(new, encoding='utf-8')
    print('wrote benchmark for levels', ', '.join(map(str, out)))

if __name__ == '__main__':
    main()
