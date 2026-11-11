import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Production security headers live in vercel.json. `vite preview` serves the
 * same ones, so the real policy (CSP, Permissions-Policy, ...) can be tested
 * locally before deploying.
 */
function previewHeaders(): Record<string, string> {
  try {
    const config = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf-8'));
    const rule = config.headers?.find((entry: { source: string }) => entry.source === '/(.*)');
    const headers: Record<string, string> = {};
    for (const { key, value } of rule?.headers ?? []) headers[key] = value;
    return headers;
  } catch {
    return {};
  }
}

export default defineConfig({
  plugins: [react()],
  preview: { headers: previewHeaders() },
});
