import { readdir, rm, rmdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readOptional, runtimeName, safeFile, undoFiles, withInstallLock } from './install-state.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
async function restore() {
  const local = await safeFile(root, runtimeName);
  console.log(`Restoring managed skill files in ${root} and removing private dependencies and reports in ${local}`);
  await withInstallLock(root, async () => {
    const raw = await readOptional(await safeFile(root, `${runtimeName}/installation.json`));
    if (raw) {
      const state = JSON.parse(raw);
      await undoFiles(root, state);
      const folders = new Set();
      for (const { name } of state.changes) {
        let dir = dirname(await safeFile(root, name));
        while (dir !== root) { folders.add(dir); dir = dirname(dir); }
      }
      for (const dir of [...folders].sort((a,b) => b.length - a.length)) {
        const entries = await readdir(dir).catch(error => { if (error.code !== 'ENOENT') throw error; });
        if (entries && !entries.length) await rmdir(dir);
      }
    }
    await rm(local, { recursive:true, force:true, maxRetries:3 });
  });
  console.log('Restore complete.');
}
restore().catch(error => { console.error(error.message); process.exitCode = 1; });
