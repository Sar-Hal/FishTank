# Fish Tank

A head-tracked 3D display for ordinary monitors. Your webcam watches your head, and the screen becomes a physical window into another room — with real motion parallax, no headset required.

Built with React 19, Three.js and MediaPipe's on-device face detector. The projection is based on Robert Kooima's generalised perspective projection: the monitor is treated as a fixed aperture at `z = 0`, and the camera's frustum is skewed every frame so its corners always match the physical screen corners.

---

## What's inside

- **On-device head tracking** — BlazeFace short-range via MediaPipe. No video leaves the machine.
- **Off-axis projection** — move your head and genuinely see around objects, through the window edges, and into the scene.
- **Three environments** — a living aquarium with animated fish and bubbles, a warm study corridor, and a neon reactor chamber.
- **Red / cyan stereo** — optional dual-pass anaglyph rendering using a 6.3 cm inter-pupillary distance.
- **Physical calibration** — monitor presets, a bank-card ruler, sitting distance and motion sensitivity. Settings persist locally.
- **Debug frustum view** — an isometric diagram of the screen, eye position and viewing frustum.
- **Camera HUD** — live preview with a mirrored face reticle, collapsible independently of tracking.
- **Keyboard control** — everything reachable without leaving the scene.

## Running it

```powershell
npm install
npm run dev
```

Open the printed URL in Chrome or Edge and allow camera access. The dev server serves everything locally, including the MediaPipe WASM runtime and face model from `public/`.

Production build:

```powershell
npm run build
npm run preview
```

Tests (tracker maths and off-axis projection):

```powershell
npm test
```

## Controls

| Input | Action |
| --- | --- |
| `1` / `2` / `3` | Aquarium / Corridor / Cyber scene |
| `C` | Recenter the view on the current head position |
| `S` | Toggle red / cyan stereo |
| `D` | Toggle the isometric frustum debug view |
| `F` | Toggle fullscreen |
| `M` | Collapse or expand the camera preview |
| Mouse | Use the HUD for scenes, recentering, settings and exit |

The **recenter** button is useful if you shift your chair: it establishes the current head position as the neutral viewpoint. If no face is visible it resets to automatic baselining.

## Display setup

For the strongest illusion, set your real monitor size and eye-to-screen distance in **Display setup**. The defaults are a 24-inch monitor at 60 cm; a laptop preset or the bank-card ruler will usually be more accurate.

The projection derives the horizontal view extent from the canvas aspect ratio, so the window stays geometrically correct when the browser is resized or zoomed. Physical size guesses use CSS pixels × device pixel ratio, which cancels out browser zoom.

**Browser zoom note:** the previous implementation could leave a stale WebGL canvas in the DOM during React StrictMode's development double-mount, pushing the live canvas below the viewport — the scene appeared only along the bottom of the page. The rebuilt engine owns exactly one canvas, positions it absolutely inside its host, removes it through a captured container during teardown, and keeps the host itself layout-independent. It is safe to zoom and resize.

## Architecture

```
src/
  state/       Zustand app settings + throttled telemetry
  tracking/    MediaPipe camera service and physical head-pose tracker
  engine/      Renderer lifecycle, off-axis camera and scene factories
  ui/          Landing, calibration, experience and HUD components
```

The engine lives outside React's render cycle. `Experience` creates one `PortalEngine` and one `FaceTrackingService` per mount, pushes scene/stereo/calibration changes through setters, and sends head samples straight to the engine. React only re-renders for UI state; the 10 Hz telemetry store feeds the HUD.

## Privacy

All tracking runs locally in the browser. The camera stream is used only by the face detector and the preview, is never recorded, and is released when you leave the experience.
