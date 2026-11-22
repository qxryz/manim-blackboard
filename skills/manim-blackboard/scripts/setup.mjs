/** Prepare just the runtimes required for a lesson, or all of them at installation. */
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWrite } from './install-state.mjs';

const scripts = dirname(fileURLToPath(import.meta.url));
const runtime = join(scripts, '..', '.manim-blackboard');
const windows = process.platform === 'win32';
const pythonProbe = 'import sys; sys.exit(sys.version_info < (3, 10))';
const usage = 'node scripts/setup.mjs [all|manim|check|interactive|three]';
const roles = {
  node: 'Runs the builders and installer', npm: 'Installs JavaScript packages',
  esbuild: 'Bundles the player and lesson into an offline HTML file', three: 'Renders interactive 3D scenes',
  python: 'Runs native builds or browser checks', manim: 'Samples the authored animation frames',
  playwright: 'Drives the offline playback checks', chromium: 'Plays the lesson during verification',
  'google chrome': 'Plays the lesson during verification', 'microsoft edge': 'Plays the lesson during verification',
  uv: 'Provisions private Python runtimes', pip: 'Installs Python packages',
  micromamba: 'Provides native Manim libraries', conda: 'Provides native Manim libraries',
};

function run(program, args, options = {}) {
  const result = spawnSync(program, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} exited with ${result.status ?? result.signal}`);
  return result;
}

// Only the bootstrap download is pinned. Any usable uv on PATH takes priority.
// SHA-256 digests from the official astral-sh/uv release assets.
const uvVersion = '0.13.9';
const archives = {
  'win32:x64': ['x86_64-pc-windows-msvc.zip', 'edd61f7f5728a56cc62455386661860bdfc7bab65872f39b0c25bdcc1d8e1beb'],
  'win32:arm64': ['aarch64-pc-windows-msvc.zip', '72eed595983a4d7d22d79f21065b0f4479cc7e5c7a89104bb410c8f47559a878'],
  'darwin:x64': ['x86_64-apple-darwin.tar.gz', '617a3211261b0fc739562f0071aa34e9739797c510208ede8e2977c30903d041'],
  'darwin:arm64': ['aarch64-apple-darwin.tar.gz', '5aeca67f2283f75235de40d0bd9c0a5bbc5fce23b6d48b3bf9fa1b2db08382ca'],
  'linux:x64': ['x86_64-unknown-linux-gnu.tar.gz', 'a7fbaff2b9a271d85c1bdb540941090fd1ce011797b4abeb48e4dcd39c2471d5'],
  'linux:arm64': ['aarch64-unknown-linux-gnu.tar.gz', '0797542018e541a9288855df555c8077eed06f7a47d206362030480e8ecc9f3d'],
};

async function findUv() {
  const bin = join(runtime, 'bin');
  const executable = windows ? 'uv.exe' : 'uv';
  const local = join(bin, executable);
  for (const candidate of ['uv', local]) {
    if (spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0) return candidate;
  }
  const asset = archives[`${process.platform}:${process.arch}`];
  if (!asset) throw new Error('Install Python 3.10+ or uv for this platform, then retry.');
  await mkdir(bin, { recursive: true });
  const staging = await mkdtemp(join(bin, '.uv-'));
  console.error(`Installing uv ${uvVersion} from astral-sh/uv into ${bin}`);
  try {
    const [name, sha] = asset;
    const archive = join(staging, 'download');
    const url = `https://github.com/astral-sh/uv/releases/download/${uvVersion}/uv-${name}`;
    const args = ['--fail', '--location', '--silent', '--show-error', '--retry', '2', '--output', archive, url];
    // Windows Schannel may have no route to the certificate's revocation server.
    // Retry only that specific failure. Both paths still verify the pinned archive.
    const curl = windows ? 'curl.exe' : 'curl';
    const download = spawnSync(curl, args, { encoding:'utf8' });
    if (download.error) throw download.error;
    if (download.status !== 0) {
      if (windows && /CRYPT_E_REVOCATION_OFFLINE|0x80092013/i.test(download.stderr)) {
        run(curl, ['--ssl-revoke-best-effort', ...args]);
      } else {
        throw new Error(`Could not download the uv release (curl ${download.status}).`);
      }
    }
    if (createHash('sha256').update(await readFile(archive)).digest('hex') !== sha) throw new Error('uv download checksum mismatch.');
    const member = windows ? executable : `uv-${name.replace('.tar.gz', '')}/uv`;
    run('tar', ['-xf', archive, '-C', staging, member]);
    try {
      await rename(join(staging, member), local);
    } catch (error) {
      if (spawnSync(local, ['--version'], { stdio: 'ignore' }).status !== 0) throw error;
    }
    return local;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

async function findPython(env) {
  const candidates = windows ? [['python'], ['py', '-3'], ['python3']] : [['python3'], ['python']];
  for (const [program, ...args] of candidates) {
    if (spawnSync(program, [...args, '-c', pythonProbe], { stdio: 'ignore' }).status === 0) return [program, ...args];
  }
  const uv = await findUv();
  if (uv !== 'uv') env.PATH = dirname(uv) + delimiter + (env.PATH || '');
  Object.assign(env, { UV_CACHE_DIR: join(runtime, 'uv-cache'), UV_PYTHON_INSTALL_DIR: join(runtime, 'interpreters'), UV_PYTHON_BIN_DIR: join(runtime, 'bin') });
  console.error(`Preparing managed Python 3.12 in ${env.UV_PYTHON_INSTALL_DIR}`);
  run(uv, ['python', 'install', '--no-bin', ...(windows ? ['--no-registry'] : []), '3.12'], { env });
  const result = run(uv, ['python', 'find', '--managed-python', '3.12'], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  return [result.stdout.trim()];
}

async function main() {
  const [mode = 'all', ...rest] = process.argv.slice(2);
  if (mode === '--help' || mode === '-h') { console.log(usage); return; }
  if (mode === '--ensure-uv' && !rest.length) {
    console.error(`Checking for uv. A missing copy will be installed into ${join(runtime, 'bin')}`);
    console.log(await findUv());
    return;
  }
  if (rest.length || !['all', 'manim', 'check', 'interactive', 'three'].includes(mode)) throw new Error(usage);
  const report = join(runtime, 'install-report.md');
  console.log(`Checking dependencies for ${mode}. Compatible installations will be reused. Private dependencies and caches go in ${runtime}\nReport: ${report}`);
  await mkdir(runtime, { recursive:true });
  const facts = await mkdtemp(join(runtime, 'report-'));
  const env = { ...process.env, MANIM_BLACKBOARD_REPORT_DIR:facts };
  // Complete independent profiles and report partial successes when one fails.
  const failures = [];
  try {
    if (['all', 'interactive', 'three'].includes(mode)) {
      try { run(process.execPath, [join(scripts, 'js-runtime.mjs'), mode === 'all' ? 'three' : mode], {env}); }
      catch (error) { console.error(error.message); failures.push('JavaScript'); }
    }
    if (['all', 'manim', 'check'].includes(mode)) {
      const [program, ...args] = await findPython(env);
      for (const profile of mode === 'all' ? ['manim', 'playwright'] : [mode === 'check' ? 'playwright' : mode]) {
        try { run(program, [...args, join(scripts, 'python_runtime.py'), profile], { env }); }
        catch (error) { console.error(error.message); failures.push(profile); }
      }
    }
  } catch (error) {
    console.error(error.message);
    failures.push('Python bootstrap');
  } finally {
    const cell = value => String(value ?? '').replace(/[\r\n]/g, ' ').replaceAll('|', '\\|');
    const rows = new Map();
    for (const name of await readdir(facts)) {
      if (!name.endsWith('.json')) continue;
      for (const dep of JSON.parse(await readFile(join(facts, name), 'utf8'))) {
        rows.set(dep.name + '\n' + dep.path, [dep.name, dep.version, dep.action, dep.path, dep.source || '', roles[dep.name.toLowerCase()] || 'Runtime dependency'].map(cell).join(' | '));
      }
    }
    const summary = [
      '# Manim Blackboard installation report', '',
      `- Time (UTC): ${new Date().toISOString()}`, `- Operation: ${env.MANIM_BLACKBOARD_OPERATION || 'setup'} (${mode})`,
      `- Platform: ${process.platform} / ${process.arch}`, `- Private directory: ${runtime}`,
      `- Result: ${failures.length ? 'incomplete — ' + failures.join(', ') : 'success'}`, '',
      '| Dependency | Version | Action | Path | Source | Purpose |', '| --- | --- | --- | --- | --- | --- |',
      ...Array.from(rows.values(), row => `| ${row} |`), '',
      `Restore with: node "${join(scripts, 'restore.mjs')}"`, '',
    ];
    const stamp = new Date().toISOString().replaceAll(':', '-');
    const archive = join(runtime, 'reports', `${stamp}-${randomUUID().slice(0,8)}.md`);
    await atomicWrite(archive, summary.join('\n'));
    await atomicWrite(report, summary.join('\n'));
    await rm(facts, {recursive:true, force:true});
    console.log(`Installation report: ${report}`);
  }
  if (failures.length) throw new Error(`Setup incomplete: ${failures.join(', ')}`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
