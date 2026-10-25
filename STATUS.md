# Camera Wall — status & findings (2026-10-25)

## What works
- The app itself is built and correct: `<project-dir>`
  (config.xml, index.html, style.css, app.js, config.js). Old-browser-friendly (no CSS vars/grid).
- It installs and runs fine on a **modern** TV; the blocker below is specific to the 2017 set.
- App id `Houqkr5pm8.CameraWall`. HA config (base/token/cameras) is in git-ignored `config.js`.

## The blocker: install fails on the 2017 TV (UE55MU7000, <TV_IP>, Tizen 3.0)
Every signed install fails with `install failed[118]` at the 22% (signature/cert-verification) point.

### Ruled out by testing
- **Not the app**: a blank "hello world" app fails identically.
- **Not privileges**: the blank app had none; also tried with/without tv.inputdevice.
- **Not required_version**: tried 2.4 and 3.0.
- **Not the install method**: `tizen install` and direct `vd_appinstall` both fail the same.
- **Not the password**: signing succeeds, so the cert password is correct.
- **Not the cert contents**: distributor cert has the correct DUID (<YOUR_TV_DUID>), not expired, valid Samsung Public cert.
- **Not the SDK version**: installed Tizen Studio 3.7 (CLI 2.5.21) at `~/tizen-studio-3.7`, signed with the
  same `camerawall` cert (shared the profile into 3.7's data dir; passwords port fine), built via the native
  `build-web`+`package` flow. STILL fails[118] at 22%.

### Conclusion
The 2017 TV rejects the **certificate** at verification — almost certainly a CA-trust / cert-era issue:
current Samsung developer certificates are not accepted by this 2017 Tizen 3.0 firmware. This matches
community reports for the same TV generation, one of which was closed "cannot reproduce" after trying a
manual Samsung Partner cert, permit-to-install, freeing storage, and re-signing
(github.com/reisxd/TizenBrew issues/239; github.com/jellyfin/jellyfin-tizen issues/243).

## The one remaining avenue (needs you + uncertain)
Create a certificate the 2017 TV trusts, using the OLD SDK's OLD Samsung Certificate Extension — this needs
an interactive Samsung-account sign-in (couldn't do while you were away), and may still fail because Samsung's
current issuing system is what the old TV distrusts. Low confidence.

## Reliable alternative (recommended)
Camera Wall is just a web page. Run it on a small external device plugged into the 2017 TV
(Chromecast/Google TV, Fire TV, Android TV box, or a Raspberry Pi kiosk), or serve it from Home Assistant.
Reuses everything already built; no Samsung signing involved.

## Build commands (for reference)
- Modern SDK sign: `~/tizen-studio/tools/ide/bin/tizen package -t wgt -s camerawall -o "$PWD/signed" -- "$PWD/CameraWall-unsigned.wgt"`
- Old SDK (3.7): native `build-web` + `package` under `~/tizen-studio-3.7/tools/ide/bin/tizen` (profile copied to `~/tizen-studio-3.7-data/profile/profiles.xml`).
- Install: `~/tizen-studio/tools/sdb -s <TV_IP>:26101 shell 0 vd_appinstall Houqkr5pm8.CameraWall <remote.wgt>`

## Legacy-cert route: CONFIRMED DEAD (2026-10-25)
The old SDK (3.7) package manager only offers the CURRENT extensions: Certificate-Manager 3.1.3 and
cert-add-on 2.0.75 (same as the modern SDK). Samsung serves the current certificate extension regardless of
SDK version — the old cert extension is no longer distributed. So any cert made via the old SDK is issued by
Samsung's current system = the same cert the 2017 TV already rejected. No legacy cert is obtainable.

### Final conclusion
Sideloading onto this 2017 Tizen 3.0 TV is not achievable with current Samsung tooling. Use the external-device
route (Camera Wall as a hosted web page on a streaming stick / Pi, or served from Home Assistant).

## SOLVED (2026-10-25): Camera Wall installs and runs on the 2017 TV
The fix was the "Permit to install" step, which we'd skipped by working purely from the CLI:
1. Samsung certificate profile with THIS TV's DUID (camerawall, DUID <YOUR_TV_DUID>), set ACTIVE in Certificate Manager.
2. Device Manager -> (connect TV) -> it prompts "No DUID for selected device in cert profile" -> after activating camerawall, Retry -> "Permit to install" succeeds. THIS authorises the host; without it the Samsung cert is rejected with error 118.
3. Restart the TV (the install service wedges after many failed attempts; a restart clears it; the permit persists).
4. Sign with camerawall and install:
   tizen package -t wgt -s camerawall -o ./signedSamsung -- ./CameraWall-unsigned.wgt
   tizen install -n ./signedSamsung/CameraWall.wgt -s <TV_IP>:26101
   tizen run -p Houqkr5pm8.CameraWall -s <TV_IP>:26101   (use `tizen run`; `sdb shell 0 execute` was flaky)
Result: installing[..100] install completed; app launched (wascmd 421ms). The earlier 10s WAS_FALSE timeouts were the wedged install service; the restart fixed them.
Note: the Tizen-cert route got past 118 too but still hit the wedged-service timeout; the Permit-to-install + Samsung cert is the real, documented path.

## CONFIRMED ON SCREEN (2026-10-25): camera feeds display on the UE55MU7000. Done.
