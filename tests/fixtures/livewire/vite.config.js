import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    cacheDir: fileURLToPath(new URL('../../../test-results/vite-livewire', import.meta.url)),
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: false,
        }),
        tailwindcss(),
    ],
    server: {
        host: '127.0.0.1',
        port: 5174,
        strictPort: true,
        hmr: false,
    },
});
