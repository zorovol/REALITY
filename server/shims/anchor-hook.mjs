import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const shimUrl = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'anchor.mjs')).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@coral-xyz/anchor') {
    return { shortCircuit: true, url: shimUrl };
  }
  return nextResolve(specifier, context);
}
