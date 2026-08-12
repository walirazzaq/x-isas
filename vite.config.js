import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: {
                index: 'src/index.js',
                core: 'src/core.js',
                calendar: 'src/calendar.js',
                upload: 'src/upload.js',
                'adapters/daisyui/index': 'src/adapters/daisyui/index.js',
            },
            name: 'xIsas',
            formats: ['es', 'cjs'],
            fileName: (format, entryName) => (
                `${entryName}.${format === 'es' ? 'js' : 'cjs'}`
            ),
        },
        rollupOptions: {
            external: ['alpinejs'],
            output: {
                exports: 'named',
            },
        },
    },
    test: {
        include: ['tests/**/*.test.js'],
        environment: 'happy-dom',
        restoreMocks: true,
    },
});
