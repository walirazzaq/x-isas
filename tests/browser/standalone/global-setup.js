import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

export default async function startStandaloneFixture() {
    const server = await createServer({
        configFile: fileURLToPath(new URL('../../fixtures/standalone/vite.config.js', import.meta.url)),
    });

    await server.listen();

    return async () => {
        await server.close();
    };
}
