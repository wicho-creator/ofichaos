// EndScene.js — Resultado, revelación de roles y siguiente partida.
import * as net from '../systems/networking.js';
import { createButton } from '../systems/ui.js';
import {
  COLORS, CSS_COLORS, FONT, RADIUS,
  drawOfficeBackdrop, drawPanel, endLayout, textStyle
} from '../systems/theme.js';

const roleLabel = role => ({ jefe: 'Jefe', empleado: 'Empleado', lamebotas: 'Lamebotas' }[role] || 'Sin revelar');
const outcomeCopy = winners => winners === 'empleados'
  ? { title: '¡La oficina sobrevivió!', side: 'Victoria de Empleados', color: COLORS.success, mood: 'victory' }
  : { title: 'El caos ganó el turno', side: 'Victoria del Jefe', color: COLORS.sabotage, mood: 'defeat' };

export class EndScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EndScene' });
    this.networkDisposers = [];
    this.rematchRole = null;
    this.rematchRoleText = '';
  }

  create(data = {}) {
    net.disposeAll(this.networkDisposers);
    const players = Array.isArray(data.players) ? data.players : [];
    const { width, height } = this.scale;
    const copy = outcomeCopy(data.winners);
    this.layout = endLayout(width, height, players.length);
    this.cameras.main.setBackgroundColor(CSS_COLORS.background);
    drawOfficeBackdrop(this, width, height, copy.mood);
    this.drawBrand();
    drawPanel(this, this.layout.card);
    this.drawResult(copy, data.reason);
    this.drawPlayers(players);
    this.drawActions(data);
    this.setupRematchListeners();
    this.events.once('shutdown', () => net.disposeAll(this.networkDisposers));
  }

  setupRematchListeners() {
    const on = (event, handler) => this.networkDisposers.push(net.subscribe(event, handler));
    on('game:role', ({ role, secondaryObjectiveText }) => {
      this.rematchRole = role;
      this.rematchRoleText = secondaryObjectiveText || '';
    });
    on('game:started', gameState => {
      const previous = this.scene.get('GameScene');
      this.scene.stop('EndScene');
      this.scene.start('GameScene', {
        roomCode: previous?.roomCode,
        myId: previous?.myId,
        myRole: this.rematchRole,
        roleText: this.rematchRoleText,
        gameState
      });
    });
  }

  drawBrand() {
    const size = this.layout.mobile ? 28 : 34;
    this.add.text(this.layout.centerX, this.layout.brandY, 'OFICHAOS', {
      fontFamily: FONT.display, fontSize: `${size}px`, color: CSS_COLORS.primary,
      fontStyle: 'bold', stroke: CSS_COLORS.border, strokeThickness: 3
    }).setOrigin(0.5, 0).setAngle(-1);
  }

  drawResult(copy, reason) {
    const { centerX, titleY, resultY, reasonY, card, short } = this.layout;
    const burst = this.add.graphics();
    const left = centerX - card.width / 2 + 24;
    const right = centerX + card.width / 2 - 24;
    burst.lineStyle(4, copy.color, 0.8);
    burst.lineBetween(left, resultY + 14, left + 20, resultY + 14);
    burst.lineBetween(right - 20, resultY + 14, right, resultY + 14);

    this.add.text(centerX, titleY, 'FIN DEL TURNO', textStyle(12, CSS_COLORS.muted, true, 'center')).setOrigin(0.5, 0);
    this.add.text(centerX, resultY, copy.title, {
      fontFamily: FONT.display, fontSize: `${short ? 24 : this.layout.mobile ? 28 : 34}px`,
      color: CSS_COLORS.ink, fontStyle: 'bold', align: 'center',
      wordWrap: { width: card.width - 64 }
    }).setOrigin(0.5, 0);
    this.add.text(centerX, resultY + (short ? 31 : 42), copy.side, {
      ...textStyle(short ? 14 : 16, copy.mood === 'defeat' ? CSS_COLORS.sabotageAccessible : '#157a36', true, 'center')
    }).setOrigin(0.5, 0);
    this.add.text(centerX, reasonY, reason || 'La jornada terminó.', {
      ...textStyle(short ? 13 : 14, CSS_COLORS.ink, false, 'center'),
      wordWrap: { width: card.width - 48 }
    }).setOrigin(0.5, 0);
  }

  drawPlayers(players) {
    const { centerX, listY, rowHeight, visibleRows, card, mobile, short } = this.layout;
    const width = card.width - 40;
    const left = centerX - width / 2;
    this.add.text(left, listY, 'ROLES REVELADOS', textStyle(12, CSS_COLORS.muted, true)).setOrigin(0, 0);
    const headerY = listY + 20;
    const nameX = left;
    const roleX = mobile ? left + width * 0.5 : left + width * 0.42;
    const statsX = left + width;
    this.add.text(nameX, headerY, 'Jugador', textStyle(13, CSS_COLORS.muted, true));
    this.add.text(roleX, headerY, 'Rol', textStyle(13, CSS_COLORS.muted, true));
    this.add.text(statsX, headerY, mobile ? 'Hechas' : 'Tareas · Puntos', textStyle(13, CSS_COLORS.muted, true)).setOrigin(1, 0);

    players.slice(0, visibleRows).forEach((player, index) => {
      const y = headerY + 19 + index * rowHeight;
      if (index % 2 === 0) this.add.rectangle(centerX, y + rowHeight / 2 - 2, width, rowHeight - 3, COLORS.background, 0.5).setOrigin(0.5);
      const name = String(player.name || 'Jugador').slice(0, mobile ? 13 : 20);
      this.add.text(nameX + 6, y, name, textStyle(short ? 14 : 15, CSS_COLORS.ink, true));
      this.add.text(roleX, y, roleLabel(player.role), textStyle(short ? 13 : 15, player.role === 'jefe' ? CSS_COLORS.sabotageAccessible : CSS_COLORS.ink, false));
      const stats = mobile ? `${player.tasksCompleted || 0}` : `${player.tasksCompleted || 0}  ·  ${player.points || 0}`;
      this.add.text(statsX - 6, y, stats, textStyle(short ? 13 : 15, CSS_COLORS.ink, true)).setOrigin(1, 0);
    });
    if (visibleRows < players.length) {
      this.add.text(centerX, headerY + 19 + visibleRows * rowHeight, `+ ${players.length - visibleRows} jugadores`, textStyle(12, CSS_COLORS.muted, true, 'center')).setOrigin(0.5, 0);
    }
  }

  drawActions(data) {
    const { centerX, actionsY, card, mobile } = this.layout;
    const game = this.scene.get('GameScene');
    const roomCode = data.roomCode || game?.roomCode;
    const myId = data.myId || game?.myId;
    const canRematch = roomCode && roomCode !== 'DEMO';
    const gap = 12;
    const buttonWidth = mobile ? Math.floor((card.width - 52) / 2) : 280;
    const leftX = centerX - buttonWidth / 2 - gap / 2;
    const rightX = centerX + buttonWidth / 2 + gap / 2;

    if (canRematch) {
      createButton(this, leftX, actionsY, 'Revancha', () => net.startGame(), {
        bgColor: COLORS.task, bgHover: COLORS.success, textColor: CSS_COLORS.ink,
        width: buttonWidth, height: 52, fontSize: mobile ? '15px' : '17px', radius: RADIUS.md
      });
    }
    createButton(this, canRematch ? rightX : centerX, actionsY, 'Volver al lobby', () => {
      this.scene.stop('EndScene');
      this.scene.start('LobbyScene', { roomCode, myId });
    }, {
      bgColor: COLORS.primary, bgHover: COLORS.ink, textColor: '#ffffff',
      width: buttonWidth, height: 52, fontSize: mobile ? '14px' : '17px', radius: RADIUS.md
    });
  }
}
