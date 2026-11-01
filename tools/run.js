// run: use window.__ff hooks to load every floor and bridge, step the simulation, reach the Chef, defeat him and land on the end screen.
const { serve, launch, open, shot, check, done, VP } = require('./lib');
const ptOk = (page, id, key) => page.waitForFunction(([id, key]) => { const e = document.getElementById(id); return e && !e.classList.contains('off') && e.dataset.k === key && e.classList.contains('ready') && e.querySelector('img').naturalWidth > 0 && e.offsetWidth > 0; }, [id, key], { timeout: 20000 }).then(() => true, () => false);
(async () => {
  const { srv, url } = await serve(); const b = await launch();
  const { page, errs } = await open(b, url, VP.desktop);
  await page.evaluate(() => { const f = window.__ff; f.video(false); /* cut-ins are covered by video.js */ f.save.seenComic = true; f.startGame(); });
  await page.waitForFunction(() => window.__ff.S.state === 'play', null, { timeout: 15000 });
  for (let i = 0; i < 4; i++) {
    const r = await page.evaluate(i => { const f = window.__ff; f.S.choices = [{ key: 'grease', floor: 0 }, { key: 'dog', floor: 1 }, { key: 'burners', floor: 2 }].slice(0, i); f.loadFloor(i); f.step(600); return { floor: f.S.floor, surfs: f.surfs().length, state: f.S.state, y: f.P.y }; }, i);
    check(r.floor === i && r.surfs > 5 && isFinite(r.y), `floor ${i + 1}: ${r.surfs} surfaces, stepped 5 s (state ${r.state})`);
    await page.waitForFunction(i => { const s = window.__ff.sky(); return s.k === i && s.st[i] === 'ready' && s.mix >= 1 && s.w > .9; }, i, { timeout: 30000 }).catch(() => {});
    const sk = await page.evaluate(() => window.__ff.sky());
    check(sk.k === i && new RegExp('ff_sky' + (i + 1) + '\\.webp').test(sk.img || '') && sk.fog !== sk.flat.toLowerCase(), `floor ${i + 1} uses painted sky ff_sky${i + 1} (fog ${sk.fog})`);
    await page.waitForTimeout(300); await shot(page, `run_floor${i + 1}`);
  }
  for (let i = 0; i < 3; i++) {
    const r = await page.evaluate(i => { const f = window.__ff; f.S.state = 'play'; f.loadBridge(i); f.BR.go = 0; f.step(480);
      const R = f.BR.riv; R.hp = 1; f.step(1); const before = f.BR.over; R.hp = -1; return { name: f.BR.def.name, before, hpF: f.BR.hpF }; }, i);
    check(r.name && isFinite(r.hpF), `bridge ${i + 1} vs ${r.name}: simulated 4 s, Frank hp ${Math.round(r.hpF)}`);
    await page.waitForFunction(i => { const s = window.__ff.sky(); return s.k === i + 1 && s.st[i + 1] === 'ready' && s.mix >= 1; }, i, { timeout: 30000 }).catch(() => {});
    check(await page.evaluate(i => window.__ff.sky().k === i + 1, i), `bridge ${i + 1} shows the sky of floor ${i + 2}`);
    await page.waitForTimeout(300); await shot(page, `run_bridge${i + 1}`);
  }
  // bridge win -> next floor transition
  await page.evaluate(() => { const f = window.__ff; f.S.state = 'play'; f.loadBridge(0); f.BR.go = 0; f.S.floor = 0; f.BR.riv.hp = 1; f.step(2); });
  await page.evaluate(() => { const f = window.__ff; const R = f.BR.riv; R.hp = 0.0001; });
  // portraits: keeper dialog, bridge intro + rival dialog
  await page.evaluate(() => { const f = window.__ff; f.S.state = 'play'; f.S.choices = []; f.loadFloor(0); f.openDialog('keeper'); });
  check(await ptOk(page, 'dpt', 'bun'), 'keeper dialog shows Bunsworth portrait');
  check(await ptOk(page, 'hpt', 'frank'), 'HUD shows Frank portrait');
  await page.evaluate(() => { const f = window.__ff; f.D && 0; document.getElementById('dlg').click(); });
  await page.waitForTimeout(200); await page.evaluate(() => document.getElementById('dlg').click());
  await page.evaluate(() => document.getElementById('optA').click());
  check(await ptOk(page, 'dfr', 'frank_happy'), 'Frank reacts happy after answering');
  await shot(page, 'run_keeper_portrait');
  await page.evaluate(() => { const f = window.__ff; f.closeDialog(); f.S.state = 'play'; f.loadBridge(1); });
  await page.evaluate(() => window.__ff.openDialog('rival'));
  check(await ptOk(page, 'dpt', 'kielbasa'), 'bridge rival dialog shows Kielbasa Kid portrait');
  await shot(page, 'run_rival_portrait');
  await page.evaluate(() => window.__ff.closeDialog());
  // roof / Chef
  const roof = await page.evaluate(() => { const f = window.__ff; f.S.state = 'play'; f.loadFloor(3); const C = f.chef; const rs = f.surfs().find(s => s.roof);
    Object.assign(f.P, { x: 4, z: 0, y: rs.y, vx: 0, vy: 0, vz: 0, onGround: true, sup: rs }); f.step(2);
    const st = f.S.state; window.__dlgChef = document.getElementById('dpt').dataset.k; f.closeDialog(); f.step(240); return { st, chef: C.state, hp: C.hp }; });
  check(roof.st === 'dialog', 'stepping onto the roof opens the Chef dialog');
  check(await page.evaluate(() => window.__dlgChef) === 'chef', 'Chef dialog shows Chef portrait');
  await page.evaluate(() => { const f = window.__ff; f.chef.state = 'idle'; f.chef.t = 5; f.step(30); });
  check(await ptOk(page, 'popt', 'chef') && await page.isVisible('#pop'), 'Chef taunt pops up with his portrait');
  await shot(page, 'run_chef_pop');
  await shot(page, 'run_chef');
  const win = await page.evaluate(async () => { const f = window.__ff, C = f.chef; let guard = 0;
    while (C.hp > 0 && guard++ < 20) { C.state = 'dizzy'; C.t = 0; C.crouch = 1; const ht = f.chef ? (f.surfs().find(s => s.roof).y + 4.75 * (1 - .64)) : 0;
      Object.assign(f.P, { x: 0.2, z: 0.1, y: ht + 0.6, vy: -6, vx: 0, vz: 0, onGround: false, sup: null, inv: 0, stun: 0, rag: 0 }); f.step(30); C.state = 'hurt'; C.t = 2; f.step(1); }
    return { hp: C.hp, state: C.state }; });
  check(win.hp <= 0 && win.state === 'defeated', `Chef stomped down to ${win.hp} hp (${win.state})`);
  await page.evaluate(() => window.__ff.step(480));
  await page.waitForFunction(() => window.__ff.S.state === 'comic', null, { timeout: 8000 }).catch(() => {});
  const cm = await page.evaluate(() => ({ st: window.__ff.S.state, art: document.querySelector('.cimg.cur') && document.querySelector('.cimg.cur').id }));
  check(cm.st === 'comic' && cm.art === 'ci-victory', 'ending panel shows victory art: ' + JSON.stringify(cm));
  await page.waitForTimeout(1500); await shot(page, 'run_ending_panel');
  await page.evaluate(() => window.__ff.comicNext()); await page.waitForTimeout(1000);
  check(await page.evaluate(() => window.__ff.S.state) === 'end', 'Finish -> end screen');
  await shot(page, 'run_end');
  check(errs.length === 0, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close(); done('run');
})().catch(e => { console.error(e); process.exit(1); });
