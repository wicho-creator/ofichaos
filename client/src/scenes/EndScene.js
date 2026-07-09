// EndScene.js — Pantalla final con resultados

import { createButton, createPanel, createText } from '../systems/ui.js';

export class EndScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EndScene' });
  }

  create(data) {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    createPanel(this, this.scale.width / 2, this.scale.height / 2, 600, 500, 0x16213e);
    createText(this, this.scale.width / 2, 80, 'PARTIDA TERMINADA', { fontSize: '36px', color: '#fbbf24', bold: true }).setOrigin(0.5);

    if (data.winners === 'empleados') {
      createText(this, this.scale.width / 2, 130, '🎉 ¡Ganan los EMPLEADOS!', { fontSize: '24px', color: '#4ade80', bold: true }).setOrigin(0.5);
    } else if (data.winners === 'jefe') {
      createText(this, this.scale.width / 2, 130, '😈 ¡Gana el JEFE!', { fontSize: '24px', color: '#ef4444', bold: true }).setOrigin(0.5);
    }

    createText(this, this.scale.width / 2, 160, `Razón: ${data.reason || ''}`, { fontSize: '14px', color: '#94a3b8' }).setOrigin(0.5);

    // Lista de jugadores con resultados
    let y = 200;
    createText(this, this.scale.width / 2 - 250, y, 'Jugador', { fontSize: '16px', color: '#94a3b8', bold: true });
    createText(this, this.scale.width / 2 - 100, y, 'Rol', { fontSize: '16px', color: '#94a3b8', bold: true });
    createText(this, this.scale.width / 2 + 50, y, 'Tareas', { fontSize: '16px', color: '#94a3b8', bold: true });
    createText(this, this.scale.width / 2 + 150, y, 'Pts', { fontSize: '16px', color: '#94a3b8', bold: true });
    y += 30;

    if (data.players) {
      for (const p of data.players) {
        const roleColor = p.role === 'jefe' ? '#ef4444' : p.role === 'lamebotas' ? '#facc15' : '#4ade80';
        createText(this, this.scale.width / 2 - 250, y, p.name, { fontSize: '15px', color: '#e0e0e0' });
        createText(this, this.scale.width / 2 - 100, y, p.role || '?', { fontSize: '15px', color: roleColor });
        createText(this, this.scale.width / 2 + 50, y, String(p.tasksCompleted || 0), { fontSize: '15px', color: '#e0e0e0' });
        createText(this, this.scale.width / 2 + 150, y, String(p.points || 0), { fontSize: '15px', color: '#fbbf24', bold: true });
        y += 30;
      }
    }

    // Botón volver al lobby
    createButton(this, this.scale.width / 2, this.scale.height - 80, 'Volver al lobby', () => {
      this.scene.stop('EndScene');
      this.scene.start('LobbyScene');
    }, { bgColor: 0x4c1d95, bgHover: 0x6d28d9, fontSize: '18px', width: 250, height: 50 });
  }
}
