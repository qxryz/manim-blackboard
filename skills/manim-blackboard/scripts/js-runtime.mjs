/** Find a working JavaScript toolchain before installing a skill-local copy. */
import { spawn } from 'node:child_process';
import { constants, realpathSync } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const managedRoot = join(root, '.manim-blackboard');
const runtime = join(managedRoot, 'js');
const reportDir = process.env.MANIM_BLACKBOARD_REPORT_DIR;
const reported = new Map();

async function record(name, version, path, action, source = 'existing installation') {
  if (!reportDir) return;
  reported.set(name, { name, version, path, action, source });
  await mkdir(reportDir, { recursive: true });
  await writeFile(join(reportDir, 'js.json'), JSON.stringify([...reported.values()], null, 2) + '\n');
}

export async function announceJsRuntime(mode) {
  const dependencies = mode === 'three' ? 'esbuild and Three.js' : 'esbuild and Three.js if the lesson imports it';
  console.error(`Checking JavaScript build dependencies (${dependencies}).\nManaged runtime directory ${managedRoot}`);
  await record('node', process.versions.node, process.execPath, 'reused');
}

function readPackage(file) {
  return readFile(file, 'utf8').then(JSON.parse);
}

function runNpm(args, directory, capture = false) {
  const windows = process.platform === 'win32';
  // All arguments passed to the Windows command come from fixed arrays. The
  // package name and version are read by npm from this directory's manifest.
  const command = windows ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const argv = windows ? ['/d', '/s', '/c', ['npm', ...args].join(' ')] : args;
  const env = process.env.npm_config_cache || process.env.NPM_CONFIG_CACHE ? process.env : {
    ...process.env, npm_config_cache: join(managedRoot, 'npm-cache'),
  };
  return new Promise((done, reject) => {
    const stdio = capture ? ['ignore', 'pipe', 'inherit'] : 'inherit';
    const npm = spawn(command, argv, { cwd: directory, env, stdio, windowsHide: true });
    let output = '';
    npm.stdout?.setEncoding('utf8').on('data', text => { output += text; });
    npm.once('error', error => reject(new Error(`Could not launch npm: ${error.message}`)));
    npm.once('close', (status, signal) => {
      if (status === 0) done(output.trim());
      else reject(new Error(`npm ${args[0]} failed (${signal || `exit ${status}`}).`));
    });
  });
}

async function npmPath(cwd) {
  const extensions = process.platform === 'win32' ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';') : [''];
  for (const directory of (process.env.PATH || '').split(delimiter)) {
    for (const extension of extensions) {
      const path = resolve(cwd, directory.replace(/^"|"$/g, ''), `npm${extension}`);
      try {
        await access(path, constants.X_OK);
        if ((await stat(path)).isFile()) return path;
      } catch {
        // Keep looking for the executable npm launcher on PATH.
      }
    }
  }
  throw new Error('Could not locate the npm executable on PATH.');
}

async function install(directory) {
  if (reportDir && !reported.has('npm')) {
    const [path, version] = await Promise.all([npmPath(directory), runNpm(['--version'], directory, true)]);
    await record('npm', version, path, 'reused');
  }
  const args = ['install', '--prefix', '.', '--global=false', '--omit=dev', '--include=optional', '--no-audit', '--no-fund', '--no-package-lock'];
  await runNpm(args, directory);
}

async function packageInfo(name, entry) {
  for (let folder = dirname(entry); dirname(folder) !== folder; folder = dirname(folder)) {
    try {
      const manifest = await readPackage(join(folder, 'package.json'));
      if (manifest.name === name && typeof manifest.version === 'string') return { folder, version: manifest.version };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`Could not locate the ${name} package manifest.`);
}

async function recordPackage(name, entry, action) {
  if (!reportDir) return;
  const { folder, version } = await packageInfo(name, entry);
  const localPath = relative(managedRoot, folder);
  const local = !isAbsolute(localPath) && localPath.split(sep)[0] !== '..';
  const source = action === 'installed' ? 'npm registry' : local ? 'managed runtime' : 'existing installation';
  await record(name, version, folder, action, source);
}

async function managedDirectories(name) {
  const entries = await readdir(runtime, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const folders = entries.filter(entry => entry.isDirectory() && entry.name.startsWith(`${name}-`));
  const ready = await Promise.all(folders.map(async entry => {
    const directory = join(runtime, entry.name);
    try {
      if (await readFile(join(directory, 'ready'), 'utf8') === name) return directory;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }));
  return ready.filter(Boolean);
}

async function* resolutionPaths(name, source) {
  yield import.meta.url;
  if (source) yield source;
  for (const directory of await managedDirectories(name)) yield join(directory, 'package.json');
}

async function ensurePackage(name, probe, source) {
  const tried = new Set();
  for await (const from of resolutionPaths(name, source)) {
    let entry, value;
    try {
      entry = createRequire(from).resolve(name);
      if (tried.has(entry)) continue;
      tried.add(entry);
      value = await probe(entry);
    } catch {
      // Keep looking when a package is absent, fails to load, or fails its probe.
      continue;
    }
    await recordPackage(name, entry, 'reused');
    return value;
  }

  const manifest = await readPackage(join(root, 'package.json'));
  const version = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
  if (!version) throw new Error(`The skill manifest does not declare ${name}.`);
  await mkdir(runtime, { recursive: true });
  // Per-install directories keep simultaneous builds from corrupting each
  // other's dependencies. A directory is discoverable only after validation.
  const directory = await mkdtemp(join(runtime, `${name}-`));
  let entry, value;
  try {
    const file = join(directory, 'package.json');
    await writeFile(file, JSON.stringify({ private: true, dependencies: { [name]: version } }));
    console.error(`Installing ${name} ${version} through npm\nInstall directory ${directory}`);
    await install(directory);
    entry = createRequire(file).resolve(name);
    value = await probe(entry);
    // Avoid renaming a running esbuild executable on Windows. Mark the
    // completed directory and let subsequent builds discover it in place.
    await writeFile(join(directory, 'ready'), name);
  } catch (error) {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
    throw new Error(`Could not prepare ${name} ${version}: ${error.message}`, { cause: error });
  }
  await recordPackage(name, entry, 'installed');
  return value;
}

export function ensureEsbuild(source) {
  return ensurePackage('esbuild', async entry => {
    const module = await import(pathToFileURL(entry).href);
    const build = module.build ?? module.default?.build;
    if (typeof build !== 'function') throw new Error('esbuild browser bundle API is unavailable.');
    const result = await build({
      stdin: { contents: `import text from './assets/deck.css' with { type: 'text' }; console.log(text);`, resolveDir: root },
      bundle: true, platform: 'browser', target: 'es2020', write: false, logLevel: 'silent',
    });
    if (result.outputFiles.length !== 1) throw new Error('esbuild browser bundle probe failed.');
    return build;
  }, source);
}

export function ensureThree(build, source) {
  return ensurePackage('three', async entry => {
    const { folder } = await packageInfo('three', entry);
    const resolveDir = dirname(dirname(folder));
    await build({
      stdin: {
        contents: `import { WebGLRenderer } from 'three';
          import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
          console.log(WebGLRenderer, OrbitControls);`,
        resolveDir,
      },
      bundle: true, platform: 'browser', target: 'es2020', write: false, logLevel: 'silent',
    });
    const license = await readFile(join(folder, 'LICENSE'), 'utf8');
    return { resolveDir, license };
  }, source);
}

async function main() {
  const [, , mode, ...rest] = process.argv;
  if (rest.length || !['interactive', 'three'].includes(mode)) {
    throw new Error('Usage: node scripts/js-runtime.mjs interactive|three');
  }
  await announceJsRuntime(mode);
  const build = await ensureEsbuild();
  if (mode === 'three') await ensureThree(build);
  console.log(`JavaScript runtime ready (${mode}).`);
}

function invokedDirectly() {
  if (import.meta.main !== undefined) return import.meta.main;
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
