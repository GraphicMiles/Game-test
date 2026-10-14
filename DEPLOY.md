# Deploy Sweetwater to Render — 3 steps

## The link

**https://render.com/deploy?repo=https://github.com/GraphicMiles/Game-test**

Click it. That's step 1.

---

## What happens when you click it

Render opens its blueprint page with `GraphicMiles/Game-test` already filled in. It reads
`render.yaml` straight from `main`, so **every setting is already correct** — you don't have to
type a build command, start command, or health check path.

You'll see one service: `sweetwater`, Node 20, free plan, Oregon.

1. Sign in (or create a free account).
2. Give the service a name if you want something other than `sweetwater`
   — this becomes your URL: `https://<name>.onrender.com`.
3. Click **Apply**.

The build runs `npm install --omit=dev` then `node server.js` and takes about two minutes.
When the status turns green and **Live**, open the URL.

---

## What to expect on first load

* **~30 s wait** if the service was asleep. Free instances suspend after ~15 min idle.
* **A few seconds of loading** — about 12 MB of PBR textures and HDRIs download once.
  They're served `Cache-Control: immutable`, so it's cached after that.
* Click **Arrive by Train** and you spawn on the Sweetwater Station platform facing
  north up Main Street.

---

## If you want to change things later

| Change | Where |
|---|---|
| Turn multiplayer on | `render.yaml` → set `NO_MULTIPLAYER` to `"0"`, then push |
| Faster cold starts | Dashboard → upgrade off the free plan |
| Region | `render.yaml` → `region:` (`frankfurt` for EU, `singapore` for Asia) |

Pushes to `main` auto-redeploy — `autoDeployTrigger: commit` is already set.

---

## Want me to do it for you instead?

I can create and monitor the service via the Render API, but I need a key — Render has no
unauthenticated API and, for obvious reasons, I can't log in as you.

1. Get one: **dashboard.render.com → Account Settings → API Keys → Create API Key**
   (it starts with `rnd_`).
2. Paste it to me.

Then it's one command:

```bash
RENDER_API_KEY=rnd_xxx node deploy/render-deploy.mjs
```

That script creates or updates the service, triggers a build, polls until it's live, and
verifies `/healthz` and `/api/info` before printing your URL.

---

## Already verified before you click

* `render.yaml` parses against the blueprint schema — no unknown or deprecated keys.
  (It initially had `autoDeployTrigger: on`, which is invalid and would have failed
  validation; it's now `commit`.)
* A clean clone with `npm install --omit=dev && node server.js` serves `/`, `/healthz`,
  and `/api/info` correctly under `NO_MULTIPLAYER=1`.
* The game boots in a real browser with zero console errors and zero failed requests.
