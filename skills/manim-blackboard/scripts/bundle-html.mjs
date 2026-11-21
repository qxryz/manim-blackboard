/** Shared single-file HTML build for the JavaScript blackboard players. */
import { mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));

async function bundledPlayer(source, mode) {
  let build;
  try {
    ({ build } = await import('esbuild'));
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    throw new Error('Install the JavaScript build dependencies with npm ci in the skill directory.');
  }
  // Installed lessons can live anywhere. Resolve shared helpers and Three.js against this skill.
  const alias = { 'blackboard-lesson': source, 'blackboard-deck': join(root, 'assets/deck.js'), three: 'three' };
  const result = await build({
    absWorkingDir: root, entryPoints: [`assets/${mode}-player.js`], alias,
    bundle: true, write: false, metafile: true, platform: 'browser', format: 'iife', target: 'es2020',
    minify: true, legalComments: 'inline', logLevel: 'silent',
  });
  if (result.outputFiles.length !== 1) throw new Error('The lesson must bundle into one script.');
  const notices = [['Manim Blackboard built-in player', 'LICENSE']];
  if (Object.keys(result.metafile.inputs).some(path => path.replaceAll('\\', '/').includes('node_modules/three/'))) {
    notices.push(['Three.js', 'node_modules/three/LICENSE'], ['Three.js components', 'licenses/three-components.txt']);
  }
  const licenseTags = await Promise.all(notices.map(async ([component, file]) => {
    const license = await readFile(join(root, file), 'utf8');
    const text = license.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
    return `<template data-software-license="${component}"><pre>${text}</pre></template>`;
  }));
  return [...licenseTags, scriptElement(result.outputFiles[0].text)].join('\n');
}

function scriptElement(code) {
  // Tagged raw strings and retained license comments can contain HTML end tags.
  if (/<\/script|<!--/i.test(code)) {
    const bytes = Buffer.from(code, 'utf8').toString('base64');
    return `<script src="data:text/javascript;base64,${bytes}"></script>`;
  }
  return `<script>\n${code}\n</script>`;
}

async function writeAtomically(output, page) {
  const folder = dirname(output);
  await mkdir(folder, { recursive: true });
  const temporary = await mkdtemp(join(folder, '.blackboard-'));
  try {
    const staged = join(temporary, 'lesson.html');
    await writeFile(staged, page, 'utf8');
    await rename(staged, output);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function buildHtml(mode) {
  const usage = `node scripts/build-${mode}.mjs LESSON.js -o OUTPUT.html`;
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { output: { type: 'string', short: 'o' }, help: { type: 'boolean', short: 'h' } },
  });
  if (values.help) { console.log(usage); return; }
  if (positionals.length !== 1 || !values.output) throw new Error(`Usage: ${usage}`);
  const source = await realpath(positionals[0]);
  const output = resolve(values.output);
  if (!['.js', '.mjs'].includes(extname(source)) || !(await stat(source)).isFile()) {
    throw new Error('Choose a JavaScript .js or .mjs lesson file.');
  }
  if (extname(output).toLowerCase() !== '.html') throw new Error('The output must be an .html file.');
  const existing = await realpath(output).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const assetDir = await realpath(join(root, 'assets'));
  const templates = ['player.html', 'three-player.html', 'interactive-player.html', 'type-controls.html', 'caption-track.html'];
  if (existing === source || templates.some(name => join(assetDir, name) === existing)) {
    throw new Error('Choose an output distinct from the lesson source and player templates.');
  }
  const template = await readFile(join(assetDir, `${mode}-player.html`), 'utf8');
  const bundleSlot = `<!--${mode.toUpperCase()}_PLAYER_BUNDLE-->`;
  const typeSlot = '<!--BLACKBOARD_TYPE-->';
  const captionSlot = '<!--BLACKBOARD_CAPTION_TRACK-->';
  for (const slot of [typeSlot, bundleSlot, captionSlot]) {
    if (template.split(slot).length !== 2) throw new Error(`The player template needs one ${slot} slot.`);
  }
  const { typographyPanel } = await import('./typography.mjs');
  const [panel, player, captions] = await Promise.all([typographyPanel(), bundledPlayer(source, mode),
    readFile(join(assetDir, 'caption-track.html'), 'utf8')]);
  const slots = new Map([[typeSlot, panel], [bundleSlot, player], [captionSlot, captions]]);
  const page = template.replace(new RegExp([...slots.keys()].join('|'), 'g'), marker => slots.get(marker));
  await writeAtomically(output, page);
  console.log(`${values.output} · ${Buffer.byteLength(page).toLocaleString('en-US')} bytes`);
}
