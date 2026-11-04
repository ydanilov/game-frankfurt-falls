// video: Chef entrance cut-in + animated victory backdrop. Forced on they play (desktop + phone) and skip; blocked / not allowed they fall back to stills.
const { serve, launch, open, shot, check, done, VP } = require('./lib');
async function toRoof(page, preload) {
  await page.evaluate(() => { const f = window.__ff; f.save.seenComic = true; f.S.state = 'title'; f.startGame(); });
  await page.waitForFunction(() => window.__ff.S.state === 'play', null, { timeout: 30000 });
  await page.evaluate(() => window.__ff.loadFloor(3)); /* floor 4 start preloads the Chef clip */
  if (preload) check(await page.waitForFunction(() => window.__ff.VID.st.chef === 'ready', null, { timeout: 30000 }).then(() => true, () => false), 'Chef clip preloaded when floor 4 starts');
  await page.evaluate(() => { const f = window.__ff; const rs = f.surfs().find(s => s.roof); Object.assign(f.P, { x: 4, z: 0, y: rs.y, vx: 0, vy: 0, vz: 0, onGround: true, sup: rs }); f.step(2); });
}
const playing = (page, id) => page.waitForFunction(id => { const v = document.getElementById(id); return v && !v.paused && v.currentTime > 0.05; }, id, { timeout: 30000 }).then(() => true, () => false);
async function forced(b, url, vp, tag) {
  console.log(`-- forced on, ${tag}`);
  const { page, errs, ctx } = await open(b, url, vp, { touch: tag !== 'desktop' });
  await page.evaluate(() => { window.__ff.video(true); const vc = document.getElementById('vchef'); vc.defaultPlaybackRate = vc.playbackRate = 0.3; /* test only: software GL is slower than the clip */ });
  await toRoof(page, true);
  check(await page.evaluate(() => window.__ff.S.state) === 'cutin', 'arriving on the roof starts the Chef cut-in (game paused)');
  check(await playing(page, 'vchef'), 'Chef clip plays');
  // software GL screenshots take seconds while the clip runs in real time: freeze it for the picture (test only)
  await page.evaluate(() => document.getElementById('vchef').pause());
  const t0 = await page.evaluate(() => window.__ff.S.time);
  await shot(page, `video_${tag}_chef`); await page.waitForTimeout(300);
  check(await page.evaluate(t0 => window.__ff.S.time === t0 && window.__ff.S.state === 'cutin', t0), 'game clock is frozen during the cut-in');
  await page.keyboard.press('KeyX');
  await page.waitForFunction(() => window.__ff.S.state === 'dialog', null, { timeout: 8000 }).catch(() => {});
  check(await page.evaluate(() => window.__ff.S.state === 'dialog' && document.getElementById('vchef').paused), 'any key skips to the Chef dialog');
  await page.evaluate(() => { const f = window.__ff; f.closeDialog(); f.S.time = 300; f.S.state = 'play'; f.finish(); });
  check(await playing(page, 'vvic') && await page.evaluate(() => document.getElementById('vvic').classList.contains('on')), 'victory clip plays behind the end card');
  await page.evaluate(() => document.getElementById('vvic').pause()); await shot(page, `video_${tag}_victory`); await page.evaluate(() => document.getElementById('vvic').play());
  await page.waitForFunction(() => { const v = document.getElementById('vvic'); return v.paused && v.currentTime > 7; }, null, { timeout: 40000 }).catch(() => {});
  check(await page.evaluate(() => { const v = document.getElementById('vvic'); return v.paused && v.currentTime > 7 && v.currentTime < 7.6 && v.classList.contains('on'); }), 'victory clip holds its last bright frame (before the fade)');
  await shot(page, `video_${tag}_victory_end`);
  await page.click('#bagain'); await page.waitForTimeout(800);
  check(await page.evaluate(() => !document.getElementById('vvic').classList.contains('on')), 'leaving the end screen stops the clip');
  check(errs.length === 0, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close();
}
(async () => {
  const { srv, url } = await serve(); const b = await launch();
  await forced(b, url, VP.desktop, 'desktop');
  await forced(b, url, VP.phone, 'phone');
  // big-fall replay
  console.log('-- big fall');
  { const { page, ctx, errs } = await open(b, url, VP.desktop);
    await page.evaluate(() => { const f = window.__ff; f.video(true); const v = document.getElementById('vfallv'); v.defaultPlaybackRate = v.playbackRate = 0.3; f.save.seenComic = true; f.startGame(); });
    await page.waitForFunction(() => window.__ff.S.state === 'play', null, { timeout: 30000 });
    check(await page.waitForFunction(() => window.__ff.VID.st.fall === 'ready', null, { timeout: 30000 }).then(() => true, () => false), 'fall clip preloaded when a floor starts');
    check(await page.evaluate(() => window.__ff.bigFall(4)) === false, 'a small fall (4 m) does not trigger it');
    await page.evaluate(() => { const f = window.__ff; f.S.falls = 7; f.bigFall(14); f.step(130); });
    check(await page.evaluate(() => window.__ff.S.state) === 'cutin' && await playing(page, 'vfallv'), 'a 14 m fall plays the replay (game paused)');
    check(await page.evaluate(() => document.getElementById('fcm').textContent === '-14 m!' && /Falls: 7/.test(document.getElementById('fcs').textContent)), 'caption shows the fall stats');
    await page.evaluate(() => document.getElementById('vfallv').pause()); await shot(page, 'video_desktop_fall');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__ff.S.state === 'play', null, { timeout: 8000 }).catch(() => {});
    check(await page.evaluate(() => window.__ff.S.state === 'play' && document.getElementById('vfall').hidden !== false || window.__ff.S.state === 'play'), 'any key skips back to play');
    await page.evaluate(() => { const f = window.__ff; f.bigFall(16); f.step(130); });
    check(await page.evaluate(() => window.__ff.S.state) === 'play', 'same floor: no second replay');
    await page.evaluate(() => { const f = window.__ff; f.loadFloor(1); f.S.time += 30; f.bigFall(16); f.step(130); });
    check(await page.evaluate(() => window.__ff.S.state) === 'play', 'next floor within the cooldown: no replay');
    await page.evaluate(() => { const f = window.__ff; f.loadBridge(1); f.S.time += 200; f.bigFall(20); f.step(130); });
    check(await page.evaluate(() => window.__ff.S.state) === 'play', 'never on a bridge');
    await page.evaluate(() => { const f = window.__ff; f.loadFloor(2); f.save.fallReplays = false; f.bigFall(20); f.step(130); });
    check(await page.evaluate(() => window.__ff.S.state) === 'play', 'setting off: no replay');
    check(errs.length === 0, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : '')); await ctx.close(); }
  { const { page, ctx } = await open(b, url, VP.phone, { touch: true });
    await page.evaluate(() => { const f = window.__ff; f.video(true); const v = document.getElementById('vfallv'); v.defaultPlaybackRate = v.playbackRate = 0.3; f.save.seenComic = true; f.startGame(); });
    await page.waitForFunction(() => window.__ff.VID.st.fall === 'ready', null, { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => { const f = window.__ff; f.bigFall(12); f.step(130); });
    if (await playing(page, 'vfallv')) await page.evaluate(() => document.getElementById('vfallv').pause());
    await shot(page, 'video_phone_fall'); await ctx.close(); }
  // default on a phone: stills (no cut-in)
  console.log('-- phone default');
  { const { page, ctx, errs } = await open(b, url, VP.phone, { touch: true });
    await toRoof(page);
    check(await page.evaluate(() => window.__ff.S.state) === 'dialog', 'phone (small screen) skips the cut-in, dialog opens directly');
    await page.evaluate(() => { const f = window.__ff; f.closeDialog(); f.S.state = 'play'; f.finish(); }); await page.waitForTimeout(1500);
    check(await page.evaluate(() => !document.getElementById('vvic').classList.contains('on')), 'phone end screen keeps the still');
    check(errs.length === 0, 'no console errors'); await ctx.close(); }
  // reduced motion on desktop: stills
  { const { page, ctx } = await open(b, url, VP.desktop, { reduced: true });
    await toRoof(page);
    check(await page.evaluate(() => window.__ff.S.state) === 'dialog', 'reduced motion: no cut-in'); await ctx.close(); }
  // blocked clips: fall back within ~1 s even when forced on
  console.log('-- blocked');
  const blk = await serve({ block: /assets\/video\// });
  { const { page, ctx, errs } = await open(b, blk.url, VP.desktop, { ignore404: true });
    await page.evaluate(() => window.__ff.video(true)); await toRoof(page);
    await page.waitForFunction(() => window.__ff.S.state === 'dialog', null, { timeout: 8000 }).catch(() => {});
    check(await page.evaluate(() => window.__ff.S.state) === 'dialog', 'blocked Chef clip -> straight to the dialog');
    await page.evaluate(() => { const f = window.__ff; f.closeDialog(); f.S.state = 'play'; f.loadFloor(1); f.S.time += 500; f.bigFall(15); f.step(130); });
    check(await page.evaluate(() => window.__ff.S.state) === 'play', 'blocked fall clip -> no replay, play continues');
    await page.evaluate(() => { const f = window.__ff; f.S.state = 'play'; f.finish(); }); await page.waitForTimeout(2500);
    check(await page.evaluate(() => !document.getElementById('vvic').classList.contains('on') && window.__ff.ART.victory === 'ready'), 'blocked victory clip -> painted still');
    await shot(page, 'video_blocked_end');
    check(errs.filter(e => !/ffv_/.test(e)).length === 0, 'no unexpected errors'); await ctx.close(); }
  blk.srv.close();
  await b.close(); srv.close(); done('video');
})().catch(e => { console.error(e); process.exit(1); });
