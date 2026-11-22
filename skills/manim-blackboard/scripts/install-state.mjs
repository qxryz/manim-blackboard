/** File ownership and undo records for the repository installer. */
import { createHash, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const runtimeName = '.manim-blackboard';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const packageDirectories = new Set(['assets', 'licenses', 'references', 'scripts']);
const packageFiles = new Set(['LICENSE', 'SKILL.md', 'package.json', 'package-lock.json', 'restore.cmd', 'restore.command']);
export function requirePackagePath(name) {
  if (typeof name !== 'string' || !(packageFiles.has(name) || (name.includes('/') && packageDirectories.has(name.split('/')[0])))) {
    throw new Error('Invalid managed package path');
  }
}
export async function readOptional(path) {
  try { return await readFile(path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
}
export async function atomicWrite(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.bb-${randomUUID()}.tmp`);
  try { await writeFile(tmp, bytes, { flag: 'wx' }); await rename(tmp, path); }
  finally { await rm(tmp, { force: true }); }
}
export async function safeFile(root, name) {
  const parts = name.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[\\:\0]/.test(p))) throw new Error('Invalid package path');
  let path = root;
  for (const part of parts) {
    path = join(path, part);
    const info = await lstat(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (info?.isSymbolicLink()) throw new Error(`Refusing to replace a symbolic link: ${path}`);
  }
  return path;
}

export async function withInstallLock(root, work) {
  const lock = join(root, '.manim-blackboard-install.lock');
  try { await writeFile(lock, String(process.pid), { flag: 'wx' }); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Another installation may be running. If its process has stopped, remove ${lock} and retry.`);
    throw error;
  }
  try { return await work(); }
  finally { await rm(lock, { force: true }); }
}

export async function undoFiles(root, record) {
  const actions = [];
  for (const { name, before, after, mode } of record.changes) {
    requirePackagePath(name);
    const path = await safeFile(root, name);
    const bytes = await readOptional(path);
    const actual = bytes && hash(bytes);
    if (actual === before) continue;
    if (actual !== after) throw new Error(`Save your changes to ${path} before restoring.`);
    let previous;
    if (before) {
      if (!/^[a-f0-9]{64}$/.test(before)) throw new Error('Invalid backup digest');
      previous = await readFile(await safeFile(root, `${runtimeName}/backups/${before}`));
      if (hash(previous) !== before) throw new Error(`Damaged backup for ${name}`);
    }
    actions.push({ path, previous, mode });
  }
  for (const { path, previous, mode } of actions) {
    if (previous) {
      await atomicWrite(path, previous);
      if (process.platform !== 'win32' && Number.isInteger(mode)) await chmod(path, mode & 0o777);
    }
    else await rm(path);
  }
}
