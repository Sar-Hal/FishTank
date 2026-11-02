# WINDOW — Perspective-Correct 3D Head-Tracked Display

Turn your monitor into an authentic 3D window into another room using your webcam and WebGL/Three.js. Inspired by Robert Kooima's generalized perspective projection and Guy Romm's *Window* project.

---

## What's Inside

1. **Lightweight 60 FPS Face Tracking**
   - Uses MediaPipe BlazeFace Short-Range (~450 KB), running entirely client-side on GPU.
   - Picture-in-picture webcam thumbnail with live face detection bounding box and tracking status.

2. **Auto-Baseline Distance & Position Calibration**
   - Automatically establishes a face width baseline on first detection.
   - **🎯 Center / Calibrate button**: Sit comfortably in your natural posture, click once, and the app snaps that as your neutral center viewpoint $(0, 0)$ at your calibrated viewing distance.

3. **Kooima Off-Axis Perspective Projection**
   - Screen bezels act as a physical aperture at $z = 0$.
   - True motion parallax: room walls, floor, and ceiling meet the exact edges of your physical display.
   - Look around corners, peer under tables and lamps, and see behind foreground objects.

4. **3 Immersive 3D Environments**
   - 🐟 **Living Aquarium (Fish Tank)**: Enclosed water tank with animated swimming clownfish and blue tangs, wagging tail fins, rising bubbles, sandy seabed, rocks, and caustic lighting.
   - 🚪 **Classic Corridor**: Inspired by Guy Romm's demo, featuring a checkered tile floor, brick walls, wood ceiling, 3D table, chair, hanging lamp, and glossy sphere.
   - ⚡ **Sci-Fi Chamber**: High-tech neon chamber with glowing holographic rings and an animated icosahedron core.

5. **🥽 Stereoscopic 3D Mode (Red / Cyan Anaglyph)**
   - Toggle with one click or press the 3D Glasses button.
   - Dual-pass off-axis projection with standard $6.3\text{ cm}$ human inter-pupillary distance (IPD).
   - Instant VR depth using cheap red/cyan anaglyph glasses!

6. **Isometric Debug Visualizer**
   - Real-time 3D mini-map showing your head position $(X, Y, Z)$ in centimeters, the physical screen plane, and the dynamic viewing frustum pyramid.

---

## Setup & Running

```powershell
# Install dependencies
npm install

# Start local development server
npm run dev
```

Open `http://localhost:5173/` in Google Chrome or Microsoft Edge.

---

## Controls

- **🎯 Center / Calibrate**: Calibrates your current head position as the center viewpoint.
- **Scene Selector**: Switch between *Living Aquarium*, *Classic Corridor*, and *Sci-Fi Chamber*.
- **🥽 3D Glasses**: Enable/disable Red/Cyan stereoscopic 3D mode.
- **Debug View**: Toggle the real-time isometric frustum visualizer.
- **Fullscreen**: Fill the entire screen for maximum immersion.
