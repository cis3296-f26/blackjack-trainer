import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const modules = new Map();
// Load the small TypeScript engine graph without adding a test-runner dependency.
export async function moduleUrl(url) {
  const key = url.href;
  if (modules.has(key)) return modules.get(key);
  const source = await readFile(url, 'utf8');
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  for (const match of [...outputText.matchAll(/from ['"](\.[^'"]+)['"]/g)]) {
    const dependency = new URL(`${match[1]}.ts`, url);
    outputText = outputText.replace(match[0], `from '${await moduleUrl(dependency)}'`);
  }
  const result = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  modules.set(key, result);
  return result;
}
