# Bernard's Arcade

TV arcade starring **Bernard**, a long-haired German Shepherd.

- **Flappy Bernard** — flap through the brick gaps
- **Lane Hoppers with Bernard** — Nick or Giulia hop the streets, yards and creeks; Bernard ferries the water. Grab the bike for double hops.
- **Flying with Bernard** — biplane or firefighter jet
- **Ballies with Bernard** — scoop his balls, get clear, throw them back to Giulia before he steals them
- **Bernard Says** — Simon on an SNES pad: he lights up buttons, you press them back

Every game has its own chiptune soundtrack (mute with the Sound button).

Same link on a phone, a laptop, or the TV. On a phone: tap a cabinet, tap to flap, and use the on-screen stick to fly. On the Onn 4K Pro, plug in a USB SNES pad.

## Ballies strategy

- Fill your arms: three balls thrown together pay +40, and a PERFECT release doubles every ball.
- Gold is 75, green 30, red only 10. Sprint for the glowing one.
- Get clear before you wind up: he steals from your arms up close. Wait for the ring to turn green.
- Throw from beyond the fire pit for a long-ball bonus on every ball.
- Grab the bone and he drops everything to chew it: a free volley.
- The final 15 seconds bank double. Save a full armful for last call.

## Play locally

Serve the folder (the art paths start with `/`, so opening `index.html` straight from disk shows no pictures):

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

| SNES | Menu | Game | Pause menu |
| --- | --- | --- | --- |
| D-pad | Choose | Move / hop / flap | Choose |
| B or A | Play | Flap / shoot / throw / ride | Confirm |
| Start | — | Pause | Resume |
| Select | Back | Pause | Quit to arcade |

In Bernard Says the d-pad and A, B, X, Y are the game. On a keyboard use the arrows and the A, B, X, Y keys.
