# Bernard's Arcade

TV arcade starring **Bernard**, a long-haired German Shepherd.

- **Flappy Bernard** — flap through the brick gaps
- **Flying with Bernard** — biplane or firefighter jet

Same link on a phone, a laptop, or the TV. On a phone: tap a cabinet, tap to flap, and use the on-screen stick to fly. On the Onn 4K Pro, plug in a USB SNES pad.

## Play locally

Open `index.html` in a browser, or:

```
npx serve .
```

## Cloudflare: use Pages, not Workers

This is a static site (HTML + CSS + JS + images). **Connect the repo to Cloudflare Pages.**

| | Pages | Workers |
| --- | --- | --- |
| This game | **Yes — use this** | Overkill |
| Build command | *(leave empty)* | not needed |
| Output directory | `/` | — |
| Root | repository root | — |

Cloudflare’s newer “start with Workers” path is for apps with a server. Bernard’s Arcade has no backend, so Pages is the right box.

### Pages setup

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Select `lb3253/bernards-arcade`
3. Framework preset: **None**
4. Build command: empty
5. Output directory: `/`  (or leave default)
6. Deploy

Your SNES pad on the Onn 4K Pro talks to the browser’s Gamepad API — no extra Cloudflare setting.

## Controls

| SNES | Menu | Game |
| --- | --- | --- |
| D-pad | Choose | Move / flap |
| B or A | Play | Flap / shoot |
| Start | — | Pause |
| Select | — | Back |
