import * as path from 'path';
import { existsSync, readFile, outputFile } from 'fs-extra';

export const META_FILENAME = 'automig-meta.json';

export type DumpMeta = {
  /** date (YYYY-MM-DD) the data was dumped on, in local time of the dumping environment */
  baseDate: string;
  /** timestamp the dump was executed at */
  dumpedAt: string;
};

export function getMetaFilePath(dir: string) {
  return path.join(dir, META_FILENAME);
}

export async function readDumpMeta(dir: string) {
  const filepath = getMetaFilePath(dir);
  if (!existsSync(filepath)) {
    return undefined;
  }
  const json = await readFile(filepath, 'utf8');
  return JSON.parse(json) as DumpMeta;
}

export async function writeDumpMeta(dir: string, meta: DumpMeta) {
  const filepath = getMetaFilePath(dir);
  await outputFile(filepath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  return filepath;
}
