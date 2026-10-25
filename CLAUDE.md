# Camera Wall — build & install runbook

A barebones standalone Samsung TV (Tizen) app showing a 2×2 grid of live Home Assistant camera
feeds. Written for **old TVs**: plain HTML/CSS/ES5, no CSS variables, no CSS grid, no framework.
Confirmed running on a 2017 **Samsung UE55MU7000 (Tizen 3.0)**.

This file is a **complete, standalone runbook** — you should be able to rebuild and install
without any other context. Reference values used below:

| Thing | Value |
| --- | --- |
| App ID | `Houqkr5pm8.CameraWall` |
| Package ID | `Houqkr5pm8` |
| Signing profile | `camerawall` (Samsung cert with the TV's DUID) |
| TV (2017 MU7000) | `<TV_IP>`, dev port `26101`, DUID `<YOUR_TV_DUID>` |
| This Mac's IP | `<HOST_PC_IP>` (the TV's Developer Mode "Host PC IP") |
| Home Assistant | `https://<YOUR_HA_HOST>` (resolves to `<HA_LAN_IP>` on the LAN) |
| SDK | `~/tizen-studio` (sdb: `~/tizen-studio/tools/sdb`; tizen: `~/tizen-studio/tools/ide/bin/tizen`) |

Camera IDs are in `config.js` (git-ignored; see "Configure").

---

## The files

| File | Purpose |
| --- | --- |
| `config.xml` | Tizen manifest (app id, `required_version="2.4"`, privileges, `<access origin="*">`) |
| `index.html`, `style.css`, `app.js` | the app (ES5, old-browser-safe) |
| `config.js` | **PRIVATE, git-ignored** — HA base URL + long-lived token + camera list |
| `config.example.js` | template for `config.js` |
| `icon.png` | 512×512 app icon (also used for the home-dock tile — see "Icons") |

## Configure (HA token)

Copy the template and fill it in; `config.js` is git-ignored so the token never gets committed:

```bash
cp config.example.js config.js
```
```js
window.CAMERAS = {
  base: "https://<YOUR_HA_HOST>",
  token: "<HA long-lived access token>",     // HA → Profile → Security → Long-lived tokens
  cams: [ { id: "camera.front", name: "Front" },
          { id: "camera.back",     name: "Back" },
          { id: "camera.garden",   name: "Garden" } ]   // up to 4 (2×2 grid)
};
```

---

## One-time setup

### 1. Tizen Studio + extensions
Install Tizen Studio (CLI is enough). Via its Package Manager install: **Certificate-Manager**,
**cert-add-on** (Samsung Certificate Extension), **TV-SAMSUNG-Public-WebAppDevelopment**,
**TV-SAMSUNG-Extension-Tools/Resources**. (All already installed under `~/tizen-studio`.)

### 2. Developer Mode on the TV
On the TV: **Apps** → press **123**/number pad → enter **1 2 3 4 5** → set **Developer Mode On**,
**Host PC IP = <HOST_PC_IP>** → save → **restart the TV**.
Verify dev mode later with: `curl -s http://<TV_IP>:8001/api/v2/ | python3 -m json.tool` (look for `developerMode:1`).

### 3. Samsung signing certificate WITH THIS TV's DUID  *(the important bit for old TVs)*
Old (pre-2021) TVs reject apps unless signed by a **Samsung** cert that carries **that TV's DUID**
*and* the host has been **permitted** (step below). Create the profile once:

1. Get the DUID:  `~/tizen-studio/tools/sdb connect <TV_IP>:26101 && ~/tizen-studio/tools/sdb -s <TV_IP>:26101 shell 0 getduid`  → `<YOUR_TV_DUID>`.
2. Open **Certificate Manager** → **+** → choose **Samsung** → **TV**.
3. Name it `camerawall`. Author certificate: reuse an existing author `.p12` or create one.
4. Distributor certificate: add the DUID `<YOUR_TV_DUID>` (or tick the connected TV). Sign in to
   your Samsung account when prompted. Finish.
5. Make `camerawall` the **active** profile (checkmark in Certificate Manager).

### 4. Permit to install  *(ONE TIME per TV — this is what clears `install failed[118]`)*
With `camerawall` active and the TV connected, open **Device Manager**, select the TV. It runs the
permit automatically (or prompts "No DUID for selected device…"; after activating `camerawall`,
click **Retry**). "Permit succeeded" = the host is now authorized. **Then restart the TV once.**
Without this step a current Samsung cert fails with `install failed[118]`.

---

## Build, sign, install (every time)

```bash
cd ~/Documents/Personal/Workspace/CameraWall

# 1. package the app files into an unsigned .wgt
rm -f CameraWall-unsigned.wgt; rm -rf signedSamsung; mkdir -p signedSamsung
zip -q CameraWall-unsigned.wgt config.xml index.html style.css app.js config.js icon.png

# 2. sign with the camerawall profile
~/tizen-studio/tools/ide/bin/tizen package -t wgt -s camerawall \
  -o "$PWD/signedSamsung" -- "$PWD/CameraWall-unsigned.wgt"
mv signedSamsung/CameraWall-unsigned.wgt signedSamsung/CameraWall.wgt

# 3. connect + install
~/tizen-studio/tools/sdb connect <TV_IP>:26101
~/tizen-studio/tools/ide/bin/tizen install -n "$PWD/signedSamsung/CameraWall.wgt" -s <TV_IP>:26101

# 4. launch  (use `tizen run`; `sdb shell 0 execute` is flaky on this TV)
~/tizen-studio/tools/ide/bin/tizen run -p Houqkr5pm8.CameraWall -s <TV_IP>:26101
```

A good install prints `installing[..100]` then `install completed`. Once permitted, installs take
a couple of seconds and need no restart.

---

## Gotchas (hard-won — read these)

- **`install failed[118]`** = the host isn't permitted. Do the Permit-to-install step (one-time
  setup #4) with a Samsung cert that has this TV's DUID, then restart. It is **not** disk space,
  privileges, `required_version`, or the SDK version. (A generic Tizen cert also gets past 118 but
  then stalls — the Permit + Samsung cert is the real path.)
- **`was_install_app return WAS_FALSE` with a ~10s timeout on everything** = the TV's install
  service has **wedged** (it does this after several back-to-back install/uninstall attempts).
  **Restart the TV**; the permit persists across restarts.
- **`sdb connect` fails / `<unknown>` device / port 26101 closed** = same wedge. Restart the TV.
  Also make sure the Mac reaches the TV from `<HOST_PC_IP>` (the Host PC IP set in Developer Mode);
  a plugged-in LAN cable can change the source IP and break the connection.
- **After `sdb kill-server`**, the first `sdb connect` sometimes fails — just retry it.

## Icons (Apps list + home dock)

Samsung web apps use a **single** icon file (`<icon src="icon.png"/>`); **SVG is not supported**,
and extra `<icon>` entries with width/height are **ignored** — the TV scales the one `icon.png`
to every placement. Use a **512-px PNG**.

**The dock-tile shape differs by TV generation**, and the TV *stretches* the single icon to fit,
so no one image is right everywhere:

| Placement | Shape |
| --- | --- |
| Apps list / panel | **square** (1:1, 250×250) — same on all generations |
| Home-dock tile, **modern TVs** (2021+, e.g. QE50QE1D) | **square** (1:1) |
| Home-dock tile, **2017-era TVs** (Tizen 3.0/4.0, e.g. UE55MU7000) | **16:9** (245×138) |

So pick the icon by the target TV's dock shape. This repo ships both:
- `icon.png` — **square**, the default (right for the Apps list on every TV, and the home dock on
  modern/2021+ TVs).
- `icon-wide.png` — **16:9**, for the home dock on **2017-era** TVs.

Before building **for a 2017-era TV**, swap in the wide one: `cp icon-wide.png icon.png`.
(On a modern TV the square `icon.png` is already correct — no swap.)

Regenerate either from a source image (macOS `sips`):
```bash
sips -s format png -z 512 512 source.png --out icon.png                 # square (-z = resize, may distort non-square sources; crop first with -c)
sips -s format png -z 288 512 source16x9.png --out icon-wide.png        # 16:9 (512×288)
```

**Dock icon won't update?** The TV caches the home-dock tile from the *first* install. Installing
over the top does **not** regenerate it. To refresh it, do a clean **uninstall then fresh install**:
```bash
~/tizen-studio/tools/ide/bin/tizen uninstall -p Houqkr5pm8.CameraWall -s <TV_IP>:26101
# (if that errors, use: sdb -s <TV_IP>:26101 shell 0 vd_appuninstall Houqkr5pm8.CameraWall)
~/tizen-studio/tools/ide/bin/tizen install -n "$PWD/signedSamsung/CameraWall.wgt" -s <TV_IP>:26101
```
If Camera Wall was pinned to the home bar, remove that tile and re-add it after reinstalling.
(Uninstall/reinstall cycles can wedge the dev connection — if so, restart the TV, see Gotchas.)

## Remote controls

Arrow keys move the selection · **OK/Enter** enlarges the selected camera to live · **Back**
un-enlarges, or exits from the grid.

## How it works

The grid polls `GET {base}/api/camera_proxy/<entity>?token=<rotating access_token>` for snapshots;
the enlarged view uses `/api/camera_proxy_stream/<entity>?token=…` (live MJPEG). The rotating
`access_token` is read from `/api/states/<entity>` (authorized with the long-lived token). On the
TV the Tizen runtime isn't subject to browser CORS, so these load from the app's own origin;
`<access origin="*">` + the `internet` privilege in `config.xml` enable it. (In a desktop browser
the feeds won't load — CORS blocks them — so only the layout is previewable off-TV.)

See `STATUS.md` for the full debugging journal.
