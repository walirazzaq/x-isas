import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const fixture = fileURLToPath(new URL('../../fixtures/livewire/', import.meta.url));
const publicDirectory = fileURLToPath(new URL('../../fixtures/livewire/public/', import.meta.url));
const appKey = 'base64:eElzYXNMaXZld2lyZUZpeHR1cmVLZXkxMjM0NTY3ODk=';

function phpArguments() {
    const extensionDir = process.env.X_ISAS_PHP_EXTENSION_DIR;
    if (! extensionDir) return [];

    return [
        '-d', `extension_dir=${extensionDir}`,
        '-d', 'extension=php_mbstring.dll',
        '-d', 'extension=php_openssl.dll',
        '-d', 'extension=php_fileinfo.dll',
        '-d', 'extension=php_pdo_sqlite.dll',
    ];
}

async function waitForApplication(process, output) {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
        if (process.exitCode !== null) {
            throw new Error(`Livewire fixture exited early.\n${output.join('')}`);
        }

        try {
            const response = await fetch('http://127.0.0.1:4180/');
            if (response.ok) return;
        } catch {
            // The PHP server has not bound its port yet.
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`Timed out starting the Livewire fixture.\n${output.join('')}`);
}

export default async function startLivewireFixture() {
    const php = process.env.X_ISAS_PHP ?? 'php';
    const version = spawnSync(php, [...phpArguments(), '-r', 'echo PHP_VERSION;'], {
        encoding: 'utf8',
    });
    const [major = 0, minor = 0] = version.stdout.trim().split('.').map(Number);

    if (version.status !== 0 || major < 8 || (major === 8 && minor < 4)) {
        throw new Error(
            `x-isas Livewire tests require PHP 8.4 or newer; ${php} reported `
            + `${version.stdout.trim() || version.stderr.trim() || 'no version'}.`,
        );
    }

    const originalDirectory = process.cwd();
    const originalAppUrl = process.env.APP_URL;
    let vite;
    try {
        process.chdir(fixture);
        process.env.APP_URL = 'http://127.0.0.1:4180';
        vite = await createServer({
            configFile: fileURLToPath(new URL('../../fixtures/livewire/vite.config.js', import.meta.url)),
        });
        await vite.listen();
    } finally {
        process.chdir(originalDirectory);
        if (originalAppUrl === undefined) delete process.env.APP_URL;
        else process.env.APP_URL = originalAppUrl;
    }

    const output = [];
    const server = spawn(php, [
        ...phpArguments(),
        '-S', '127.0.0.1:4180',
        '../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php',
    ], {
        cwd: publicDirectory,
        env: {
            ...process.env,
            APP_NAME: 'x-isas Livewire fixture',
            APP_ENV: 'testing',
            APP_KEY: appKey,
            APP_DEBUG: 'true',
            APP_URL: 'http://127.0.0.1:4180',
            LOG_CHANNEL: 'stderr',
            SESSION_DRIVER: 'array',
            CACHE_STORE: 'array',
            QUEUE_CONNECTION: 'sync',
            DB_CONNECTION: 'sqlite',
            DB_DATABASE: ':memory:',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    server.stdout.on('data', (chunk) => output.push(chunk.toString()));
    server.stderr.on('data', (chunk) => output.push(chunk.toString()));

    try {
        await waitForApplication(server, output);
    } catch (error) {
        server.kill();
        await vite.close();
        throw error;
    }

    return async () => {
        server.kill();
        await vite.close();
    };
}
