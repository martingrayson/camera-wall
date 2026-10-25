# Camera Wall

A tiny standalone **Samsung TV (Tizen) app** that shows a grid of live security-camera feeds
from **Home Assistant**. Point the remote at a camera, press OK to blow it up full-screen.

Built deliberately plain — plain HTML/CSS/ES5, no framework, no CSS variables, no CSS grid — so
it runs on **old TVs**. It's confirmed working on a 2017 **Samsung UE55MU7000 (Tizen 3.0)**, a
model Samsung's current developer tooling nominally no longer supports.

## Features

- 2×2 grid of up to four cameras, auto-refreshing near-live snapshots.
- **OK** on a tile → enlarge to the live MJPEG stream. **Back** → grid, again → exit.
- Full remote navigation (arrow keys).
- Talks to Home Assistant directly over the LAN; no cloud, no extra services.

## Quick start

1. **Configure** — copy the template and add your Home Assistant details:
   ```bash
   cp config.example.js config.js
   ```
   ```js
   window.CAMERAS = {
     base: "https://your-home-assistant:8123",
     token: "<HA long-lived access token>",   // HA → Profile → Security → Long-lived tokens
     cams: [
       { id: "camera.front", name: "Front" },
       { id: "camera.back",     name: "Back" },
       { id: "camera.garden",   name: "Garden" }
     ]
   };
   ```
   `config.js` is git-ignored — your token never leaves your machine.

2. **Preview the layout** on a computer (feeds only load on the TV):
   ```bash
   python3 -m http.server 4797   # open http://127.0.0.1:4797/index.html
   ```

3. **Build & install on the TV** — enable Developer Mode on the TV, then package, sign with your
   Samsung certificate, and install with the Tizen SDK. Full commands are in
   [CLAUDE.md](CLAUDE.md).

## Installing on older (pre-2021) Samsung TVs

Current Samsung developer certificates are only trusted by 2021+ TVs, so a 2017/2018 set rejects
a signed app with `install failed[118]` — **until you authorize the computer** with the
**"Permit to install"** step (Device Manager, using a Samsung certificate that carries that TV's
DUID), then restart the TV. That's the whole trick; it's written up step-by-step in
[CLAUDE.md](CLAUDE.md), and the complete debugging story is in [STATUS.md](STATUS.md).

## How it works

Home Assistant exposes each camera as an image: the grid polls
`/api/camera_proxy/<entity>` and the enlarged view uses `/api/camera_proxy_stream/<entity>`
(MJPEG), authorized with a rotating `access_token` read from `/api/states/<entity>`. On the TV
the Tizen runtime isn't subject to browser CORS, so these load fine from the app's own origin.

## Licence / notes

Personal project. Not affiliated with Samsung or Home Assistant. Use at your own risk — it
drives developer-mode installs on your own TV.
