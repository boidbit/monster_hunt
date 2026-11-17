# Monster Hunt — adaptive chase director

The director drives through a streamed grid of connected streets and intersections. It selects left, right and straight routes using seeded variation, traffic, the monster's position and recent turns. The truck brakes for traffic, changes lanes, slows and drifts through turns, and boosts when threatened.

Thirty moving cars and buses occupy the nearby roads. They follow traffic ahead, brake when blocked, and accelerate and sound horns near the monster. The monster chooses swipes, charges, leaps, building smashes and aerial shortcuts based on distance, street turns, nearby traffic and recently used attacks. Interceptions move continuously to a predicted route position and can land ahead of the truck; the monster can misjudge a changing situation.

There is no timestamped attack sequence. Event-specific cameras include pursuit, rear tracking, side tracking, intersection and reveal shots. Framing and building raycasts are checked every frame. Shots have a minimum hold time; when a building obstructs the chase, the camera rises or cuts to a clear view. Aerial shortcuts deliberately use wider views.

## One workflow

After merging the PR into the default branch, open **Actions → Record Monster Chase → Run workflow**.

- Keep seed **auto** for a new episode. Supply a uint32 seed for a replay without past episode memory.
- Choose a maximum duration between 30 and 60 seconds. The director looks for an ending after 30 seconds and stops at the maximum if none occurs.
- Choose intensity, ending preference and portrait (720×1280) or landscape (1280×720).
- The workflow validates simulation and audio, checks two browser configurations, records 30 FPS, encodes H.264/AAC, and uploads one video ZIP.
- Download from the completed run's **Artifacts** section while signed in to GitHub. Open **monster-chase.mp4** inside the ZIP. Artifacts expire after 14 days; this workflow does not publish to YouTube.
- The run summary includes GitHub's generated download link. Reports contain the actual seed, duration, events, route choices and camera cuts.

Automatic-seed manual runs restore/save recent attack, turn and shot memory through a GitHub Actions cache. Cache retention/eviction can reset that memory; individual episodes still avoid recent choices. Same-branch runs are serialized. Explicit seeds ignore prior workflow memory. Browser preview uses localStorage memory and a new seed on reload. Recording never depends on browser localStorage.

Feature-branch source pushes run the same workflow with seed 42 and a 45-second maximum, allowing review before merge. No tools need installing on the viewer's computer.

## Validation and limits

Pure simulation tests cover seeded determinism, route and attack variation across 12 configurations, variable endings, physical interception continuity, history changes, moving traffic, ten simulated minutes of bounded streaming and finite audible audio. Cloud checks cover portrait seed 42 and landscape seed 99, actor framing, building obstruction, console errors and bounded geometry. Media checks verify duration, dimensions, frame rate and audio presence. Representative images still need visual review.

Twenty-five city blocks, thirty traffic vehicles, route history and event history are bounded. World coordinates rebase every 360 units. Shared geometry/materials are reused. Preview runs indefinitely; recording stops at an episode ending. Health has a cinematic survival floor.

The city is currently a procedural street grid, with varying road widths and building heights. Flyovers, tunnels, ground-level monster pathfinding around entire blocks, manual driving controls and social-media uploads are not implemented. Shortcuts are visible aerial movements, not teleports.

## Development on a suitable machine

Run node --test tools/render/core.test.mjs. Install tools/render dependencies, Playwright Chromium and FFmpeg on that machine; then run node tools/render/record.mjs. Use --smoke for browser checks. CHASE_DURATION, CHASE_SEED, CHASE_INTENSITY, CHASE_ENDING and CHASE_FORMAT override defaults.

The recording browser blocks external network requests and serves pinned Three.js locally. Live preview loads the same pinned module from its CDN. Original monster and truck models are preserved.
