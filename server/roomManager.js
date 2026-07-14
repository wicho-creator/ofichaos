// roomManager.js — Gestión de salas privadas con códigos

const { startGame, tickGame, startMeeting, startVoting, castVote, endVoting, updateSecondaryObjectives } = require('./gameState');
const { ZONES } = require('./tasks');

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
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    return p;
  }
  const now = Date.now();
  if (p.suspendedUntil && now < p.suspendedUntil) return p;
  if (room.gameState && (room.gameState.phase === 'meeting' || room.gameState.phase === 'voting')) return p;

  const isBurnout = p.burnoutUntil && now < p.burnoutUntil;
  const baseSpeed = 250;
  const speed = isBurnout ? baseSpeed * 0.5 : baseSpeed;

  // Validar y limitar límites del mapa
  const clampedX = Math.max(20, Math.min(1180, x));
  const clampedY = Math.max(20, Math.min(880, y));

  if (!p.lastMoveTime) {
    p.lastMoveTime = now;
    p.x = clampedX;
    p.y = clampedY;
    return p;
  }

  // Limitar el delta de tiempo para evitar teletransporte después de inactividad o lag extremo
  const maxDt = 0.25;
  const dt = Math.min((now - p.lastMoveTime) / 1000, maxDt);
  p.lastMoveTime = now;

  const dist = Math.hypot(clampedX - p.x, clampedY - p.y);
  const tolerance = 1.2;
  const maxAllowedDist = speed * dt * tolerance;
  const minDistBuffer = 15;

  if (!p.bypassSpeedCheck && dist > maxAllowedDist + minDistBuffer) {
    console.log(`[Anti-Cheat] Movimiento rechazado para ${p.name}. Distancia: ${dist.toFixed(1)}, Máx permitida: ${(maxAllowedDist + minDistBuffer).toFixed(1)}, dt: ${dt.toFixed(3)}s`);
    return p;
  }

  if (isBurnout) {
    p.x = clampedX * 0.5 + p.x * 0.5;
    p.y = clampedY * 0.5 + p.y * 0.5;
  } else {
    p.x = clampedX;
    p.y = clampedY;
  }
  return p;
}

function completeTask(code, playerId, taskId) {
  const room = rooms[code];
  if (!room || !room.gameState) return { error: 'No hay partida activa' };
  if (room.gameState.phase !== 'playing') {
    return { error: 'Acción no permitida en esta fase' };
  }
  const task = room.gameState.taskStates.find((t) => t.id === taskId);
  if (!task || task.completed) return { error: 'Tarea no disponible' };
  if (task.blockedUntil && Date.now() < task.blockedUntil) return { error: 'Tarea bloqueada temporalmente por sabotaje' };
  const p = room.players[playerId];
  if (!p) return { error: 'Jugador no encontrado' };
  if (p.role !== 'empleado') return { error: 'Rol no autorizado para completar tareas' };
  if (p.burnoutUntil && Date.now() < p.burnoutUntil) return { error: 'En burnout' };

  if (task.zone) {
    const zone = ZONES.find((z) => z.id === task.zone);
    if (zone) {
      const zoneCenterX = zone.x + zone.w / 2;
      const zoneCenterY = zone.y + zone.h / 2;
      const dist = Math.hypot(p.x - zoneCenterX, p.y - zoneCenterY);
      const THRESHOLD = 180; // server tolerance (approx 170px + leeway)
      if (dist > THRESHOLD) {
        return { error: 'Demasiado lejos de la tarea' };
      }
    }
  }

  task.completed = true;
  task.completedBy = playerId;
  p.tasksCompleted = (p.tasksCompleted || 0) + 1;
  p.completedTaskZones = p.completedTaskZones || [];
  if (task.zone && !p.completedTaskZones.includes(task.zone)) p.completedTaskZones.push(task.zone);
  p.morale = Math.min(100, p.morale + 5);
  room.gameState.points[playerId] = (room.gameState.points[playerId] || 0) + 10;
  updateSecondaryObjectives(room);

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
