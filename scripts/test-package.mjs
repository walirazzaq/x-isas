import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const vite = resolve(packageRoot, 'node_modules/vite/bin/vite.js');

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd ?? packageRoot,
        encoding: 'utf8',
        env: options.env ?? process.env,
        shell: process.platform === 'win32' && command.endsWith('.cmd'),
        stdio: options.capture ? 'pipe' : 'inherit',
    });

    if (result.status !== 0) {
        throw new Error(
            `${command} ${args.join(' ')} failed with status ${result.status}.\n`
            + `${result.stdout ?? ''}${result.stderr ?? ''}`,
        );
    }

    return result.stdout;
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'x-isas-package-'));
const consumer = join(temporaryRoot, 'consumer');
const npmEnvironment = {
    ...process.env,
    npm_config_cache: join(temporaryRoot, 'npm-cache'),
};

try {
    const packedOutput = run(npm, [
        'pack', '--json', '--pack-destination', temporaryRoot,
    ], { capture: true, env: npmEnvironment });
    const [packed] = JSON.parse(packedOutput);
    const tarball = join(temporaryRoot, packed.filename);
    const paths = packed.files.map((entry) => entry.path.replaceAll('\\', '/'));

    const allowed = /^(?:README\.md|package\.json|dist\/|src\/adapters\/[^/]+\/[^/]+\.css)/;
    const unexpected = paths.filter((path) => ! allowed.test(path));
    if (unexpected.length > 0) {
        throw new Error(`Packed tarball contains unexpected files:\n${unexpected.join('\n')}`);
    }

    const requiredArtifacts = [
        'dist/index.js', 'dist/index.cjs',
        'dist/core.js', 'dist/core.cjs',
        'dist/calendar.js', 'dist/calendar.cjs',
        'dist/upload.js', 'dist/upload.cjs',
        'dist/adapters/daisyui/index.js', 'dist/adapters/daisyui/index.cjs',
        'src/adapters/daisyui/styles.css',
    ];
    for (const artifact of requiredArtifacts) {
        if (! paths.includes(artifact)) throw new Error(`Packed tarball is missing ${artifact}`);
    }

    await mkdir(consumer);
    await writeFile(join(consumer, 'package.json'), JSON.stringify({
        name: 'x-isas-clean-consumer',
        private: true,
        type: 'module',
    }, null, 2) + '\n');

    run(npm, ['install', tarball, '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: consumer,
        env: npmEnvironment,
    });

    await writeFile(join(consumer, 'index.html'), '<div id="app"></div><script type="module" src="/main.js"></script>\n');
    await writeFile(join(consumer, 'main.js'), `
        import isas, { autoInstall } from 'x-isas';
        import * as core from 'x-isas/core';
        import * as calendar from 'x-isas/calendar';
        import * as upload from 'x-isas/upload';
        import * as daisyui from 'x-isas/adapters/daisyui';
        import 'x-isas/adapters/daisyui/styles.css';
        import 'x-isas/styles.css';
        globalThis.__xIsasConsumer = { isas, autoInstall, core, calendar, upload, daisyui };
    `);
    run(process.execPath, [vite, 'build'], { cwd: consumer });

    const nodePath = join(consumer, 'node_modules')
        + (process.env.NODE_PATH ? delimiter + process.env.NODE_PATH : '');
    run(process.execPath, ['--input-type=module', '--eval', `
        await import('x-isas');
        await import('x-isas/core');
        await import('x-isas/calendar');
        await import('x-isas/upload');
        await import('x-isas/adapters/daisyui');
    `], { cwd: consumer, env: { ...process.env, NODE_PATH: nodePath } });
    run(process.execPath, ['--input-type=commonjs', '--eval', `
        require('x-isas');
        require('x-isas/core');
        require('x-isas/calendar');
        require('x-isas/upload');
        require('x-isas/adapters/daisyui');
        const fs = require('node:fs');
        for (const css of ['x-isas/styles.css', 'x-isas/adapters/daisyui/styles.css']) {
            if (!fs.statSync(require.resolve(css)).isFile()) throw new Error(css + ' did not resolve');
        }
    `], { cwd: consumer, env: { ...process.env, NODE_PATH: nodePath } });

    const manifest = JSON.parse(await readFile(join(consumer, 'node_modules/x-isas/package.json'), 'utf8'));
    if (manifest.name !== 'x-isas') throw new Error('Installed package manifest was not x-isas');

    console.log(`Verified ${paths.length} packed files in an isolated consumer.`);
} finally {
    await rm(temporaryRoot, { recursive: true, force: true });
}
