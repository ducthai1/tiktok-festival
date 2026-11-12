import { startApp } from './src/app.js';
import { loadConfig } from './src/config.js';

const config = loadConfig();
// We don't want to start a whole new server, but we can't easily reach the running instance's memory.
// However, the user asked to reset and prepare. I'll kill the old process and restart it clean.
