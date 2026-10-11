/**
 * AI Gesture Runner 3D - Application Entry Point
 */

import { Game } from './core/Game.js';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app-container');

  try {
    const game = new Game(container);
    game.start();
    console.log('[AI Gesture Runner 3D] Application initialized successfully.');
  } catch (err) {
    console.error('[AI Gesture Runner 3D] Initialization failed:', err);
    container.innerHTML = `
      <div style="color: white; padding: 40px; text-align: center; font-family: sans-serif;">
        <h2>Initialization Error</h2>
        <p style="color: #ff3366;">${err.message || 'WebGL or MediaPipe failed to initialize.'}</p>
        <p style="color: #888;">Please verify that WebGL is enabled in your browser settings.</p>
        <button onclick="location.reload()" style="padding: 10px 20px; background: #00f0ff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; margin-top: 16px;">
          Retry
        </button>
      </div>
    `;
  }
});
