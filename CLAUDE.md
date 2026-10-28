# Frankfurt Falls — guide for Claude

You are continuing **Frankfurt Falls**, a 3D rage-climber browser game made by **Diego Danylov** (Yura's son; Yura, GitHub `ydanilov`, hosts the repos and runs the sessions). Credit "Diego Danylov" anywhere the game names an author (title card, end card, README, meta tags). Public showcase of Diego's games: https://diego-games.vercel.app.

## 1. The game in one minute
Frank, a floppy hotdog (sesame-bun jacket, mustard zigzag, white gloves, red sneakers), climbs Chef Le Grill's food tower to free his buddies from a birdcage on the roof.
- 4 floors (`FL`): Greasy Kitchen, Pantry Shelves, Rooftop Grill, Chef's Roof. Ring-shaped ledges around a central tower; falling more than 5 m counts as a "fall".
- Gatekeepers (`KEEPERS`: Bunsworth, Dill Pickleton, Señor Mostaza) ask a would-you-rather; each answer adds a hazard (`HAZ`: grease, wind, wiener dogs, ketchup drips, burners, sticky mustard) to all floors above.
- Bridges between floors (`RIVALS`: Bratty McBrat, Kielbasa Kid, Count Wurstula): health-bar fights with sauce weapons from crates (`WPN`).
- Chef boss on the roof (`stepChef`): pans, ketchup sniper, meatballs, spatula sweep, pan flip; stomp his hat while he's dizzy, 3 hp, phase 2 at 1 hp.
- Story comic (`COMIC.intro` 4 panels, `COMIC.end` 1 panel), shop **Frank's Closet** (`SHOP`), pause, end screen with stats.

## 2. Files
| Path | What |
|---|---|
| `src.html` | **Source of truth.** Artifact body: starts at `<title>`, no doctype/html/head/body. Edit this. |
| `index.html` | Full page for Vercel. Regenerate with `bash tools/build-index.sh`; never edit by hand. |
| `assets/ff_*.webp` | 7 painted menu backdrops, 1024×572: `ff_title`, `ff_shop`, `ff_comic1..4`, `ff_victory`; plus 4 in-game sky panoramas `ff_sky1..4` (1376×768). Referenced by **relative** paths (`assets/ff_title.webp`). |
| `tools/` | Playwright tests (`boot.js`, `menus.js`, `run.js`, `mobile.js`), `lib.js` helpers, `build-test.sh`, `build-index.sh`. |

## 3. Code map (`src.html`)
CSS (tokens on `:root`: `--ink --paper --ketchup --mustard --relish`, fonts `--display` Lilita One, `--comic` Bangers, `--body` Nunito) → HTML (`#bgart` backdrops, canvas, HUD, dialog `#dlg`, overlays `#title #shop #pause #end`, `#comic`, bridge HUD, touch `#pad`) → one IIFE script:
renderer (alpha canvas, layer 1 = sausage logo letters) · data (`HAZ KEEPERS FL SHOP`) · save · audio · `Saus` character · scenery + sausage title sign · level building (`loadFloor`) · keepers/dogs · Chef · Frank physics · input (`press`, `pollPad`, `KMAP`) · **menu navigation** (`MENUS`, `menuKey`, `moveFocus`, `kbnav`) · shop (`openShop`, `renderShop`, `buy`, `shopMsg`) · comic (`COMIC`, `showPanel`, `refreshPanelArt`, `placeBubbles`) · flow (`startGame`, `nextFloor`, `finish`, `togglePause`, `updateOverlays`, `showEl` transitions, `ART` image states) · dialog · particles · bridges · camera (art-aware framing for title/shop) · loop (`drawModeFor` / `drawScene`).

### Art system
- `ART[key]` = `loading | ready | failed` per image, set by `setArt` from `img` load/error events (`initArt`).
- Backdrops: `.bgl` layers (`#bg-title`, `#bg-shop`, `#bg-victory`) show a shimmer skeleton while loading, fade the image in when ready, Ken-Burns drift (off under reduced motion). Per-image crop via CSS vars on each layer: `--op` (landscape object-position), `--opp` (portrait), `--kbo` (zoom origin).
- The canvas is transparent. `drawModeFor(state)` picks what WebGL draws: `logo` (only the sausage FRANKFURT FALLS letters, layer 1) over title art, `frank` (only Frank) over shop art, `none` over victory/comic art, `world` otherwise **or whenever that screen's image failed** — so the game still looks right with no images.
- Comic panels: each `COMIC` entry has `art` (image key), `opp` (portrait crop x %), `capPos` (`tl`/`bl`), and `ab` = bubble anchors `[x%, y%, tail%]` in **image** coordinates (`placeBubbles` maps them through the object-fit crop and clamps inside the frame). If the image failed, the old 3D comic scene (`setup(t)`, `cam`, `look`) is used.
- **In-game skies** (`SKYD`, `setSky`, `updateSky`, `skyScene`): each floor has a painted panorama `assets/ff_sky1..4.webp` (1376×768) on two inward-facing cylinders centred on the tower in a separate `skyScene` (rendered before `scene`, so no fog and no outlines; `scene.background` is null in world mode). Far layer R470 (hazed, slow drift), near layer R400 (transparent above the skyline, nudged by camera yaw for parallax); u is repeated 4× with a mirrored triangle wave so there is no seam; top fades to `cap`, bottom to `hor`. `loadFloor(i)` → `setSky(i)`, `loadBridge(i)` → `setSky(i+1)` (the floor it leads to). Changing floor crossfades the textures (1.3 s) and lerps fog colour/distance, hemisphere + sun tint and the ground disc colour (`GROUND`) to the floor's `SKYD` values. Textures load lazily (current + next floor, others disposed); small screens downscale to 1024×512. If an image is missing/failed the floor keeps its old flat `FL[i].c.sky` colour, fog and lights. Debug: `__ff.sky()`.
- Layouts: wide screens put the title/end card bottom-left under the logo and the shop card on the right (Frank stands in the closet spotlight); phone landscape puts cards right; portrait stacks at the bottom. Cards scroll if taller than the viewport.

### Rules
- Save key `frankfurtFalls.save` must never change; default new fields on load.
- Keep `window.__ff` (tests depend on it): `S P save ART drawMode loadFloor loadBridge BR chef openDialog closeDialog startGame openShop renderShop playComic comicNext finish step surfs lettersSettled CM`.
- Every interactive control needs default / hover / pressed / focus-visible / disabled states; keyboard and gamepad focus uses `body.kbnav` + the mustard ring. Respect `prefers-reduced-motion`.
- Touch targets ≥ 44 px, body text ≥ 13–14 px, honour `env(safe-area-inset-*)`.

## 4. Edit → build → test
```bash
# edit src.html
bash tools/build-index.sh          # regenerate index.html
cd tools && npm install            # first time only
bash build-test.sh                 # test.html with local three.js
node boot.js && node menus.js && node run.js && node mobile.js   # or: npm test
```
Then **Read the PNGs in `tools/shots/`** and fix anything ugly. Tests serve the repo root on a random port; Chromium is `/opt/pw-browsers/chromium` if present (SwiftShader WebGL is slow: ~20–40 fps, menus.js takes a few minutes).

## 5. Publishing (only when Yura/the coordinator asks)
- **Artifact:** republish to the **same URL** https://claude.ai/artifact/CDiRLv1HnFyZ8WbKNkr5Qc (saves are per-origin; a new URL loses players' progress). Use the Artifact tool with `file_path` = `src.html`, `url` = that URL, and the images as supporting files via `files`: `{"assets/ff_title.webp":"assets/ff_title.webp", ... all 11 incl. ff_sky1..4}`. Read the artifact first if this conversation has not published it.
- **Web:** push `main` to GitHub `ydanilov/game-frankfurt-falls` (remote `origin`); pushes auto-deploy to the Vercel project `game-frankfurt-falls` → https://game-frankfurt-falls.vercel.app. Run `tools/build-index.sh` before committing.
- Commit messages end with the session's Co-Authored-By / Claude-Session lines.
