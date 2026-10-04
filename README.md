# Sweetwater

A first-person recreation of **Sweetwater**, the frontier town from HBO's *Westworld*, built to run in a browser.
Walk off the train, stroll the length of Main Street, push through the batwing doors of the Mariposa,
climb the Coronado's staircase and watch the light go gold over the mesas.

No build step, no bundler, no CDN — plain ES modules and a vendored copy of three.js r160.

---

## Running it

```bash
npm install --omit=dev     # optional: only pulls in `ws` for the multiplayer relay
node server.js             # http://localhost:3000
```

`PORT` and `HOST` are read from the environment (defaults `3000` / `0.0.0.0`).

## Controls

| | |
|---|---|
| `W A S D` | Move |
| `Shift` | Run |
| `Ctrl` | Crouch |
| `Space` | Jump |
| Mouse | Look (click to capture the pointer) |
| `E` | Interact |
| `T` | Lantern |
| `M` | Town map (click a marker to fast-travel) |
| `Esc` | Pause / settings |
| `F3` | Performance stats |

Touch devices get an on-screen stick and buttons automatically.

## What's in the town

Every canonical location is placed and enterable — all 28 buildings:

*Main Street* — Mariposa Saloon, Coronado Hotel & Restaurant, Sweetwater Bank & Trust,
H. Sharp General Store, The Sweetwater Gazette, The Sheriff's Office, Dr. O'Rourke,
A. Mull Embalmer & Undertaker, Gunsmith, Sweetwater Post Office, Lehmer Bro. Clothing & Tailor,
County Recording Office, Dillin & Foote, G. Benz Harness, Whitfield's Tip Top Sarsaparilla,
Livery & Board, McIntyre Shipping & Freight, Sonski & Sons, McGinty Sash & Door Co.,
Mining Exchange, Photographer's Shop, Cabinet & Window Carpentry, Men's Clothing & Tailor,
Bakery & Restaurant, Delos Stables.

Plus the **Train Platform** with its welcome arch, the **Sweetwater Chapel** and cemetery on the
north edge, back-lot corrals and workshops, and ~30 ambient hosts on looping beats — Dolores by
the general store, the photographer on Main Street, a bounty board by the sheriff's office,
bartenders, piano players, clerks and riders.

## How it's built

```
public/
  index.html            loader, menu, HUD, map, settings panels
  js/
    main.js             boot sequence, game loop, keybinds
    core/               Engine (renderer + post FX + quality presets), Assets, Audio, GradeShader
    world/              Terrain, Sky, Builder, Buildings, Furnish, Props, Sweetwater, Hosts
    player/Player.js    capsule collision, step-up, ramp climbing, coyote/jump buffering
    ui/HUD.js           compass, toasts, place cards, map
  assets/textures/      10 CC0 ambientCG PBR sets
  assets/hdri/          Poly Haven skies (day + dusk)
  assets/models/        horse.glb, stork.glb
  vendor/three/         three.js r160 (module build + the examples we import)
server.js               static server, ETag/brotli/gzip, SPA fallback
```

The town is assembled by a small **MeshBuilder** DSL: primitives are declared in a transform stack,
tagged with a material, and merged into a handful of draw calls. One `B.build()` call emits the whole
town (~535k triangles in ~530 draw calls) plus its collider set and ramp list.

### Collision notes

The player is a capsule resolved axis-by-axis against an AABB spatial hash. Two details matter:

* **Doorway keep-clear.** Street dressing is laid down *before* the buildings, and each shop clears
  its footprint plus an approach corridor for clutter. Facade segments are tagged and preserved
  during that sweep, so the broad path cannot erase solid wall panels or enlarge the designed
  openings. Barrels, hitching rails and porch clutter can never seal a shop.
* **Stairs are ramps.** Flights are drawn as discrete treads but collide as a single smooth slope,
  so you glide up instead of catching a toe on every riser.

## Deploying to Render

`render.yaml` is a blueprint — Render reads it straight from the repo.

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo, and it configures itself.
3. Or one click:

   `https://render.com/deploy?repo=https://github.com/GraphicMiles/Game-test`

Free plan, Node 20, `npm install --omit=dev` then `node server.js`, health check on `/healthz`.
First load takes a few seconds while the 12 MB of textures and HDRIs download — they're served
with `Cache-Control: immutable`, so only the first visit pays for it.

## Multiplayer

The relay is **stubbed but ready**. `server.js` looks for the optional `ws` package; if it's
missing the server runs single-player and the client never tries to open a socket. Install it
(`npm i ws`) and the Socket.IO-compatible relay comes up on the same port; set `NO_MULTIPLAYER=1`
to force it off. `/api/info` reports `multiplayer: true|false`.

## Credits

* Textures — [ambientCG](https://ambientcg.com) (CC0)
* Skies — [Poly Haven](https://polyhaven.com) (CC0)
* Models — three.js examples (CC0)
* three.js — MIT

*Westworld* is a trademark of HBO / Warner Bros. Discovery. This is an unofficial, non-commercial
fan recreation; no assets from the show are distributed here.
