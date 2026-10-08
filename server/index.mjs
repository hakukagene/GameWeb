import { createApp } from './app.mjs';
const port = Number(process.env.PORT || 8000);
const production = process.env.NODE_ENV === 'production';
const origin = process.env.APP_ORIGIN || `http://localhost:${port}`;
const demo = process.env.DEMO_PURCHASES === undefined ? !production : process.env.DEMO_PURCHASES === 'true';
const gamePort = Number(process.env.GAME_PORT || 8001);
const gameOrigin = process.env.GAME_ORIGIN || `http://localhost:${gamePort}`;
const app = createApp({ gameOrigin, contentRoot:process.env.GAME_CONTENT_ROOT || './game-content', dbPath: process.env.DB_PATH || './data/storyplay.sqlite', origin, production, demo });
if (!production && demo) app.gameServer.listen(gamePort, process.env.HOST || '127.0.0.1', () => console.log(`Game preview: ${gameOrigin}`));
for (const server of [app.server, app.gameServer]) server.on('error', err => { console.error('Server startup failed:', err.code); app.close().finally(() => process.exit(1)); });
app.server.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`STORYPLAY: ${origin}`);
  console.log(`Demo purchases: ${demo ? 'ON (no money, no paid entitlement)' : 'OFF'}`);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => app.close().then(() => process.exit(0)));
