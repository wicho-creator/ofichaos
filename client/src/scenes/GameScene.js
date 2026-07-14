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

    // Sabotage warnings
    this.sabotageOverlay = null;
    this.sabotageBanner = null;
    this.sabotageTween = null;

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

    // Grupo de física estática para obstáculos de la oficina
    this.obstacles = this.physics.add.staticGroup();
    const obstacleData = [
      // Recepcion
      { name: 'Escritorio Recepcion', x: 150, y: 220, w: 150, h: 40, color: 0x3b82f6 },
      { name: 'Planta Recepcion', x: 120, y: 120, w: 30, h: 30, color: 0x3b82f6 },
      // Cubiculos
      { name: 'Cubículo 1', x: 480, y: 150, w: 100, h: 40, color: 0x10b981 },
      { name: 'Cubículo 2', x: 620, y: 150, w: 100, h: 40, color: 0x10b981 },
      { name: 'Divisor Cubículos', x: 595, y: 100, w: 10, h: 200, color: 0x10b981 },
      // Juntas
      { name: 'Mesa de Juntas', x: 900, y: 180, w: 150, h: 60, color: 0xf59e0b },
      { name: 'Planta Juntas', x: 1060, y: 120, w: 30, h: 30, color: 0xf59e0b },
      // Cocina
      { name: 'Barra Cocina', x: 100, y: 400, w: 120, h: 40, color: 0xef4444 },
      { name: 'Refrigerador', x: 260, y: 400, w: 40, h: 40, color: 0xef4444 },
      { name: 'Mesa Cocina', x: 170, y: 490, w: 60, h: 60, color: 0xef4444 },
      // Archivo
      { name: 'Archivero 1', x: 420, y: 420, w: 40, h: 120, color: 0x8b5cf6 },
      { name: 'Archivero 2', x: 520, y: 420, w: 40, h: 120, color: 0x8b5cf6 },
      // Jefe
      { name: 'Escritorio Jefe', x: 750, y: 460, w: 100, h: 50, color: 0xdc2626 },
      { name: 'Librero Jefe', x: 700, y: 410, w: 140, h: 20, color: 0xdc2626 },
      // RH
      { name: 'Escritorio RH 1', x: 120, y: 680, w: 80, h: 40, color: 0x06b6d4 },
      { name: 'Escritorio RH 2', x: 230, y: 680, w: 80, h: 40, color: 0x06b6d4 },
      // Servidor
      { name: 'Rack 1', x: 530, y: 670, w: 50, h: 120, color: 0x6366f1 },
      { name: 'Rack 2', x: 650, y: 670, w: 50, h: 120, color: 0x6366f1 }
    ];
    this.createMapTextures();
    for (const obs of obstacleData) {
      const cx = obs.x + obs.w / 2;
      const cy = obs.y + obs.h / 2;
      const rect = this.add.rectangle(cx, cy, obs.w, obs.h, 0x1f2937, 0.0);
      this.physics.add.existing(rect, true);
      this.obstacles.add(rect);
      this.drawObstacleDecoration(obs, cx, cy);
    }

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

    // Responsividad al redimensionar
    this.scale.on('resize', this.resize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.resize, this);
      if (this.sabotageTween) {
        this.sabotageTween.stop();
        this.sabotageTween = null;
      }
    });

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
    // 1. Draw tiled background carpet floor
    this.add.tileSprite(0, 0, 1200, 900, 'floor_carpet_general').setOrigin(0);

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

    const g = this.add.graphics();

    for (const z of zones) {
      // 2. Tile backgrounds or colored overlay for rooms
      if (z.id === 'cocina') {
        // Checkered tile floor
        this.add.tileSprite(z.x, z.y, z.w, z.h, 'floor_kitchen_tile').setOrigin(0);
        g.fillStyle(0xef4444, 0.06);
        g.fillRect(z.x, z.y, z.w, z.h);
      } else if (z.id === 'servidor') {
        // Tech metallic grid floor
        this.add.tileSprite(z.x, z.y, z.w, z.h, 'floor_server_grid').setOrigin(0);
        g.fillStyle(0x6366f1, 0.06);
        g.fillRect(z.x, z.y, z.w, z.h);
      } else {
        // Semi-transparent colored overlay to tint carpet
        const color = zoneColors[z.id] || 0x475569;
        g.fillStyle(color, 0.12);
        g.fillRect(z.x, z.y, z.w, z.h);
      }

      // 3. Double-outline walls with outer shadow and neon glow strip
      const color = zoneColors[z.id] || 0x475569;

      // Soft shadow border
      g.lineStyle(8, 0x000000, 0.35);
      g.strokeRect(z.x - 2, z.y - 2, z.w + 4, z.h + 4);

      // Main thick slate wall core
      g.lineStyle(6, 0x1e293b, 1.0);
      g.strokeRect(z.x, z.y, z.w, z.h);

      // Glowing inner divider strip
      g.lineStyle(2, color, 0.85);
      g.strokeRect(z.x, z.y, z.w, z.h);

      // Inner border offset for double line style
      g.lineStyle(1, 0x0f172a, 0.5);
      g.strokeRect(z.x + 3, z.y + 3, z.w - 6, z.h - 6);

      // Room Title
      this.add.text(z.x + z.w / 2, z.y + 16, z.name, {
        fontSize: '13px',
        color: '#f8fafc',
        fontStyle: 'bold',
        shadow: { fill: true, blur: 4, color: '#000000', y: 1 }
      }).setOrigin(0.5);

      // Task in Zone text
      const taskInZone = CLIENT_TASKS.find((t) => t.zone === z.id);
      if (taskInZone) {
        this.add.text(z.x + z.w / 2, z.y + z.h - 16, `📋 ${taskInZone.name}`, {
          fontSize: '11px',
          color: '#fbbf24',
          fontStyle: 'bold',
          shadow: { fill: true, blur: 2, color: '#000000', y: 1 }
        }).setOrigin(0.5);
      }
    }

    // Nice visual pathways between offices
    g.lineStyle(4, 0x334155, 0.45);
    g.lineBetween(350, 200, 450, 200); // recepción -> cubículos
    g.lineBetween(750, 200, 850, 200); // cubículos -> juntas
    g.lineBetween(225, 300, 225, 400); // recepción -> cocina
    g.lineBetween(500, 300, 500, 400); // cubículos -> archivo
    g.lineBetween(800, 300, 800, 400); // juntas -> jefe
  }

  createHUD() {
    this.hud = this.hud || {};

    // Sabotage warning overlay
    this.sabotageOverlay = this.add.graphics();
    this.sabotageOverlay.fillStyle(0xef4444, 1);
    this.sabotageOverlay.fillRect(0, 0, this.scale.width, this.scale.height);
    this.sabotageOverlay.setScrollFactor(0);
    this.sabotageOverlay.setDepth(50);
    this.sabotageOverlay.setAlpha(0);
    this.sabotageOverlay.setVisible(false);

    // Sabotage warning banner
    this.sabotageBanner = this.add.text(0, 0, '', {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#ef4444',
      padding: { x: 12, y: 6 },
      shadow: { fill: true, blur: 2, color: '#000000', y: 1 }
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101).setVisible(false);

    // 1. Header Panel y Textos
    this.hud.headerPanel = createPanel(this, 0, 0, 100, 100, 0x0b1220, { strokeColor: 0xfbbf24, strokeAlpha: 0.28, radius: 18 });
    this.hud.timerText = this.add.text(0, 0, '⏱ 8:00', { fontStyle: 'bold', color: '#fbbf24' }).setOrigin(0.5, 0.5);
    this.hud.taskPercentText = this.add.text(0, 0, '📋 Tareas 0%', { fontStyle: 'bold', color: '#4ade80' }).setOrigin(0.5, 0.5);
    this.hud.helpText = this.add.text(0, 0, 'WASD/Flechas · E o botón azul para trabajar', { fontSize: '10px', color: '#94a3b8' }).setOrigin(0.5);

    this.timerText = this.hud.timerText;
    this.taskPercentText = this.hud.taskPercentText;

    // 2. Role Panel
    const roleColors = { jefe: '#ef4444', lamebotas: '#facc15', empleado: '#4ade80' };
    const roleName = { jefe: 'JEFE', lamebotas: 'LAMEBOTAS', empleado: 'EMPLEADO' };
    this.hud.rolePanel = createPanel(this, 0, 0, 100, 100, 0x111827, { strokeColor: 0x38bdf8, strokeAlpha: 0.24, radius: 20 });
    this.hud.roleDisplay = this.add.text(0, 0, `ROL: ${roleName[this.myRole] || '?'}`, {
      color: roleColors[this.myRole] || '#94a3b8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.hud.roleObjectiveLabel = this.add.text(0, 0, 'Objetivo secundario', { fontSize: '10px', color: '#94a3b8' }).setOrigin(0.5);
    this.hud.roleDescription = this.add.text(0, 0, this.roleText || 'Sobrevive al caos de la oficina', {
      color: '#f8fafc', align: 'center'
    }).setOrigin(0.5);

    this.roleDisplay = this.hud.roleDisplay;

    // 3. Status/Moral Panel
    this.hud.statusPanel = createPanel(this, 0, 0, 100, 100, 0x111827, { strokeColor: 0x22c55e, strokeAlpha: 0.22, radius: 20 });
    this.hud.moraleLabel = this.add.text(0, 0, '😊 Moral del equipo', { color: '#cbd5e1', fontStyle: 'bold' });
    this.hud.moraleBar = this.add.rectangle(0, 0, 100, 14, 0x334155).setOrigin(0.5);
    this.hud.moraleFill = this.add.rectangle(0, 0, 100, 14, 0x4ade80).setOrigin(0, 0.5);
    this.hud.tasksLabel = this.add.text(0, 0, 'Tareas activas', { color: '#94a3b8', fontStyle: 'bold' });
    this.hud.tasksList = this.add.text(0, 0, '', { color: '#e2e8f0', lineSpacing: 2 }).setOrigin(0, 0);

    this.moraleBar = this.hud.moraleBar;
    this.moraleFill = this.hud.moraleFill;
    this.tasksList = this.hud.tasksList;

    // 4. Action Panel & Buttons
    this.hud.actionPanel = createPanel(this, 0, 0, 100, 100, 0x0b1220, { strokeColor: 0x64748b, strokeAlpha: 0.25, radius: 18 });
    this.hud.btnMeeting = createButton(this, 0, 0, '📋', () => net.callMeeting());
    this.hud.btnInteract = createButton(this, 0, 0, '🛠', () => this.tryOpenNearbyTask());

    if (this.myRole === 'empleado') {
      this.hud.btnSabotageOrReport = createButton(this, 0, 0, '🚨', () => net.reportSabotage());
    } else if (this.myRole === 'jefe' || this.myRole === 'lamebotas') {
      this.hud.btnSabotageOrReport = createButton(this, 0, 0, '💀', () => this.startSabotageMenu());
    }
    this.hud.cooldownText = this.add.text(0, 0, '', { fontSize: '10px', color: '#bbf7d0', align: 'center' }).setOrigin(0.5, 0.5);

    this.cooldownText = this.hud.cooldownText;
    this.hud.mobileControls = [];

    // Asegurar ScrollFactor 0 para evitar que el HUD se desplace con el mapa
    Object.values(this.hud).forEach((el) => {
      if (!el) return;
      if (el.setScrollFactor) {
        el.setScrollFactor(0);
        el.setDepth(100);
      } else if (el.bg) {
        el.bg.setScrollFactor(0);
        el.label.setScrollFactor(0);
        el.hit.setScrollFactor(0);
        el.shadow.setScrollFactor(0);

        el.bg.setDepth(100);
        el.label.setDepth(100);
        el.hit.setDepth(100);
        el.shadow.setDepth(100);
      }
    });

    // Posicionar todo dinámicamente según tamaño actual
    this.repositionHUD(this.scale.width, this.scale.height);
  }

  loadDemoState(gs) {
    this.gameState = gs;
    this.syncPlayers(gs);
    this.updateHUD(gs);
    this.showFloatingText('🧪 Sala demo cargada: probá tareas, sabotajes y cámara', 0xfbbf24);
  }

  resize(gameSize) {
    const w = gameSize.width;
    const h = gameSize.height;

    // Ajustar zoom de cámara principal según altura
    this.cameras.main.setZoom(h < 700 ? 0.9 : 1.15);

    // Reposicionar HUD principal
    if (this.hud && this.hud.headerPanel) {
      this.repositionHUD(w, h);
    }

    // Redimensionar overlay de sabotaje
    if (this.sabotageOverlay) {
      this.sabotageOverlay.clear();
      this.sabotageOverlay.fillStyle(0xef4444, 1);
      this.sabotageOverlay.fillRect(0, 0, w, h);
    }

    // Reposicionar paneles abiertos
    this.repositionActivePanels(w, h);
  }

  repositionHUD(w, h) {
    const compact = h < 700;
    const narrow = w < 600;

    // 1. Header Panel
    const headerW = narrow ? w - 20 : Math.min(690, w - 120);
    const headerH = compact ? 56 : 68;
    const headerX = w / 2;
    const headerY = compact ? 38 : 46;

    this.hud.headerPanel.drawPanel(headerX, headerY, headerW, headerH);
    this.hud.timerText.setPosition(headerX - (narrow ? 64 : 128), headerY - (compact ? 7 : 6));
    this.hud.timerText.setFontSize(compact ? '18px' : '22px');
    this.hud.taskPercentText.setPosition(headerX + (narrow ? 64 : 84), headerY - (compact ? 7 : 6));
    this.hud.taskPercentText.setFontSize(compact ? '14px' : '17px');

    this.hud.helpText.setPosition(headerX, headerY + (compact ? 12 : 16));
    this.hud.helpText.setVisible(!narrow);

    // 2. Role Panel
    let roleX, roleY, roleW, roleH;
    if (narrow) {
      roleW = 145;
      roleH = 68;
      roleX = 10 + roleW / 2;
      roleY = headerY + headerH / 2 + 10 + roleH / 2;
    } else {
      roleW = compact ? 270 : 320;
      roleH = compact ? 88 : 104;
      roleX = compact ? 205 : 210;
      roleY = compact ? h - 126 : h - 154;
    }

    this.hud.rolePanel.drawPanel(roleX, roleY, roleW, roleH);
    this.hud.roleDisplay.setPosition(roleX, roleY - (narrow ? 16 : compact ? 22 : 28));
    this.hud.roleDisplay.setFontSize(narrow ? '12px' : compact ? '15px' : '17px');
    this.hud.roleObjectiveLabel.setPosition(roleX, roleY + (narrow ? 2 : compact ? -1 : -3));
    this.hud.roleObjectiveLabel.setVisible(!narrow);
    this.hud.roleDescription.setPosition(roleX, roleY + (narrow ? 10 : compact ? 18 : 21));
    this.hud.roleDescription.setFontSize(narrow ? '9px' : compact ? '10px' : '11px');
    this.hud.roleDescription.setStyle({ wordWrap: { width: roleW - (narrow ? 16 : compact ? 56 : 60) } });

    // 3. Status/Moral Panel
    let statusX, statusY, statusW, statusH;
    if (narrow) {
      statusW = w - roleW - 30;
      statusH = 76;
      statusX = w - 10 - statusW / 2;
      statusY = headerY + headerH / 2 + 10 + statusH / 2;
    } else {
      statusW = compact ? 294 : 342;
      statusH = compact ? 108 : 130;
      statusX = compact ? w - 205 : w - 215;
      statusY = compact ? h - 130 : h - 160;
    }

    this.hud.statusPanel.drawPanel(statusX, statusY, statusW, statusH);

    const moraleLabelX = statusX - statusW / 2 + 16;
    const moraleLabelY = statusY - statusH / 2 + 12;
    this.hud.moraleLabel.setPosition(moraleLabelX, moraleLabelY);
    this.hud.moraleLabel.setFontSize(narrow ? '10px' : compact ? '12px' : '13px');

    const moraleBarW = narrow ? statusW - 120 : compact ? 146 : 168;
    const moraleBarX = statusX + statusW / 2 - moraleBarW / 2 - 16;
    const moraleBarY = moraleLabelY + (narrow ? 6 : 4);
    this.hud.moraleBar.setPosition(moraleBarX, moraleBarY);
    this.hud.moraleBar.setSize(moraleBarW, 14);
    this.hud.moraleFill.setPosition(moraleBarX - moraleBarW / 2, moraleBarY);
    this.hud.moraleFill.height = 14;

    const tasksLabelX = moraleLabelX;
    const tasksLabelY = moraleLabelY + (narrow ? 18 : compact ? 27 : 30);
    this.hud.tasksLabel.setPosition(tasksLabelX, tasksLabelY);
    this.hud.tasksLabel.setFontSize(narrow ? '9px' : '11px');
    this.hud.tasksLabel.setVisible(!narrow);

    const tasksListX = moraleLabelX;
    const tasksListY = narrow ? tasksLabelY : tasksLabelY + 18;
    this.hud.tasksList.setPosition(tasksListX, tasksListY);
    this.hud.tasksList.setFontSize(narrow ? '9px' : compact ? '10px' : '11px');
    this.hud.tasksList.setStyle({ wordWrap: { width: statusW - 32 } });

    // 4. Action Panel & Buttons
    let actionX, actionY, actionW, actionH, btnY;
    if (narrow) {
      actionW = 120;
      actionH = 120;
      actionX = w - 10 - actionW / 2;
      actionY = h - 10 - actionH / 2;

      this.hud.actionPanel.drawPanel(actionX, actionY, actionW, actionH);
      this.hud.actionPanel.setVisible(false);

      const mainBtnX = w - 50;
      const mainBtnY = h - 50;
      this.hud.btnInteract.setPositionAndSize(mainBtnX, mainBtnY, 56, 56);
      this.hud.btnInteract.label.setFontSize('22px');

      this.hud.btnMeeting.setPositionAndSize(mainBtnX - 58, mainBtnY, 40, 40);
      this.hud.btnMeeting.label.setFontSize('16px');

      if (this.hud.btnSabotageOrReport) {
        this.hud.btnSabotageOrReport.setPositionAndSize(mainBtnX, mainBtnY - 58, 40, 40);
        this.hud.btnSabotageOrReport.label.setFontSize('16px');
      }

      this.hud.cooldownText.setPosition(mainBtnX - 60, mainBtnY - 60);
      this.hud.cooldownText.setFontSize('9px');
    } else {
      actionW = compact ? 228 : 280;
      actionH = compact ? 72 : 94;
      actionX = w / 2;
      actionY = compact ? h - 76 : h - 82;
      btnY = compact ? actionY - 7 : actionY - 8;

      this.hud.actionPanel.drawPanel(actionX, actionY, actionW, actionH);
      this.hud.actionPanel.setVisible(true);

      this.hud.btnMeeting.setPositionAndSize(actionX - 58, btnY, compact ? 44 : 50, compact ? 42 : 48);
      this.hud.btnMeeting.label.setFontSize('18px');

      this.hud.btnInteract.setPositionAndSize(actionX, btnY, compact ? 44 : 50, compact ? 42 : 48);
      this.hud.btnInteract.label.setFontSize('18px');

      if (this.hud.btnSabotageOrReport) {
        this.hud.btnSabotageOrReport.setPositionAndSize(actionX + 58, btnY, compact ? 44 : 50, compact ? 42 : 48);
        this.hud.btnSabotageOrReport.label.setFontSize('18px');
      }

      this.hud.cooldownText.setPosition(actionX, actionY + (compact ? 14 : 22));
      this.hud.cooldownText.setFontSize('10px');
    }

    if (this.sabotageBanner) {
      this.sabotageBanner.setPosition(w / 2, headerY + headerH / 2 + 18);
    }

    // 5. Mobile Pad Controls (D-pad)
    this.hud.mobileControls.forEach((btn) => btn.bg?.destroy?.());
    this.hud.mobileControls = [];

    if (w <= 900) {
      const baseX = 70;
      const baseY = h - 70;

      const makePad = (px, py, label, key) => {
        const btn = createButton(this, px, py, label, () => {}, {
          width: 34, height: 34, bgColor: 0x334155, bgHover: 0x475569, fontSize: '12px', radius: 10
        });
        btn.hit.on('pointerdown', () => { this.mobileInput[key] = true; });
        btn.hit.on('pointerup', () => { this.mobileInput[key] = false; });
        btn.hit.on('pointerout', () => { this.mobileInput[key] = false; });

        btn.bg.setScrollFactor(0);
        btn.label.setScrollFactor(0);
        btn.hit.setScrollFactor(0);
        btn.shadow.setScrollFactor(0);

        this.hud.mobileControls.push(btn);
      };

      makePad(baseX, baseY - 32, '↑', 'up');
      makePad(baseX, baseY + 32, '↓', 'down');
      makePad(baseX - 34, baseY, '←', 'left');
      makePad(baseX + 34, baseY, '→', 'right');
    }

    this.updateHUD(this.gameState);
  }

  repositionActivePanels(w, h) {
    // Redimensionar Sabotaje si está abierto
    if (this.activeSabotageMenu) {
      this.closeSabotageMenu();
      this.startSabotageMenu();
    }

    // Redimensionar Tarea activa si está abierta
    if (this.activeTaskPanel) {
      const panelX = w / 2;
      const panelY = h / 2;
      const task = this.activeTaskPanel.task;

      const panel = this.activeTaskPanel.elements[0];
      const title = this.activeTaskPanel.elements[1];
      const desc = this.activeTaskPanel.elements[2];

      const panelW = w < 400 ? w - 30 : 350;
      if (panel && panel.drawPanel) panel.drawPanel(panelX, panelY, panelW, 250);
      if (title) title.setPosition(panelX, panelY - 90);
      if (desc) {
        desc.setPosition(panelX, panelY - 50);
        desc.setStyle({ wordWrap: { width: panelW - 40 } });
      }

      if (task.type === 'progress') {
        const progressBar = this.activeTaskPanel.progressBar;
        const progressFill = this.activeTaskPanel.progressFill;
        const closeBtn = this.activeTaskPanel.closeBtn;

        const barW = panelW - 50;
        if (progressBar) {
          progressBar.setPosition(panelX, panelY);
          progressBar.setSize(barW, 30);
        }
        if (progressFill) {
          progressFill.setPosition(panelX - barW / 2, panelY);
          // El progreso actual se ajustará en el siguiente loop/animación
        }
        if (closeBtn && closeBtn.setPositionAndSize) {
          closeBtn.setPositionAndSize(panelX, panelY + 100, 100, 30);
        }
      } else if (task.type === 'click') {
        const clickText = this.activeTaskPanel.clickText;
        const clickBtn = this.activeTaskPanel.clickBtn;

        if (clickText) clickText.setPosition(panelX, panelY);
        if (clickBtn && clickBtn.setPositionAndSize) {
          clickBtn.setPositionAndSize(panelX, panelY + 60, 150, 50);
        }
      } else if (task.type === 'sequence') {
        const stepText = this.activeTaskPanel.stepText;
        const stepBtn = this.activeTaskPanel.stepBtn;

        if (stepText) stepText.setPosition(panelX, panelY);
        if (stepBtn && stepBtn.setPositionAndSize) {
          stepBtn.setPositionAndSize(panelX, panelY + 60, 200, 50);
        }
      }
    }
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
            const serverP = data.players[pid];
            if (pid === this.myId) {
              const localSprite = this.sprites[pid];
              if (localSprite) {
                const dist = Phaser.Math.Distance.Between(localSprite.container.x, localSprite.container.y, serverP.x, serverP.y);
                if (dist > 30) {
                  localSprite.container.setPosition(serverP.x, serverP.y);
                  if (localSprite.container.body) {
                    localSprite.container.body.reset(serverP.x, serverP.y);
                  }
                  this.players[pid].x = serverP.x;
                  this.players[pid].y = serverP.y;
                }
              }
            } else {
              Object.assign(this.players[pid], serverP);
            }
          }
        }
      }
      this.updateHUD(this.gameState);
    });

    net.socket.on('player:moved', ({ playerId, x, y }) => {
      if (this.players[playerId]) {
        if (playerId === this.myId) {
          const localSprite = this.sprites[playerId];
          if (localSprite) {
            const dist = Phaser.Math.Distance.Between(localSprite.container.x, localSprite.container.y, x, y);
            if (dist > 30) {
              localSprite.container.setPosition(x, y);
              if (localSprite.container.body) {
                localSprite.container.body.reset(x, y);
              }
              this.players[playerId].x = x;
              this.players[playerId].y = y;
            }
          }
        } else {
          this.players[playerId].x = x;
          this.players[playerId].y = y;
        }
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
          // Habilitar colisiones del contenedor de jugador con obstáculos
          this.physics.add.collider(this.sprites[p.id].container, this.obstacles);
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
      const barWidth = this.moraleBar.width;
      this.moraleFill.width = Math.max(0, barWidth * (moralePct / 100));
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

    // Actualizar advertencias de sabotaje activo
    const hasActiveSabotages = gs.activeSabotages && gs.activeSabotages.length > 0;
    if (hasActiveSabotages) {
      if (!this.sabotageTween) {
        this.sabotageOverlay.setVisible(true);
        this.sabotageOverlay.setAlpha(0);
        this.sabotageTween = this.tweens.add({
          targets: this.sabotageOverlay,
          alpha: 0.28,
          duration: 900,
          yoyo: true,
          repeat: -1
        });
      }

      const descriptions = gs.activeSabotages.map((s) => {
        if (s.type === 'zone') return `Zona: ${s.zoneId.toUpperCase()}`;
        if (s.type === 'close_door') return `Puerta Cerrada: ${s.zoneId.toUpperCase()}`;
        if (s.type === 'block_task') return `Tarea Bloqueada: ${s.taskId.toUpperCase()}`;
        if (s.type === 'false_report') return `Alarma Falsa / Pánico`;
        return s.type.toUpperCase();
      }).join(' | ');

      this.sabotageBanner.setText(`⚠ OFICINA SABOTEADA: ${descriptions} ⚠`);
      this.sabotageBanner.setVisible(true);
    } else {
      if (this.sabotageTween) {
        this.sabotageTween.stop();
        this.sabotageTween = null;
      }
      if (this.sabotageOverlay) {
        this.sabotageOverlay.setVisible(false);
        this.sabotageOverlay.setAlpha(0);
      }
      if (this.sabotageBanner) {
        this.sabotageBanner.setVisible(false);
      }
    }
  }

  update(time, delta) {
    // Movimiento del jugador local
    const me = this.players[this.myId];
    if (!me) return;

    // No mover si está en burnout (el servidor lo maneja, pero reducimos visualmente)
    let speed = 250;
    if (me.burnout) speed = 125;

    const localSprite = this.sprites[this.myId];
    if (localSprite && localSprite.container.body) {
      let vx = 0, vy = 0;
      if (this.cursors.left.isDown || this.wasd.A.isDown || this.mobileInput.left) vx = -speed;
      if (this.cursors.right.isDown || this.wasd.D.isDown || this.mobileInput.right) vx = speed;
      if (this.cursors.up.isDown || this.wasd.W.isDown || this.mobileInput.up) vy = -speed;
      if (this.cursors.down.isDown || this.wasd.S.isDown || this.mobileInput.down) vy = speed;

      if (vx !== 0 && vy !== 0) {
        vx *= Math.SQRT1_2;
        vy *= Math.SQRT1_2;
      }

      localSprite.container.body.setVelocity(vx, vy);

      me.x = localSprite.container.x;
      me.y = localSprite.container.y;

      if (vx !== 0 || vy !== 0) {
        if (time - this.lastMoveTime > this.moveThrottle) {
          net.sendMove(me.x, me.y);
          this.lastMoveTime = time;
        }
      }
    }

    // Actualizar sprites
    for (const pid of Object.keys(this.players)) {
      if (this.sprites[pid]) {
        updatePlayerSprite(this.sprites[pid], this.players[pid], pid === this.myId);
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
    const panelW = this.scale.width < 400 ? this.scale.width - 30 : 350;

    const panel = createPanel(this, panelX, panelY, panelW, 250, 0x16213e);
    const title = createText(this, panelX, panelY - 90, task.name, { fontSize: '20px', color: '#fbbf24', bold: true }).setOrigin(0.5);
    const desc = createText(this, panelX, panelY - 50, task.description, { fontSize: '14px', color: '#94a3b8', wrap: panelW - 40 }).setOrigin(0.5, 0);

    let progressBar = null;
    let progressFill = null;
    let closeBtn = null;
    let clickText = null;
    let clickBtn = null;
    let stepText = null;
    let stepBtn = null;
    let progress = 0;

    // Custom Mini-game elements list
    const customElements = [];
    let cleanupFn = null;

    if (task.id === 'cafe') {
      // Reaction Test Mini-game: moving slider back and forth on a horizontal bar.
      const barBg = this.add.rectangle(panelX, panelY, 240, 20, 0x334155);
      const successZone = this.add.rectangle(panelX, panelY, 40, 20, 0x22c55e);
      const slider = this.add.rectangle(panelX - 120, panelY, 8, 28, 0xffffff);
      
      customElements.push(barBg, successZone, slider);

      const sliderTween = this.tweens.add({
        targets: slider,
        x: panelX + 120,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Linear'
      });

      clickBtn = createButton(this, panelX, panelY + 50, '¡DETENER!', () => {
        const halfSuccess = 20; // 40px width success zone, so +/-20px from center
        if (Math.abs(slider.x - panelX) <= halfSuccess) {
          sliderTween.stop();
          net.completeTask(task.id);
          this.closeTaskPanel();
        } else {
          this.showFloatingText('¡Fallaste! Intenta de nuevo', 0xef4444);
          this.tweens.add({
            targets: slider,
            alpha: 0.2,
            duration: 80,
            yoyo: true,
            repeat: 2
          });
        }
      }, { width: 140, height: 40, bgColor: 0x16a34a, fontSize: '15px' });

      closeBtn = createButton(this, panelX, panelY + 100, 'Cancelar', () => {
        sliderTween.stop();
        this.closeTaskPanel();
      }, { width: 100, height: 30, bgColor: 0x7f1d1d, fontSize: '12px' });

    } else if (task.id === 'archivos') {
      // Ordenar Archivos Mini-game: 4 buttons in a randomized layout to click in ascending order (1->2->3->4).
      let expected = 1;
      const numButtons = [];
      const positions = [
        { x: panelX - 60, y: panelY - 15 },
        { x: panelX + 60, y: panelY - 15 },
        { x: panelX - 60, y: panelY + 45 },
        { x: panelX + 60, y: panelY + 45 }
      ];
      const shuffledPositions = [...positions].sort(() => Math.random() - 0.5);

      const numValues = [1, 2, 3, 4];
      numValues.forEach((num, idx) => {
        const pos = shuffledPositions[idx];
        const bg = this.add.rectangle(pos.x, pos.y, 50, 50, 0x334155).setInteractive({ useHandCursor: true });
        bg.setStrokeStyle(2, 0xffffff, 0.5);
        const label = this.add.text(pos.x, pos.y, num.toString(), { fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
        
        bg.on('pointerover', () => { if (expected <= num) bg.setFillStyle(0x475569); });
        bg.on('pointerout', () => { if (expected <= num) bg.setFillStyle(0x334155); });
        
        bg.on('pointerdown', () => {
          if (num === expected) {
            bg.setFillStyle(0x16a34a);
            bg.disableInteractive();
            expected++;
            if (expected > 4) {
              net.completeTask(task.id);
              this.closeTaskPanel();
            }
          } else {
            this.showFloatingText('¡Orden incorrecto! Empezando de nuevo', 0xef4444);
            expected = 1;
            numButtons.forEach((b) => {
              b.bg.setFillStyle(0x334155);
              b.bg.setInteractive({ useHandCursor: true });
            });
          }
        });
        
        numButtons.push({ bg, label });
        customElements.push(bg, label);
      });

      closeBtn = createButton(this, panelX, panelY + 100, 'Cancelar', () => {
        this.closeTaskPanel();
      }, { width: 100, height: 30, bgColor: 0x7f1d1d, fontSize: '12px' });

    } else if (task.id === 'wifi' || task.id === 'correos') {
      // Arreglar WiFi / Cables Mini-game: 4 colored nodes left to drag/connect to right matched colored nodes.
      const colors = [
        { name: 'red', val: 0xef4444 },
        { name: 'yellow', val: 0xf59e0b },
        { name: 'green', val: 0x10b981 },
        { name: 'blue', val: 0x3b82f6 }
      ];
      const rightColors = [...colors].sort(() => Math.random() - 0.5);
      
      const linesGraphics = this.add.graphics();
      customElements.push(linesGraphics);

      const leftCircles = [];
      const rightCircles = [];
      const connections = [];
      let activeStartNode = null;

      colors.forEach((color, idx) => {
        const y = panelY - 60 + idx * 40;
        const x = panelX - 110;
        const circle = this.add.circle(x, y, 10, color.val).setInteractive({ useHandCursor: true });
        circle.setStrokeStyle(2, 0xffffff);
        circle.colorData = color;
        
        circle.on('pointerdown', () => {
          if (connections.some(c => c.colorName === color.name)) return;
          activeStartNode = circle;
        });
        leftCircles.push(circle);
        customElements.push(circle);
      });

      rightColors.forEach((color, idx) => {
        const y = panelY - 60 + idx * 40;
        const x = panelX + 110;
        const circle = this.add.circle(x, y, 10, color.val).setInteractive({ useHandCursor: true });
        circle.setStrokeStyle(2, 0xffffff);
        circle.colorData = color;
        rightCircles.push(circle);
        customElements.push(circle);
      });

      const drawAllLines = (pointer) => {
        linesGraphics.clear();
        connections.forEach(c => {
          linesGraphics.lineStyle(4, c.colorVal, 1);
          linesGraphics.lineBetween(c.startX, c.startY, c.endX, c.endY);
        });
        if (activeStartNode && pointer) {
          linesGraphics.lineStyle(4, activeStartNode.colorData.val, 0.7);
          linesGraphics.lineBetween(activeStartNode.x, activeStartNode.y, pointer.x, pointer.y);
        }
      };

      const onPointerMove = (pointer) => {
        if (!activeStartNode) return;
        drawAllLines(pointer);
      };

      const onPointerUp = (pointer) => {
        if (!activeStartNode) return;
        
        let matched = false;
        for (const rc of rightCircles) {
          const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, rc.x, rc.y);
          if (dist < 25) {
            if (rc.colorData.name === activeStartNode.colorData.name) {
              connections.push({
                colorName: activeStartNode.colorData.name,
                colorVal: activeStartNode.colorData.val,
                startX: activeStartNode.x,
                startY: activeStartNode.y,
                endX: rc.x,
                endY: rc.y
              });
              matched = true;
              activeStartNode.disableInteractive();
              rc.disableInteractive();
              
              if (connections.length === 4) {
                net.completeTask(task.id);
                this.closeTaskPanel();
              }
            }
            break;
          }
        }
        
        activeStartNode = null;
        drawAllLines(null);
      };

      this.input.on('pointermove', onPointerMove);
      this.input.on('pointerup', onPointerUp);

      cleanupFn = () => {
        this.input.off('pointermove', onPointerMove);
        this.input.off('pointerup', onPointerUp);
      };

      closeBtn = createButton(this, panelX, panelY + 100, 'Cancelar', () => {
        this.closeTaskPanel();
      }, { width: 100, height: 30, bgColor: 0x7f1d1d, fontSize: '12px' });

    } else if (task.type === 'progress') {
      const barW = panelW - 50;
      progressBar = this.add.rectangle(panelX, panelY, barW, 30, 0x334155);
      progressFill = this.add.rectangle(panelX - barW / 2, panelY, 0, 30, 0x4ade80).setOrigin(0, 0.5);

      // Simular progresoAnimado
      this.time.addEvent({
        delay: 50,
        repeat: task.duration / 50,
        callback: () => {
          progress += 50 / task.duration;
          if (progressFill) progressFill.width = Math.min(barW, barW * progress);
          if (progress >= 1) {
            net.completeTask(task.id);
            this.closeTaskPanel();
          }
        }
      });

      closeBtn = createButton(this, panelX, panelY + 100, 'Cancelar', () => {
        this.closeTaskPanel();
      }, { width: 100, height: 30, bgColor: 0x7f1d1d, fontSize: '12px' });
    } else if (task.type === 'click') {
      let clicks = 0;
      clickText = createText(this, panelX, panelY, `Clicks: 0/10`, { fontSize: '16px', color: '#e0e0e0' }).setOrigin(0.5);
      clickBtn = createButton(this, panelX, panelY + 60, 'CLICK', () => {
        clicks++;
        clickText.label.setText(`Clicks: ${clicks}/10`);
        if (clicks >= 10) {
          net.completeTask(task.id);
          this.closeTaskPanel();
        }
      }, { width: 150, height: 50, bgColor: 0x16a34a, fontSize: '16px' });
    } else if (task.type === 'sequence') {
      let steps = 0;
      const totalSteps = task.steps || 5;
      stepText = createText(this, panelX, panelY, `Paso: 0/${totalSteps}`, { fontSize: '16px', color: '#e0e0e0' }).setOrigin(0.5);
      stepBtn = createButton(this, panelX, panelY + 60, 'SIGUIENTE', () => {
        steps++;
        stepText.label.setText(`Paso: ${steps}/${totalSteps}`);
        if (steps >= totalSteps) {
          net.completeTask(task.id);
          this.closeTaskPanel();
        }
      }, { width: 200, height: 50, bgColor: 0x6366f1, fontSize: '16px' });
    }

    this.activeTaskPanel = {
      taskId: task.id,
      task: task,
      elements: [
        panel, title, desc, 
        closeBtn?.bg, closeBtn?.label, 
        progressBar, progressFill,
        clickText, clickBtn?.bg, clickBtn?.label,
        stepText, stepBtn?.bg, stepBtn?.label,
        ...customElements
      ].filter(Boolean),
      progressBar,
      progressFill,
      closeBtn,
      clickText,
      clickBtn,
      stepText,
      stepBtn,
      cleanup: cleanupFn
    };

    this.activeTaskPanel.elements.forEach((el) => el.setScrollFactor?.(0));
  }

  closeTaskPanel() {
    if (!this.activeTaskPanel) return;
    if (this.activeTaskPanel.cleanup) {
      this.activeTaskPanel.cleanup();
    }
    for (const el of this.activeTaskPanel.elements) {
      if (el && el.destroy) el.destroy();
    }
    this.activeTaskPanel = null;
  }

  startSabotageMenu() {
    if (this.activeSabotageMenu) this.closeSabotageMenu();

    const panelX = this.scale.width / 2;
    const panelY = this.scale.height / 2;
    const narrow = this.scale.width < 450;
    const panelW = narrow ? this.scale.width - 30 : 410;
    const panel = createPanel(this, panelX, panelY, panelW, this.myRole === 'lamebotas' ? 330 : 300, 0x7c2d12);
    const title = createText(this, panelX, panelY - 135, this.myRole === 'lamebotas' ? 'SABOTAJES LAMEBOTAS' : 'SABOTAJE', { fontSize: narrow ? '16px' : '20px', color: '#ef4444', bold: true }).setOrigin(0.5);

    const elements = [panel, title];
    this.activeSabotageMenu = { elements };
    const closeMenu = () => this.closeSabotageMenu();

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
        const btn = createButton(this, panelX, panelY - 80 + idx * 55, label, () => { fn(); closeMenu(); }, { width: narrow ? panelW - 40 : 280, height: 38, bgColor: 0x991b1b, bgHover: 0xdc2626, fontSize: '13px' });
        elements.push(btn.bg, btn.label);
      });
    }

    const zones = ['recepcion', 'cubiculos', 'juntas', 'cocina', 'archivo', 'jefe_oficina', 'rh', 'servidor'];
    const startY = this.myRole === 'lamebotas' ? panelY + 90 : panelY - 70;
    zones.forEach((zid, i) => {
      let x, y, btnW;
      if (narrow) {
        x = panelX + (i % 2 === 0 ? - (panelW - 40) / 4 : (panelW - 40) / 4);
        y = startY + Math.floor(i / 2) * 30;
        btnW = (panelW - 60) / 2;
      } else {
        x = panelX + (i % 2 === 0 ? -100 : 100);
        y = startY + Math.floor(i / 2) * 30;
        btnW = 180;
      }
      const btn = createButton(this, x, y, zid.toUpperCase(), () => { net.sabotageZone(zid); closeMenu(); }, { width: btnW, height: 24, bgColor: 0x991b1b, bgHover: 0xdc2626, fontSize: '11px' });
      elements.push(btn.bg, btn.label);
    });
    elements.forEach((el) => el.setScrollFactor?.(0));
  }

  closeSabotageMenu() {
    if (this.activeSabotageMenu) {
      this.activeSabotageMenu.elements.forEach((el) => el?.destroy && el.destroy());
      this.activeSabotageMenu = null;
    }
  }

  showFloatingText(text, color = 0xffffff) {
    const ft = this.add.text(this.scale.width / 2, 92, text, {
      fontSize: '16px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      backgroundColor: '#00000088',
      padding: { x: 10, y: 5 },
      align: 'center',
      wordWrap: { width: this.scale.width - 40 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(9999);
    this.tweens.add({
      targets: ft,
      y: 74,
      alpha: 0,
      duration: 2500,
      onComplete: () => ft.destroy()
    });
  }

  /**
   * Generates custom tilesets programmatically using HTML5 Canvas contexts.
   */
  createMapTextures() {
    // 1. General carpet texture
    if (!this.textures.exists('floor_carpet_general')) {
      const tex = this.textures.createCanvas('floor_carpet_general', 60, 60);
      const ctx = tex.context;
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.fillRect(0, 0, 60, 60);

      // Carpet grain effect
      ctx.fillStyle = '#0f172a';
      for (let i = 0; i < 35; i++) ctx.fillRect(Math.random() * 60, Math.random() * 60, 1.5, 1.5);
      ctx.fillStyle = '#334155';
      for (let i = 0; i < 25; i++) ctx.fillRect(Math.random() * 60, Math.random() * 60, 1.5, 1.5);

      // Fine grid tile boundaries
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(0, 0, 60, 60);
      tex.refresh();
    }

    // 2. Kitchen checkered tiles
    if (!this.textures.exists('floor_kitchen_tile')) {
      const tex = this.textures.createCanvas('floor_kitchen_tile', 40, 40);
      const ctx = tex.context;
      ctx.fillStyle = '#e2e8f0'; // light slate-200
      ctx.fillRect(0, 0, 20, 20);
      ctx.fillRect(20, 20, 20, 20);
      ctx.fillStyle = '#cbd5e1'; // darker slate-300
      ctx.fillRect(20, 0, 20, 20);
      ctx.fillRect(0, 20, 20, 20);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(0, 0, 40, 40);
      ctx.strokeRect(0, 0, 20, 20);
      ctx.strokeRect(20, 20, 20, 20);
      tex.refresh();
    }

    // 3. Server room tech floor grid
    if (!this.textures.exists('floor_server_grid')) {
      const tex = this.textures.createCanvas('floor_server_grid', 80, 80);
      const ctx = tex.context;
      ctx.fillStyle = '#090d16'; // deep futuristic dark blue
      ctx.fillRect(0, 0, 80, 80);

      // Metallic frame lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, 80, 80);

      // Tech circuit microdots
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(10, 10, 3, 3);
      ctx.fillRect(50, 45, 3, 3);
      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(11, 11); ctx.lineTo(11, 35); ctx.lineTo(30, 35);
      ctx.moveTo(51, 46); ctx.lineTo(70, 46);
      ctx.stroke();
      tex.refresh();
    }
  }

  /**
   * Draws nice polished visuals representing desks, plants, meeting tables, files, or server racks.
   */
  drawObstacleDecoration(obs, cx, cy) {
    const rx = obs.x;
    const ry = obs.y;

    // 1. Office Desks
    if (obs.name.includes('Escritorio')) {
      const deskColor = obs.name.includes('Jefe') ? 0x3e2723 : 0x334155; // Wood for boss, slate for standard desks
      this.add.rectangle(cx, cy, obs.w, obs.h, deskColor).setStrokeStyle(1.5, 0x1e293b);

      if (obs.w > obs.h) {
        // Monitor
        this.add.rectangle(cx, cy - 8, 42, 4, 0x0f172a); // Screen
        this.add.rectangle(cx, cy - 5, 8, 2, 0x64748b);  // Neck
        this.add.rectangle(cx, cy - 3, 14, 3, 0x475569); // Foot
        // Keyboard
        this.add.rectangle(cx, cy + 5, 24, 6, 0x94a3b8).setStrokeStyle(0.5, 0x475569);
        // Mouse
        this.add.circle(cx + 18, cy + 5, 1.5, 0xd1d5db);
        // Papers
        this.add.rectangle(cx - 32, cy + 2, 12, 14, 0xf8fafc).setStrokeStyle(0.5, 0xcbd5e1);
      } else {
        // Vertical Desk Layout
        this.add.rectangle(cx - 8, cy, 4, 42, 0x0f172a); // Screen
        this.add.rectangle(cx - 5, cy, 2, 8, 0x64748b);
        this.add.rectangle(cx - 3, cy, 3, 14, 0x475569);
        this.add.rectangle(cx + 5, cy, 6, 24, 0x94a3b8).setStrokeStyle(0.5, 0x475569);
        this.add.circle(cx + 5, cy + 18, 1.5, 0xd1d5db);
      }
      return;
    }

    // 2. Plants
    if (obs.name.includes('Planta')) {
      // Pot
      this.add.circle(cx, cy, 9, 0xb45309).setStrokeStyle(1.5, 0x78350f);
      // Foliage (overlapping green circles)
      this.add.circle(cx - 3, cy - 2, 8, 0x15803d);
      this.add.circle(cx + 3, cy - 3, 9, 0x166534);
      this.add.circle(cx, cy + 3, 8, 0x22c55e);
      return;
    }

    // 3. Meeting Room Table
    if (obs.name.includes('Mesa de Juntas')) {
      // Large Wood Table
      this.add.rectangle(cx, cy, obs.w, obs.h, 0x5c4033).setStrokeStyle(2.5, 0x3e2723);
      // Conference speakerphone
      this.add.triangle(cx, cy - 4, cx - 6, cy + 6, cx + 6, cy + 6, 0x1e293b);
      // Office Chairs
      const chairColor = 0x1e293b;
      for (let xOff = -50; xOff <= 50; xOff += 25) {
        this.add.circle(cx + xOff, cy - obs.h / 2 - 3, 5, chairColor).setStrokeStyle(1, 0x475569); // Top chairs
        this.add.circle(cx + xOff, cy + obs.h / 2 + 3, 5, chairColor).setStrokeStyle(1, 0x475569); // Bottom chairs
      }
      return;
    }

    // 4. Server Racks (IT Room)
    if (obs.name.includes('Rack')) {
      this.add.rectangle(cx, cy, obs.w, obs.h, 0x0f172a).setStrokeStyle(1.5, 0x334155);

      // Vent grills
      const grills = this.add.graphics();
      grills.lineStyle(1.5, 0x1e293b, 0.5);
      for (let vy = cy - obs.h / 2 + 8; vy < cy + obs.h / 2 - 8; vy += 6) {
        grills.lineBetween(cx - obs.w / 2 + 5, vy, cx + obs.w / 2 - 5, vy);
      }

      // Blinking status LEDs (Green/Red)
      const lights = [];
      for (let ly = cy - obs.h / 2 + 12; ly < cy + obs.h / 2 - 12; ly += 16) {
        const ledG = this.add.circle(cx - 12, ly, 2, 0x22c55e);
        const ledR = this.add.circle(cx - 6, ly, 2, 0xef4444);
        lights.push(ledG, ledR);
      }

      // LED Blinker animation
      this.tweens.add({
        targets: lights,
        alpha: 0.15,
        duration: 450,
        yoyo: true,
        repeat: -1,
        delay: (target, key, value, index) => index * 80
      });
      return;
    }

    // 5. Kitchen Refrigerator
    if (obs.name.includes('Refrigerador')) {
      // Refrigerator metallic base
      this.add.rectangle(cx, cy, obs.w, obs.h, 0x94a3b8).setStrokeStyle(1.5, 0x475569);
      // Freezer boundary line
      const line = this.add.graphics();
      line.lineStyle(1.5, 0x334155);
      line.lineBetween(cx - obs.w / 2, cy - 2, cx + obs.w / 2, cy - 2);
      // Handles
      this.add.rectangle(cx + obs.w / 2 - 2, cy - 10, 2, 6, 0x334155);
      this.add.rectangle(cx + obs.w / 2 - 2, cy + 8, 2, 8, 0x334155);
      // Magnet post-its
      this.add.rectangle(cx - 5, cy + 6, 5, 5, 0xfef08a); // Yellow
      this.add.rectangle(cx + 3, cy + 4, 4, 4, 0xfecdd3); // Pink
      return;
    }

    // 6. Archiveros (File Cabinets)
    if (obs.name.includes('Archivero')) {
      this.add.rectangle(cx, cy, obs.w, obs.h, 0x475569).setStrokeStyle(1.5, 0x1e293b);
      const cabinetLine = this.add.graphics();
      cabinetLine.lineStyle(1.5, 0x1e293b);

      if (obs.h > obs.w) {
        // Vertical cabinet drawers
        for (let dy = cy - obs.h / 2 + 20; dy < cy + obs.h / 2; dy += 24) {
          cabinetLine.lineBetween(cx - obs.w / 2, dy, cx + obs.w / 2, dy);
          this.add.rectangle(cx, dy - 12, 6, 2, 0xd1d5db); // Silver handle
        }
      } else {
        // Horizontal cabinet drawers
        for (let dx = cx - obs.w / 2 + 20; dx < cx + obs.w / 2; dx += 24) {
          cabinetLine.lineBetween(dx, cy - obs.h / 2, dx, cy + obs.h / 2);
          this.add.rectangle(dx - 12, cy, 2, 6, 0xd1d5db); // Silver handle
        }
      }
      return;
    }

    // Default fallback rect outline
    this.add.rectangle(cx, cy, obs.w, obs.h, 0x1f2937).setStrokeStyle(2, obs.color, 0.85);
  }
}
