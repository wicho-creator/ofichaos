// GameScene.js — Escena principal de juego: mapa, movimiento, tareas, HUD

import * as net from '../systems/networking.js';
import { createButton, createPanel, createText } from '../systems/ui.js';
import { createPlayerSprite, updatePlayerSprite } from '../systems/player.js';
import { TASKS as CLIENT_TASKS } from '../systems/tasks.js';
import { createMinigamePanel } from '../systems/minigame-ui.js';
import { getRoleBriefing } from '../systems/onboarding.js';
import {
  WORLD_BOUNDS,
  OFFICE_ZONES,
  OFFICE_OBSTACLES,
  OFFICE_WALLS,
  OFFICE_DOORS,
  OFFICE_STATIONS,
  findNearestTaskStation
} from '../systems/world.js';
import { gameHudLayout } from '../systems/theme.js';
import { sabotageMenuLayout } from '../systems/sabotage-layout.js';

const clearMobileInput = (input) => {
  for (const key of ['left', 'right', 'up', 'down']) input[key] = false;
};

export function bindMobileInputLifecycle(windowTarget, documentTarget, input) {
  const release = () => clearMobileInput(input);
  const visibility = () => documentTarget.hidden && release();
  windowTarget.addEventListener('blur', release);
  documentTarget.addEventListener('visibilitychange', visibility);
  return () => {
    windowTarget.removeEventListener('blur', release);
    documentTarget.removeEventListener('visibilitychange', visibility);
  };
}

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
    this.mobileInputCleanup = null;

    // Sabotage warnings
    this.sabotageOverlay = null;
    this.sabotageBanner = null;
    this.sabotageTween = null;

    // Active task minigame
    this.activeTaskPanel = null;
    this.taskPanelRequest = null;
    this.networkDisposers = [];
  }

  resetRunState() {
    this.activeTaskPanel?.destroy?.();
    this.players = {};
    this.sprites = {};
    this.gameState = null;
    this.activeTaskPanel = null;
    this.taskPanelRequest = null;
    this.activeSabotageMenu = null;
    this.briefingOpen = false;
    clearMobileInput(this.mobileInput);
    this.mobileInputCleanup?.();
    this.mobileInputCleanup = null;
    net.disposeAll(this.networkDisposers);
  }

  create(data) {
    this.resetRunState();
    this.cameras.main.setBackgroundColor('#dbeafe');
    this.roomCode = data?.roomCode;
    this.myId = data?.myId;
    this.myRole = data?.myRole;
    this.roleText = data?.roleText || '';

    this.createMapTextures();
    // Mapa de oficina (fondo)
    this.drawMap();

    this.obstacles = this.physics.add.staticGroup();
    for (const obstacle of [...OFFICE_WALLS, ...OFFICE_OBSTACLES]) {
      const rect = this.add.rectangle(
        obstacle.x + obstacle.w / 2,
        obstacle.y + obstacle.h / 2,
        obstacle.w,
        obstacle.h,
        0x172554,
        0
      );
      this.physics.add.existing(rect, true);
      this.obstacles.add(rect);
    }

    this.doors = this.physics.add.staticGroup();
    this.doorColliders = new Map();
    for (const door of OFFICE_DOORS) {
      const horizontal = door.orientation === 'horizontal';
      const blocker = this.add.rectangle(
        door.x,
        door.y,
        horizontal ? door.width : 12,
        horizontal ? 12 : door.width,
        0xd83a4a,
        0
      );
      this.physics.add.existing(blocker, true);
      blocker.body.enable = false;
      this.doors.add(blocker);
      this.doorColliders.set(door.id, blocker);
    }

    this.cameras.main.setBounds(WORLD_BOUNDS.x, WORLD_BOUNDS.y, WORLD_BOUNDS.w, WORLD_BOUNDS.h);
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
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      this.mobileInputCleanup = bindMobileInputLifecycle(window, document, this.mobileInput);
    }
    this.events.once('shutdown', () => this.shutdown());

    // Listeners socket
    this.setupSocketListeners();
    if (data?.gameState) this.applyGameState(data.gameState);
    this.time.delayedCall(100, () => this.showRoleBriefing());

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

  shutdown() {
    this.closeTaskPanel();
    this.closeSabotageMenu();
    clearMobileInput(this.mobileInput);
    this.mobileInputCleanup?.();
    this.mobileInputCleanup = null;
    this.scale?.off?.('resize', this.resize, this);
    net.disposeAll(this.networkDisposers);
    if (this.sabotageTween) {
      this.sabotageTween.stop();
      this.sabotageTween = null;
    }
  }

  drawMap() {
    this.add.tileSprite(0, 0, WORLD_BOUNDS.w, WORLD_BOUNDS.h, 'floor_carpet_general').setOrigin(0).setDepth(-3);

    const colors = {
      recepcion: 0x2563eb, cubiculos: 0x22c55e, juntas: 0xf6c344, cocina: 0xf05a5a,
      archivo: 0x8b5cf6, jefe_oficina: 0xd83a4a, rh: 0x06b6d4, servidor: 0x6366f1
    };
    const g = this.add.graphics().setDepth(-1);

    g.fillStyle(0xffffff, 0.78);
    g.fillRoundedRect(52, 332, 1096, 268, 30);
    g.fillRoundedRect(365, 52, 440, 796, 30);
    g.lineStyle(3, 0x93c5fd, 0.42);
    g.strokeRoundedRect(52, 332, 1096, 268, 30);
    g.strokeRoundedRect(365, 52, 440, 796, 30);

    for (const zone of OFFICE_ZONES) {
      const color = colors[zone.id] || 0x64748b;
      g.fillStyle(0x172554, 0.13);
      g.fillRoundedRect(zone.x + 7, zone.y + 8, zone.w, zone.h, 14);
      g.fillStyle(0xffffff, 0.96);
      g.fillRoundedRect(zone.x, zone.y, zone.w, zone.h, 14);
      g.fillStyle(color, 0.12);
      g.fillRoundedRect(zone.x + 5, zone.y + 5, zone.w - 10, zone.h - 10, 10);

      if (zone.id === 'cocina') {
        this.add.tileSprite(zone.x + 5, zone.y + 5, zone.w - 10, zone.h - 10, 'floor_kitchen_tile')
          .setOrigin(0).setAlpha(0.42).setDepth(-1);
      } else if (zone.id === 'servidor') {
        this.add.tileSprite(zone.x + 5, zone.y + 5, zone.w - 10, zone.h - 10, 'floor_server_grid')
          .setOrigin(0).setAlpha(0.5).setDepth(-1);
      }

      this.add.text(zone.x + 12, zone.y + 12, zone.name.toUpperCase(), {
        fontSize: '11px', color: '#172554', fontStyle: 'bold', backgroundColor: '#ffffffdd', padding: { x: 7, y: 4 }
      }).setDepth(3);
    }

    for (const wall of OFFICE_WALLS) {
      g.fillStyle(0x172554, 0.92);
      g.fillRect(wall.x, wall.y, wall.w, wall.h);
      g.fillStyle(0xffffff, 0.42);
      if (wall.w > wall.h) g.fillRect(wall.x, wall.y, wall.w, 2);
      else g.fillRect(wall.x, wall.y, 2, wall.h);
    }

    for (const obstacle of OFFICE_OBSTACLES) {
      this.drawObstacleDecoration(obstacle, obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2);
    }

    this.doorVisuals = new Map();
    for (const door of OFFICE_DOORS) this.drawDoor(door);
    for (const station of OFFICE_STATIONS) this.drawTaskStation(station);
  }

  drawDoor(door) {
    const horizontal = door.orientation === 'horizontal';
    const threshold = this.add.rectangle(
      door.x, door.y, horizontal ? door.width : 16, horizontal ? 16 : door.width, 0xf6c344, 0.28
    ).setStrokeStyle(2, 0xb77900, 0.7).setDepth(2);
    const jambOffset = door.width / 2;
    const jambA = this.add.rectangle(
      door.x + (horizontal ? -jambOffset : 0), door.y + (horizontal ? 0 : -jambOffset),
      horizontal ? 9 : 18, horizontal ? 18 : 9, 0x172554
    ).setDepth(3);
    const jambB = this.add.rectangle(
      door.x + (horizontal ? jambOffset : 0), door.y + (horizontal ? 0 : jambOffset),
      horizontal ? 9 : 18, horizontal ? 18 : 9, 0x172554
    ).setDepth(3);
    const leaf = this.add.rectangle(
      door.x, door.y, horizontal ? door.width - 10 : 10, horizontal ? 10 : door.width - 10, 0xd83a4a
    ).setStrokeStyle(3, 0x172554).setDepth(4).setVisible(false);
    const sign = this.add.text(door.x, door.y - (horizontal ? 18 : 0), 'ENTRADA', {
      fontSize: '8px', color: '#172554', fontStyle: 'bold', backgroundColor: '#f6c344dd', padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(4);
    if (!horizontal) sign.setPosition(door.x + 23, door.y).setAngle(90);
    this.doorVisuals.set(door.id, { threshold, jambA, jambB, leaf, sign });
  }

  drawTaskStation(station) {
    const pulse = this.add.circle(station.x, station.y, 26, 0xf6c344, 0.16).setStrokeStyle(3, 0xb77900, 0.8).setDepth(2);
    this.tweens.add({ targets: pulse, scale: 1.14, alpha: 0.32, duration: 720, yoyo: true, repeat: -1 });
    this.add.rectangle(station.x, station.y, 34, 26, 0xf8fafc).setStrokeStyle(3, 0x172554).setDepth(3);
    this.add.circle(station.x + 9, station.y - 6, 3, 0x22c55e).setDepth(4);
    this.add.text(station.x, station.y + 30, station.label, {
      fontSize: '9px', color: '#172554', fontStyle: 'bold', backgroundColor: '#f6c344ee', padding: { x: 5, y: 3 }
    }).setOrigin(0.5).setDepth(4);
  }

  createHUD() {
    this.hud = this.hud || {};

    // Sabotage warning overlay
    this.sabotageOverlay = this.add.graphics();
    this.sabotageOverlay.lineStyle(12, 0xd83a4a, 1);
    this.sabotageOverlay.strokeRoundedRect(6, 6, this.scale.width - 12, this.scale.height - 12, 18);
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
    this.hud.headerPanel = createPanel(this, 0, 0, 100, 100, 0xffffff, { strokeColor: 0x15203a, strokeAlpha: 0.9, radius: 18 });
    this.hud.timerText = this.add.text(0, 0, '8:00', { fontStyle: 'bold', color: '#172554' }).setOrigin(0.5, 0.5);
    this.hud.taskPercentText = this.add.text(0, 0, 'Tareas 0%', { fontStyle: 'bold', color: '#157a36' }).setOrigin(0.5, 0.5);
    this.hud.helpText = this.add.text(0, 0, 'WASD/Flechas · E para trabajar', { fontSize: '10px', color: '#475569' }).setOrigin(0.5);

    this.timerText = this.hud.timerText;
    this.taskPercentText = this.hud.taskPercentText;

    // 2. Role Panel
    const roleColors = { jefe: '#d83a4a', lamebotas: '#9a6700', empleado: '#157a36' };
    const roleName = { jefe: 'JEFE', lamebotas: 'LAMEBOTAS', empleado: 'EMPLEADO' };
    this.hud.rolePanel = createPanel(this, 0, 0, 100, 100, 0xffffff, { strokeColor: 0x2563eb, strokeAlpha: 0.9, radius: 20 });
    this.hud.roleDisplay = this.add.text(0, 0, roleName[this.myRole] || '?', {
      color: roleColors[this.myRole] || '#475569', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.hud.roleObjectiveLabel = this.add.text(0, 0, 'OBJETIVO PRIVADO', { fontSize: '10px', color: '#64748b' }).setOrigin(0.5);
    this.hud.roleDescription = this.add.text(0, 0, this.roleText || 'Sobrevive al caos de la oficina', {
      color: '#172554', align: 'center'
    }).setOrigin(0.5);

    this.roleDisplay = this.hud.roleDisplay;

    // 3. Status/Moral Panel
    this.hud.statusPanel = createPanel(this, 0, 0, 100, 100, 0xffffff, { strokeColor: 0x22c55e, strokeAlpha: 0.9, radius: 20 });
    this.hud.moraleLabel = this.add.text(0, 0, 'MORAL', { color: '#172554', fontStyle: 'bold' });
    this.hud.moraleBar = this.add.rectangle(0, 0, 100, 14, 0xcbd5e1).setOrigin(0.5);
    this.hud.moraleFill = this.add.rectangle(0, 0, 100, 14, 0x22c55e).setOrigin(0, 0.5);
    this.hud.tasksLabel = this.add.text(0, 0, 'TAREAS ACTIVAS', { color: '#64748b', fontStyle: 'bold' });
    this.hud.tasksList = this.add.text(0, 0, '', { color: '#172554', lineSpacing: 2 }).setOrigin(0, 0);

    this.moraleBar = this.hud.moraleBar;
    this.moraleFill = this.hud.moraleFill;
    this.tasksList = this.hud.tasksList;

    // 4. Action Panel & Buttons
    this.hud.actionPanel = createPanel(this, 0, 0, 100, 100, 0xffffff, { strokeColor: 0x15203a, strokeAlpha: 0.8, radius: 18 });
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

  showRoleBriefing() {
    if (this.briefingOpen) return;
    this.briefingOpen = true;
    const briefing = getRoleBriefing(this.myRole, this.roleText);
    const w = this.scale.width;
    const h = this.scale.height;
    const cardW = Math.min(520, w - 24);
    const cardH = Math.min(360, h - 32);
    const cx = w / 2;
    const cy = h / 2;
    const roleColors = { empleado: '#22c55e', jefe: '#d83a4a', lamebotas: '#b77900' };

    const blocker = this.add.zone(cx, cy, w, h).setScrollFactor(0).setDepth(2000).setInteractive();
    const shade = this.add.rectangle(0, 0, w, h, 0x172554, 0.82)
      .setOrigin(0).setScrollFactor(0).setDepth(2000);
    const panel = createPanel(this, cx, cy, cardW, cardH, 0xf8fafc, {
      strokeColor: 0x15203a,
      strokeAlpha: 1,
      radius: 24
    }).setScrollFactor(0).setDepth(2001);
    const eyebrow = this.add.text(cx, cy - cardH / 2 + 34, 'TU EXPEDIENTE CONFIDENCIAL', {
      fontSize: w < 500 ? '11px' : '13px',
      color: '#64748b',
      fontStyle: 'bold',
      letterSpacing: 1
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
    const title = this.add.text(cx, cy - cardH / 2 + 78, briefing.label, {
      fontSize: w < 500 ? '30px' : '40px',
      color: roleColors[this.myRole] || '#2563eb',
      fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
    const mission = this.add.text(cx, cy - 32, briefing.mission, {
      fontSize: w < 500 ? '16px' : '19px',
      color: '#172554',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: cardW - 56 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
    const objective = this.add.text(cx, cy + 26, `Objetivo privado: ${briefing.secondaryObjective}`, {
      fontSize: w < 500 ? '12px' : '14px',
      color: '#475569',
      align: 'center',
      wordWrap: { width: cardW - 56 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
    const firstStep = this.add.text(cx, cy + 82, briefing.firstStep, {
      fontSize: w < 500 ? '12px' : '14px',
      color: '#172554',
      backgroundColor: '#f6c344',
      padding: { x: 12, y: 8 },
      align: 'center',
      wordWrap: { width: cardW - 80 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);

    const elements = [blocker, shade, panel, eyebrow, title, mission, objective, firstStep];
    const dismiss = () => {
      this.briefingOpen = false;
      elements.forEach((element) => element.destroy());
      button.bg.destroy();
      button.label.destroy();
      if (this.scale.width >= 600) {
        this.showFloatingText(briefing.firstStep, 0xf6c344);
      }
    };
    const button = createButton(this, cx, cy + cardH / 2 - 42, w < 500 ? 'EMPEZAR' : 'ENTENDIDO · EMPEZAR', dismiss, {
      width: Math.min(280, cardW - 48),
      height: 48,
      bgColor: 0x2563eb,
      bgHover: 0x1d4ed8,
      fontSize: w < 500 ? '13px' : '15px',
      radius: 14
    });
    [button.bg, button.label, button.hit, button.shadow].forEach((element) => element.setScrollFactor(0).setDepth(2003));
  }

  loadDemoState(gs) {
    this.gameState = gs;
    this.syncPlayers(gs);
    this.updateHUD(gs);
    if (this.scale.width >= 600) {
      this.showFloatingText('🧪 Sala demo cargada: probá tareas, sabotajes y cámara', 0xfbbf24);
    }
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
      this.sabotageOverlay.lineStyle(12, 0xd83a4a, 1);
      this.sabotageOverlay.strokeRoundedRect(6, 6, w - 12, h - 12, 18);
    }

    // Reposicionar paneles abiertos
    this.repositionActivePanels(w, h);
  }

  repositionHUD(w, h) {
    const layout = gameHudLayout(w, h);
    const compact = h < 700;
    const narrow = layout.mobile;

    // 1. Header Panel
    const headerW = layout.header.width;
    const headerH = layout.header.height;
    const headerX = layout.header.x;
    const headerY = layout.header.y;

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
    [this.hud.rolePanel, this.hud.roleDisplay, this.hud.roleObjectiveLabel, this.hud.roleDescription]
      .forEach((element) => element.setVisible(layout.showRolePanel));

    // 3. Moral: integrada al encabezado en móvil; panel completo en escritorio.
    if (narrow) {
      this.hud.statusPanel.setVisible(false);
      this.hud.moraleLabel.setVisible(true).setPosition(headerX - 86, headerY + 17).setFontSize('9px');
      const moraleBarW = 118;
      const moraleBarX = headerX + 22;
      const moraleBarY = headerY + 18;
      this.hud.moraleBar.setVisible(true).setPosition(moraleBarX, moraleBarY).setSize(moraleBarW, 10);
      this.hud.moraleFill.setVisible(true).setPosition(moraleBarX - moraleBarW / 2, moraleBarY);
      this.hud.moraleFill.height = 10;
      this.hud.tasksLabel.setVisible(false);
      this.hud.tasksList.setVisible(false);
    } else {
      const statusW = compact ? 294 : 342;
      const statusH = compact ? 108 : 130;
      const statusX = compact ? w - 205 : w - 215;
      const statusY = compact ? h - 130 : h - 160;
      this.hud.statusPanel.setVisible(true).drawPanel(statusX, statusY, statusW, statusH);

      const moraleLabelX = statusX - statusW / 2 + 16;
      const moraleLabelY = statusY - statusH / 2 + 12;
      this.hud.moraleLabel.setVisible(true).setPosition(moraleLabelX, moraleLabelY).setFontSize(compact ? '12px' : '13px');

      const moraleBarW = compact ? 146 : 168;
      const moraleBarX = statusX + statusW / 2 - moraleBarW / 2 - 16;
      const moraleBarY = moraleLabelY + 4;
      this.hud.moraleBar.setVisible(true).setPosition(moraleBarX, moraleBarY).setSize(moraleBarW, 14);
      this.hud.moraleFill.setVisible(true).setPosition(moraleBarX - moraleBarW / 2, moraleBarY);
      this.hud.moraleFill.height = 14;

      const tasksLabelY = moraleLabelY + (compact ? 27 : 30);
      this.hud.tasksLabel.setVisible(layout.showTaskList).setPosition(moraleLabelX, tasksLabelY).setFontSize('11px');
      this.hud.tasksList.setVisible(layout.showTaskList).setPosition(moraleLabelX, tasksLabelY + 18);
      this.hud.tasksList.setFontSize(compact ? '10px' : '11px');
      this.hud.tasksList.setStyle({ wordWrap: { width: statusW - 32 } });
    }

    // 4. Action Panel & Buttons
    let actionX, actionY, actionW, actionH, btnY;
    if (narrow) {
      actionW = 120;
      actionH = 120;
      actionX = w - 10 - actionW / 2;
      actionY = h - 10 - actionH / 2;

      this.hud.actionPanel.drawPanel(actionX, actionY, actionW, actionH);
      this.hud.actionPanel.setVisible(false);

      const mainBtnX = layout.actions.x;
      const mainBtnY = layout.actions.y;
      this.hud.btnInteract.setPositionAndSize(mainBtnX, mainBtnY, 56, 56);
      this.hud.btnInteract.label.setFontSize('22px');

      this.hud.btnMeeting.setPositionAndSize(mainBtnX - 58, mainBtnY, 44, 44);
      this.hud.btnMeeting.label.setFontSize('16px');

      if (this.hud.btnSabotageOrReport) {
        this.hud.btnSabotageOrReport.setPositionAndSize(mainBtnX, mainBtnY - 58, 44, 44);
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
      const wide = w >= 900;
      this.sabotageBanner.setPosition(wide ? w - 190 : w / 2, wide ? 32 : headerY + headerH / 2 + 18);
      this.sabotageBanner.setFontSize(wide ? '11px' : '10px');
      this.sabotageBanner.setStyle({ wordWrap: { width: wide ? 340 : w - 32 }, align: 'center' });
    }

    // 5. Mobile Pad Controls (D-pad)
    this.hud.mobileControls.forEach((btn) => {
      btn.bg?.destroy?.();
      btn.label?.destroy?.();
      btn.hit?.destroy?.();
      btn.shadow?.destroy?.();
    });
    this.hud.mobileControls = [];

    if (w <= 900) {
      const baseX = layout.dpad.x;
      const baseY = layout.dpad.y;
      const offset = narrow ? 42 : 38;
      const size = 44;

      const makePad = (px, py, label, key) => {
        const btn = createButton(this, px, py, label, () => {}, {
          width: size, height: size, bgColor: 0x172554, bgHover: 0x2563eb, fontSize: '15px', radius: 12
        });
        btn.hit.on('pointerdown', () => { this.mobileInput[key] = true; });
        btn.hit.on('pointerup', () => { this.mobileInput[key] = false; });
        btn.hit.on('pointerupoutside', () => { this.mobileInput[key] = false; });
        btn.hit.on('pointerout', () => { this.mobileInput[key] = false; });

        btn.bg.setScrollFactor(0);
        btn.label.setScrollFactor(0);
        btn.hit.setScrollFactor(0);
        btn.shadow.setScrollFactor(0);

        this.hud.mobileControls.push(btn);
      };

      makePad(baseX, baseY - offset, '↑', 'up');
      makePad(baseX, baseY + offset, '↓', 'down');
      makePad(baseX - offset, baseY, '←', 'left');
      makePad(baseX + offset, baseY, '→', 'right');
    }

    this.updateHUD(this.gameState);
  }

  repositionActivePanels(w, h) {
    if (this.activeSabotageMenu) {
      this.closeSabotageMenu();
      this.startSabotageMenu();
    }
    this.activeTaskPanel?.resize(w, h);
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
    net.disposeAll(this.networkDisposers);
    const on = (event, handler) => this.networkDisposers.push(net.subscribe(event, handler));

    on('game:started', (gs) => this.applyGameState(gs));

    on('game:update', (gs) => this.applyGameState(gs));

    on('game:private', ({ playerId, cooldowns }) => {
      if (playerId !== this.myId || !this.players[this.myId]) return;
      this.players[this.myId].cooldowns = { ...(cooldowns || {}) };
      this.updateHUD(this.gameState);
    });

    on('game:tick', (data) => {
      if (!this.gameState) this.gameState = {};
      this.gameState.timeRemaining = data.timeRemaining;
      this.gameState.taskPercent = data.taskPercent;
      this.gameState.activeSabotages = data.activeSabotages || [];
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

    on('player:moved', ({ playerId, x, y }) => {
      if (this.players[playerId]) {
        if (playerId === this.myId) {
          const localSprite = this.sprites[playerId];
          if (localSprite) {
            localSprite.container.setPosition(x, y);
            if (localSprite.container.body) {
              localSprite.container.body.reset(x, y);
            }
            this.players[playerId].x = x;
            this.players[playerId].y = y;
          }
        } else {
          this.players[playerId].x = x;
          this.players[playerId].y = y;
        }
      }
    });

    on('task:completed', ({ taskId, playerName }) => {
      const task = CLIENT_TASKS.find((t) => t.id === taskId);
      this.showFloatingText(`${playerName} completó: ${task?.name || taskId}`, 0x4ade80);
      if (this.activeTaskPanel && this.activeTaskPanel.taskId === taskId) {
        this.closeTaskPanel();
      }
    });

    on('sabotage:triggered', (data) => {
      const label = data.type === 'fake_task' ? 'un compañero está fingiendo trabajar' : `zona ${data.zoneId}`;
      this.showFloatingText(`⚠ Sabotaje: ${label}`, 0xef4444);
    });

    on('sabotage:extra_task', () => {
      this.showFloatingText('Asignaste tarea extra! -10 moral', 0xef4444);
    });

    on('sabotage:morale', () => {
      this.showFloatingText('Moral bajada por el jefe! -20', 0xef4444);
    });

    on('sabotage:door_closed', ({ zoneId }) => {
      this.showFloatingText(`Puerta cerrada: ${zoneId}`, 0xf59e0b);
    });

    on('sabotage:fake_task', () => {
      this.showFloatingText('Fingiste una tarea. Nadie sospecha... todavía.', 0xfacc15);
    });

    on('sabotage:false_report', () => {
      this.showFloatingText('📣 Reporte falso: la oficina entra en pánico', 0xef4444);
    });

    on('sabotage:block_task', ({ taskId }) => {
      this.showFloatingText(`⛔ Tarea bloqueada: ${taskId}`, 0xef4444);
    });

    on('sabotage:reported', ({ playerName, sabotageType, zoneId, taskId }) => {
      const where = zoneId || taskId || sabotageType;
      this.showFloatingText(`🚨 ${playerName} reportó sabotaje: ${where}`, 0xf97316);
    });

    on('meeting:started', ({ calledBy, playerName }) => {
      clearMobileInput(this.mobileInput);
      this.closeTaskPanel();
      this.showFloatingText(`Reunión convocada por ${playerName}`, 0xfbbf24);
      const players = Object.values(this.players).map(({ id, name, x, y, morale, burnout, tasksCompleted }) => ({
        id, name, x, y, morale, burnout, tasksCompleted
      }));
      this.scene.pause('GameScene');
      this.scene.launch('MeetingScene', {
        roomCode: this.roomCode,
        myId: this.myId,
        myRole: this.myRole,
        players
      });
      this.scene.bringToTop('MeetingScene');
    });

    on('game:ended', (data) => {
      this.scene.stop('MeetingScene');
      this.scene.stop('GameScene');
      this.scene.start('EndScene', data);
    });

    on('error:message', ({ message }) => {
      if (this.activeTaskPanel?.pending) this.closeTaskPanel();
      this.showFloatingText(message, 0xef4444);
    });
  }

  applyGameState(gs) {
    if (!gs) return;
    this.gameState = gs;
    this.syncPlayers(gs);
    this.updateHUD(gs);
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
          this.physics.add.collider(this.sprites[p.id].container, this.doors);
        }
      }
      Object.assign(this.players[p.id], p);
    }
  }

  syncDoors(activeSabotages = []) {
    const closedDoors = new Set(activeSabotages.filter(({ type }) => type === 'close_door').map(({ doorId }) => doorId));

    for (const door of OFFICE_DOORS) {
      const closed = closedDoors.has(door.id);
      const collider = this.doorColliders?.get(door.id);
      if (collider?.body) collider.body.enable = closed;
      const visual = this.doorVisuals?.get(door.id);
      visual?.leaf?.setVisible(closed);
      visual?.threshold?.setFillStyle(closed ? 0xd83a4a : 0xf6c344, closed ? 0.58 : 0.28);
      visual?.sign?.setText(closed ? 'CERRADA' : 'ENTRADA').setBackgroundColor(closed ? '#d83a4a' : '#f6c344dd').setColor(closed ? '#ffffff' : '#172554');
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
    this.syncDoors(gs.activeSabotages || []);
    if (hasActiveSabotages) {
      if (!this.sabotageTween) {
        this.sabotageOverlay.setVisible(true);
        this.sabotageOverlay.setAlpha(0);
        this.sabotageTween = this.tweens.add({
          targets: this.sabotageOverlay,
          alpha: 0.72,
          duration: 650,
          yoyo: true,
          repeat: -1
        });
      }

      const descriptions = gs.activeSabotages.map((s) => {
        if (s.type === 'zone') return `Zona: ${s.zoneId.toUpperCase()}`;
        if (s.type === 'close_door') return `Puerta Cerrada: ${(s.doorId || s.zoneId).toUpperCase()}`;
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

    if (this.briefingOpen || this.activeTaskPanel) {
      this.sprites[this.myId]?.container?.body?.setVelocity(0, 0);
      return;
    }

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
    if (this.activeTaskPanel) return;
    const me = this.players[this.myId];
    if (!me) return;
    if (this.myRole !== 'empleado') {
      this.showFloatingText('Solo los empleados pueden completar encargos', 0xfbbf24);
      return;
    }

    const station = findNearestTaskStation(me.x, me.y);
    const task = station && CLIENT_TASKS.find((item) => item.id === station.taskId);
    const distance = station ? Phaser.Math.Distance.Between(me.x, me.y, station.x, station.y) : Infinity;
    if (!task || distance > this.getTaskInteractionDistance()) {
      this.showFloatingText('Busca una estación amarilla y acércate para trabajar', 0xfbbf24);
      return;
    }
    this.openTaskPanel(task);
  }

  handleMapClick(pointer) {
    if (this.activeTaskPanel || this.briefingOpen) return;
    if (this.myRole !== 'empleado') return this.showFloatingText('Solo los empleados pueden completar encargos', 0xfbbf24);
    const station = OFFICE_STATIONS.find(({ x, y }) => Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, x, y) <= 42);
    if (!station) return;
    const me = this.players[this.myId];
    if (!me || Phaser.Math.Distance.Between(me.x, me.y, station.x, station.y) > this.getTaskInteractionDistance()) {
      this.showFloatingText('Acércate a la estación para trabajar', 0xfbbf24);
      return;
    }
    const task = CLIENT_TASKS.find((item) => item.id === station.taskId);
    if (task) this.openTaskPanel(task);
  }

  async openTaskPanel(task, sessionId = null, request = null) {
    const taskState = this.gameState?.tasks?.find((item) => item.id === task.id);
    if (taskState?.blocked) return this.showFloatingText('Esta estación está bloqueada por sabotaje', 0xef4444);
    if (taskState?.completed) return this.showFloatingText('Este encargo ya está completado', 0xfbbf24);
    if (this.activeTaskPanel) this.closeTaskPanel();

    if (this.roomCode !== 'DEMO' && !sessionId) {
      request = Symbol(task.id);
      this.taskPanelRequest = request;
      const started = await net.startTask(task.id);
      return this.applyTaskStartResult(task, request, started);
    }

    if (request && this.taskPanelRequest !== request) return;

    let panel;
    panel = createMinigamePanel(this, task, {
      authoritative: Boolean(sessionId),
      onAction: (action) => {
        if (sessionId) return net.sendTaskAction(sessionId, action).then((result) => this.applyTaskActionResult(panel, result));
      },
      onComplete: (taskId) => {
        if (this.roomCode !== 'DEMO') return;
        const demoTask = this.gameState?.tasks?.find((item) => item.id === taskId);
        if (demoTask) demoTask.completed = true;
        const tasks = this.gameState?.tasks || [];
        this.gameState.taskPercent = tasks.length ? Math.round(tasks.filter((item) => item.completed).length / tasks.length * 100) : 0;
        this.updateHUD(this.gameState);
        this.time.delayedCall(350, () => {
          if (this.activeTaskPanel !== panel) return;
          this.closeTaskPanel(panel);
          this.showFloatingText(`Completaste: ${task.name}`, 0x22c55e);
        });
      },
      onCancel: () => this.closeTaskPanel(panel)
    });
    this.activeTaskPanel = panel;
    this.sprites[this.myId]?.container?.body?.setVelocity(0, 0);
  }

  applyTaskStartResult(task, request, result) {
    if (this.taskPanelRequest !== request) return;
    if (result?.error) {
      this.taskPanelRequest = null;
      return this.showFloatingText(result.error, 0xef4444);
    }
    return this.openTaskPanel(task, result.sessionId, request);
  }

  applyTaskActionResult(panel, result) {
    if (this.activeTaskPanel !== panel) return result;
    if (result?.error) {
      this.closeTaskPanel(panel);
      this.showFloatingText(result.error, 0xef4444);
    }
    return result;
  }

  closeTaskPanel(expected = this.activeTaskPanel) {
    if (this.activeTaskPanel !== expected) return;
    this.taskPanelRequest = null;
    this.activeTaskPanel?.destroy();
    this.activeTaskPanel = null;
  }

  startSabotageMenu(page = 0) {
    if (this.activeSabotageMenu) this.closeSabotageMenu();
    this.floatingText?.destroy();
    this.floatingText = null;

    const layout = sabotageMenuLayout(this.scale.width, this.scale.height, this.myRole, page);
    const narrow = this.scale.width < 450;
    const panel = createPanel(this, layout.panelX, layout.panelY, layout.panelW, layout.panelH, 0x7c2d12);
    const title = createText(this, layout.panelX, layout.top + 28, this.myRole === 'lamebotas' ? 'SABOTAJES LAMEBOTAS' : 'SABOTAJE DEL JEFE', {
      fontSize: narrow ? '16px' : '20px', color: '#ffffff', bold: true
    }).setOrigin(0.5);
    const elements = [panel, title];
    this.activeSabotageMenu = { elements, page: layout.page };
    const addAction = (target, label, fn, options = {}) => {
      const button = createButton(this, target.x, target.y, label, () => {
        fn();
        if (options.keepOpen !== true) this.closeSabotageMenu();
      }, {
        width: target.width,
        height: target.height,
        bgColor: options.bgColor || 0x991b1b,
        bgHover: 0xdc2626,
        fontSize: options.fontSize || '12px',
        radius: 12
      });
      elements.push(button.bg, button.label);
    };
    const byId = (id) => layout.targets.find((target) => target.id === id);
    const actions = {
      fake: ['FINGIR TAREA · +MORAL', () => net.sabotageFakeTask()],
      'false-report': ['REPORTE FALSO · PÁNICO', () => net.sabotageFalseReport()],
      'block-task': ['BLOQUEAR TAREA ACTIVA', () => {
        const task = (this.gameState?.tasks || []).find((item) => !item.completed && !item.blocked);
        if (task) net.sabotageBlockTask(task.id);
        else this.showFloatingText('No hay tareas bloqueables', 0xfbbf24);
      }]
    };
    for (const [id, [label, fn]] of Object.entries(actions)) {
      const target = byId(id);
      if (target) addAction(target, label, fn, { fontSize: narrow ? '10px' : '12px' });
    }

    OFFICE_ZONES.forEach((zone, index) => {
      const target = byId(`zone-${index}`);
      if (target) addAction(target, `ZONA · ${zone.name.toUpperCase()}`, () => net.sabotageZone(zone.id), { fontSize: narrow ? '10px' : '11px' });
    });

    const me = this.players[this.myId];
    const nearestDoor = me && OFFICE_DOORS.reduce((nearest, door) => {
      const distance = Phaser.Math.Distance.Between(me.x, me.y, door.x, door.y);
      return !nearest || distance < nearest.distance ? { door, distance } : nearest;
    }, null)?.door;
    const zone = nearestDoor && OFFICE_ZONES.find((candidate) => candidate.id === nearestDoor.zoneId);
    if (byId('close-door')) addAction(byId('close-door'), `CERRAR ACCESO · ${zone?.name.toUpperCase() || 'CERCANO'}`, () => {
      if (nearestDoor) net.sabotageCloseDoor(nearestDoor.id);
      else this.showFloatingText('No hay una puerta cercana', 0xfbbf24);
    }, { bgColor: 0xd83a4a });
    if (byId('zones-page')) addAction(byId('zones-page'), 'ELEGIR ZONA…', () => this.startSabotageMenu(1), { keepOpen: true });
    if (byId('back')) addAction(byId('back'), layout.veryCompact ? 'ANTERIOR' : 'VOLVER A HABILIDADES', () => this.startSabotageMenu(layout.veryCompact ? layout.page - 1 : 0), { keepOpen: true });
    if (byId('next')) addAction(byId('next'), 'SIGUIENTE', () => this.startSabotageMenu(layout.page + 1), { keepOpen: true });
    addAction(byId('cancel'), 'CANCELAR', () => {}, { bgColor: 0x475569 });
    elements.forEach((element) => element.setScrollFactor?.(0).setDepth?.(3001));
  }

  closeSabotageMenu() {
    if (this.activeSabotageMenu) {
      this.activeSabotageMenu.elements.forEach((el) => el?.destroy && el.destroy());
      this.activeSabotageMenu = null;
    }
  }

  showFloatingText(text, color = 0xffffff) {
    this.floatingText?.destroy();
    const mobile = this.scale.width < 600;
    const startY = mobile ? 88 : 92;
    const ft = this.add.text(this.scale.width / 2, startY, text, {
      fontSize: mobile ? '12px' : '16px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      backgroundColor: '#172554e6',
      padding: { x: mobile ? 8 : 10, y: mobile ? 4 : 5 },
      align: 'center',
      wordWrap: { width: this.scale.width - (mobile ? 48 : 40) }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(9999);
    this.floatingText = ft;
    this.tweens.add({
      targets: ft,
      y: mobile ? 76 : 74,
      alpha: 0,
      duration: 2500,
      onComplete: () => {
        if (ft.active) ft.destroy();
        if (this.floatingText === ft) this.floatingText = null;
      }
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
      ctx.fillStyle = '#dbeafe';
      ctx.fillRect(0, 0, 60, 60);

      // Fibra suave de alfombra clara, sin ruido aleatorio que cambie entre sesiones.
      ctx.fillStyle = '#bfdbfe';
      for (let x = 8; x < 60; x += 18) for (let y = 8; y < 60; y += 18) ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = '#ffffff';
      for (let x = 16; x < 60; x += 24) for (let y = 4; y < 60; y += 24) ctx.fillRect(x, y, 1.5, 1.5);

      ctx.strokeStyle = '#93c5fd';
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
      ctx.fillStyle = '#dbeafe';
      ctx.fillRect(0, 0, 80, 80);

      // Rejilla técnica clara.
      ctx.strokeStyle = '#93c5fd';
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
