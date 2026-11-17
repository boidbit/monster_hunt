# The Chase — director mode

An automatically driven, endlessly streamed pursuit using Monster Hunt's original monster and armored truck models.

## Watch and record

The root game's start screen links to `chase/index.html`. Preview needs internet for the pinned Three.js module; it runs until paused. The director drives the truck and controls the camera.

After this branch is merged into the default branch, open **Actions → Record Monster Chase → Run workflow**. Choose 30–60 seconds, a uint32 seed, pursuit intensity, ending and portrait/landscape framing. Download the `monster-chase-<run number>` artifact from the completed run.

This feature branch automatically produces a 45-second portrait take on source pushes, so it can be reviewed before merging. No tools need installing on the viewer's laptop. The workflow only uploads downloadable artifacts; it does not publish videos or create releases. Artifacts expire after 14 days.

The artifact contains:
- `monster-chase.mp4`: H.264/AAC, 30 FPS, 720×1280 portrait or 1280×720 landscape.
- Five representative shots and a contact sheet.
- `report.json`: seed, configuration, simulation events, camera visibility metrics, per-frame telemetry and media metadata.
- A browser smoke report.

## How it works

`core.mjs` simulates at 60 Hz. Seeded chunks hold continuous connected road geometry, buildings and traffic. Eight chunks stay active; old geometry is disposed and the origin shifts every 320 metres. Traffic and attack reactions use bounded acceleration and lateral steering, with real collision damage.

The director stages five attacks per episode: swipe, charge, leap, building smash, charge. The monster follows and intercepts using acceleration-limited pursuit. The episode repeats during endless preview; truck health resets at each episode boundary. Escape and cliffhanger endings control the final pursuit gap.

`scene.mjs` renders the actors, streamed streets, particles, captions and smoothly changing cameras. `models.mjs` adapts the original game's models.

The cloud recorder renders one frame per 1/30 simulation second through Playwright. It can run slower than real time without skipping video frames. `audio.mjs` supplies synthesized event sounds and engine audio; the renderer writes a synchronized WAV and FFmpeg encodes the MP4. The same sound definitions play in live preview.

Recording blocks external browser requests and serves the exact Three.js package installed on the runner. Dependencies are pinned in `tools/render/package.json`. Live preview uses the same Three.js version from a CDN.

## Verification

The workflow checks deterministic replays, all attack types over 24 seed/duration/intensity combinations, ten simulated minutes of bounded streaming, and finite audible audio. Browser checks verify camera visibility, bounded geometry counts and console errors. Export checks verify duration, dimensions, FPS and audio presence. Review the actual take as well: screen-space actor visibility alone cannot judge storytelling or occlusion.

## Development on a suitable machine

```sh
node --test tools/render/core.test.mjs
npm install --prefix tools/render
node tools/render/node_modules/playwright/cli.js install --with-deps chromium
node tools/render/record.mjs --smoke
node tools/render/record.mjs
```

FFmpeg and ffprobe must be available for export. Defaults are seed 42, 45 seconds, savage intensity, escape ending and portrait format. Override with `CHASE_SEED`, `CHASE_DURATION`, `CHASE_INTENSITY`, `CHASE_ENDING`, and `CHASE_FORMAT`.

This is a cinematic director mode. It does not add manual driving controls, multiplayer, a mission campaign or social-media uploads.
