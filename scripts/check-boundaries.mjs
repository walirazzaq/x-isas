import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const boundaryScript = fileURLToPath(import.meta.url);
const ignoredDirectories = new Set([
    '.git',
    'dist',
    'node_modules',
    'playwright-report',
    'test-results',
    'vendor',
]);
const textExtensions = new Set([
    '.blade.php', '.cjs', '.css', '.html', '.js', '.json', '.md', '.mjs', '.php', '.ts',
]);
const forbiddenReferences = [
    ['parent project identifier', /dx-components/i],
    ['former demo route', /(?:^|["'`])\/x-isas(?:\/|["'`])/i],
    ['former demo entry', /x-isas-demo/i],
    ['former root browser suite', /tests[\\/]e2e/i],
    ['former demo views', /resources[\\/]views[\\/]x-isas/i],
];
const relativePathPattern = /["'`](\.\.?(?:[\\/][^"'`\r\n]+)+)["'`]/g;

function isInsideRoot(path) {
    const offset = relative(root, path);
    return offset === '' || (! offset.startsWith('..') && ! isAbsolute(offset));
}

async function collect(directory) {
    const files = [];

    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

        const path = resolve(directory, entry.name);
        const packagePath = relative(root, path).replaceAll('\\', '/');
        if (entry.isDirectory() && packagePath === 'tests/fixtures/livewire/storage') continue;
        if (entry.isDirectory()) {
            files.push(...await collect(path));
            continue;
        }

        if (entry.isFile() && textExtensions.has(extname(entry.name))) files.push(path);
    }

    return files;
}

const failures = [];
const canonicalRoot = await realpath(root);

for (const file of await collect(root)) {
    const metadata = await lstat(file);
    if (metadata.isSymbolicLink() && ! isInsideRoot(await realpath(file))) {
        failures.push(`${relative(root, file)} is a symlink outside the package`);
        continue;
    }

    const contents = await readFile(file, 'utf8');
    if (file !== boundaryScript) {
        for (const [label, pattern] of forbiddenReferences) {
            if (pattern.test(contents)) failures.push(`${relative(root, file)} contains ${label}`);
        }
    }

    for (const match of contents.matchAll(relativePathPattern)) {
        const target = resolve(dirname(file), match[1].replaceAll('\\', '/'));
        if (! isInsideRoot(target)) {
            failures.push(`${relative(root, file)} escapes the package via ${match[1]}`);
        }
    }
}

if (canonicalRoot !== await realpath(root)) failures.push('package root could not be canonicalized');

if (failures.length > 0) {
    console.error('x-isas package boundary violations:\n' + failures.map((failure) => `- ${failure}`).join('\n'));
    process.exitCode = 1;
} else {
    console.log('x-isas package boundary is self-contained.');
}
