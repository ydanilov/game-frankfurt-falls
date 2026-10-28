// mobile: at phone portrait / phone landscape / tablet, cards, HUD, touch pad and dialogs fit the viewport and don't overlap.
const { serve, launch, open, shot, check, done, VP } = require('./lib');
const SMALL = { phone: VP.phone, phoneL: VP.phoneL, tablet: VP.tablet };
const boxes = sel => document.querySelectorAll(sel);
async function measure(page) {
  return page.evaluate(() => {
    const vis = el => { if (!el) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const R = el => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, id: el.id || el.className.toString().split(' ').slice(0, 2).join('.') }; };
    const W = innerWidth, H = innerHeight, out = [];
    const sels = ['.overlay:not([hidden]) .card', '.hud .card', '.hud .ibtn', '.pad .pb', '.pad .joyhint', '.dlg', '.boss', '.vs', '.wpn', '.meter', '.cframe', '.cbtns .btn', '.cap'];
    const els = [...document.querySelectorAll(sels.join(','))].filter(vis);
    els.forEach(e => { const r = R(e); if (e.closest('.overlay')) { /* overlay cards may scroll: check horizontal fit only */ if (r.l < -1 || r.r > W + 1) out.push('x-overflow ' + r.id); } else if (r.l < -1 || r.t < -1 || r.r > W + 1 || r.b > H + 1) out.push('overflow ' + r.id + ' ' + JSON.stringify([Math.round(r.l), Math.round(r.t), Math.round(r.r), Math.round(r.b)])); });
    const groups = { hud: [...document.querySelectorAll('.hud .card,.hud .ibtn,.boss,.vs,.meter')].filter(vis), pad: [...document.querySelectorAll('.pad .pb,.pad .joyhint')].filter(vis), dlg: [...document.querySelectorAll('.dlg,.wpn')].filter(vis) };
    const ov = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
    const keys = Object.keys(groups);
    for (let i = 0; i < keys.length; i++) for (let j = i; j < keys.length; j++) for (const a of groups[keys[i]]) for (const b of groups[keys[j]]) { if (a === b || a.contains(b) || b.contains(a)) continue; if (keys[i] === keys[j] && keys[i] !== 'hud') continue; if (ov(R(a), R(b))) out.push(`overlap ${R(a).id} / ${R(b).id}`); }
    const small = [...document.querySelectorAll('button,.pb')].filter(vis).filter(e => { return e.offsetWidth < 44 || e.offsetHeight < 44; /* layout size, ignores entry/press transforms */ }).map(e => R(e).id);
    if (small.length) out.push('small targets: ' + small.join(','));
    const tiny = [...document.querySelectorAll('.tagline,.controls dd,.endp,.shopmsg,.say,.item small,.best,.hint')].filter(vis).filter(e => parseFloat(getComputedStyle(e).fontSize) < 13).map(e => R(e).id);
    if (tiny.length) out.push('text <13px: ' + tiny.join(','));
    if (document.documentElement.scrollWidth > W + 1) out.push('page h-scroll');
    return out;
  });
}
(async () => {
  const { srv, url } = await serve(); const b = await launch();
  for (const [tag, vp] of Object.entries(SMALL)) {
    console.log(`-- ${tag} ${vp.width}x${vp.height}`);
    const { page, errs, ctx } = await open(b, url, vp, { touch: true });
    await page.waitForFunction(() => window.__ff.ART.title !== 'loading' && window.__ff.lettersSettled(), null, { timeout: 60000 }); await page.waitForTimeout(400);
    const states = [
      ['title', async () => {}],
      ['shop', async () => { await page.evaluate(() => window.__ff.openShop()); }],
      ['comic', async () => { await page.evaluate(() => window.__ff.playComic('intro', () => {})); await page.waitForTimeout(1500); }],
      ['play', async () => { await page.evaluate(() => { const f = window.__ff; f.save.seenComic = true; f.S.state = 'title'; f.startGame(); }); await page.waitForFunction(() => window.__ff.S.state === 'play'); await page.evaluate(() => { const f = window.__ff; f.S.choices = [{ key: 'wind', floor: 0 }, { key: 'drips', floor: 1 }]; f.loadFloor(2); }); }],
      ['dialog', async () => { await page.evaluate(() => { const f = window.__ff; f.S.state = 'play'; f.loadFloor(0); f.openDialog('keeper'); }); await page.waitForTimeout(4500); }],
      ['bridge', async () => { await page.evaluate(() => { const f = window.__ff; f.closeDialog(); f.S.state = 'play'; f.loadBridge(1); f.BR.go = 0; }); }],
      ['boss', async () => { await page.evaluate(() => { const f = window.__ff; f.S.state = 'play'; f.loadFloor(3); f.chef.state = 'idle'; }); }],
      ['pause', async () => { await page.evaluate(() => { document.getElementById('bpause').click(); }); }],
      ['end', async () => { await page.evaluate(() => { const f = window.__ff; f.S.state = 'play'; f.S.time = 222; f.finish(); }); }],
    ];
    for (const [name, go] of states) {
      await go(); await page.waitForTimeout(700);
      if (['play', 'bridge', 'boss'].includes(name)) await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      const issues = await measure(page);
      check(issues.length === 0, `${tag} ${name}` + (issues.length ? ': ' + issues.join(' ; ') : ''));
      await shot(page, `mobile_${tag}_${name}`);
    }
    check(errs.length === 0, `${tag}: no console errors` + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }
  await b.close(); srv.close(); done('mobile');
})().catch(e => { console.error(e); process.exit(1); });
