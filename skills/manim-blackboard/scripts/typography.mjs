import { readFileSync } from 'node:fs';

const assets = new URL('../assets/', import.meta.url);

/** Inline the type picker and its licensed font files into a standalone lesson. */
export function typographyPanel() {
  const panel = readFileSync(new URL('type-controls.html', assets), 'utf8');
  return panel.replace(/\{\{([\w.-]+\.(woff2|txt))\}\}/g, (_, name, type) =>
    readFileSync(new URL(`fonts/${name}`, assets), type === 'woff2' ? 'base64' : 'utf8')
  );
}
