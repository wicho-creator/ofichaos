// LobbyScene.js — Pantalla de lobby: crear/unirse a sala, elegir nombre, lista de jugadores

import * as net from '../systems/networking.js';
import { createButton, createPanel, createText } from '../systems/ui.js';

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
    this.roomCode = null;
    this.roomState = null;
    this.myRole = null;
    this.myId = null;
    this.roleAssigned = false;
  }

  create() {
    document.getElementById('loading')?.classList.add('hidden');
    this.cameras.main.setBackgroundColor('#1a1a2e');

    createPanel(this, this.scale.width / 2, this.scale.height / 2, 560, 540, 0x16213e);
    createText(this, this.scale.width / 2, 60, 'OFICHAOS', { fontSize: '48px', color: '#fbbf24', bold: true }).setOrigin(0.5);
    createText(this, this.scale.width / 2, 100, 'El caos de la oficina', { fontSize: '18px', color: '#94a3b8' }).setOrigin(0.5);

    // Input de nombre
    this.add.text(this.scale.width / 2 - 180, 120, 'Nombre:', { fontSize: '16px', color: '#e0e0e0' }).setOrigin(0, 0.5);
    const nameInput = this.add.dom(this.scale.width / 2, 140).createFromHTML('<input id="name-field" type="text" maxlength="12" placeholder="Ej: Carlos" style="width:240px;padding:8px;font-size:16px;background:#334155;color:#e0e0e0;border:2px solid #6366f1;border-radius:6px;">');
    nameInput.setOrigin(0.5);
    const nameEl = document.getElementById('name-field');

    // Input de código
    this.add.text(this.scale.width / 2 - 180, 200, 'Código:', { fontSize: '16px', color: '#e0e0e0' }).setOrigin(0, 0.5);
    const codeInput = this.add.dom(this.scale.width / 2, 220).createFromHTML('<input id="code-field" type="text" maxlength="5" placeholder="ABCDE" style="width:240px;padding:8px;font-size:16px;background:#334155;color:#e0e0e0;border:2px solid #6366f1;border-radius:6px;text-transform:uppercase;">');
    codeInput.setOrigin(0.5);
    const codeEl = document.getElementById('code-field');

    // Botones
    const btnY = 260;
    createButton(this, this.scale.width / 2 - 110, btnY, 'Crear sala', () => {
      const name = nameEl.value || 'Jugador';
      this.roomCode = null;
      this.myRole = null;
      this.roleAssigned = false;
      net.createRoom(name);
    });
    createButton(this, this.scale.width / 2 + 110, btnY, 'Unirse', () => {
      const name = nameEl.value || 'Jugador';
      const code = codeEl.value.toUpperCase();
      if (!code) { this.showMessage('Ingresa un código'); return; }
      this.roomCode = null;
      this.myRole = null;
      this.roleAssigned = false;
      net.joinRoom(code, name);
    });

    createButton(this, this.scale.width / 2, btnY + 60, '🧪 Probar sala demo', () => {
      this.startDemoRoom(nameEl.value || 'Wicho');
    }, { width: 300, height: 46, bgColor: 0xf59e0b, bgHover: 0xfbbf24, textColor: '#111827', fontSize: '16px' });

    // Área de info de sala
    this.infoText = createText(this, this.scale.width / 2, btnY + 120, 'Aún no estás en una sala.', { fontSize: '14px', color: '#94a3b8' }).setOrigin(0.5);
    this.playersText = createText(this, this.scale.width / 2, btnY + 180, '', { fontSize: '16px', color: '#e0e0e0' }).setOrigin(0.5);
    this.startButton = null;

    // Listeners de socket
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    net.socket.on('room:created', ({ code, playerId }) => {
      this.myId = playerId;
      this.roomCode = code;
      this.showMessage(`Sala creada: ${code}`);
    });

    net.socket.on('room:joined', ({ code, playerId }) => {
      this.myId = playerId;
      this.roomCode = code;
      this.showMessage(`Te uniste a sala ${code}`);
    });

    net.socket.on('room:update', (payload) => {
      if (!payload) return;
      this.roomState = payload;
      this.updateLobbyUI();
    });

    net.socket.on('error:message', ({ message }) => {
      this.showMessage(`Error: ${message}`);
    });

    net.socket.on('game:role', ({ role, secondaryObjectiveText }) => {
      this.myRole = role;
      this.roleAssigned = true;
      this.roleText = secondaryObjectiveText;
    });

    net.socket.on('game:started', (gameState) => {
      if (!this.roleAssigned) {
        this.scene.get('GameScene').myRole = this.myRole;
        this.scene.get('GameScene').roleText = this.roleText;
      }
      this.scene.stop('LobbyScene');
      this.scene.start('GameScene', { roomCode: this.roomCode, myId: this.myId, myRole: this.myRole, roleText: this.roleText });
    });
  }

  updateLobbyUI() {
    if (!this.roomState || !this.roomState.players) return;
    const players = this.roomState.players;
    const count = players.length;
    const names = players.map(p => p.name).join('\n');
    this.playersText.setText(`Jugadores (${count}/12):\n${names}`);

    // Mostrar botón de iniciar si es host y hay >= 4 jugadores
    if (this.roomState.hostId === this.myId && count >= 4 && !this.startButton) {
      this.startButton = createButton(this, this.scale.width / 2, this.scale.height - 100, '🚀 Iniciar partida', () => {
        net.startGame();
      }, { bgColor: 0x16a34a, bgHover: 0x22c55e, fontSize: '20px', width: 300, height: 60 });
    }
    if (count < 4 && this.startButton) {
      this.startButton.bg.destroy();
      this.startButton.label.destroy();
      this.startButton = null;
    }
  }

  showMessage(msg) {
    if (this.infoText) this.infoText.setText(msg);
  }

  startDemoRoom(name = 'Wicho') {
    const demoState = {
      phase: 'playing',
      timeRemaining: 7 * 60 * 1000 + 35 * 1000,
      taskPercent: 20,
      tasks: [
        { id: 'reporte', name: 'Imprimir reporte', zone: 'recepcion', completed: false },
        { id: 'correos', name: 'Responder correos', zone: 'cubiculos', completed: true },
        { id: 'cafe', name: 'Preparar café', zone: 'cocina', completed: false },
        { id: 'archivos', name: 'Ordenar archivos', zone: 'archivo', completed: false, blocked: true, blockedUntil: Date.now() + 12000 },
        { id: 'wifi', name: 'Arreglar WiFi', zone: 'servidor', completed: false }
      ],
      players: [
        { id: 'demo-me', name, x: 220, y: 190, morale: 86, role: 'empleado', tasksCompleted: 1, burnout: false, secondaryObjectiveDone: false, cooldowns: { report_sabotage: 16000 } },
        { id: 'demo-jefe', name: 'La Jefa', x: 800, y: 470, morale: 100, role: 'jefe', tasksCompleted: 0, burnout: false, cooldowns: {} },
        { id: 'demo-lame', name: 'Lame Pro', x: 520, y: 455, morale: 95, role: 'lamebotas', tasksCompleted: 0, burnout: false, cooldowns: {} },
        { id: 'demo-ana', name: 'Ana', x: 560, y: 205, morale: 72, role: 'empleado', tasksCompleted: 1, burnout: false, cooldowns: {} }
      ],
      activeSabotages: [{ type: 'block_task', taskId: 'archivos', expires: Date.now() + 12000 }]
    };
    this.scene.stop('LobbyScene');
    this.scene.start('GameScene', {
      roomCode: 'DEMO',
      myId: 'demo-me',
      myRole: 'empleado',
      roleText: 'Reportar un sabotaje sin quemarte',
      demoState
    });
  }
}
