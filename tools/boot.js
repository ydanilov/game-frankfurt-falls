// boot: page loads, no console errors, title visible, all 7 art images requested + loaded; fallback when art is missing.
const { serve, launch, open, shot, check, done, VP } = require('./lib');
const IMGS = ['ff_title', 'ff_shop', 'ff_comic1', 'ff_comic2', 'ff_comic3', 'ff_comic4', 'ff_victory'];
(async () => {
  const { srv, url } = await serve(); const b = await launch();
  const { page, errs } = await open(b, url, VP.desktop);
  const reqs = new Set(); page.on('request', r => { const m = r.url().match(/assets\/(ff_\w+)\.webp/); if (m) reqs.add(m[1]); });
  await page.reload({ waitUntil: 'commit' }); await page.waitForFunction(() => window.__ff, null, { timeout: 60000 });
  await page.waitForFunction(() => Object.values(window.__ff.ART).every(s => s !== 'loading'), null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  check(await page.isVisible('#title .panel'), 'title card visible');
  for (const n of IMGS) check(reqs.has(n), `requested ${n}.webp`);
  const art = await page.evaluate(() => window.__ff.ART);
  check(Object.values(art).every(s => s === 'ready'), 'all art loaded: ' + JSON.stringify(art));
  check(await page.evaluate(() => document.getElementById('bg-title').classList.contains('on')), 'title backdrop on');
  check(await page.evaluate(() => window.__ff.drawMode()) === 'logo', 'canvas draws only the logo over title art');
  check(await page.evaluate(() => localStorage.getItem('frankfurtFalls.save') !== undefined && typeof window.__ff.loadBridge === 'function'), 'debug hooks present');
  await shot(page, 'boot_title_desktop');
  check(errs.length === 0, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  // slow art: the loading skeleton shows
  const slow = await serve({ delay: 8000 });
  const s = await open(b, slow.url, VP.phone);
  check(await s.page.evaluate(() => document.getElementById('bg-title').classList.contains('loading')), 'loading skeleton while art downloads');
  await shot(s.page, 'boot_loading_phone'); slow.srv.close();
  // missing art: game falls back to the 3D scenery and still starts
  const miss = await serve({ block: /assets\// });
  const m = await open(b, miss.url, VP.desktop, { ignore404: true });
  await m.page.waitForFunction(() => window.__ff.ART.title === 'failed', null, { timeout: 30000, polling: 250 });
  await m.page.waitForTimeout(800);
  check(await m.page.evaluate(() => window.__ff.drawMode()) === 'world', 'missing art -> full 3D title scene');
  await shot(m.page, 'boot_fallback_noart');
  await m.page.evaluate(() => { window.__ff.save.seenComic = true; window.__ff.startGame(); }); await m.page.waitForFunction(() => window.__ff.S.state === 'play', null, { timeout: 30000 }).catch(() => {});
  const st0 = await m.page.evaluate(() => window.__ff.S.state);
  check(st0 === 'play', 'game starts without art (state ' + st0 + ')');
  check(m.errs.length === 0, 'no errors without art' + (m.errs.length ? ': ' + m.errs.join(' | ') : ''));
  miss.srv.close();
  await b.close(); srv.close(); done('boot');
})().catch(e => { console.error(e); process.exit(1); });
