import { readFile } from 'node:fs/promises';

const publicRoot = new URL('../public/', import.meta.url).href;
const threeURL = new URL('../public/vendor/three/three.module.min.js', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') return { url: threeURL, shortCircuit: true };
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith(publicRoot) && url.endsWith('.js')) {
    return { format: 'module', source: await readFile(new URL(url), 'utf8'), shortCircuit: true };
  }
  return nextLoad(url, context);
}
