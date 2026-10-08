#!/usr/bin/env node
/* Inlines src/* into a single deployable index.html (no external deps). */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
let html = rd('shell.html');
const logic = ['levels.js', 'dogs.js', 'logic.js'].map(rd).join('\n');
const game = '(function () {\n\'use strict\';\n' + ['ui.js', 'audio.js', 'gfx.js', 'game.js', 'finale.js', 'main.js'].map(rd).join('\n') + '\n})();';
html = html.replace('/*STYLE*/', () => rd('style.css')).replace('/*LOGIC*/', () => logic).replace('/*GAME*/', () => game);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(1) + ' KB');
