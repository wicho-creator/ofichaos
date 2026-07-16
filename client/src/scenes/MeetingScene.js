import * as net from '../systems/networking.js';
import { createButton, createPanel } from '../systems/ui.js';
import { COLORS, CSS_COLORS, FONT, drawOfficeBackdrop, meetingLayout, textStyle } from '../systems/theme.js';

export class MeetingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MeetingScene' });
    this.networkDisposers = [];
    this.playerCards = [];
    this.skipButton = null;
  }

  create(data = {}) {
    this.myId = data.myId;
    this.players = data.players || [];
    this.phase = 'meeting';
    this.secondsLeft = 60;
    this.hasVoted = false;
    this.playerCards = [];
    this.layout = meetingLayout(this.scale.width, this.scale.height, this.players.length);

    drawOfficeBackdrop(this, this.scale.width, this.scale.height, 'meeting');
    const { panel, titleY, timer, chat, input, mobile } = this.layout;
    createPanel(this, panel.x, panel.y, panel.width, panel.height, COLORS.white, {
      radius: 24, strokeColor: COLORS.border, strokeAlpha: 1
    });

    this.titleText = this.add.text(panel.x, titleY, mobile ? 'REUNIÓN DE EMERGENCIA' : '🚨 REUNIÓN DE EMERGENCIA', {
      fontFamily: FONT.display,
      fontSize: mobile ? '18px' : '26px',
      color: CSS_COLORS.sabotageAccessible,
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);

    this.timerBg = this.add.rectangle(timer.x, timer.y, timer.width, timer.height, COLORS.neutral).setStrokeStyle(1, COLORS.border);
    this.timerFill = this.add.rectangle(timer.x - timer.width / 2, timer.y, timer.width, timer.height, COLORS.task).setOrigin(0, 0.5);
    this.timerMaxWidth = timer.width;
    this.timerText = this.add.text(timer.x, timer.y + 17, '', textStyle(mobile ? 11 : 14, CSS_COLORS.ink, true, 'center')).setOrigin(0.5, 0);

    this.add.text(chat.x - chat.width / 2, chat.y - chat.height / 2 - 20, 'DISCUSIÓN', textStyle(12, CSS_COLORS.muted, true));
    this.add.text(this.layout.cards.x - this.layout.cards.width / 2, this.layout.cards.y - this.layout.cards.height / 2 - 20, 'EQUIPO', textStyle(12, CSS_COLORS.muted, true));
    this.createChat(chat, input);
    this.renderVotingArea();

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.secondsLeft > 0) this.secondsLeft--;
        this.updateTimerDisplay();
      }
    });
    this.setupSocketListeners();
    this.events.once('shutdown', () => this.cleanup());
    this.updateTimerDisplay();
  }

  createChat(chat, input) {
    const width = Math.round(chat.width);
    const height = Math.round(chat.height);
    this.chatBoxDOM = this.add.dom(chat.x, chat.y).createFromHTML(`
      <div id="meeting-chat-box" role="log" aria-live="polite" aria-label="Mensajes de la reunión" style="
        width:${width}px;height:${height}px;overflow-y:auto;box-sizing:border-box;padding:12px;
        background:#f8fafc;border:2px solid #15203a;border-radius:12px;
        font:13px/1.45 system-ui,-apple-system,sans-serif;color:#172554;
      "><div style="color:#64748b">Comparte hechos. Los roles siguen siendo secretos.</div></div>
    `).setOrigin(0.5);

    this.chatInputDOM = this.add.dom(input.x, input.y).createFromHTML(`
      <form id="meeting-chat-form" style="display:flex;gap:8px;width:${Math.round(input.width)}px;height:${Math.round(input.height)}px;box-sizing:border-box">
        <input id="chat-input" aria-label="Escribe tu argumento" maxlength="150" placeholder="¿Qué viste?" style="
          min-width:0;flex:1;padding:10px 12px;font:14px system-ui,sans-serif;color:#172554;
          background:#fff;border:2px solid #64748b;border-radius:10px;outline:none;box-sizing:border-box" />
        <button type="submit" style="min-width:76px;padding:0 12px;font:700 13px system-ui,sans-serif;color:#fff;
          background:#2563eb;border:2px solid #172554;border-radius:10px;cursor:pointer">Enviar</button>
      </form>
    `).setOrigin(0.5);
    const form = this.chatInputDOM.node.querySelector('form');
    form.onsubmit = (event) => { event.preventDefault(); this.sendChat(); };
  }

  setupSocketListeners() {
    net.disposeAll(this.networkDisposers);
    const on = (event, handler) => this.networkDisposers.push(net.subscribe(event, handler));

    on('meeting:chat', ({ playerName, message }) => this.appendChat(playerName, message));
    on('voting:started', () => {
      this.phase = 'voting';
      this.secondsLeft = 20;
      this.renderVotingArea();
      this.updateTimerDisplay();
      this.showFloatingText('¡Comienza la votación!', COLORS.task);
    });
    on('vote:confirmed', () => {
      this.hasVoted = true;
      this.renderVotingArea();
      this.showFloatingText('Voto registrado', COLORS.success);
    });
    on('voting:ended', (result) => {
      this.timerEvent?.destroy();
      this.showVotingResult(result);
      this.time.delayedCall(1600, () => {
        this.scene.stop('MeetingScene');
        this.scene.resume('GameScene');
      });
    });
  }

  appendChat(playerName, message) {
    const box = this.chatBoxDOM?.node?.querySelector('#meeting-chat-box');
    if (!box) return;
    const row = document.createElement('div');
    row.style.marginTop = '8px';
    row.style.wordBreak = 'break-word';
    const name = document.createElement('strong');
    name.textContent = `${playerName}: `;
    name.style.color = CSS_COLORS.primary;
    const text = document.createElement('span');
    text.textContent = message;
    row.append(name, text);
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
  }

  renderVotingArea() {
    this.playerCards.splice(0).forEach((card) => card.destroy());
    this.destroyButton(this.skipButton);
    this.skipButton = null;

    const { cards, visiblePlayers } = this.layout;
    this.players.slice(0, visiblePlayers).forEach((player, index) => {
      const col = index % cards.columns;
      const row = Math.floor(index / cards.columns);
      const x = cards.x + col * (cards.width + cards.gapX);
      const y = cards.y + row * (cards.height + cards.gapY);
      this.playerCards.push(this.createPlayerCard(player, x, y, cards.width, cards.height));
    });
    this.renderSkipCard();
  }

  createPlayerCard(player, x, y, width, height) {
    const elements = [];
    const panel = createPanel(this, x, y, width, height, COLORS.surface, {
      radius: 12,
      strokeColor: player.id === this.myId ? COLORS.primary : COLORS.border,
      strokeAlpha: 1
    });
    elements.push(panel);
    const left = x - width / 2 + 10;
    const name = this.add.text(left, y - height / 2 + 9, String(player.name || 'Jugador').slice(0, 14), textStyle(13, CSS_COLORS.ink, true));
    const state = this.add.text(left, y + 7, player.burnout ? 'BURNOUT' : 'ACTIVO', textStyle(10, player.burnout ? CSS_COLORS.sabotageAccessible : CSS_COLORS.success, true));
    elements.push(name, state);

    let button;
    if (player.id === this.myId) {
      elements.push(this.add.text(x + width / 2 - 12, y + 8, 'TÚ', textStyle(10, CSS_COLORS.primary, true)).setOrigin(1, 0.5));
    } else if (this.phase === 'voting' && !this.hasVoted) {
      const mobileVote = this.layout.mobile;
      button = createButton(this, x + width / 2 - (mobileVote ? 40 : 37), y + (mobileVote ? 7 : 9), 'VOTAR', () => this.castVote(player.id), {
        width: mobileVote ? 68 : 64,
        height: mobileVote ? 40 : 30,
        fontSize: '10px', bgColor: COLORS.sabotageAccessible, bgHover: COLORS.sabotage, radius: 9
      });
    } else {
      const label = this.hasVoted ? 'VOTADO' : 'HABLANDO';
      elements.push(this.add.text(x + width / 2 - 10, y + 9, label, textStyle(9, CSS_COLORS.muted, true)).setOrigin(1, 0.5));
    }
    return { destroy: () => { elements.forEach((element) => element?.destroy()); this.destroyButton(button); } };
  }

  renderSkipCard() {
    const { skip } = this.layout;
    const waiting = this.phase === 'meeting';
    const label = waiting ? 'LA VOTACIÓN ABRE EN BREVE' : this.hasVoted ? 'VOTO REGISTRADO' : 'OMITIR VOTO';
    this.skipButton = createButton(this, skip.x, skip.y, label, () => this.castVote('skip'), {
      width: skip.width,
      height: skip.height,
      fontSize: this.layout.mobile ? '11px' : '12px',
      bgColor: waiting || this.hasVoted ? COLORS.disabled : COLORS.primary,
      bgHover: COLORS.ink,
      textColor: '#ffffff',
      radius: 12
    });
    if (waiting || this.hasVoted) this.skipButton.hit.disableInteractive();
  }

  destroyButton(button) {
    if (!button) return;
    button.bg?.destroy();
    button.label?.destroy();
    button.hit?.destroy();
    button.shadow?.destroy();
  }

  updateTimerDisplay() {
    if (!this.timerFill) return;
    const duration = this.phase === 'voting' ? 20 : 60;
    this.timerFill.width = this.timerMaxWidth * Math.max(0, this.secondsLeft / duration);
    const phase = this.phase === 'voting' ? 'VOTACIÓN' : 'DISCUSIÓN';
    this.timerText.setText(`${phase} · ${this.secondsLeft}s`);
    this.timerText.setColor(this.phase === 'voting' ? CSS_COLORS.sabotageAccessible : CSS_COLORS.ink);
    this.timerFill.setFillStyle(this.phase === 'voting' ? COLORS.sabotageAccessible : COLORS.task);
  }

  castVote(targetId) {
    if (this.hasVoted || this.phase !== 'voting') return;
    net.castVote(targetId);
  }

  sendChat() {
    const input = this.chatInputDOM?.node?.querySelector('#chat-input');
    const message = input?.value.trim();
    if (!message) return;
    net.sendChat(message);
    input.value = '';
  }

  showVotingResult(result = {}) {
    this.chatBoxDOM?.setVisible(false);
    this.chatInputDOM?.setVisible(false);
    const width = Math.min(520, this.scale.width - 24);
    const height = Math.min(400, this.scale.height - 24);
    const x = this.scale.width / 2;
    const y = this.scale.height / 2;
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, COLORS.ink, 0.78).setOrigin(0).setDepth(2000);
    createPanel(this, x, y, width, height, COLORS.surface, { radius: 22, strokeColor: COLORS.border, strokeAlpha: 1 }).setDepth(2001);
    this.add.text(x, y - height / 2 + 34, 'RESULTADO DE LA VOTACIÓN', {
      fontFamily: FONT.display, fontSize: this.layout.mobile ? '17px' : '21px', color: CSS_COLORS.ink, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002);

    const nameOf = (id) => id === 'skip' ? 'Omitir' : this.players.find((player) => player.id === id)?.name || id;
    const tally = Object.entries(result.tally || {}).map(([id, count]) => `${nameOf(id)} · ${count}`).join('\n') || 'Sin votos registrados';
    this.add.text(x, y - 78, tally, {
      ...textStyle(14, CSS_COLORS.ink, false, 'center'), wordWrap: { width: width - 52 }
    }).setOrigin(0.5, 0).setDepth(2002);

    const sanctioned = result.sanctioned ? nameOf(result.sanctioned) : null;
    const outcome = sanctioned
      ? `${sanctioned}: ${result.sanctionType === 'suspend' ? 'SUSPENSIÓN' : 'BLOQUEO DE HABILIDAD'}`
      : 'SIN SANCIÓN · EMPATE O MAYORÍA INSUFICIENTE';
    const outcomeColor = sanctioned ? COLORS.sabotageAccessible : COLORS.success;
    createPanel(this, x, y + 88, width - 40, 70, sanctioned ? 0xffe4e6 : 0xdcfce7, {
      radius: 12, strokeColor: outcomeColor, strokeAlpha: 1
    }).setDepth(2002);
    this.add.text(x, y + 88, outcome, {
      ...textStyle(this.layout.mobile ? 12 : 14, sanctioned ? CSS_COLORS.sabotageAccessible : '#157a36', true, 'center'),
      wordWrap: { width: width - 68 }
    }).setOrigin(0.5).setDepth(2003);
    this.add.text(x, y + height / 2 - 34, 'Regresando a la oficina…', textStyle(12, CSS_COLORS.muted, true, 'center')).setOrigin(0.5).setDepth(2002);
  }

  showFloatingText(text, color = COLORS.task) {
    const toast = this.add.text(this.scale.width / 2, 100, text, {
      ...textStyle(this.layout.mobile ? 12 : 15, `#${color.toString(16).padStart(6, '0')}`, true, 'center'),
      backgroundColor: '#172554ee', padding: { x: 12, y: 6 }, wordWrap: { width: this.scale.width - 40 }
    }).setOrigin(0.5).setDepth(9999);
    this.tweens.add({ targets: toast, y: 82, alpha: 0, duration: 1800, onComplete: () => toast.destroy() });
  }

  cleanup() {
    net.disposeAll(this.networkDisposers);
    this.timerEvent?.destroy();
    this.playerCards.splice(0).forEach((card) => card.destroy());
    this.destroyButton(this.skipButton);
    this.chatBoxDOM?.destroy();
    this.chatInputDOM?.destroy();
  }
}
