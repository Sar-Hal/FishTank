import * as THREE from 'three';

/**
 * Textures for the "Infinity" scene: a mock desktop / screenshare UI and a
 * pointer that can drift across it.
 *
 * The share is drawn once at 1280×720 and reused by every screen in the echo
 * tunnel. Because the material that displays it is additive, the dark desktop
 * background disappears and only the bright UI survives — which lets the nested
 * screens glow through each other.
 */

function textureFromCanvas(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  draw(ctx, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

type Token = readonly [text: string, color: string];

const CODE_LINES: ReadonlyArray<ReadonlyArray<Token>> = [
  [
    ['import', '#c084fc'],
    [' * as ', '#cbd5e1'],
    ['THREE', '#67e8f9'],
    [' from ', '#cbd5e1'],
    ["'three'", '#86efac'],
    [';', '#94a3b8'],
  ],
  [
    ['import', '#c084fc'],
    [' { ', '#cbd5e1'],
    ['createScreenshare', '#7dd3fc'],
    [' } ', '#cbd5e1'],
    ['from', '#c084fc'],
    [' ', '#cbd5e1'],
    ["'./screenShareTexture'", '#86efac'],
    [';', '#94a3b8'],
  ],
  [],
  [
    ['export', '#c084fc'],
    [' function ', '#c084fc'],
    ['createMirror', '#7dd3fc'],
    ['(): ', '#cbd5e1'],
    ['Environment', '#fbbf24'],
    [' {', '#cbd5e1'],
  ],
  [
    ['  const ', '#c084fc'],
    ['group', '#e2e8f0'],
    [' = ', '#cbd5e1'],
    ['new ', '#c084fc'],
    ['THREE.Group', '#67e8f9'],
    ['();', '#cbd5e1'],
  ],
  [
    ['  const ', '#c084fc'],
    ['layers', '#e2e8f0'],
    [' = ', '#cbd5e1'],
    ['[]', '#cbd5e1'],
    [' as ', '#c084fc'],
    ['THREE.Mesh', '#67e8f9'],
    ['[];', '#cbd5e1'],
  ],
  [],
  [
    ['  for ', '#c084fc'],
    ['(', '#cbd5e1'],
    ['let i', '#e2e8f0'],
    [' = ', '#cbd5e1'],
    ['0', '#fda4af'],
    ['; i < ', '#cbd5e1'],
    ['8', '#fda4af'],
    ['; i += ', '#cbd5e1'],
    ['1', '#fda4af'],
    [') {', '#cbd5e1'],
  ],
  [
    ['    const ', '#c084fc'],
    ['depth', '#e2e8f0'],
    [' = ', '#cbd5e1'],
    ['-240', '#fda4af'],
    [' - i * ', '#cbd5e1'],
    ['160', '#fda4af'],
    [';', '#cbd5e1'],
  ],
  [
    ['    const ', '#c084fc'],
    ['scale', '#e2e8f0'],
    [' = ', '#cbd5e1'],
    ['Math.pow', '#7dd3fc'],
    ['(', '#cbd5e1'],
    ['0.72', '#fda4af'],
    [', i);', '#cbd5e1'],
  ],
  [],
  [
    ['    const ', '#c084fc'],
    ['screen', '#e2e8f0'],
    [' = ', '#cbd5e1'],
    ['createScreen', '#7dd3fc'],
    ['(', '#cbd5e1'],
    ['scale', '#e2e8f0'],
    [');', '#cbd5e1'],
  ],
  [
    ['    screen.position.z = depth;', '#cbd5e1'],
  ],
  [
    ['    layers.push', '#7dd3fc'],
    ['(screen);', '#cbd5e1'],
  ],
  [
    ['    group.add', '#7dd3fc'],
    ['(screen);', '#cbd5e1'],
  ],
  [
    ['  }', '#cbd5e1'],
  ],
  [],
  [
    ['  return ', '#c084fc'],
    ['{ group, fog: ', '#cbd5e1'],
    ['null', '#fda4af'],
    [' };', '#cbd5e1'],
  ],
  [
    ['}', '#cbd5e1'],
  ],
];

const TREE: ReadonlyArray<readonly [text: string, indent: number, active?: boolean]> = [
  ['SRC', 0],
  ['▾ engine', 0],
  ['  ▾ scenes', 1],
  ['    aquarium.ts', 2],
  ['    corridor.ts', 2],
  ['    cyber.ts', 2],
  ['    mirror.ts', 2, true],
  ['    screenShareTexture.ts', 2],
  ['  PortalEngine.ts', 1],
  ['▸ state', 0],
  ['  appStore.ts', 1],
  ['  telemetryStore.ts', 1],
  ['▸ tracking', 0],
  ['  HeadTracker.ts', 1],
];

function drawParticipant(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  hue: number,
  name: string,
  speaking: boolean,
): void {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, `hsl(${hue} 42% 15%)`);
  gradient.addColorStop(1, `hsl(${hue + 28} 48% 9%)`);
  ctx.fillStyle = gradient;
  roundRect(ctx, x, y, width, height, 9);
  ctx.fill();

  ctx.strokeStyle = speaking ? 'rgba(52, 211, 153, 0.9)' : 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = speaking ? 2 : 1;
  ctx.stroke();

  const cx = x + width / 2;
  const cy = y + height * 0.38;
  ctx.fillStyle = `hsl(${hue} 58% 72%)`;
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsl(${hue} 45% 46%)`;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 17, 18, 11, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(226, 232, 240, 0.86)';
  ctx.font = '600 10px "Cascadia Mono", Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(name, x + 8, y + height - 7);

  if (speaking) {
    ctx.fillStyle = '#34d399';
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(x + width - 18 + i * 4, y + height - 13 - (i % 2) * 4, 2, 7 + (i % 2) * 4);
    }
  }
}

export function createScreenshareTexture(width = 1280, height = 720): THREE.CanvasTexture {
  return textureFromCanvas(width, height, (ctx, w, h) => {
    // ── Desktop wallpaper ──────────────────────────────────────────────────
    const background = ctx.createLinearGradient(0, 0, w, h);
    background.addColorStop(0, '#07141f');
    background.addColorStop(0.48, '#060d16');
    background.addColorStop(1, '#0d0716');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);

    for (const [x, y, radius, color] of [
      [w * 0.18, h * 0.1, w * 0.42, 'rgba(34, 211, 238, 0.15)'],
      [w * 0.9, h * 0.12, w * 0.34, 'rgba(217, 70, 239, 0.12)'],
      [w * 0.58, h * 1.02, w * 0.46, 'rgba(14, 116, 144, 0.14)'],
    ] as const) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = 'rgba(148, 163, 184, 0.11)';
    for (let y = 14; y < h; y += 26) {
      for (let x = 8; x < w; x += 26) ctx.fillRect(x, y, 1, 1);
    }

    // ── Menu bar ───────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(3, 8, 14, 0.86)';
    ctx.fillRect(0, 0, w, 38);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.fillRect(0, 37, w, 1);

    ctx.fillStyle = 'rgba(34, 211, 238, 0.2)';
    ctx.beginPath();
    ctx.arc(23, 19, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(16, 19);
    ctx.quadraticCurveTo(23, 12.5, 30, 19);
    ctx.quadraticCurveTo(23, 25.5, 16, 19);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#a5f3fc';
    ctx.beginPath();
    ctx.arc(20.5, 18.4, 1.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 14px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FishTank', 40, 24);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
    ctx.font = '500 12px "Segoe UI", Arial, sans-serif';
    let menuX = 128;
    for (const label of ['File', 'Edit', 'View', 'Window', 'Share']) {
      ctx.fillText(label, menuX, 24);
      menuX += ctx.measureText(label).width + 22;
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.font = '500 11px "Cascadia Mono", Consolas, monospace';
    ctx.fillText('Screen 1  ·  2560 × 1440  ·  60 fps', w - 24, 24);

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
    roundRect(ctx, w - 352, 9, 76, 20, 10);
    ctx.fill();
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.arc(w - 340, 19, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 10px "Cascadia Mono", Consolas, monospace';
    ctx.fillText('LIVE', w - 330, 23);

    // ── Dock ───────────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(7, 13, 22, 0.78)';
    roundRect(ctx, 18, 58, 52, h - 138, 15);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const dockIcons: Array<[string, string]> = [
      ['>_', '#22d3ee'],
      ['◈', '#a78bfa'],
      ['♪', '#fb7185'],
      ['✉', '#34d399'],
      ['◐', '#fbbf24'],
      ['⌁', '#67e8f9'],
      ['●', '#f472b6'],
    ];
    dockIcons.forEach(([glyph, color], index) => {
      const y = 72 + index * 52;
      ctx.fillStyle = index === 0 ? 'rgba(34, 211, 238, 0.16)' : 'rgba(148, 163, 184, 0.07)';
      roundRect(ctx, 27, y, 34, 34, 9);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = '700 14px "Cascadia Mono", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(glyph, 44, y + 23);
    });
    ctx.textAlign = 'left';

    // ── Editor window ──────────────────────────────────────────────────────
    const editorX = 88;
    const editorY = 54;
    const editorW = 812;
    const editorH = h - 124;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#08101c';
    roundRect(ctx, editorX, editorY, editorW, editorH, 12);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    roundRect(ctx, editorX, editorY, editorW, editorH, 12);
    ctx.stroke();

    // Window chrome
    ctx.fillStyle = '#0a1624';
    roundRect(ctx, editorX, editorY, editorW, 42, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.fillRect(editorX, editorY + 41, editorW, 1);

    for (const [offset, color] of [
      [18, '#fb7185'],
      [36, '#fbbf24'],
      [54, '#34d399'],
    ] as const) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(editorX + offset, editorY + 21, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(9, 20, 33, 0.95)';
    roundRect(ctx, editorX + 82, editorY + 8, 154, 34, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.28)';
    ctx.stroke();
    ctx.fillStyle = '#67e8f9';
    ctx.font = '600 11px "Cascadia Mono", Consolas, monospace';
    ctx.fillText('mirror.ts', editorX + 96, editorY + 29);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.fillText('✕', editorX + 214, editorY + 29);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.44)';
    ctx.font = '500 11px "Cascadia Mono", Consolas, monospace';
    ctx.fillText('portal.ts', editorX + 262, editorY + 29);
    ctx.fillText('textures.ts', editorX + 344, editorY + 29);

    // Sidebar / file tree
    const treeX = editorX;
    const treeW = 178;
    const treeTop = editorY + 42;
    const treeBottom = editorY + editorH - 34;
    ctx.fillStyle = 'rgba(7, 14, 24, 0.72)';
    ctx.fillRect(treeX, treeTop, treeW, treeBottom - treeTop);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.fillRect(treeX + treeW - 1, treeTop, 1, treeBottom - treeTop);

    ctx.font = '600 10px "Cascadia Mono", Consolas, monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.fillText('EXPLORER', treeX + 14, treeTop + 22);

    TREE.forEach(([label, indent, active], index) => {
      const y = treeTop + 48 + index * 24;
      if (active) {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.13)';
        ctx.fillRect(treeX + 4, y - 14, treeW - 8, 22);
        ctx.fillStyle = '#67e8f9';
      } else {
        ctx.fillStyle = label.startsWith('▸') || label.startsWith('▾') || label === 'SRC'
          ? 'rgba(165, 243, 252, 0.76)'
          : 'rgba(203, 213, 225, 0.62)';
      }
      ctx.font = '500 11px "Cascadia Mono", Consolas, monospace';
      ctx.fillText(label, treeX + 14 + indent * 12, y);
    });

    // Code area
    const codeX = treeX + treeW + 18;
    const codeTop = treeTop + 26;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.035)';
    ctx.fillRect(treeX + treeW, codeTop + 22 * 3 - 15, editorW - treeW, 23);

    ctx.font = '500 14px "Cascadia Mono", Consolas, "Liberation Mono", monospace';
    CODE_LINES.forEach((tokens, index) => {
      const y = codeTop + 20 + index * 22;
      ctx.fillStyle = 'rgba(100, 116, 139, 0.5)';
      ctx.textAlign = 'right';
      ctx.fillText(String(index + 1), codeX + 12, y);
      ctx.textAlign = 'left';
      let x = codeX + 32;
      for (const [text, color] of tokens) {
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        x += ctx.measureText(text).width;
      }
    });

    // Blinking caret on the active line.
    ctx.fillStyle = 'rgba(103, 232, 249, 0.95)';
    ctx.fillRect(codeX + 32, codeTop + 20 + 11 * 22 - 15, 2, 18);

    // Editor status bar
    ctx.fillStyle = '#07121f';
    ctx.fillRect(treeX, treeBottom, editorW, 34);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.72)';
    ctx.font = '600 10px "Cascadia Mono", Consolas, monospace';
    ctx.fillText('⌥ main*   ⟳ 0   ⚠ 0', treeX + 14, treeBottom + 21);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.62)';
    ctx.fillText('TypeScript  ·  UTF-8  ·  Ln 12, Col 4', treeX + editorW - 14, treeBottom + 21);
    ctx.textAlign = 'left';

    // ── Call / share panel ─────────────────────────────────────────────────
    const panelX = 918;
    const panelY = 54;
    const panelW = 338;
    const panelH = h - 124;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#08111d';
    roundRect(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    roundRect(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.stroke();

    ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
    roundRect(ctx, panelX + 16, panelY + 14, 50, 18, 9);
    ctx.fill();
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.arc(panelX + 25, panelY + 23, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 9px "Cascadia Mono", Consolas, monospace';
    ctx.fillText('LIVE', panelX + 33, panelY + 26);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('You are sharing', panelX + 78, panelY + 27);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.font = '500 10px "Cascadia Mono", Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('4 viewers', panelX + panelW - 16, panelY + 26);
    ctx.textAlign = 'left';

    const previewX = panelX + 14;
    const previewY = panelY + 44;
    const previewW = panelW - 28;
    const previewH = Math.round((previewW * 9) / 16);

    const drawRecursivePreview = (
      px: number,
      py: number,
      pw: number,
      ph: number,
      depth: number,
    ): void => {
      ctx.save();
      roundRect(ctx, px, py, pw, ph, Math.max(2, 7 - depth * 2));
      ctx.clip();
      ctx.drawImage(ctx.canvas, 0, 0, w, h, px, py, pw, ph);
      ctx.restore();

      ctx.strokeStyle = depth === 0
        ? 'rgba(34, 211, 238, 0.5)'
        : 'rgba(103, 232, 249, 0.35)';
      ctx.lineWidth = depth === 0 ? 1.5 : 1;
      roundRect(ctx, px, py, pw, ph, Math.max(2, 7 - depth * 2));
      ctx.stroke();

      if (depth < 2) {
        const inset = pw * 0.27;
        drawRecursivePreview(
          px + inset,
          py + ph * 0.3,
          pw - inset * 2,
          ph - ph * 0.46,
          depth + 1,
        );
      }
    };

    ctx.fillStyle = '#03070d';
    roundRect(ctx, previewX, previewY, previewW, previewH, 7);
    ctx.fill();
    drawRecursivePreview(previewX, previewY, previewW, previewH, 0);

    ctx.fillStyle = 'rgba(3, 8, 14, 0.78)';
    roundRect(ctx, previewX + 8, previewY + previewH - 22, 116, 15, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(165, 243, 252, 0.85)';
    ctx.font = '600 8.5px "Cascadia Mono", Consolas, monospace';
    ctx.fillText('SCREEN 1  ·  2560 × 1440', previewX + 14, previewY + previewH - 12);

    // Participants
    const tilesY = previewY + previewH + 12;
    const tileW = (previewW - 8) / 2;
    const tileH = 72;
    drawParticipant(ctx, previewX, tilesY, tileW, tileH, 192, 'Ari', false);
    drawParticipant(ctx, previewX + tileW + 8, tilesY, tileW, tileH, 282, 'Noa', true);
    drawParticipant(ctx, previewX, tilesY + tileH + 8, tileW, tileH, 32, 'Kai', false);
    drawParticipant(ctx, previewX + tileW + 8, tilesY + tileH + 8, tileW, tileH, 158, 'You', false);

    // Call controls
    const controlsY = panelY + panelH - 52;
    const controls: Array<[string, string, string]> = [
      ['mic', '🎙', 'rgba(148, 163, 184, 0.14)'],
      ['cam', '▣', 'rgba(148, 163, 184, 0.14)'],
      ['share', '⇱', 'rgba(34, 211, 238, 0.9)'],
      ['leave', '⏻', 'rgba(244, 63, 94, 0.9)'],
    ];
    controls.forEach(([label, glyph, color], index) => {
      const cx = panelX + panelW / 2 + (index - 1.5) * 54;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, controlsY, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = label === 'share' ? '#031017' : '#e2e8f0';
      ctx.font = '600 14px "Segoe UI Symbol", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(glyph, cx, controlsY + 5);
    });
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.font = '500 9px "Cascadia Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Sharing entire screen', panelX + panelW / 2, controlsY + 34);
    ctx.textAlign = 'left';

    // ── Bottom system bar ──────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(3, 8, 14, 0.82)';
    ctx.fillRect(0, h - 52, w, 52);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.fillRect(0, h - 52, w, 1);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.62)';
    ctx.font = '500 10px "Cascadia Mono", Consolas, monospace';
    ctx.fillText('◉ Screen sharing active   ·   60 fps   ·   hardware accelerated', 22, h - 21);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(103, 232, 249, 0.7)';
    ctx.fillText('fishTank.exe   ·   portal ready', w - 22, h - 21);
    ctx.textAlign = 'left';

    // ── Pointer + finishing touches ────────────────────────────────────────
    const cursorX = w * 0.605;
    const cursorY = h * 0.53;
    ctx.save();
    ctx.translate(cursorX, cursorY);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 26);
    ctx.lineTo(7, 19);
    ctx.lineTo(12, 27);
    ctx.lineTo(17, 24);
    ctx.lineTo(12, 16);
    ctx.lineTo(21, 15);
    ctx.closePath();
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    // Scanlines and a soft vignette keep the image from looking too flat.
    ctx.fillStyle = 'rgba(2, 6, 11, 0.09)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);

    const vignette = ctx.createRadialGradient(
      w / 2,
      h / 2,
      h * 0.2,
      w / 2,
      h / 2,
      h * 0.82,
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(1, 3, 7, 0.52)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // Turn brightness into transparency. Dark desktop chrome becomes a faint
    // glass pane; text and UI highlights stay crisp. That keeps the nested
    // screens visible through each other without additive blow-out.
    const image = ctx.getImageData(0, 0, w, h);
    const pixels = image.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const luma =
        (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) /
        255;
      const alpha = Math.min(1, Math.max(0.055, Math.pow(luma, 0.75) * 1.35));
      pixels[i + 3] = Math.round(alpha * 255);
    }
    ctx.putImageData(image, 0, 0);
  });
}

export function createCursorTexture(size = 128): THREE.CanvasTexture {
  return textureFromCanvas(size, size, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(s * 0.18, s * 0.12);
    ctx.scale(s / 42, s / 42);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 30);
    ctx.lineTo(8, 22);
    ctx.lineTo(14, 32);
    ctx.lineTo(20, 28);
    ctx.lineTo(14, 18);
    ctx.lineTo(25, 17);
    ctx.closePath();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  });
}
