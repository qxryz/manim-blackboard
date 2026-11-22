/** Install from a checkout without copying its development files or dependency cache. */
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, mkdir, realpath, readdir, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { atomicWrite, hash, readOptional, runtimeName, safeFile, undoFiles, withInstallLock } from '../skills/manim-blackboard/scripts/install-state.mjs';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const prefix = 'skills/manim-blackboard/';
const source = join(repo, prefix);
const usage = 'node scripts/install.mjs --target SKILL_DIRECTORY [--mode all|interactive|three|manim|check]';

async function install() {
  const { values } = parseArgs({ options: { target: {type:'string'}, mode: {type:'string', default:'all'}, help: {type:'boolean', short:'h'} } });
  if (values.help) { console.log(usage); return; }
  if (!values.target || !['all','interactive','three','manim','check'].includes(values.mode)) throw new Error(usage);
  await mkdir(resolve(values.target), { recursive: true });
  const root = await realpath(resolve(values.target));
  const skillSource = await realpath(source);
  const inside = relative(skillSource, root);
  if (!inside || (inside !== '..' && !inside.startsWith('..' + sep) && !isAbsolute(inside))) {
    throw new Error('Choose an installation directory outside the source skill.');
  }
  const local = await safeFile(root, runtimeName);
  const marker = await readOptional(await safeFile(root, 'SKILL.md'));
  const recovering = await readOptional(await safeFile(root, `${runtimeName}/installation.json`));
  if (!recovering && (await readdir(root)).length && !/^name:\s*manim-blackboard\s*$/m.test(marker?.toString() || '')) throw new Error('Choose an empty directory or an existing manim-blackboard installation.');
  const operation = marker ? 'update' : 'install';
  console.log(`Preparing to ${operation} Manim Blackboard in ${root}\nDependency check and any private downloads: ${local}\nRestore: node "${join(root, 'scripts', 'restore.mjs')}"`);
  await withInstallLock(root, async () => {
    const statePath = await safeFile(root, `${runtimeName}/installation.json`);
    const stateBytes = await readOptional(statePath);
    let state = stateBytes && JSON.parse(stateBytes);
    if (state?.pending) {
      await undoFiles(root, state);
      state = state.previous;
      if (state) await atomicWrite(statePath, JSON.stringify(state));
      else await rm(statePath, { force: true });
    }
    const names = execFileSync('git', ['ls-files', '-z', '--', prefix], {cwd:repo, encoding:'utf8'}).split('\0').filter(Boolean).map(p => p.slice(prefix.length));
    if (!names.includes('scripts/setup.mjs')) throw new Error('Run the installer from the manim-blackboard Git checkout.');
    const newNames = new Set(names);
    const changes = [];
    const payloads = new Map();
    for (const name of new Set([...names, ...(state?.files || [])])) {
      const target = await safeFile(root, name);
      const beforeBytes = await readOptional(target);
      const afterBytes = newNames.has(name) ? await readOptional(await safeFile(skillSource, name)) : null;
      if (newNames.has(name) && !afterBytes) throw new Error(`Missing package source: ${name}`);
      const before = beforeBytes && hash(beforeBytes);
      const after = afterBytes && hash(afterBytes);
      if (before === after) continue;
      if (beforeBytes) await atomicWrite(join(local, 'backups', before), beforeBytes);
      changes.push({ name, before, after });
      payloads.set(target, afterBytes);
    }
    if (changes.length) {
      const updated = { files: names, changes };
      await atomicWrite(statePath, JSON.stringify({ ...updated, pending:true, previous:state }));
      for (const [path, bytes] of payloads) {
        if (bytes) await atomicWrite(path, bytes);
        else await rm(path);
      }
      await atomicWrite(statePath, JSON.stringify(updated));
    }
    if (process.platform !== 'win32') await chmod(join(root, 'restore.command'), 0o755);
    const result = spawnSync(process.execPath, [join(root,'scripts','setup.mjs'), values.mode], {
      stdio:'inherit', env:{ ...process.env, MANIM_BLACKBOARD_OPERATION: operation },
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  });
}

install().catch(error => { console.error(error.message); process.exitCode = 1; });
