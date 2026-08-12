import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const fixture = resolve(packageRoot, 'tests/fixtures/livewire');
const installed = resolve(fixture, 'vendor/composer/installed.json');

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

try {
    await access(resolve(fixture, 'vendor/autoload.php'), constants.R_OK);
    const packages = JSON.parse(await readFile(installed, 'utf8')).packages ?? [];
    const names = new Set(packages.map((entry) => entry.name));
    if (names.has('laravel/framework') && names.has('livewire/livewire')) {
        console.log('Laravel 13 / Livewire 4 fixture dependencies are installed.');
        process.exit(0);
    }
} catch {
    // A copied package has no fixture vendor directory yet.
}

const composerPhar = process.env.X_ISAS_COMPOSER_PHAR;
const composer = composerPhar
    ? (process.env.X_ISAS_PHP ?? 'php')
    : (process.env.X_ISAS_COMPOSER ?? 'composer');
const composerPrefix = composerPhar ? [...phpArguments(), composerPhar] : [];
let result;
for (let attempt = 1; attempt <= 3; attempt++) {
    result = spawnSync(composer, [
        ...composerPrefix,
        'install',
        '--working-dir', fixture,
        '--no-interaction',
        '--prefer-dist',
        '--no-scripts',
    ], {
        encoding: 'utf8',
        shell: process.platform === 'win32',
        stdio: 'pipe',
    });

    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');

    if (result.status === 0) break;

    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    const transientLock = /resource temporarily unavailable|being used by another process|\bEPERM\b|\bEACCES\b/i
        .test(output);
    if (! transientLock || attempt === 3) break;

    console.warn(`Composer encountered a transient file lock; retrying (${attempt}/3).`);
    await new Promise((resolve) => setTimeout(resolve, 750));
}

if (result.status !== 0) {
    throw new Error(
        'Unable to install the package-owned Livewire fixture. '
        + 'Use PHP 8.4+ and Composer, set X_ISAS_COMPOSER to its executable, '
        + 'or set X_ISAS_COMPOSER_PHAR with X_ISAS_PHP.',
    );
}

const php = process.env.X_ISAS_PHP ?? 'php';
const discover = spawnSync(php, [
    ...phpArguments(),
    'artisan',
    'package:discover',
    '--ansi',
], {
    cwd: fixture,
    encoding: 'utf8',
    stdio: 'inherit',
});

if (discover.status !== 0) {
    throw new Error('Installed the Livewire fixture but Laravel package discovery failed.');
}
