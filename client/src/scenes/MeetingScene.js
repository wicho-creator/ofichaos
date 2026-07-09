// MeetingScene.js — Escena de reunión: chat de discusión + votación

import * as net from '../systems/networking.js';
import { createButton, createPanel, createText } from '../systems/ui.js';

export class MeetingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MeetingScene' });
    this.chatMessages = [];
    this.votes = {};
    this.myId = null;
    this.myRole = null;
    this.chatInputEl = null;
  }

  create(data) {
    this.cameras.main.setBackgroundColor('#0f172a');
    this.myId = data?.myId;
    this.myRole = data?.myRole;

    // Panel principal
    createPanel(this, this.scale.width / 2, this.scale.height / 2, 700, 600, 0x1e293b);
    createText(this, this.scale.width / 2, 50, '📋 REUNIÓN', { fontSize: '32px', color: '#fbbf24', bold: true }).setOrigin(0.5);
    this.timerText = createText(this, this.scale.width / 2, 90, '60s', { fontSize: '20px', color: '#ef4444', bold: true }).setOrigin(0.5);

    // Área de chat
    createText(this, this.scale.width / 2 - 300, 120, 'Chat de discusión:', { fontSize: '14px', color: '#94a3b8' });
    this.chatArea = createText(this, this.scale.width / 2 - 300, 145, '', { fontSize: '13px', color: '#e0e0e0', wrap: 580 }).setOrigin(0, 0);

    // Input de chat (HTML)
    const chatContainer = this.add.dom(this.scale.width / 2, 400).createFromHTML(
      '<div style="display:flex;gap:8px;">' +
      '<input id="chat-input" type="text" maxlength="200" placeholder="Escribe un mensaje..." style="flex:1;padding:8px;font-size:14px;background:#334155;color:#e0e0e0;border:2px solid #6366f1;border-radius:6px;width:500px;">' +
      '<button id="chat-send" style="padding:8px 16px;font-size:14px;background:#4c1d95;color:white;border:none;border-radius:6px;cursor:pointer;">Enviar</button>' +
      '</div>'
    );
    chatContainer.setOrigin(0.5);

    this.chatInputEl = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    if (sendBtn) {
      sendBtn.onclick = () => this.sendChat();
    }
    if (this.chatInputEl) {
      this.chatInputEl.onkeydown = (e) => {
        if (e.key === 'Enter') this.sendChat();
      };
    }

    // Área de votación
    createText(this, this.scale.width / 2 - 300, 460, 'Votación:', { fontSize: '14px', color: '#94a3b8' });
    this.votingArea = createText(this, this.scale.width / 2 - 300, 485, 'La votación se abrirá al terminar la discusión.', { fontSize: '13px', color: '#94a3b8' });

    // Listeners
    this.setupSocketListeners();

    // Timer
    this.time.addEvent({
      delay: 1000,
      repeat: 60,
      callback: () => {
        // Timer local aproximado
      }
    });
  }

  setupSocketListeners() {
    net.socket.on('meeting:chat', ({ playerName, message }) => {
      this.chatMessages.push(`${playerName}: ${message}`);
      if (this.chatMessages.length > 15) this.chatMessages.shift();
      if (this.chatArea) {
        this.chatArea.setText(this.chatMessages.join('\\n'));
      }
    });

    net.socket.on('voting:started', () => {
      this.showVotingUI();
    });

    net.socket.on('voting:ended', (result) => {
      this.showVotingResult(result);
    });

    net.socket.on('vote:confirmed', ({ targetId }) => {
      this.showFloatingText('Voto registrado', 0x4ade80);
    });

    net.socket.on('game:update', (gs) => {
      if (gs.phase === 'playing') {
        this.scene.stop('MeetingScene');
        this.scene.resume('GameScene');
      }
    });

    net.socket.on('game:ended', (data) => {
      this.scene.stop('MeetingScene');
      this.scene.start('EndScene', data);
    });
  }

  showVotingUI() {
    this.votingArea.setText('Vota por un jugador (o Skip):');
    // Mostrar botones de voto para cada jugador conocido
    const gameScene = this.scene.get('GameScene');
    const players = Object.values(gameScene.players || {});
    let btnY = 510;
    const voteButtons = [];
    for (const p of players) {
      if (p.id === this.myId) continue;
      const btn = createButton(this, this.scale.width / 2 - 200, btnY, `Votar: ${p.name}`, () => {
        net.castVote(p.id);
        voteButtons.forEach((b) => { b.bg.destroy(); b.label.destroy(); });
      }, { width: 180, height: 30, bgColor: 0x7c2d12, fontSize: '12px' });
      voteButtons.push(btn);
      btnY += 35;
    }
    // Skip
    const skipBtn = createButton(this, this.scale.width / 2 + 200, 510, 'Skip', () => {
      net.castVote('skip');
      voteButtons.forEach((b) => { b.bg.destroy(); b.label.destroy(); });
    }, { width: 120, height: 30, bgColor: 0x334155, fontSize: '12px' });
    voteButtons.push(skipBtn);
  }

  showVotingResult(result) {
    let text = 'Resultados de la votión:\n';
    if (result.tally) {
      for (const [target, count] of Object.entries(result.tally)) {
        text += `- ${target}: ${count} votos\n`;
      }
    }
    if (result.sanctioned) {
      text += `\n⚠ Sancionado: ${result.sanctioned} (${result.sanctionType})`;
    } else {
      text += '\n nadie fue sancionado';
    }
    this.votingArea.setText(text);
  }

  sendChat() {
    if (!this.chatInputEl) return;
    const msg = this.chatInputEl.value.trim();
    if (msg) {
      net.sendChat(msg);
      this.chatInputEl.value = '';
    }
  }

  showFloatingText(text, color = 0xffffff) {
    const ft = this.add.text(this.scale.width / 2, 120, text, {
      fontSize: '16px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      backgroundColor: '#00000088',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5);
    this.tweens.add({
      targets: ft,
      y: 80,
      alpha: 0,
      duration: 2000,
      onComplete: () => ft.destroy()
    });
  }
}
