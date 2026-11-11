// Transpiles every engine .ts file into a temp folder so tests can import modules that import
// each other (e.g. game.ts -> rules.ts -> shoe.ts). Relative imports get a .js extension so
// Node's ESM loader can resolve them.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const engineDir = fileURLToPath(new URL('..', import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'bjt-engine-'));
process.on('exit', () => rmSync(outDir, { recursive: true, force: true }));

for (const file of readdirSync(engineDir).filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(join(engineDir, file), 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            verbatimModuleSyntax: true,
        },
    });
    const withExtensions = outputText.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g, '$1$2.js$3');
    writeFileSync(join(outDir, file.replace(/\.ts$/, '.js')), withExtensions);
}

// Imports one transpiled engine module by name, e.g. loadEngine('game')
export const loadEngine = (name) => import(pathToFileURL(join(outDir, `${name}.js`)).href);
