/** Publish only generated HTML and bundles; never clear public or user uploads. */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
await mkdir(new URL('public/assets/build/', root), { recursive: true });
await cp(
  new URL('.frontend-build/assets/build/', root),
  new URL('public/assets/build/', root),
  { recursive: true },
);
for (const name of ['index.html', 'admin.html']) {
  const html = await readFile(new URL('.frontend-build/' + name, root));
  await writeFile(fileURLToPath(new URL('public/' + name, root)), html);
}
