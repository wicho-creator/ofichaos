// proposed_MeetingScene.js — Escena de reunión pulida: chat de discusión + votación
import * as net from '../systems/networking.js';
import { createButton, createPanel, createText } from '../systems/ui.js';

export class MeetingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MeetingScene' });
    this.chatMessages = [];
    this.votes = {};
    this.myId = null;
    this.myRole = null;
    
    // UI elements to destroy on shutdown
    this.chatBoxDOM = null;
    this.chatInputDOM = null;
    
    // State
    this.phase = 'meeting'; // 'meeting' (discussion) or 'voting'
    this.secondsLeft = 60;
    this.hasVoted = false;
    this.playerCards = [];
    this.skipButton = null;
  }

  create(data) {
    this.cameras.main.setBackgroundColor('#0b0f19');
    this.myId = data?.myId;
    this.myRole = data?.myRole;
    this.phase = 'meeting';
    this.secondsLeft = 60;
    this.hasVoted = false;
    this.playerCards = [];

    const panelW = 900;
    const panelH = 640;
    const panelX = this.scale.width / 2;
    const panelY = this.scale.height / 2;

    // 1. Panel Base Principal
    createPanel(this, panelX, panelY, panelW, panelH, 0x1e293b, { radius: 24, strokeColor: 0x4f46e5, strokeAlpha: 0.5 });
    
    // 2. Encabezado y Título
    this.titleText = createText(this, panelX, panelY - panelH / 2 + 40, '🚨 REUNIÓN DE EMERGENCIA', { 
      fontSize: '26px', 
      color: '#f59e0b', 
      bold: true 
    }).setOrigin(0.5);

    // 3. Barra de Progreso del Temporizador
    this.timerBg = this.add.rectangle(panelX, panelY - panelH / 2 + 80, 800, 10, 0x0f172a).setStrokeStyle(1, 0x334155);
    this.timerFill = this.add.rectangle(panelX - 400, panelY - panelH / 2 + 80, 800, 10, 0xfbbf24).setOrigin(0, 0.5);
    
    this.timerText = createText(this, panelX, panelY - panelH / 2 + 105, 'Fase: Discusión (60s)', { 
      fontSize: '15px', 
      color: '#cbd5e1', 
      bold: true 
    }).setOrigin(0.5);

    // Column coordinates
    const leftColX = panelX - panelW / 2 + 50;
    const rightColX = panelX + 50;

    // 4. Panel Izquierdo: Chat de Discusión
    createText(this, leftColX, panelY - panelH / 2 + 140, '💬 CHAT DE DISCUSIÓN', { 
      fontSize: '13px', 
      color: '#94a3b8', 
      bold: true 
    });

    // Chat Box DOM element (Scrollable)
    this.chatBoxDOM = this.add.dom(panelX - 225, panelY + 40).createFromHTML(`
      <div id="meeting-chat-box" style="
        width: 380px;
        height: 330px;
        overflow-y: auto;
        background: #0f172a;
        border: 2px solid #334155;
        border-radius: 8px;
        padding: 12px;
        box-sizing: border-box;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
        color: #cbd5e1;
        line-height: 1.5;
      "></div>
    `).setOrigin(0.5);

    // Chat Input DOM element
    this.chatInputDOM = this.add.dom(panelX - 225, panelY + 245).createFromHTML(`
      <div style="display: flex; gap: 8px; width: 380px; box-sizing: border-box;">
        <input id="chat-input" type="text" maxlength="150" placeholder="Escribe tu argumento..." style="
          flex: 1;
          padding: 10px;
          font-size: 13px;
          font-family: sans-serif;
          background: #1e293b;
          color: #f8fafc;
          border: 2px solid #475569;
          border-radius: 6px;
          outline: none;
        " />
        <button id="chat-send" style="
          padding: 10px 16px;
          font-size: 13px;
          font-weight: bold;
          font-family: sans-serif;
          background: #4f46e5;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        ">Enviar</button>
      </div>
    `).setOrigin(0.5);

    // Configurar eventos de Chat
    const chatInputEl = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    if (sendBtn) {
      sendBtn.onclick = () => this.sendChat();
    }
    if (chatInputEl) {
      chatInputEl.onkeydown = (e) => {
        if (e.key === 'Enter') this.sendChat();
      };
    }

    // 5. Panel Derecho: Área de Votación
    this.votingHeader = createText(this, rightColX, panelY - panelH / 2 + 140, '🗳️ VOTOS DE EXPULSIÓN', { 
      fontSize: '13px', 
      color: '#94a3b8', 
      bold: true 
    });

    const gameScene = this.scene.get('GameScene');
    const players = Object.values(gameScene.players || {});

    // Renderizar tarjetas de jugadores y botón de Skip
    this.renderPlayerCards(players, rightColX, panelY - 110);
    this.renderSkipCard(panelX + 225, panelY + 245);

    // Iniciar temporizador
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.secondsLeft > 0) {
          this.secondsLeft--;
          this.updateTimerDisplay();
        }
      }
    });

    // Configurar listeners de red
    this.setupSocketListeners();

    // Limpieza al salir de la escena
    this.events.on('shutdown', () => {
      if (this.timerEvent) this.timerEvent.destroy();
      if (this.chatBoxDOM) this.chatBoxDOM.destroy();
      if (this.chatInputDOM) this.chatInputDOM.destroy();
    });

    this.updateTimerDisplay();
  }

  setupSocketListeners() {
    // Al recibir un mensaje de chat de reunión
    net.socket.off('meeting:chat');
    net.socket.on('meeting:chat', ({ playerId, playerName, message }) => {
      const chatBox = document.getElementById('meeting-chat-box');
      if (chatBox) {
        // Encontrar el color por rol
        const gameScene = this.scene.get('GameScene');
        const player = gameScene.players[playerId];
        const role = player?.role || 'empleado';
        
        const roleColors = { 
          jefe: '#ef4444', 
          lamebotas: '#facc15', 
          empleado: '#4ade80' 
        };
        const userColor = roleColors[role] || '#60a5fa';

        const msgDiv = document.createElement('div');
        msgDiv.style.marginBottom = '8px';
        msgDiv.style.wordBreak = 'break-word';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = playerName;
        nameSpan.style.color = userColor;
        nameSpan.style.fontWeight = 'bold';

        const separator = document.createTextNode(': ');

        const textSpan = document.createElement('span');
        textSpan.textContent = message;
        textSpan.style.color = '#e2e8f0';

        msgDiv.appendChild(nameSpan);
        msgDiv.appendChild(separator);
        msgDiv.appendChild(textSpan);
        chatBox.appendChild(msgDiv);
        
        // Desplazamiento automático al final
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    });

    // Cuando se abre el periodo de votación
    net.socket.off('voting:started');
    net.socket.on('voting:started', () => {
      this.phase = 'voting';
      this.secondsLeft = 20; // Reajustar a duración de votación (20s)
      this.updateTimerDisplay();
      this.showFloatingText('📊 ¡Comienza la votación!', 0xf59e0b);
      
      // Re-renderizar tarjetas para habilitar botones
      const gameScene = this.scene.get('GameScene');
      const players = Object.values(gameScene.players || {});
      const panelW = 900;
      const panelX = this.scale.width / 2;
      const panelY = this.scale.height / 2;
      const rightColX = panelX + 50;

      this.playerCards.forEach(card => card.destroy());
      this.playerCards = [];
      if (this.skipButton) {
        this.skipButton.bg.destroy();
        this.skipButton.label.destroy();
        this.skipButton.hit.destroy();
        if (this.skipButton.shadow) this.skipButton.shadow.destroy();
      }

      this.renderPlayerCards(players, rightColX, panelY - 110);
      this.renderSkipCard(panelX + 225, panelY + 245);
    });

    // Cuando termina la votación
    net.socket.off('voting:ended');
    net.socket.on('voting:ended', (result) => {
      if (this.timerEvent) this.timerEvent.destroy();
      this.showVotingResult(result);
    });

    // Confirmación del voto emitido por mí
    net.socket.off('vote:confirmed');
    net.socket.on('vote:confirmed', ({ targetId }) => {
      this.hasVoted = true;
      this.showFloatingText('Voto registrado', 0x4ade80);
      
      // Re-renderizar para deshabilitar los botones de votación
      const gameScene = this.scene.get('GameScene');
      const players = Object.values(gameScene.players || {});
      const panelW = 900;
      const panelX = this.scale.width / 2;
      const panelY = this.scale.height / 2;
      const rightColX = panelX + 50;

      this.playerCards.forEach(card => card.destroy());
      this.playerCards = [];
      if (this.skipButton) {
        this.skipButton.bg.destroy();
        this.skipButton.label.destroy();
        this.skipButton.hit.destroy();
        if (this.skipButton.shadow) this.skipButton.shadow.destroy();
      }

      this.renderPlayerCards(players, rightColX, panelY - 110);
      this.renderSkipCard(panelX + 225, panelY + 245);
    });

    // Volver a la escena de juego
    net.socket.off('game:update');
    net.socket.on('game:update', (gs) => {
      if (gs.phase === 'playing') {
        this.scene.stop('MeetingScene');
        this.scene.resume('GameScene');
      }
    });

    net.socket.off('game:ended');
    net.socket.on('game:ended', (data) => {
      this.scene.stop('MeetingScene');
      this.scene.start('EndScene', data);
    });
  }

  updateTimerDisplay() {
    const duration = this.phase === 'voting' ? 20 : 60;
    const ratio = Math.max(0, this.secondsLeft / duration);
    this.timerFill.width = 800 * ratio;

    const phaseText = this.phase === 'voting' ? 'VOTACIÓN' : 'DISCUSIÓN';
    const color = this.phase === 'voting' ? '#ef4444' : '#fbbf24';
    this.timerText.setText(`⏱ Fase: ${phaseText} (${this.secondsLeft}s)`);
    this.timerText.setColor(color);
  }

  renderPlayerCards(players, startX, startY) {
    const cardW = 180;
    const cardH = 75;
    const gapX = 20;
    const gapY = 15;

    const roleNames = { jefe: 'Jefe 👔', lamebotas: 'Lamebotas 🤡', empleado: 'Empleado 🛠' };
    const roleColors = { jefe: '#ef4444', lamebotas: '#facc15', empleado: '#4ade80' };

    players.forEach((p, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cardX = startX + col * (cardW + gapX) + cardW / 2;
      const cardY = startY + row * (cardH + gapY) + cardH / 2;

      // Crear un contenedor de Phaser para agrupar visualmente la tarjeta
      const cardContainer = this.add.container(cardX, cardY);
      this.playerCards.push(cardContainer);

      // Fondo de la tarjeta
      const bg = this.add.rectangle(0, 0, cardW, cardH, 0x0f172a).setStrokeStyle(2, p.id === this.myId ? 0x6366f1 : 0x334155);
      cardContainer.add(bg);

      // Nombre
      const nameText = this.add.text(-80, -22, p.name, {
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold'
      });
      cardContainer.add(nameText);

      // Badge de Rol
      const badgeText = roleNames[p.role] || 'Empleado 🛠';
      const badgeColor = roleColors[p.role] || '#94a3b8';
      const roleText = this.add.text(-80, -2, badgeText, {
        fontSize: '10px',
        color: badgeColor,
        fontStyle: 'bold'
      });
      cardContainer.add(roleText);

      // Botón o Etiqueta de Voto
      if (p.id === this.myId) {
        // Nosotros
        const selfText = this.add.text(45, 12, '[ TÚ ]', {
          fontSize: '11px',
          color: '#6366f1',
          fontStyle: 'bold'
        }).setOrigin(0.5);
        cardContainer.add(selfText);
      } else {
        if (this.phase === 'meeting') {
          // Fase discusión: no se puede votar todavía
          const statusText = this.add.text(45, 12, '💬 Hablando', {
            fontSize: '11px',
            color: '#64748b'
          }).setOrigin(0.5);
          cardContainer.add(statusText);
        } else {
          // Fase votación
          if (this.hasVoted) {
            // Ya votamos: deshabilitado
            const statusText = this.add.text(45, 12, '🔒 Votado', {
              fontSize: '11px',
              color: '#475569',
              fontStyle: 'bold'
            }).setOrigin(0.5);
            cardContainer.add(statusText);
          } else {
            // Se puede votar por este jugador
            const voteBtn = createButton(this, 45, 12, 'Votar', () => {
              this.castVote(p.id);
            }, { 
              width: 70, 
              height: 26, 
              fontSize: '11px', 
              bgColor: 0x7c2d12, 
              bgHover: 0xef4444,
              radius: 6
            });
            // Añadir los componentes visuales del botón al contenedor (devolviendo origen local)
            // Ya que el botón usa coordenadas globales en createButton, modificamos su posición relativa
            voteBtn.bg.x = 45;
            voteBtn.bg.y = 12;
            voteBtn.label.x = 45;
            voteBtn.label.y = 11;
            voteBtn.hit.x = cardX + 45;
            voteBtn.hit.y = cardY + 12;
            
            cardContainer.add(voteBtn.bg);
            cardContainer.add(voteBtn.label);
            
            // Registrar los gráficos para que se destruyan en cascada
            cardContainer.on('destroy', () => {
              voteBtn.bg?.destroy();
              voteBtn.label?.destroy();
              voteBtn.hit?.destroy();
              if (voteBtn.shadow) voteBtn.shadow.destroy();
            });
          }
        }
      }
    });
  }

  renderSkipCard(x, y) {
    if (this.phase === 'meeting') {
      this.skipButton = createButton(this, x, y, 'Esperando fin de discusión...', () => {}, { 
        width: 380, 
        height: 38, 
        fontSize: '12px', 
        bgColor: 0x1e293b,
        textColor: '#64748b'
      });
      this.skipButton.hit.disableInteractive();
    } else if (this.hasVoted) {
      this.skipButton = createButton(this, x, y, '✓ Voto registrado', () => {}, { 
        width: 380, 
        height: 38, 
        fontSize: '12px', 
        bgColor: 0x1e293b,
        textColor: '#10b981'
      });
      this.skipButton.hit.disableInteractive();
    } else {
      this.skipButton = createButton(this, x, y, '🗳️ Omitir Voto (Skip)', () => {
        this.castVote('skip');
      }, { 
        width: 380, 
        height: 38, 
        fontSize: '12px', 
        bgColor: 0x475569, 
        bgHover: 0x64748b 
      });
    }
  }

  castVote(targetId) {
    if (this.hasVoted || this.phase !== 'voting') return;
    net.castVote(targetId);
  }

  showVotingResult(result) {
    const panelX = this.scale.width / 2;
    const panelY = this.scale.height / 2;
    const gameScene = this.scene.get('GameScene');

    // 1. Overlay oscuro bloqueante
    const overlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.8)
      .setOrigin(0, 0)
      .setDepth(2000);

    // 2. Panel de Resultados
    const resultsPanel = createPanel(this, panelX, panelY, 520, 440, 0x0f172a, { 
      strokeColor: 0xfbbf24, 
      strokeAlpha: 0.8, 
      radius: 24 
    });
    resultsPanel.setDepth(2001);

    // 3. Título
    const titleText = createText(this, panelX, panelY - 170, '📊 RESULTADOS DE LA VOTACIÓN', { 
      fontSize: '20px', 
      color: '#fbbf24', 
      bold: true 
    }).setOrigin(0.5).setDepth(2002);

    // 4. Detalle de los votos recibidos
    let tallyStr = '';
    if (result.tally) {
      for (const [targetId, count] of Object.entries(result.tally)) {
        const player = gameScene.players[targetId];
        const name = player ? player.name : targetId;
        const countText = count === 1 ? 'voto' : 'votos';
        tallyStr += `• ${name}: ${count} ${countText}\n`;
      }
    }
    if (!tallyStr) {
      tallyStr = 'No se registraron votos por ningún jugador.\n';
    }

    const tallyText = createText(this, panelX, panelY - 80, tallyStr, {
      fontSize: '14px',
      color: '#e2e8f0',
      align: 'center',
      wrap: 440
    }).setOrigin(0.5, 0).setDepth(2002);

    // 5. Destacar Sanción
    let sanctionStr = '';
    let sanctionBgColor = 0x1e293b;
    let sanctionStrokeColor = 0x475569;

    if (result.sanctioned) {
      const player = gameScene.players[result.sanctioned];
      const name = player ? player.name : result.sanctioned;
      const type = result.sanctionType === 'suspend' ? 'SUSPENDIDO (EXPULSADO)' : result.sanctionType;
      sanctionStr = `⚠️ SANCIÓN: ${name} ha sido ${type}`;
      sanctionBgColor = 0x7f1d1d; // Dark red
      sanctionStrokeColor = 0xef4444; // Red
    } else {
      sanctionStr = '🕊️ SIN SANCIÓN: Votos insuficientes o empate';
      sanctionBgColor = 0x064e3b; // Dark green
      sanctionStrokeColor = 0x10b981; // Green
    }

    const sanctionBox = createPanel(this, panelX, panelY + 110, 440, 60, sanctionBgColor, { 
      radius: 12, 
      strokeColor: sanctionStrokeColor, 
      strokeAlpha: 0.8 
    });
    sanctionBox.setDepth(2002);

    const sanctionText = createText(this, panelX, panelY + 110, sanctionStr, {
      fontSize: '14px',
      color: '#ffffff',
      bold: true
    }).setOrigin(0.5).setDepth(2003);

    // 6. Mensaje de cierre de reunión
    const closeText = createText(this, panelX, panelY + 185, 'Regresando a la oficina...', {
      fontSize: '12px',
      color: '#94a3b8',
      bold: true
    }).setOrigin(0.5).setDepth(2002);
  }

  sendChat() {
    const chatInputEl = document.getElementById('chat-input');
    if (!chatInputEl) return;
    const msg = chatInputEl.value.trim();
    if (msg) {
      net.sendChat(msg);
      chatInputEl.value = '';
    }
  }

  showFloatingText(text, color = 0xffffff) {
    const ft = this.add.text(this.scale.width / 2, 120, text, {
      fontSize: '16px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold',
      backgroundColor: '#000000aa',
      padding: { x: 14, y: 6 },
      shadow: { fill: true, blur: 2, y: 1 }
    }).setOrigin(0.5).setDepth(9999);
    
    this.tweens.add({
      targets: ft,
      y: 90,
      alpha: 0,
      duration: 2000,
      onComplete: () => ft.destroy()
    });
  }
}
