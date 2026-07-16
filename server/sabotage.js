const { OFFICE_DOORS, OFFICE_STATIONS } = require('../shared/world-data');
const { interactionBlocked } = require('./worldCollision');

// sabotage.js — Lógica de sabotajes y efectos sobre jugadores

const SABOTAGE_TYPES = {
  ZONE: 'zone', // Sabotea una zona completa (ej. apaga luces, corta café)
  EXTRA_TASK: 'extra_task', // Asigna tarea extra a un empleado
  LOWER_MORALE: 'lower_morale', // Baja moral de un empleado
  CLOSE_DOOR: 'close_door', // Cierra una puerta temporalmente
  FAKE_TASK: 'fake_task',
  FALSE_REPORT: 'false_report',
  BLOCK_TASK: 'block_task'
};

const SABOTAGE_EFFECTS = {
  [SABOTAGE_TYPES.ZONE]: { moraleLoss: 15, duration: 20000 },
  [SABOTAGE_TYPES.EXTRA_TASK]: { moraleLoss: 10 },
  [SABOTAGE_TYPES.LOWER_MORALE]: { moraleLoss: 20 },
  [SABOTAGE_TYPES.CLOSE_DOOR]: { duration: 15000 },
  [SABOTAGE_TYPES.FAKE_TASK]: { moraleGain: 5 },
  [SABOTAGE_TYPES.FALSE_REPORT]: { moraleLoss: 8, duration: 10000 },
  [SABOTAGE_TYPES.BLOCK_TASK]: { duration: 12000 }
};

/**
 * Aplica un sabotaje de zona a todos los empleados en esa zona.
 * @param {Object} room - estado de la sala
 * @param {string} zoneId - zona sabotada
 * @param {string} saboteurId - quién saboteó
 * @returns {Object[]} jugadores afectados
 */
function incrementSabotageStat(room, playerId, key) {
  if (!room.gameState.sabotageStats) room.gameState.sabotageStats = {};
  if (!room.gameState.sabotageStats[playerId]) room.gameState.sabotageStats[playerId] = {};
  room.gameState.sabotageStats[playerId][key] = (room.gameState.sabotageStats[playerId][key] || 0) + 1;
}

function invalidateTaskAtZeroMorale(player) {
  if (player.morale <= 0) delete player.taskSession;
}

function sabotageZone(room, zoneId, saboteurId) {
  if (typeof zoneId !== 'string' || !room.gameState.zones.some((zone) => zone.id === zoneId)) return null;
  const affected = [];
  for (const pid of Object.keys(room.players)) {
    const p = room.players[pid];
    if (p.role !== 'empleado') continue;
    const zone = room.gameState.zones.find((z) => z.id === zoneId);
    if (zone && isInZone(p, zone)) {
      p.morale -= SABOTAGE_EFFECTS[SABOTAGE_TYPES.ZONE].moraleLoss;
      if (p.morale < 0) p.morale = 0;
      invalidateTaskAtZeroMorale(p);
      affected.push(pid);
    }
  }
  incrementSabotageStat(room, saboteurId, 'zone');
  room.gameState.activeSabotages.push({
    type: SABOTAGE_TYPES.ZONE,
    zoneId,
    saboteurId,
    expires: Date.now() + SABOTAGE_EFFECTS[SABOTAGE_TYPES.ZONE].duration
  });
  return affected;
}

/**
 * Asigna una tarea extra a un empleado (baja moral).
 * @param {Object} room
 * @param {string} targetId
 */
function assignExtraTask(room, targetId, saboteurId) {
  if (typeof targetId !== 'string') return null;
  const p = room.players[targetId];
  if (!p || p.role !== 'empleado') return null;
  p.morale -= SABOTAGE_EFFECTS[SABOTAGE_TYPES.EXTRA_TASK].moraleLoss;
  if (p.morale < 0) p.morale = 0;
  invalidateTaskAtZeroMorale(p);
  p.extraTasks = (p.extraTasks || 0) + 1;
  if (saboteurId) incrementSabotageStat(room, saboteurId, 'extraTask');
  return p;
}

/**
 * Baja la moral de un empleado directamente.
 * @param {Object} room
 * @param {string} targetId
 */
function lowerMorale(room, targetId, saboteurId) {
  if (typeof targetId !== 'string') return null;
  const p = room.players[targetId];
  if (!p || p.role !== 'empleado') return null;
  p.morale -= SABOTAGE_EFFECTS[SABOTAGE_TYPES.LOWER_MORALE].moraleLoss;
  if (p.morale < 0) p.morale = 0;
  invalidateTaskAtZeroMorale(p);
  if (saboteurId) incrementSabotageStat(room, saboteurId, 'lowerMorale');
  return p;
}

/**
 * Cierra una puerta concreta temporalmente.
 * @param {Object} room
 * @param {string} doorId
 * @param {string} saboteurId
 */
function closeDoor(room, doorId, saboteurId) {
  const selected = OFFICE_DOORS.find((door) => door.id === doorId);
  const player = room.players[saboteurId];
  const nearest = player && OFFICE_DOORS.reduce((best, door) => {
    const distance = Math.hypot(player.x - door.x, player.y - door.y);
    return !best || distance < best.distance ? { door, distance } : best;
  }, null);
  if (!selected || !room.gameState.zones?.some((zone) => zone.id === selected.zoneId)
    || nearest?.door.id !== selected.id || nearest.distance > 170) return null;
  const door = {
    type: SABOTAGE_TYPES.CLOSE_DOOR,
    doorId: selected.id,
    zoneId: selected.zoneId,
    saboteurId,
    expires: Date.now() + SABOTAGE_EFFECTS[SABOTAGE_TYPES.CLOSE_DOOR].duration
  };
  incrementSabotageStat(room, saboteurId, 'closeDoor');
  room.gameState.activeSabotages.push(door);
  for (const candidate of Object.values(room.players)) {
    const station = candidate.taskSession && OFFICE_STATIONS.find(({ taskId }) => taskId === candidate.taskSession.taskId);
    if (station && interactionBlocked(candidate, station, room.gameState.activeSabotages)) delete candidate.taskSession;
  }
  return door;
}


function fakeTask(room, playerId) {
  const p = room.players[playerId];
  if (!p) return null;
  p.fakeTasks = (p.fakeTasks || 0) + 1;
  p.morale = Math.min(100, (p.morale ?? 100) + SABOTAGE_EFFECTS[SABOTAGE_TYPES.FAKE_TASK].moraleGain);
  incrementSabotageStat(room, playerId, 'fakeTask');
  return { playerId, fakeTasks: p.fakeTasks };
}

function falseReport(room, playerId) {
  const p = room.players[playerId];
  if (!p) return null;
  const affected = [];
  for (const pid of Object.keys(room.players)) {
    if (pid === playerId) continue;
    const target = room.players[pid];
    target.morale = Math.max(0, (target.morale ?? 100) - SABOTAGE_EFFECTS[SABOTAGE_TYPES.FALSE_REPORT].moraleLoss);
    invalidateTaskAtZeroMorale(target);
    affected.push(pid);
  }
  incrementSabotageStat(room, playerId, 'falseReport');
  room.gameState.activeSabotages.push({
    type: SABOTAGE_TYPES.FALSE_REPORT,
    saboteurId: playerId,
    expires: Date.now() + SABOTAGE_EFFECTS[SABOTAGE_TYPES.FALSE_REPORT].duration
  });
  return { affected };
}

function blockTask(room, taskId, playerId) {
  const task = room.gameState.taskStates.find((t) => t.id === taskId);
  if (!task || task.completed) return null;
  const duration = SABOTAGE_EFFECTS[SABOTAGE_TYPES.BLOCK_TASK].duration;
  task.blockedUntil = Date.now() + duration;
  task.blockedBy = playerId;
  for (const player of Object.values(room.players)) {
    if (player.taskSession?.taskId === taskId) delete player.taskSession;
  }
  incrementSabotageStat(room, playerId, 'blockTask');
  room.gameState.activeSabotages.push({
    type: SABOTAGE_TYPES.BLOCK_TASK,
    taskId,
    saboteurId: playerId,
    expires: Date.now() + duration
  });
  return { taskId, expires: task.blockedUntil };
}

/**
 * Limpia sabotajes expirados.
 * @param {Object} room
 */
function cleanExpiredSabotages(room) {
  if (!room.gameState.activeSabotages) return;
  const now = Date.now();
  room.gameState.activeSabotages = room.gameState.activeSabotages.filter((s) => s.expires > now);
}

function isInZone(player, zone) {
  return (
    player.x >= zone.x &&
    player.x <= zone.x + zone.w &&
    player.y >= zone.y &&
    player.y <= zone.y + zone.h
  );
}


const ABILITY_COOLDOWNS = {
  zone: 30000,
  extra_task: 45000,
  lower_morale: 40000,
  close_door: 35000,
  fake_task: 20000,
  false_report: 30000,
  block_task: 25000,
  report_sabotage: 25000
};

function checkCooldown(player, ability, now = Date.now()) {
  player.abilityCooldowns = player.abilityCooldowns || {};
  const readyAt = player.abilityCooldowns[ability] || 0;
  if (readyAt > now) {
    return { ok: false, remainingMs: readyAt - now };
  }
  return { ok: true, remainingMs: 0 };
}

function startCooldown(player, ability, now = Date.now()) {
  player.abilityCooldowns = player.abilityCooldowns || {};
  player.abilityCooldowns[ability] = now + (ABILITY_COOLDOWNS[ability] || 0);
  return player.abilityCooldowns[ability];
}

function getCooldownPayload(player, now = Date.now()) {
  const out = {};
  for (const [ability, readyAt] of Object.entries(player.abilityCooldowns || {})) {
    out[ability] = Math.max(0, readyAt - now);
  }
  return out;
}

function findReportableSabotage(room, playerId) {
  const player = room.players[playerId];
  if (!player || !room.gameState) return null;
  const now = Date.now();
  return (room.gameState.activeSabotages || []).find((s) => {
    if (s.expires <= now) return false;
    if (s.type === SABOTAGE_TYPES.ZONE || s.type === SABOTAGE_TYPES.CLOSE_DOOR) {
      const zone = room.gameState.zones.find((z) => z.id === s.zoneId);
      if (!zone) return false;
      const cx = zone.x + zone.w / 2;
      const cy = zone.y + zone.h / 2;
      return Math.hypot(player.x - cx, player.y - cy) < 220;
    }
    if (s.type === SABOTAGE_TYPES.BLOCK_TASK) {
      const task = room.gameState.taskStates.find((t) => t.id === s.taskId);
      const zone = task && room.gameState.zones.find((z) => z.id === task.zone);
      if (!zone) return false;
      const cx = zone.x + zone.w / 2;
      const cy = zone.y + zone.h / 2;
      return Math.hypot(player.x - cx, player.y - cy) < 220;
    }
    return s.type === SABOTAGE_TYPES.FALSE_REPORT;
  }) || null;
}

module.exports = {
  SABOTAGE_TYPES,
  SABOTAGE_EFFECTS,
  sabotageZone,
  assignExtraTask,
  lowerMorale,
  closeDoor,
  cleanExpiredSabotages,
  isInZone,
  fakeTask,
  falseReport,
  blockTask,
  incrementSabotageStat,
  ABILITY_COOLDOWNS,
  checkCooldown,
  startCooldown,
  getCooldownPayload,
  findReportableSabotage
};
