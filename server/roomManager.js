// roomManager.js — Gestión de salas privadas con códigos

const { startGame, tickGame, startMeeting, startVoting, castVote, endVoting, updateSecondaryObjectives } = require('./gameState');
const { randomUUID } = require('node:crypto');
const { TASKS } = require('./tasks');
const { OFFICE_STATIONS } = require('../shared/world-data');
const { createMinigameState, reduceMinigame } = require('../shared/minigames');
const { movementBlocked, interactionBlocked } = require('./worldCollision');

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

function validateJoinRoom(code, playerId) {
  const room = rooms[code];
  if (!room) return { error: 'Sala no encontrada' };
  if (room.gameState && room.gameState.phase !== 'lobby') return { error: 'La partida ya empezó' };
  if (!room.players[playerId] && Object.keys(room.players).length >= 12) return { error: 'Sala llena' };
  return null;
}

function joinRoom(code, playerId, playerName) {
  const error = validateJoinRoom(code, playerId);
  if (error) return error;
  const room = rooms[code];
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
  if (room.gameState) return { error: 'La partida ya empezó' };
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
  if (room.gameState?.phase !== 'playing' || (p.suspendedUntil && now < p.suspendedUntil)) {
    delete p.taskSession;
    return p;
  }

  const isBurnout = p.burnoutUntil && now < p.burnoutUntil;
  const baseSpeed = 250;
  const speed = isBurnout ? baseSpeed * 0.5 : baseSpeed;

  // Validar y limitar límites del mapa
  const clampedX = Math.max(20, Math.min(1180, x));
  const clampedY = Math.max(20, Math.min(880, y));

  if (!p.lastMoveTime) p.lastMoveTime = now;

  // Limitar el delta de tiempo para evitar teletransporte después de inactividad o lag extremo
  const maxDt = 0.25;
  const dt = Math.min((now - p.lastMoveTime) / 1000, maxDt);
  p.lastMoveTime = now;

  const dist = Math.hypot(clampedX - p.x, clampedY - p.y);
  const tolerance = 1.2;
  const maxAllowedDist = speed * dt * tolerance;
  const minDistBuffer = 15;

  if (!p.bypassSpeedCheck && dist > maxAllowedDist + minDistBuffer) return p;

  if (movementBlocked(p, { x: clampedX, y: clampedY }, room.gameState?.activeSabotages)) return p;

  if (isBurnout) {
    p.x = clampedX * 0.5 + p.x * 0.5;
    p.y = clampedY * 0.5 + p.y * 0.5;
  } else {
    p.x = clampedX;
    p.y = clampedY;
  }
  if (p.taskSession && validateTaskAccess(code, playerId, p.taskSession.taskId, now).error) delete p.taskSession;
  return p;
}

function movePlayerFromClient(code, playerId, x, y, now = Date.now()) {
  const player = rooms[code]?.players[playerId];
  if (!player) return { player: null, moved: false };
  if (player.lastClientMoveAt != null && now - player.lastClientMoveAt < 20) return { rateLimited: true };
  player.lastClientMoveAt = now;
  const beforeX = player.x;
  const beforeY = player.y;
  const result = movePlayer(code, playerId, x, y);
  return { player: result, moved: !!result && (result.x !== beforeX || result.y !== beforeY) };
}

function validateTaskAccess(code, playerId, taskId, now = Date.now()) {
  const room = rooms[code];
  if (!room || !room.gameState) return { error: 'No hay partida activa' };
  if (room.gameState.phase !== 'playing') {
    return { error: 'Acción no permitida en esta fase' };
  }
  const task = room.gameState.taskStates.find((t) => t.id === taskId);
  if (!task || task.completed) return { error: 'Tarea no disponible' };
  if (task.blockedUntil && now < task.blockedUntil) return { error: 'Tarea bloqueada temporalmente por sabotaje' };
  const p = room.players[playerId];
  if (!p) return { error: 'Jugador no encontrado' };
  if (p.role !== 'empleado') return { error: 'Rol no autorizado para completar tareas' };
  if (p.morale <= 0 || (p.burnoutUntil && now < p.burnoutUntil)) return { error: 'En burnout' };

  const station = OFFICE_STATIONS.find(({ taskId: id }) => id === taskId);
  if (!station) return { error: 'Estación de tarea no encontrada' };
  const distance = Math.hypot(p.x - station.x, p.y - station.y);
  if (distance > 170 || interactionBlocked(p, station, room.gameState.activeSabotages)) {
    return { error: 'Demasiado lejos de la tarea' };
  }
  return { room, task, player: p };
}

function startTaskSession(code, playerId, taskId, now = Date.now()) {
  const access = validateTaskAccess(code, playerId, taskId, now);
  if (access.error) return access;
  const definition = TASKS.find(({ id }) => id === taskId);
  if (!definition?.mechanic) return { error: 'Minijuego no disponible' };
  const session = {
    id: randomUUID(),
    taskId,
    state: createMinigameState(definition),
    startedAt: now,
    lastActionAt: now
  };
  access.player.taskSession = session;
  return { sessionId: session.id, state: session.state };
}

function sanitizeTaskAction(session, action, now) {
  if (!action || typeof action.type !== 'string') return null;
  if (session.state.mechanic === 'timing' && action.type === 'stop') {
    const phase = (now - session.startedAt) % 1900;
    const t = phase <= 950 ? phase / 950 : (1900 - phase) / 950;
    return { type: 'stop', position: -(Math.cos(Math.PI * t) - 1) / 2 };
  }
  if (session.state.mechanic === 'order' && action.type === 'pick') {
    return { type: 'pick', value: typeof action.value === 'number' ? action.value : NaN };
  }
  if (session.state.mechanic === 'triage' && action.type === 'choose') {
    return { type: 'choose', value: typeof action.value === 'string' ? action.value : '' };
  }
  if (session.state.mechanic === 'match' && action.type === 'connect') {
    return {
      type: 'connect',
      from: typeof action.from === 'string' ? action.from : '',
      to: typeof action.to === 'string' ? action.to : ''
    };
  }
  if (session.state.mechanic === 'hold' && action.type === 'hold') return { type: 'hold', active: Boolean(action.active) };
  if (session.state.mechanic === 'hold' && action.type === 'tick' && session.state.active) {
    const delta = Math.max(0, now - session.lastActionAt);
    return delta <= 250 ? { type: 'tick', delta } : { type: 'hold', active: false };
  }
  return null;
}

function applyTaskAction(code, playerId, sessionId, action, now = Date.now()) {
  const room = rooms[code];
  const player = room?.players[playerId];
  const session = player?.taskSession;
  if (!session || session.id !== sessionId) return { error: 'Sesión de minijuego inválida' };
  if (now - session.startedAt > 120000) {
    delete player.taskSession;
    return { error: 'Sesión de minijuego inválida' };
  }
  const access = validateTaskAccess(code, playerId, session.taskId, now);
  if (access.error) {
    delete player.taskSession;
    return access;
  }
  const safeAction = sanitizeTaskAction(session, action, now);
  if (!safeAction) return { error: 'Acción de minijuego inválida' };
  if (session.state.mechanic === 'timing' && session.lastTimingActionAt != null && now - session.lastTimingActionAt < 600) {
    return { success: true, completed: false, state: session.state };
  }
  if (session.state.mechanic === 'timing') session.lastTimingActionAt = now;
  const discrete = ['order', 'triage', 'match'].includes(session.state.mechanic);
  if (discrete && session.lastDiscreteActionAt != null && now - session.lastDiscreteActionAt < 120) {
    return { success: true, completed: false, state: session.state };
  }
  if (discrete) session.lastDiscreteActionAt = now;
  session.state = reduceMinigame(session.state, safeAction);
  session.lastActionAt = now;
  if (!session.state.completed) return { success: true, completed: false, state: session.state };
  const result = completeTask(code, playerId, session.taskId);
  return result.success ? { ...result, completed: true } : result;
}

function completeTask(code, playerId, taskId) {
  const access = validateTaskAccess(code, playerId, taskId);
  if (access.error) return access;
  const { room, task, player: p } = access;
  if (p.taskSession?.taskId !== taskId || !p.taskSession.state.completed) {
    return { error: 'Minijuego no completado' };
  }

  task.completed = true;
  task.completedBy = playerId;
  for (const other of Object.values(room.players)) {
    if (other.taskSession?.taskId === taskId) delete other.taskSession;
  }
  p.tasksCompleted = (p.tasksCompleted || 0) + 1;
  p.completedTaskZones = p.completedTaskZones || [];
  if (task.zone && !p.completedTaskZones.includes(task.zone)) p.completedTaskZones.push(task.zone);
  p.morale = Math.min(100, p.morale + 5);
  room.gameState.points[playerId] = (room.gameState.points[playerId] || 0) + 10;
  delete p.taskSession;
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
  for (const player of Object.values(room.players)) delete player.taskSession;
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
  validateJoinRoom,
  leaveRoom,
  getRoom,
  getAllRooms,
  startGameInRoom,
  movePlayer,
  movePlayerFromClient,
  completeTask,
  startTaskSession,
  applyTaskAction,
  callMeeting,
  votePlayer,
  tickRoom
};
