// main.js — Punto de entrada de Phaser, registra todas las escenas

import { LobbyScene } from './scenes/LobbyScene.js';
import { GameScene } from './scenes/GameScene.js';
import { MeetingScene } from './scenes/MeetingScene.js';
import { EndScene } from './scenes/EndScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#dbeafe',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  dom: {
    createContainer: true
  },
  scene: [LobbyScene, GameScene, MeetingScene, EndScene],
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  }
};

window.addEventListener('load', () => {
  const game = new Phaser.Game(config);
  window.game = game; // debug
  console.log('[OfiChaos] Juego iniciado');
});
