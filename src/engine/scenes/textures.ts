import * as THREE from 'three';

function canvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  draw(ctx, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCheckerTexture(size = 512, tiles = 8): THREE.CanvasTexture {
  return canvasTexture(size, (ctx, s) => {
    const tile = s / tiles;
    for (let y = 0; y < tiles; y++) {
      for (let x = 0; x < tiles; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#e8e2d6' : '#28313d';
        ctx.fillRect(x * tile, y * tile, tile, tile);
        ctx.strokeStyle = 'rgba(10, 15, 22, 0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x * tile, y * tile, tile, tile);
      }
    }
  });
}

export function createBrickTexture(size = 512): THREE.CanvasTexture {
  return canvasTexture(size, (ctx, s) => {
    ctx.fillStyle = '#4a2416';
    ctx.fillRect(0, 0, s, s);

    const brickHeight = 32;
    const brickWidth = 84;
    for (let row = 0; row < s / brickHeight; row++) {
      const offset = row % 2 === 0 ? 0 : brickWidth / 2;
      for (let x = -brickWidth; x < s + brickWidth; x += brickWidth) {
        const variation = (row * 7 + x) % 3;
        ctx.fillStyle = variation === 0 ? '#7a3a22' : variation === 1 ? '#8a4527' : '#6d3220';
        ctx.fillRect(x + offset + 3, row * brickHeight + 3, brickWidth - 6, brickHeight - 6);
        ctx.strokeStyle = '#2d150c';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + offset + 1, row * brickHeight + 1, brickWidth - 2, brickHeight - 2);
      }
    }
  });
}

export function createWoodTexture(size = 512): THREE.CanvasTexture {
  return canvasTexture(size, (ctx, s) => {
    ctx.fillStyle = '#3b2414';
    ctx.fillRect(0, 0, s, s);

    for (let y = 0; y < s; y += 10) {
      ctx.strokeStyle = y % 40 === 0 ? '#241207' : 'rgba(20, 10, 4, 0.55)';
      ctx.lineWidth = y % 40 === 0 ? 3 : 1.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= s; x += 32) {
        ctx.lineTo(x, y + Math.sin((x + y) * 0.03) * 2);
      }
      ctx.stroke();
    }

    for (let x = 0; x < s; x += 128) {
      ctx.strokeStyle = 'rgba(16, 8, 3, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, s);
      ctx.stroke();
    }
  });
}

export function createSandTexture(size = 512): THREE.CanvasTexture {
  return canvasTexture(size, (ctx, s) => {
    ctx.fillStyle = '#bea473';
    ctx.fillRect(0, 0, s, s);

    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const light = Math.random();
      ctx.fillStyle =
        light > 0.72 ? 'rgba(240, 222, 184, 0.7)' : light > 0.35 ? 'rgba(170, 140, 94, 0.6)' : 'rgba(120, 94, 60, 0.35)';
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    for (let i = 0; i < 120; i++) {
      ctx.strokeStyle = 'rgba(120, 98, 66, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const y = Math.random() * s;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y + 8, s * 0.7, y - 8, s, y + 2);
      ctx.stroke();
    }
  });
}

export function createWaterTexture(size = 512): THREE.CanvasTexture {
  return canvasTexture(size, (ctx, s) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, s);
    gradient.addColorStop(0, '#1189a6');
    gradient.addColorStop(0.4, '#07627e');
    gradient.addColorStop(0.75, '#044257');
    gradient.addColorStop(1, '#022b3c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, s, s);

    // Soft caustic ribbons.
    for (let line = 0; line < 32; line += 1) {
      const baseY = Math.random() * s;
      ctx.strokeStyle = `rgba(165, 243, 252, ${0.018 + Math.random() * 0.05})`;
      ctx.lineWidth = 0.8 + Math.random() * 2.2;
      ctx.beginPath();
      for (let x = 0; x <= s; x += 16) {
        const y =
          baseY +
          Math.sin((x / s) * Math.PI * 2 + line) * (7 + Math.random() * 3) +
          Math.sin((x / s) * Math.PI * 5 + line * 0.7) * 3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Dim light pools near the surface.
    for (let i = 0; i < 14; i += 1) {
      const x = Math.random() * s;
      const y = Math.random() * s * 0.55;
      const radius = 20 + Math.random() * 60;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, 'rgba(186, 250, 255, 0.07)');
      glow.addColorStop(1, 'rgba(186, 250, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  });
}

export function createDoorGlowTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round(size * 1.7);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#fff7df');
  gradient.addColorStop(0.45, '#ffe0a8');
  gradient.addColorStop(0.8, '#f5b45f');
  gradient.addColorStop(1, '#b86a2c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height * 0.42,
    4,
    canvas.width / 2,
    canvas.height * 0.42,
    canvas.width * 0.8,
  );
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createHoloTexture(size = 512): THREE.CanvasTexture {
  return canvasTexture(size, (ctx, s) => {
    ctx.fillStyle = '#020b12';
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.38)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, s - 20, s - 20);

    ctx.fillStyle = 'rgba(34, 211, 238, 0.1)';
    for (let row = 0; row < 6; row += 1) {
      const y = 54 + row * 62;
      const width = s * (0.22 + Math.random() * 0.55);
      ctx.fillRect(32, y, width, 10);
      ctx.fillStyle = `rgba(34, 211, 238, ${0.05 + Math.random() * 0.16})`;
    }

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.22)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= s; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, s);
      ctx.stroke();
    }
    for (let y = 0; y <= s; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(165, 243, 252, 0.75)';
    ctx.font = '600 20px ui-monospace, monospace';
    ctx.fillText('REACTOR / 07', 32, 38);

    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = `rgba(34, 211, 238, ${0.3 + Math.random() * 0.5})`;
      ctx.fillRect(34 + i * 54, s - 56, 26, 28);
    }
  });
}

export function createGridTexture(size = 512): THREE.CanvasTexture {
  return canvasTexture(size, (ctx, s) => {
    ctx.fillStyle = '#050b16';
    ctx.fillRect(0, 0, s, s);

    const step = s / 8;
    for (let i = 0; i <= 8; i++) {
      const p = i * step;
      ctx.strokeStyle = i % 4 === 0 ? 'rgba(34, 211, 238, 0.55)' : 'rgba(34, 211, 238, 0.18)';
      ctx.lineWidth = i % 4 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(s, p);
      ctx.stroke();
    }

    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(34, 211, 238, ${0.05 + Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });
}

/**
 * Tileable web of bright wavy lines, like sunlight focused by ripples onto the
 * sand. Integer frequencies keep it seamless when repeated.
 */
export function createCausticTexture(size = 256): THREE.CanvasTexture {
  return canvasTexture(size, (ctx, s) => {
    const image = ctx.createImageData(s, s);
    const tau = Math.PI * 2;
    for (let y = 0; y < s; y += 1) {
      for (let x = 0; x < s; x += 1) {
        const u = x / s;
        const v = y / s;
        const a = Math.abs(Math.sin(tau * (3 * u + 0.45 * Math.sin(tau * (2 * v + u)))));
        const b = Math.abs(Math.sin(tau * (3 * v + 0.45 * Math.sin(tau * (2 * u - v)))));
        const line = Math.pow(1 - Math.min(a, b), 7);
        const value = Math.round(Math.min(1, line * 1.4) * 255);
        const index = (y * s + x) * 4;
        image.data[index] = value;
        image.data[index + 1] = value;
        image.data[index + 2] = value;
        image.data[index + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  });
}
