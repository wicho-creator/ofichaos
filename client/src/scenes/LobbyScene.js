// LobbyScene.js — Entrada accesible, sala multijugador y demo de OfiChaos.
import * as net from '../systems/networking.js';
import { createButton } from '../systems/ui.js';
import {
  COLORS, CSS_COLORS, FONT, MIN_PLAYERS, RADIUS,
  drawOfficeBackdrop, drawPanel, lobbyLayout, textStyle
} from '../systems/theme.js';

const safeName = value => value.trim().slice(0, 12) || 'Jugador';

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
    this.roomCode = null;
    this.roomState = null;
    this.myRole = null;
    this.myId = null;
    this.roleAssigned = false;
    this.networkDisposers = [];
  }

  create() {
    document.getElementById('loading')?.classList.add('hidden');
    const { width, height } = this.scale;
    this.layout = lobbyLayout(width, height);
    this.cameras.main.setBackgroundColor(CSS_COLORS.background);
    drawOfficeBackdrop(this, width, height);
    this.drawBrand();
    drawPanel(this, this.layout.card);
    this.drawHeading();
    this.createEntryForm();
    this.drawRoomArea();

    this.setupSocketListeners();
    this.events.once('shutdown', () => net.disposeAll(this.networkDisposers));
  }

  drawBrand() {
    const { centerX, brandY, mobile } = this.layout;
    const size = mobile ? 34 : 46;
    const logo = this.add.text(centerX, brandY, 'OFI', {
      fontFamily: FONT.display, fontSize: `${size}px`, color: CSS_COLORS.primary,
      fontStyle: 'bold', stroke: CSS_COLORS.border, strokeThickness: mobile ? 3 : 4
    }).setOrigin(1, 0).setAngle(-2);
    this.add.text(centerX, brandY + 1, 'CHAOS', {
      fontFamily: FONT.display, fontSize: `${size}px`, color: CSS_COLORS.task,
      fontStyle: 'bold', stroke: CSS_COLORS.border, strokeThickness: mobile ? 3 : 4
    }).setOrigin(0, 0).setAngle(2);
    this.add.graphics().fillStyle(COLORS.sabotage).fillCircle(centerX + logo.width * 0.77, brandY + 4, mobile ? 5 : 7);
  }

  drawHeading() {
    const top = this.layout.card.y - this.layout.card.height / 2;
    this.add.text(this.layout.centerX, top + 18, 'La oficina está por explotar', {
      fontFamily: FONT.display, fontSize: `${this.layout.short ? 20 : 24}px`, color: CSS_COLORS.ink,
      fontStyle: 'bold', align: 'center',
      wordWrap: { width: this.layout.card.width - 40 }
    }).setOrigin(0.5, 0);
    if (!this.layout.short) {
      this.add.text(this.layout.centerX, top + 50, 'Crea una sala o entra con el código de tu equipo.', {
        ...textStyle(14, CSS_COLORS.muted, false, 'center'),
        wordWrap: { width: this.layout.card.width - 40 }
      }).setOrigin(0.5, 0);
    }
  }

  createEntryForm() {
    const width = Math.min(this.layout.card.width - 32, 520);
    const compact = this.layout.mobile;
    const html = `
      <form class="ofc-entry" aria-label="Entrar a una sala de OfiChaos" autocomplete="off">
        <div class="ofc-fields">
          <label>Tu nombre<input name="name" type="text" maxlength="12" placeholder="Ej. Ana" autocomplete="nickname" aria-describedby="name-help"></label>
          <span id="name-help" class="sr-only">Máximo 12 caracteres</span>
          <label>Código de sala<input name="code" type="text" maxlength="5" placeholder="ABCDE" inputmode="text" autocapitalize="characters" aria-label="Código de sala de cinco caracteres"></label>
        </div>
        <div class="ofc-actions">
          <button type="button" data-action="create">Crear sala</button>
          <button type="submit" data-action="join">Unirme</button>
        </div>
        <button class="ofc-demo" type="button" data-action="demo"><span aria-hidden="true" class="ofc-flask"></span>Probar sala demo</button>
      </form>`;
    this.entryDom = this.add.dom(this.layout.centerX, this.layout.formY).createFromHTML(html).setOrigin(0.5, 0);
    const form = this.entryDom.node.querySelector('form');
    form.style.width = `${width}px`;
    this.entryDom.updateSize();
    this.entryDom.setOrigin(0.5, 0);
    form.classList.toggle('is-compact', compact);
    const name = form.elements.name;
    const code = form.elements.code;
    const resetJoin = () => { this.roomCode = null; this.myRole = null; this.roleAssigned = false; };

    form.querySelector('[data-action="create"]').addEventListener('click', () => {
      resetJoin();
      net.createRoom(safeName(name.value));
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const roomCode = code.value.trim().toUpperCase();
      if (!roomCode) { this.showMessage('Escribe el código de la sala.'); code.focus(); return; }
      resetJoin();
      net.joinRoom(roomCode, safeName(name.value));
    });
    form.querySelector('[data-action="demo"]').addEventListener('click', () => this.startDemoRoom(safeName(name.value) || 'Wicho'));
    code.addEventListener('input', () => { code.value = code.value.replace(/[^a-z0-9]/gi, '').toUpperCase(); });
  }

  drawRoomArea() {
    const x = this.layout.centerX;
    this.infoText = this.add.text(x, this.layout.infoY, 'Aún no estás en una sala.', textStyle(14, CSS_COLORS.muted, true, 'center')).setOrigin(0.5, 0);
    this.playersText = this.add.text(x, this.layout.listY, '', {
      ...textStyle(this.layout.short ? 14 : 16, CSS_COLORS.ink, false, 'left'),
      lineSpacing: this.layout.short ? 4 : 7,
      wordWrap: { width: this.layout.card.width - 48 }
    }).setOrigin(0.5, 0);
    this.startButton = null;
  }

  setupSocketListeners() {
    net.disposeAll(this.networkDisposers);
    const on = (event, handler) => this.networkDisposers.push(net.subscribe(event, handler));
    on('room:created', ({ code, playerId }) => { this.myId = playerId; this.roomCode = code; this.showMessage(`Sala ${code} creada · comparte el código`); });
    on('room:joined', ({ code, playerId }) => { this.myId = playerId; this.roomCode = code; this.showMessage(`Ya estás en la sala ${code}`); });
    on('room:update', payload => { if (payload) { this.roomState = payload; this.updateLobbyUI(); } });
    on('error:message', ({ message }) => this.showMessage(`No se pudo entrar: ${message}`));
    on('game:role', ({ role, secondaryObjectiveText }) => { this.myRole = role; this.roleAssigned = true; this.roleText = secondaryObjectiveText; });
    on('game:started', gameState => {
      if (!this.roleAssigned) {
        this.scene.get('GameScene').myRole = this.myRole;
        this.scene.get('GameScene').roleText = this.roleText;
      }
      this.scene.stop('LobbyScene');
      this.scene.start('GameScene', { roomCode: this.roomCode, myId: this.myId, myRole: this.myRole, roleText: this.roleText, gameState });
    });
  }

  updateLobbyUI() {
    if (!this.roomState?.players) return;
    const players = this.roomState.players;
    const count = players.length;
    const visible = players.slice(0, this.layout.maxRows);
    const rows = visible.map((player, index) => `${index + 1}.  ${player.name}${player.id === this.myId ? '  · Tú' : ''}`);
    if (visible.length < count) rows.push(`+ ${count - visible.length} más`);
    this.playersText.setText(`EQUIPO  ${count}/12\n${rows.join('\n')}`);

    const missing = Math.max(0, MIN_PLAYERS - count);
    this.showMessage(missing ? `Faltan ${missing} ${missing === 1 ? 'persona' : 'personas'} para empezar (mínimo ${MIN_PLAYERS}).` : 'Equipo completo. El host puede iniciar.');
    const isHost = this.roomState.hostId === this.myId;
    if (isHost && count >= MIN_PLAYERS && !this.startButton) {
      const y = this.layout.card.y + this.layout.card.height / 2 - 38;
      this.startButton = createButton(this, this.layout.centerX, y, 'Iniciar partida', () => net.startGame(), {
        bgColor: COLORS.primary, bgHover: COLORS.ink, textColor: '#ffffff', fontSize: '17px',
        width: Math.min(300, this.layout.card.width - 48), height: 52, radius: RADIUS.md
      });
    }
    if ((!isHost || count < MIN_PLAYERS) && this.startButton) {
      this.startButton.bg.destroy();
      this.startButton.label.destroy();
      this.startButton = null;
    }
  }

  showMessage(message) { this.infoText?.setText(message); }

  startDemoRoom(name = 'Wicho') {
    const demoState = {
      phase: 'playing', timeRemaining: 455000, taskPercent: 0,
      tasks: [
        { id: 'reporte', name: 'Imprimir reporte', zone: 'recepcion', completed: false },
        { id: 'correos', name: 'Responder correos', zone: 'cubiculos', completed: false },
        { id: 'cafe', name: 'Preparar café', zone: 'cocina', completed: false },
        { id: 'archivos', name: 'Ordenar archivos', zone: 'archivo', completed: false },
        { id: 'wifi', name: 'Arreglar WiFi', zone: 'servidor', completed: false }
      ],
      players: [
        { id: 'demo-me', name, x: 220, y: 190, morale: 86, role: 'empleado', tasksCompleted: 1, burnout: false, secondaryObjectiveDone: false, cooldowns: { report_sabotage: 16000 } },
        { id: 'demo-jefe', name: 'La Jefa', x: 800, y: 470, morale: 100, role: 'jefe', tasksCompleted: 0, burnout: false, cooldowns: {} },
        { id: 'demo-ana', name: 'Ana', x: 560, y: 205, morale: 72, role: 'empleado', tasksCompleted: 1, burnout: false, cooldowns: {} },
        { id: 'demo-luis', name: 'Luis', x: 520, y: 455, morale: 95, role: 'empleado', tasksCompleted: 0, burnout: false, cooldowns: {} }
      ],
      activeSabotages: []
    };
    this.scene.stop('LobbyScene');
    this.scene.start('GameScene', { roomCode: 'DEMO', myId: 'demo-me', myRole: 'empleado', roleText: 'Reportar un sabotaje sin quemarte', demoState });
  }
}
