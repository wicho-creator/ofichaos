// index.js — Servidor principal: Express + Socket.IO para OfiChaos

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const roomManager = require('./roomManager');
const sabotage = require('./sabotage');
const { updateSecondaryObjectives } = require('./gameState');
const { projectPublic, projectPrivate, projectRuntimePrivate, projectTick, projectFinal } = require('./projections');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Servir archivos estáticos del cliente
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// --- Socket.IO ---

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} conectado`);

  let currentRoom = null;
  let playerId = socket.id;
  const text = (value, fallback = '') => typeof value === 'string' ? value : fallback;

  // Crear sala
  socket.on('room:create', (payload) => {
    const { name } = payload || {};
    const playerName = text(name).slice(0, 12) || 'Jugador';
    const roomsObj = roomManager.getAllRooms();
    for (const rCode of Object.keys(roomsObj)) {
      if (roomsObj[rCode].players[playerId]) {
        roomManager.leaveRoom(rCode, playerId);
        socket.leave(rCode);
        io.to(rCode).emit('room:update', getRoomPayload(rCode));
        io.to(rCode).emit('game:update', getGamePayload(rCode));
      }
    }
    const room = roomManager.createRoom(playerId, playerName);
    currentRoom = room.code;
    socket.join(currentRoom);
    socket.emit('room:created', { code: currentRoom, playerId });
    io.to(currentRoom).emit('room:update', getRoomPayload(currentRoom));
    console.log(`[ROOM] ${playerName} creó sala ${currentRoom}`);
  });

  // Unirse a sala
  socket.on('room:join', (payload) => {
    const { code, name } = payload || {};
    const playerName = text(name).slice(0, 12) || 'Jugador';
    const targetCode = text(code).toUpperCase();
    const validation = roomManager.validateJoinRoom(targetCode, playerId);
    if (validation) {
      socket.emit('error:message', { message: validation.error });
      return;
    }
    const roomsObj = roomManager.getAllRooms();
    for (const rCode of Object.keys(roomsObj)) {
      if (rCode !== targetCode && roomsObj[rCode].players[playerId]) {
        roomManager.leaveRoom(rCode, playerId);
        socket.leave(rCode);
        io.to(rCode).emit('room:update', getRoomPayload(rCode));
        io.to(rCode).emit('game:update', getGamePayload(rCode));
      }
    }
    const result = roomManager.joinRoom(targetCode, playerId, playerName);
    currentRoom = targetCode;
    socket.join(currentRoom);
    socket.emit('room:joined', { code: currentRoom, playerId });
    io.to(currentRoom).emit('room:update', getRoomPayload(currentRoom));
    console.log(`[ROOM] ${playerName} se unió a sala ${currentRoom}`);
  });

  // Iniciar partida (solo host)
  socket.on('game:start', () => {
    if (!currentRoom) return;
    const room = roomManager.getRoom(currentRoom);
    if (!room || room.hostId !== playerId) {
      socket.emit('error:message', { message: 'Solo el host puede iniciar' });
      return;
    }
    const result = roomManager.startGameInRoom(currentRoom);
    if (result.error) {
      socket.emit('error:message', { message: result.error });
      return;
    }

    // Enviar a cada jugador su rol secreto
    for (const pid of Object.keys(room.players)) {
      const p = room.players[pid];
      io.to(pid).emit('game:role', projectPrivate(p));
    }

    // En estado de juego inicial a todos
    io.to(currentRoom).emit('game:started', getGamePayload(currentRoom));
    console.log(`[GAME] Partida iniciada en sala ${currentRoom}`);
  });

  // Movimiento de jugador
  socket.on('player:move', (payload) => {
    if (!currentRoom) return;
    const { x, y } = payload || {};
    const result = roomManager.movePlayerFromClient(currentRoom, playerId, x, y);
    const p = result.player;
    if (p && result.moved) {
      socket.to(currentRoom).emit('player:moved', { playerId, x: p.x, y: p.y });
    }
    if (p && (p.x !== x || p.y !== y)) {
      socket.emit('player:moved', { playerId, x: p.x, y: p.y });
    }
  });

  const emitTaskCompleted = (taskId) => {
    io.to(currentRoom).emit('task:completed', {
      taskId,
      playerName: roomManager.getRoom(currentRoom).players[playerId].name
    });
    io.to(currentRoom).emit('game:update', getGamePayload(currentRoom));
  };

  socket.on('task:start', (payload, reply = () => {}) => {
    if (!currentRoom) return;
    const { taskId } = payload || {};
    const result = roomManager.startTaskSession(currentRoom, playerId, taskId);
    if (typeof reply === 'function') reply(result);
  });

  socket.on('task:action', (payload, reply = () => {}) => {
    if (!currentRoom) return;
    const { sessionId, action } = payload || {};
    const result = roomManager.applyTaskAction(currentRoom, playerId, sessionId, action);
    if (typeof reply === 'function') reply(result);
    if (result.completed) emitTaskCompleted(result.task.id);
  });

  // Compatibilidad fail-closed: el taskId por sí solo nunca completa un minijuego.
  socket.on('task:complete', (payload) => {
    if (!currentRoom) return;
    const { taskId } = payload || {};
    const result = roomManager.completeTask(currentRoom, playerId, taskId);
    if (result.success) emitTaskCompleted(taskId);
    else socket.emit('error:message', { message: result.error });
  });

  // Sabotaje (jefe/lamebotas)
  socket.on('sabotage:zone', (payload) => {
    if (!currentRoom) return;
    const { zoneId } = payload || {};
    const room = roomManager.getRoom(currentRoom);
    if (!room || !room.gameState) return;
    const p = room.players[playerId];
    if (!p || (p.role !== 'jefe' && p.role !== 'lamebotas')) return;

    if (!canUseAbility(socket, room, playerId, 'zone')) return;
    const result = sabotage.sabotageZone(room, zoneId, playerId);
    if (!result) return socket.emit('error:message', { message: 'Zona inválida' });
    markAbilityUsed(room, playerId, 'zone');
    io.to(currentRoom).emit('sabotage:triggered', {
      type: 'zone',
      zoneId,
      expires: Date.now() + 20000
    });
    io.to(currentRoom).emit('game:update', getGamePayload(currentRoom));
    console.log(`[SABOTAGE] ${p.name} saboteó zona ${zoneId}`);
  });

  socket.on('sabotage:extra_task', (payload) => {
    if (!currentRoom) return;
    const { targetId } = payload || {};
    const room = roomManager.getRoom(currentRoom);
    if (!room || !room.gameState) return;
    const p = room.players[playerId];
    if (!p || p.role !== 'jefe') return;

    if (!canUseAbility(socket, room, playerId, 'extra_task')) return;
    const result = sabotage.assignExtraTask(room, targetId, playerId);
    if (!result) return socket.emit('error:message', { message: 'Objetivo inválido' });
    markAbilityUsed(room, playerId, 'extra_task');
    io.to(targetId).emit('sabotage:extra_task', {});
    io.to(currentRoom).emit('game:update', getGamePayload(currentRoom));
  });

  socket.on('sabotage:morale', (payload) => {
    if (!currentRoom) return;
    const { targetId } = payload || {};
    const room = roomManager.getRoom(currentRoom);
    if (!room || !room.gameState) return;
    const p = room.players[playerId];
    if (!p || p.role !== 'jefe') return;

    if (!canUseAbility(socket, room, playerId, 'lower_morale')) return;
    const result = sabotage.lowerMorale(room, targetId, playerId);
    if (!result) return socket.emit('error:message', { message: 'Objetivo inválido' });
    markAbilityUsed(room, playerId, 'lower_morale');
    io.to(targetId).emit('sabotage:morale', {});
    io.to(currentRoom).emit('game:update', getGamePayload(currentRoom));
  });

  socket.on('sabotage:close_door', (payload) => {
    if (!currentRoom) return;
    const { doorId } = payload || {};
    const room = roomManager.getRoom(currentRoom);
    if (!room || !room.gameState) return;
    const p = room.players[playerId];
    if (!p || p.role !== 'jefe') return;

    if (!canUseAbility(socket, room, playerId, 'close_door')) return;
    const result = sabotage.closeDoor(room, doorId, playerId);
    if (!result) return socket.emit('error:message', { message: 'Puerta inválida' });
    markAbilityUsed(room, playerId, 'close_door');
    io.to(currentRoom).emit('sabotage:door_closed', {
      doorId: result.doorId,
      zoneId: result.zoneId,
      expires: result.expires
    });
    io.to(currentRoom).emit('game:update', getGamePayload(currentRoom));
  });


  socket.on('sabotage:fake_task', () => {
    if (!currentRoom) return;
    const room = roomManager.getRoom(currentRoom);
    if (!room || !room.gameState) return;
    const p = room.players[playerId];
    if (!p || p.role !== 'lamebotas') return;
    if (!canUseAbility(socket, room, playerId, 'fake_task')) return;
    markAbilityUsed(room, playerId, 'fake_task');
    const result = sabotage.fakeTask(room, playerId);
    updateSecondaryObjectives(room);
    socket.emit('sabotage:fake_task', result);
    io.to(currentRoom).emit('sabotage:triggered', { type: 'fake_task' });
    io.to(currentRoom).emit('game:update', getGamePayload(currentRoom));
  });

  socket.on('sabotage:false_report', () => {
    if (!currentRoom) return;
    const room = roomManager.getRoom(currentRoom);
    if (!room || !room.gameState) return;
    const p = room.players[playerId];
    if (!p || p.role !== 'lamebotas') return;
    if (!canUseAbility(socket, room, playerId, 'false_report')) return;
    markAbilityUsed(room, playerId, 'false_report');
    sabotage.falseReport(room, playerId);
    updateSecondaryObjectives(room);
    io.to(currentRoom).emit('sabotage:false_report', {});
    io.to(currentRoom).emit('game:update', getGamePayload(currentRoom));
  });

  socket.on('sabotage:block_task', (payload) => {
    if (!currentRoom) return;
    const { taskId } = payload || {};
    const room = roomManager.getRoom(currentRoom);
    if (!room || !room.gameState) return;
    const p = room.players[playerId];
    if (!p || p.role !== 'lamebotas') return;
    if (!canUseAbility(socket, room, playerId, 'block_task')) return;
    const result = sabotage.blockTask(room, taskId, playerId);
    if (!result) {
      socket.emit('error:message', { message: 'No se pudo bloquear esa tarea' });
      return;
    }
    markAbilityUsed(room, playerId, 'block_task');
    updateSecondaryObjectives(room);
    io.to(currentRoom).emit('sabotage:block_task', result);
    io.to(currentRoom).emit('game:update', getGamePayload(currentRoom));
  });


  socket.on('sabotage:report', () => {
    if (!currentRoom) return;
    const room = roomManager.getRoom(currentRoom);
    if (!room || !room.gameState) return;
    const p = room.players[playerId];
    if (!p || p.role !== 'empleado') return;
    if (!canUseAbility(socket, room, playerId, 'report_sabotage')) return;
    const reported = sabotage.findReportableSabotage(room, playerId);
    if (!reported) {
      socket.emit('error:message', { message: 'No hay sabotaje cercano para reportar' });
      return;
    }
    const result = roomManager.callMeeting(currentRoom, playerId);
    if (result.success) {
      markAbilityUsed(room, playerId, 'report_sabotage');
      io.to(currentRoom).emit('sabotage:reported', {
        reportedBy: playerId,
        playerName: p.name,
        sabotageType: reported.type,
        zoneId: reported.zoneId,
        taskId: reported.taskId
      });
      io.to(currentRoom).emit('meeting:started', { calledBy: playerId, playerName: p.name });
      io.to(currentRoom).emit('game:update', getGamePayload(currentRoom));
    } else {
      socket.emit('error:message', { message: result.error });
    }
  });

  // Llamar reunión
  socket.on('meeting:call', () => {
    if (!currentRoom) return;
    const result = roomManager.callMeeting(currentRoom, playerId);
    if (result.success) {
      io.to(currentRoom).emit('meeting:started', {
        calledBy: playerId,
        playerName: roomManager.getRoom(currentRoom).players[playerId].name
      });
      io.to(currentRoom).emit('game:update', getGamePayload(currentRoom));
    } else {
      socket.emit('error:message', { message: result.error });
    }
  });

  // Chat de reunión
  socket.on('meeting:chat', (payload) => {
    if (!currentRoom) return;
    const { message } = payload || {};
    const room = roomManager.getRoom(currentRoom);
    if (!room || !room.gameState || room.gameState.phase !== 'meeting') return;
    const p = room.players[playerId];
    if (!p) return;
    io.to(currentRoom).emit('meeting:chat', {
      playerId,
      playerName: p.name,
      message: text(message).slice(0, 200)
    });
  });

  // Votar
  socket.on('vote:cast', (payload) => {
    if (!currentRoom) return;
    const { targetId } = payload || {};
    const result = roomManager.votePlayer(currentRoom, playerId, targetId);
    if (result.success) {
      socket.emit('vote:confirmed', { targetId });
    } else {
      socket.emit('error:message', { message: result.error });
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id} desconectado`);
    if (currentRoom) {
      roomManager.leaveRoom(currentRoom, playerId);
      socket.to(currentRoom).emit('room:update', getRoomPayload(currentRoom));
      io.to(currentRoom).emit('game:update', getGamePayload(currentRoom));
    }
  });
});

// --- Game loop (tick cada 1 segundo) ---
setInterval(() => {
  const rooms = roomManager.getAllRooms();
  for (const code of Object.keys(rooms)) {
    const room = rooms[code];
    if (!room.gameState || room.gameState.phase === 'lobby' || room.gameState.phase === 'ended')
      continue;

    const result = roomManager.tickRoom(code);

    if (result) {
      if (result.winners) {
        // Fin de partida
        io.to(code).emit('game:ended', getEndPayload(code, result));
        console.log(`[GAME] Partida terminada en sala ${code}: ${result.winners}`);
      } else if (result.event === 'voting_started') {
        io.to(code).emit('voting:started', {});
        io.to(code).emit('game:update', getGamePayload(code));
      } else if (result.event === 'voting_ended') {
        io.to(code).emit('voting:ended', result.result);
        io.to(code).emit('game:update', getGamePayload(code));
      }
    }

    // Broadcast periódico del estado de juego
    if (room.gameState && room.gameState.phase === 'playing') {
      io.to(code).emit('game:tick', projectTick(room));
      for (const player of Object.values(room.players)) {
        io.to(player.id).emit('game:private', projectRuntimePrivate(player));
      }
    }
  }
}, 1000);


function canUseAbility(socket, room, playerId, ability) {
  const player = room.players[playerId];
  if (room.gameState?.phase !== 'playing') {
    socket.emit('error:message', { message: 'Habilidad no permitida en esta fase' });
    return false;
  }
  if (player.suspendedUntil && Date.now() < player.suspendedUntil) {
    socket.emit('error:message', { message: 'Habilidad bloqueada: Estás suspendido.' });
    return false;
  }
  if (player.abilityBlockedUntil && Date.now() < player.abilityBlockedUntil) {
    socket.emit('error:message', { message: 'Habilidad bloqueada temporalmente' });
    return false;
  }
  const cd = sabotage.checkCooldown(player, ability);
  if (!cd.ok) {
    socket.emit('error:message', { message: `Habilidad en cooldown: ${Math.ceil(cd.remainingMs / 1000)}s` });
    return false;
  }
  return true;
}

function markAbilityUsed(room, playerId, ability) {
  const p = room.players[playerId];
  const readyAt = sabotage.startCooldown(p, ability);
  return readyAt;
}

// --- Helpers para payloads ---

function getRoomPayload(code) {
  const room = roomManager.getRoom(code);
  if (!room) return null;
  return {
    code: room.code,
    hostId: room.hostId,
    players: Object.values(room.players).map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready
    }))
  };
}

function getGamePayload(code) {
  const room = roomManager.getRoom(code);
  return projectPublic(room);
}

function getEndPayload(code, result) {
  const room = roomManager.getRoom(code);
  return projectFinal(room, result);
}

function getTaskPercent(code) {
  const room = roomManager.getRoom(code);
  if (!room || !room.gameState) return 0;
  const tasks = room.gameState.taskStates;
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);
}

server.listen(PORT, () => {
  console.log(`[OFICHAOS] Servidor corriendo en http://localhost:${PORT}`);
});
