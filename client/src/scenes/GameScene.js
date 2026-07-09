// GameScene.js — Escena principal de juego: mapa, movimiento, tareas, HUD

import * as net from '../systems/networking.js';
import { createButton, createPanel, createText } from '../systems/ui.js';
import { createPlayerSprite, updatePlayerSprite } from '../systems/player.js';
import { TASKS as CLIENT_TASKS } from '../systems/tasks.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.roomCode = null;
    this.myId = null;
    this.myRole = null;
    this.roleText = '';
    this.players = {};
    this.sprites = {};
    this.cursors = null;
    this.wasd = null;
    this.gameState = null;
    this.lastMoveTime = 0;
    this.moveThrottle = 80;

    // HUD elements
    this.hudText = null;
    this.roleDisplay = null;
    this.tasksList = null;
    this.moraleBar = null;
    this.timerText = null;
    this.taskPercentText = null;
    this.cooldownText = null;
    this.mobileInput = { left: false, right: false, up: false, down: false };

    // Active task minigame
    this.activeTaskPanel = null;
  }

  create(data) {
    this.cameras.main.setBackgroundColor('#0f0f23');
    this.roomCode = data?.roomCode;
    this.myId = data?.myId;
    this.myRole = data?.myRole;
    this.roleText = data?.roleText || '';

    // Mapa de oficina (fondo)
    this.drawMap();
    this.cameras.main.setBounds(0, 0, 1200, 900);
    this.cameras.main.setZoom(this.scale.height < 700 ? 0.9 : 1.15);

    // Controles
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // HUD fijo en pantalla aunque la cámara siga al jugador
    const worldChildCount = this.children.list.length;
    this.createHUD();
    this.children.list.slice(worldChildCount).forEach((child) => child.setScrollFactor?.(0));

    // Listeners socket
    this.setupSocketListeners();

    if (data?.demoState) {
      this.time.delayedCall(80, () => this.loadDemoState(data.demoState));
    }

    // Throttled movement
    this.input.on('pointerdown', (pointer) => {
      this.handleMapClick(pointer);
    });
    this.input.keyboard.on('keydown-E', () => this.tryOpenNearbyTask());

    console.log('[GameScene] Iniciada', { role: this.myRole, roleText: this.roleText });
  }

  drawMap() {
    // Fondo general
    const g = this.add.graphics();
    g.fillStyle(0x101827, 1);
    g.fillRect(0, 0, 1200, 900);
    g.lineStyle(1, 0x233044, 0.35);
    for (let x = 0; x <= 1200; x += 60) g.lineBetween(x, 0, x, 900);
    for (let y = 0; y <= 900; y += 60) g.lineBetween(0, y, 1200, y);

    // Zonas del mapa
    const zoneColors = {
      recepcion: 0x3b82f6,
      cubiculos: 0x10b981,
      juntas: 0xf59e0b,
      cocina: 0xef4444,
      archivo: 0x8b5cf6,
      jefe_oficina: 0xdc2626,
      rh: 0x06b6d4,
      servidor: 0x6366f1
    };

    const zones = [
      { id: 'recepcion', name: 'Recepción', x: 100, y: 100, w: 250, h: 200 },
      { id: 'cubiculos', name: 'Cubículos', x: 450, y: 100, w: 300, h: 200 },
      { id: 'juntas', name: 'Sala de Juntas', x: 850, y: 100, w: 250, h: 200 },
      { id: 'cocina', name: 'Cocina', x: 100, y: 400, w: 200, h: 180 },
      { id: 'archivo', name: 'Archivo', x: 400, y: 400, w: 200, h: 180 },
      { id: 'jefe_oficina', name: 'Oficina del Jefe', x: 700, y: 400, w: 200, h: 180 },
      { id: 'rh', name: 'Recursos Humanos', x: 100, y: 650, w: 250, h: 180 },
      { id: 'servidor', name: 'Servidor / IT', x: 500, y: 650, w: 250, h: 180 }
    ];

    for (const z of zones) {
      const color = zoneColors[z.id] || 0x475569;
      g.fillStyle(color, 0.15);
      g.fillRect(z.x, z.y, z.w, z.h);
      g.lineStyle(3, color, 0.5);
      g.strokeRect(z.x, z.y, z.w, z.h);
      this.add.text(z.x + z.w / 2, z.y + 15, z.name, {
        fontSize: '14px',
        color: '#94a3b8',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      // Marcar tareas disponibles en cada zona
      const taskInZone = CLIENT_TASKS.find((t) => t.zone === z.id);
      if (taskInZone) {
        this.add.text(z.x + z.w / 2, z.y + z.h - 15, `📋 ${taskInZone.name}`, {
          fontSize: '12px',
          color: '#fbbf24'
        }).setOrigin(0.5);
      }
    }

    // Caminos entre zonas (líneas decorativas)
    g.lineStyle(2, 0x334155, 0.3);
    g.lineBetween(350, 200, 450, 200); // recepción -> cubículos
    g.lineBetween(750, 200, 850, 200); // cubículos -> juntas
    g.lineBetween(225, 300, 225, 400); // recepción -> cocina
    g.lineBetween(500, 300, 500, 400); // cubículos -> archivo
    g.lineBetween(800, 300, 800, 400); // juntas -> jefe
  }

  createHUD() {
    const w = this.scale.width;
    const h = this.scale.height;
    const compact = h < 700;

    createPanel(this, w / 2, compact ? 58 : 52, Math.min(690, w - 120), compact ? 56 : 68, 0x0b1220, { strokeColor: 0xfbbf24, strokeAlpha: 0.28, radius: 18 });
    this.timerText = this.add.text(w / 2 - 128, compact ? 51 : 46, '⏱ 8:00', {
      fontSize: compact ? '20px' : '22px', color: '#fbbf24', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);
    this.taskPercentText = this.add.text(w / 2 + 84, compact ? 51 : 46, '📋 Tareas 0%', {
      fontSize: compact ? '16px' : '17px', color: '#4ade80', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);
    this.add.text(w / 2, compact ? 68 : 68, 'WASD/Flechas · E o botón azul para trabajar', {
      fontSize: '10px', color: '#94a3b8'
    }).setOrigin(0.5);

    const roleColors = { jefe: '#ef4444', lamebotas: '#facc15', empleado: '#4ade80' };
    const roleName = { jefe: 'JEFE', lamebotas: 'LAMEBOTAS', empleado: 'EMPLEADO' };
    const roleW = compact ? 270 : 320;
    const roleH = compact ? 88 : 104;
    const roleX = compact ? 205 : 210;
    const roleY = compact ? h - 126 : h - 154;
    createPanel(this, roleX, roleY, roleW, roleH, 0x111827, { strokeColor: 0x38bdf8, strokeAlpha: 0.24, radius: 20 });
    this.roleDisplay = this.add.text(roleX, roleY - (compact ? 22 : 28), `ROL: ${roleName[this.myRole] || '?'}`, {
      fontSize: compact ? '15px' : '17px', color: roleColors[this.myRole] || '#94a3b8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(roleX, roleY + (compact ? -1 : -3), 'Objetivo secundario', { fontSize: '10px', color: '#94a3b8' }).setOrigin(0.5);
    this.add.text(roleX, roleY + (compact ? 18 : 21), this.roleText || 'Sobrevive al caos de la oficina', {
      fontSize: compact ? '10px' : '11px', color: '#f8fafc', align: 'center', wordWrap: { width: compact ? 214 : 260 }
    }).setOrigin(0.5);

    const statusW = compact ? 294 : 342;
    const statusH = compact ? 108 : 130;
    const statusX = compact ? w - 205 : w - 215;
    const statusY = compact ? h - 130 : h - 160;
    createPanel(this, statusX, statusY, statusW, statusH, 0x111827, { strokeColor: 0x22c55e, strokeAlpha: 0.22, radius: 20 });
    this.add.text(statusX - (compact ? 108 : 126), statusY - (compact ? 34 : 42), '😊 Moral del equipo', { fontSize: compact ? '12px' : '13px', color: '#cbd5e1', fontStyle: 'bold' });
    this.moraleBar = this.add.rectangle(statusX + (compact ? 8 : 18), statusY - (compact ? 26 : 34), compact ? 146 : 168, 14, 0x334155).setOrigin(0.5);
    this.moraleFill = this.add.rectangle(statusX - (compact ? 65 : 66), statusY - (compact ? 26 : 34), compact ? 146 : 168, 14, 0x4ade80).setOrigin(0, 0.5);
    this.add.text(statusX - (compact ? 108 : 126), statusY - (compact ? 7 : 12), 'Tareas activas', { fontSize: '11px', color: '#94a3b8', fontStyle: 'bold' });
    this.tasksList = this.add.text(statusX - (compact ? 108 : 126), statusY + (compact ? 11 : 8), '', {
      fontSize: compact ? '10px' : '11px', color: '#e2e8f0', lineSpacing: 2, wordWrap: { width: compact ? 220 : 268 }
    }).setOrigin(0, 0);

    const actionY = compact ? h - 76 : h - 82;
    createPanel(this, w / 2, actionY, compact ? 228 : 280, compact ? 72 : 94, 0x0b1220, { strokeColor: 0x64748b, strokeAlpha: 0.25, radius: 18 });
    const btnY = compact ? actionY - 7 : actionY - 8;
    createButton(this, w / 2 - 58, btnY, '📋', () => net.callMeeting(), { width: compact ? 44 : 50, height: compact ? 42 : 48, bgColor: 0xdc2626, bgHover: 0xef4444, fontSize: '18px', radius: 14 });
    createButton(this, w / 2, btnY, '🛠', () => this.tryOpenNearbyTask(), { width: compact ? 44 : 50, height: compact ? 42 : 48, bgColor: 0x2563eb, bgHover: 0x3b82f6, fontSize: '18px', radius: 14 });
    if (this.myRole === 'empleado') {
      createButton(this, w / 2 + 58, btnY, '🚨', () => net.reportSabotage(), { width: compact ? 44 : 50, height: compact ? 42 : 48, bgColor: 0xf97316, bgHover: 0xfb923c, fontSize: '18px', radius: 14 });
    }
    if (this.myRole === 'jefe' || this.myRole === 'lamebotas') {
      createButton(this, w / 2 + 58, btnY, '💀', () => this.startSabotageMenu(), { width: compact ? 44 : 50, height: compact ? 42 : 48, bgColor: 0x7c2d12, bgHover: 0xdc2626, fontSize: '18px', radius: 14 });
    }
    this.cooldownText = this.add.text(w / 2, actionY + (compact ? 14 : 22), '', {
      fontSize: '10px', color: '#bbf7d0', align: 'center', wordWrap: { width: compact ? 206 : 190 }
    }).setOrigin(0.5, 0.5);

    this.createMobileControls();
  }

  loadDemoState(gs) {
    this.gameState = gs;
    this.syncPlayers(gs);
    this.updateHUD(gs);
    this.showFloatingText('🧪 Sala demo cargada: probá tareas, sabotajes y cámara', 0xfbbf24);
  }

  createMobileControls() {
    if (this.scale.width > 900) return;
    const baseX = 82;
    const baseY = this.scale.height - 82;
    const makePad = (x, y, label, key) => {
      const btn = createButton(this, x, y, label, () => {}, { width: 38, height: 36, bgColor: 0x334155, bgHover: 0x475569, fontSize: '14px' });
      btn.hit.on('pointerdown', () => { this.mobileInput[key] = true; });
      btn.hit.on('pointerup', () => { this.mobileInput[key] = false; });
      btn.hit.on('pointerout', () => { this.mobileInput[key] = false; });
      btn.bg.setScrollFactor(0);
      btn.label.setScrollFactor(0);
      btn.hit.setScrollFactor(0);
      btn.shadow.setScrollFactor(0);
    };
    makePad(baseX, baseY - 38, '↑', 'up');
    makePad(baseX, baseY + 38, '↓', 'down');
    makePad(baseX - 40, baseY, '←', 'left');
    makePad(baseX + 40, baseY, '→', 'right');
  }

  getCooldownLine(me) {
    const cd = me?.cooldowns || {};
    const interesting = this.myRole === 'empleado'
      ? [['Reportar', cd.report_sabotage]]
      : this.myRole === 'lamebotas'
        ? [['Fake', cd.fake_task], ['Reporte', cd.false_report], ['Bloq', cd.block_task], ['Zona', cd.zone]]
        : [['Zona', cd.zone], ['Moral', cd.lower_morale], ['Extra', cd.extra_task], ['Puerta', cd.close_door]];
    return interesting
      .filter(([, ms]) => ms > 0)
      .map(([name, ms]) => `${name} ${Math.ceil(ms / 1000)}s`)
      .join('\n');
  }

  setupSocketListeners() {
    net.socket.on('game:started', (gs) => {
      this.gameState = gs;
      this.syncPlayers(gs);
      this.updateHUD(gs);
    });

    net.socket.on('game:update', (gs) => {
      this.gameState = gs;
      this.syncPlayers(gs);
      this.updateHUD(gs);
    });

    net.socket.on('game:tick', (data) => {
      if (!this.gameState) this.gameState = {};
      this.gameState.timeRemaining = data.timeRemaining;
      this.gameState.taskPercent = data.taskPercent;
      // Actualizar posiciones de jugadores remotos
      if (data.players) {
        for (const pid of Object.keys(data.players)) {
          if (this.players[pid]) {
            Object.assign(this.players[pid], data.players[pid]);
          }
        }
      }
      this.updateHUD(this.gameState);
    });

    net.socket.on('player:moved', ({ playerId, x, y }) => {
      if (this.players[playerId]) {
        this.players[playerId].x = x;
        this.players[playerId].y = y;
      }
    });

    net.socket.on('task:completed', ({ taskId, completedBy, playerName }) => {
      const task = CLIENT_TASKS.find((t) => t.id === taskId);
      this.showFloatingText(`${playerName} completó: ${task?.name || taskId}`, 0x4ade80);
      if (this.activeTaskPanel && this.activeTaskPanel.taskId === taskId) {
        this.closeTaskPanel();
      }
    });

    net.socket.on('sabotage:triggered', (data) => {
      const label = data.type === 'fake_task' ? 'un compañero está fingiendo trabajar' : `zona ${data.zoneId}`;
      this.showFloatingText(`⚠ Sabotaje: ${label}`, 0xef4444);
    });

    net.socket.on('sabotage:extra_task', () => {
      this.showFloatingText('Asignaste tarea extra! -10 moral', 0xef4444);
    });

    net.socket.on('sabotage:morale', () => {
      this.showFloatingText('Moral bajada por el jefe! -20', 0xef4444);
    });

    net.socket.on('sabotage:door_closed', ({ zoneId }) => {
      this.showFloatingText(`Puerta cerrada: ${zoneId}`, 0xf59e0b);
    });

    net.socket.on('sabotage:fake_task', () => {
      this.showFloatingText('Fingiste una tarea. Nadie sospecha... todavía.', 0xfacc15);
    });

    net.socket.on('sabotage:false_report', () => {
      this.showFloatingText('📣 Reporte falso: la oficina entra en pánico', 0xef4444);
    });

    net.socket.on('sabotage:block_task', ({ taskId }) => {
      this.showFloatingText(`⛔ Tarea bloqueada: ${taskId}`, 0xef4444);
    });

    net.socket.on('sabotage:reported', ({ playerName, sabotageType, zoneId, taskId }) => {
      const where = zoneId || taskId || sabotageType;
      this.showFloatingText(`🚨 ${playerName} reportó sabotaje: ${where}`, 0xf97316);
    });

    net.socket.on('meeting:started', ({ calledBy, playerName }) => {
      this.showFloatingText(`Reunión convocada por ${playerName}`, 0xfbbf24);
      this.scene.stop('GameScene');
      this.scene.launch('MeetingScene', { roomCode: this.roomCode, myId: this.myId, myRole: this.myRole });
      this.scene.bringToTop('MeetingScene');
    });

    net.socket.on('game:ended', (data) => {
      this.scene.stop('GameScene');
      this.scene.start('EndScene', data);
    });

    net.socket.on('error:message', ({ message }) => {
      this.showFloatingText(message, 0xef4444);
    });
  }

  syncPlayers(gs) {
    if (!gs || !gs.players) return;
    for (const p of gs.players) {
      if (!this.players[p.id]) {
        this.players[p.id] = { ...p };
        this.sprites[p.id] = createPlayerSprite(this, p, p.id === this.myId);
        if (p.id === this.myId) {
          this.cameras.main.startFollow(this.sprites[p.id].container, true, 0.12, 0.12);
        }
      }
      Object.assign(this.players[p.id], p);
    }
  }

  updateHUD(gs) {
    if (!gs) return;

    // Timer
    if (gs.timeRemaining != null) {
      const secs = Math.ceil(gs.timeRemaining / 1000);
      const mins = Math.floor(secs / 60);
      const remSecs = secs % 60;
      this.timerText.setText(`⏱ ${mins}:${remSecs.toString().padStart(2, '0')}`);
    }

    // Task percent
    if (gs.taskPercent != null) {
      this.taskPercentText.setText(`📋 Tareas ${gs.taskPercent}%`);
      const color = gs.taskPercent >= 80 ? '#4ade80' : '#fbbf24';
      this.taskPercentText.setColor(color);
    }

    // Moral
    const me = this.players[this.myId];
    if (me) {
      const moralePct = Math.max(0, Math.min(100, me.morale));
      this.moraleFill.width = Math.max(0, 230 * (moralePct / 100));
      const moraleColor = moralePct > 60 ? 0x4ade80 : moralePct > 30 ? 0xfbbf24 : 0xef4444;
      this.moraleFill.setFillStyle(moraleColor);
    }

    // Tasks list
    if (gs.tasks) {
      const tasksStr = gs.tasks.map((t) => `${t.completed ? '✅' : t.blocked ? '⛔' : '⬜'} ${t.name}`).join('\n');
      this.tasksList.setText(tasksStr);
    }

    if (this.cooldownText) {
      const line = this.getCooldownLine(me);
      this.cooldownText.setText(line ? `Cooldowns:\n${line}` : 'Listo');
      this.cooldownText.setColor(line ? '#fed7aa' : '#bbf7d0');
    }
  }

  update(time, delta) {
    // Movimiento del jugador local
    const me = this.players[this.myId];
    if (!me) return;

    // No mover si está en burnout (el servidor lo maneja, pero reducimos visualmente)
    let speed = 250;
    if (me.burnout) speed = 125;

    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown || this.mobileInput.left) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown || this.mobileInput.right) dx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown || this.mobileInput.up) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown || this.mobileInput.down) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len; dy /= len;
      me.x += dx * speed * (delta / 1000);
      me.y += dy * speed * (delta / 1000);
      me.x = Phaser.Math.Clamp(me.x, 20, 1180);
      me.y = Phaser.Math.Clamp(me.y, 20, 880);

      // Throttle send to server
      if (time - this.lastMoveTime > this.moveThrottle) {
        net.sendMove(me.x, me.y);
        this.lastMoveTime = time;
      }
    }

    // Actualizar sprites
    for (const pid of Object.keys(this.players)) {
      if (this.sprites[pid]) {
        updatePlayerSprite(this.sprites[pid], this.players[pid]);
      }
    }
  }

  getTaskInteractionDistance() {
    return this.scale.height < 700 ? 170 : 135;
  }

  tryOpenNearbyTask() {
    const me = this.players[this.myId];
    if (!me) return;
    const zones = [
      { id: 'recepcion', name: 'Recepción', x: 100, y: 100, w: 250, h: 200 },
      { id: 'cubiculos', name: 'Cubículos', x: 450, y: 100, w: 300, h: 200 },
      { id: 'juntas', name: 'Sala de Juntas', x: 850, y: 100, w: 250, h: 200 },
      { id: 'cocina', name: 'Cocina', x: 100, y: 400, w: 200, h: 180 },
      { id: 'archivo', name: 'Archivo', x: 400, y: 400, w: 200, h: 180 },
      { id: 'jefe_oficina', name: 'Oficina del Jefe', x: 700, y: 400, w: 200, h: 180 },
      { id: 'rh', name: 'Recursos Humanos', x: 100, y: 650, w: 250, h: 180 },
      { id: 'servidor', name: 'Servidor / IT', x: 500, y: 650, w: 250, h: 180 }
    ];
    let nearestTask = null;
    let minDist = Infinity;
    for (const z of zones) {
      const task = CLIENT_TASKS.find((t) => t.zone === z.id);
      if (!task) continue;
      const dist = Phaser.Math.Distance.Between(me.x, me.y, z.x + z.w / 2, z.y + z.h / 2);
      if (dist < minDist) {
        minDist = dist;
        nearestTask = task;
      }
    }
    if (nearestTask && minDist < this.getTaskInteractionDistance()) {
      this.openTaskPanel(nearestTask);
    } else {
      this.showFloatingText('Acércate a una zona y presiona E para trabajar', 0xfbbf24);
    }
  }

  handleMapClick(pointer) {
    // Verificar si click está cerca de una zona con tarea
    const clickX = pointer.worldX;
    const clickY = pointer.worldY;
    const zones = [
      { id: 'recepcion', name: 'Recepción', x: 100, y: 100, w: 250, h: 200 },
      { id: 'cubiculos', name: 'Cubículos', x: 450, y: 100, w: 300, h: 200 },
      { id: 'juntas', name: 'Sala de Juntas', x: 850, y: 100, w: 250, h: 200 },
      { id: 'cocina', name: 'Cocina', x: 100, y: 400, w: 200, h: 180 },
      { id: 'archivo', name: 'Archivo', x: 400, y: 400, w: 200, h: 180 },
      { id: 'jefe_oficina', name: 'Oficina del Jefe', x: 700, y: 400, w: 200, h: 180 },
      { id: 'rh', name: 'Recursos Humanos', x: 100, y: 650, w: 250, h: 180 },
      { id: 'servidor', name: 'Servidor / IT', x: 500, y: 650, w: 250, h: 180 }
    ];

    for (const z of zones) {
      if (clickX >= z.x && clickX <= z.x + z.w && clickY >= z.y && clickY <= z.y + z.h) {
        const task = CLIENT_TASKS.find((t) => t.zone === z.id);
        if (task) {
          const me = this.players[this.myId];
          if (me) {
            const dist = Phaser.Math.Distance.Between(me.x, me.y, z.x + z.w / 2, z.y + z.h / 2);
            if (dist < this.getTaskInteractionDistance()) {
              this.openTaskPanel(task);
            } else {
              this.showFloatingText('Acércate a la zona para hacer la tarea', 0xfbbf24);
            }
          }
        }
        return;
      }
    }
  }

  openTaskPanel(task) {
    // Verificar si ya está completada
    if (this.gameState?.tasks) {
      const ts = this.gameState.tasks.find((t) => t.id === task.id);
      if (ts?.blocked) {
        this.showFloatingText('Esta tarea está bloqueada por el lamebotas', 0xef4444);
        return;
      }
      if (ts?.completed) {
        this.showFloatingText('Esta tarea ya está completada', 0xfbbf24);
        return;
      }
    }

    if (this.activeTaskPanel) this.closeTaskPanel();

    const panelX = this.scale.width / 2;
    const panelY = this.scale.height / 2;

    const panel = createPanel(this, panelX, panelY, 350, 250, 0x16213e);
    const title = createText(this, panelX, panelY - 90, task.name, { fontSize: '20px', color: '#fbbf24', bold: true }).setOrigin(0.5);
    const desc = createText(this, panelX, panelY - 50, task.description, { fontSize: '14px', color: '#94a3b8' }).setOrigin(0.5, 0);

    let progressBar = null;
    let progressFill = null;
    let progress = 0;

    if (task.type === 'progress') {
      progressBar = this.add.rectangle(panelX, panelY, 300, 30, 0x334155);
      progressFill = this.add.rectangle(panelX - 150, panelY, 0, 30, 0x4ade80).setOrigin(0, 0.5);

      // Simular progresoAnimado
      this.time.addEvent({
        delay: 50,
        repeat: task.duration / 50,
        callback: () => {
          progress += 50 / task.duration;
          if (progressFill) progressFill.width = Math.min(300, 300 * progress);
          if (progress >= 1) {
            net.completeTask(task.id);
            this.closeTaskPanel();
          }
        }
      });
    } else if (task.type === 'click') {
      let clicks = 0;
      const clickText = createText(this, panelX, panelY, `Clicks: 0/10`, { fontSize: '16px', color: '#e0e0e0' }).setOrigin(0.5);
      const clickBtn = createButton(this, panelX, panelY + 60, 'CLICK', () => {
        clicks++;
        clickText.label.setText(`Clicks: ${clicks}/10`);
        if (clicks >= 10) {
          net.completeTask(task.id);
          this.closeTaskPanel();
        }
      }, { width: 150, height: 50, bgColor: 0x16a34a, fontSize: '16px' });

      this.activeTaskPanel = {
        taskId: task.id,
        elements: [panel, title, desc, clickText, clickBtn.bg, clickBtn.label]
      };
      this.activeTaskPanel.elements.forEach((el) => el.setScrollFactor?.(0));
      return;
    } else if (task.type === 'sequence') {
      let steps = 0;
      const totalSteps = task.steps || 5;
      const stepText = createText(this, panelX, panelY, `Paso: 0/${totalSteps}`, { fontSize: '16px', color: '#e0e0e0' }).setOrigin(0.5);
      const stepBtn = createButton(this, panelX, panelY + 60, 'SIGUIENTE', () => {
        steps++;
        stepText.label.setText(`Paso: ${steps}/${totalSteps}`);
        if (steps >= totalSteps) {
          net.completeTask(task.id);
          this.closeTaskPanel();
        }
      }, { width: 200, height: 50, bgColor: 0x6366f1, fontSize: '16px' });

      this.activeTaskPanel = {
        taskId: task.id,
        elements: [panel, title, desc, stepText, stepBtn.bg, stepBtn.label]
      };
      this.activeTaskPanel.elements.forEach((el) => el.setScrollFactor?.(0));
      return;
    }

    const closeBtn = createButton(this, panelX, panelY + 100, 'Cancelar', () => {
      this.closeTaskPanel();
    }, { width: 100, height: 30, bgColor: 0x7f1d1d, fontSize: '12px' });

    this.activeTaskPanel = {
      taskId: task.id,
      elements: [panel, title, desc, closeBtn.bg, closeBtn.label, progressBar, progressFill].filter(Boolean)
    };
    this.activeTaskPanel.elements.forEach((el) => el.setScrollFactor?.(0));
  }

  closeTaskPanel() {
    if (!this.activeTaskPanel) return;
    for (const el of this.activeTaskPanel.elements) {
      if (el && el.destroy) el.destroy();
    }
    this.activeTaskPanel = null;
  }

  startSabotageMenu() {
    const panelX = this.scale.width / 2;
    const panelY = this.scale.height / 2;
    const panel = createPanel(this, panelX, panelY, 410, this.myRole === 'lamebotas' ? 330 : 300, 0x7c2d12);
    const title = createText(this, panelX, panelY - 135, this.myRole === 'lamebotas' ? 'SABOTAJES LAMEBOTAS' : 'SABOTAJE', { fontSize: '20px', color: '#ef4444', bold: true }).setOrigin(0.5);

    const elements = [panel, title];
    const closeMenu = () => elements.forEach((el) => el?.destroy && el.destroy());

    if (this.myRole === 'lamebotas') {
      const actions = [
        ['Fingir tarea (+moral)', () => net.sabotageFakeTask()],
        ['Reporte falso (-moral global)', () => net.sabotageFalseReport()],
        ['Bloquear tarea aleatoria', () => {
          const task = (this.gameState?.tasks || []).find((t) => !t.completed && !t.blocked);
          if (task) net.sabotageBlockTask(task.id);
          else this.showFloatingText('No hay tareas bloqueables', 0xfbbf24);
        }]
      ];
      actions.forEach(([label, fn], idx) => {
        const btn = createButton(this, panelX, panelY - 80 + idx * 55, label, () => { fn(); closeMenu(); }, { width: 280, height: 38, bgColor: 0x991b1b, bgHover: 0xdc2626, fontSize: '13px' });
        elements.push(btn.bg, btn.label);
      });
    }

    const zones = ['recepcion', 'cubiculos', 'juntas', 'cocina', 'archivo', 'jefe_oficina', 'rh', 'servidor'];
    const startY = this.myRole === 'lamebotas' ? panelY + 90 : panelY - 70;
    zones.forEach((zid, i) => {
      const x = panelX + (i % 2 === 0 ? -100 : 100);
      const y = startY + Math.floor(i / 2) * 30;
      const btn = createButton(this, x, y, zid.toUpperCase(), () => { net.sabotageZone(zid); closeMenu(); }, { width: 180, height: 24, bgColor: 0x991b1b, bgHover: 0xdc2626, fontSize: '11px' });
      elements.push(btn.bg, btn.label);
    });
    elements.forEach((el) => el.setScrollFactor?.(0));
  }

  showFloatingText(text, color = 0xffffff) {
    const ft = this.add.text(this.scale.width / 2, 92, text, {
      fontSize: '16px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      backgroundColor: '#00000088',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(9999);
    this.tweens.add({
      targets: ft,
      y: 74,
      alpha: 0,
      duration: 2500,
      onComplete: () => ft.destroy()
    });
  }
}
