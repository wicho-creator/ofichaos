// roomManager.js — Gestión de salas privadas con códigos

const { startGame, tickGame, startMeeting, startVoting, castVote, endVoting } = require('./gameState');

const rooms = {}; // roomCode -> room

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms[code]);
  return code;
}

function createRoom(playerId, playerName) {
  const code = generateRoomCode();
  rooms[code] = {
    code,
    hostId: playerId,
    players: {},
    gameState: null,
    createdAt: Date.now()
  };
  rooms[code].players[playerId] = {
    id: playerId,
    name: playerName,
    role: null,
    x: 600,
    y: 450,
    vx: 0,
    vy: 0,
    morale: 100,
    ready: false
  };
  return rooms[code];
}

function joinRoom(code, playerId, playerName) {
  const room = rooms[code];
  if (!room) return null;
  if (room.gameState && room.gameState.phase !== 'lobby') {
    return { error: 'La partida ya empezó' };
  }
  if (Object.keys(room.players).length >= 12) {
    return { error: 'Sala llena' };
  }
  room.players[playerId] = {
    id: playerId,
    name: playerName,
    role: null,
    x: 600,
    y: 450,
    vx: 0,
    vy: 0,
    morale: 100,
    ready: false
  };
  return room;
}

function leaveRoom(code, playerId) {
  const room = rooms[code];
  if (!room) return false;
  delete room.players[playerId];
  // Si el host se va, asignar nuevo host
  if (room.hostId === playerId) {
    const remaining = Object.keys(room.players);
    if (remaining.length > 0) {
      room.hostId = remaining[0];
    } else {
      delete rooms[code];
      return false; // sala eliminada
    }
  }
  return true;
}

function getRoom(code) {
  return rooms[code];
}

function getAllRooms() {
  return rooms;
}

// --- Acciones de gioco ---

function startGameInRoom(code) {
  const room = rooms[code];
  if (!room) return { error: 'Sala no encontrada' };
  const playerCount = Object.keys(room.players).length;
  if (playerCount < 4) {
    return { error: 'Se necesitan mínimo 4 jugadores' };
  }
  startGame(room);
  return room;
}

function movePlayer(code, playerId, x, y) {
  const room = rooms[code];
  if (!room || !room.players[playerId]) return null;
  const p = room.players[playerId];
  // No permitir movimiento si está en burnout o reunión o suspendido
  if (room.gameState && room.gameState.phase === 'meeting') return p;
  if (room.gameState && room.gameState.phase === 'voting') return p;
  if (p.burnoutUntil && Date.now() < p.burnoutUntil) {
    // Movimiento lento: reducir desplazamiento a la mitad
    p.x = x * 0.5 + p.x * 0.5;
    p.y = y * 0.5 + p.y * 0.5;
  } else {
    p.x = x;
    p.y = y;
  }
  return p;
}

function completeTask(code, playerId, taskId) {
  const room = rooms[code];
  if (!room || !room.gameState) return { error: 'No hay partida activa' };
  const task = room.gameState.taskStates.find((t) => t.id === taskId);
  if (!task || task.completed) return { error: 'Tarea no disponible' };
  const p = room.players[playerId];
  if (!p) return { error: 'Jugador no encontrado' };
  if (p.burnoutUntil && Date.now() < p.burnoutUntil) return { error: 'En burnout' };

  task.completed = true;
  task.completedBy = playerId;
  p.tasksCompleted = (p.tasksCompleted || 0) + 1;
  p.morale = Math.min(100, p.morale + 5);
  room.gameState.points[playerId] = (room.gameState.points[playerId] || 0) + 10;

  return { success: true, task };
}

function callMeeting(code, playerId) {
  const room = rooms[code];
  if (!room || !room.gameState) return { error: 'No hay partida' };
  if (room.gameState.phase !== 'playing') return { error: 'No se puede iniciar reunión ahora' };
  const p = room.players[playerId];
  if (!p) return { error: 'Jugador no encontrado' };
  const assignment = room.gameState.roleAssignments[playerId];
  if (assignment && assignment.meetingCalled) {
    return { error: 'Ya usaste tu reunión' };
  }
  startMeeting(room, playerId);
  return { success: true };
}

function votePlayer(code, voterId, targetId) {
  const room = rooms[code];
  if (!room || !room.gameState) return { error: 'No hay partida' };
  return castVote(room, voterId, targetId) ? { success: true } : { error: 'No se puede votar ahora' };
}

function tickRoom(code) {
  const room = rooms[code];
  if (!room || !room.gameState) return null;

  const gs = room.gameState;
  if (gs.phase === 'playing') {
    return tickGame(room);
  } else if (gs.phase === 'meeting') {
    gs.meetingTimer -= 1000;
    if (gs.meetingTimer <= 0) {
      startVoting(room);
      return { event: 'voting_started' };
    }
  } else if (gs.phase === 'voting') {
    gs.votingTimer -= 1000;
    if (gs.votingTimer <= 0) {
      const result = endVoting(room);
      return { event: 'voting_ended', result };
    }
  }
  return null;
}

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  getAllRooms,
  startGameInRoom,
  movePlayer,
  completeTask,
  callMeeting,
  votePlayer,
  tickRoom
};
