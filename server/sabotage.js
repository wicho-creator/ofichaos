// sabotage.js — Lógica de sabotajes y efectos sobre jugadores

const SABOTAGE_TYPES = {
  ZONE: 'zone', // Sabotea una zona completa (ej. apaga luces, corta café)
  EXTRA_TASK: 'extra_task', // Asigna tarea extra a un empleado
  LOWER_MORALE: 'lower_morale', // Baja moral de un empleado
  CLOSE_DOOR: 'close_door' // Cierra una puerta temporalmente
};

const SABOTAGE_EFFECTS = {
  [SABOTAGE_TYPES.ZONE]: { moraleLoss: 15, duration: 20000 },
  [SABOTAGE_TYPES.EXTRA_TASK]: { moraleLoss: 10 },
  [SABOTAGE_TYPES.LOWER_MORALE]: { moraleLoss: 20 },
  [SABOTAGE_TYPES.CLOSE_DOOR]: { duration: 15000 }
};

/**
 * Aplica un sabotaje de zona a todos los empleados en esa zona.
 * @param {Object} room - estado de la sala
 * @param {string} zoneId - zona sabotada
 * @param {string} saboteurId - quién saboteó
 * @returns {Object[]} jugadores afectados
 */
function sabotageZone(room, zoneId, saboteurId) {
  const affected = [];
  for (const pid of Object.keys(room.players)) {
    const p = room.players[pid];
    if (p.role !== 'empleado') continue;
    const zone = room.gameState.zones.find((z) => z.id === zoneId);
    if (zone && isInZone(p, zone)) {
      p.morale -= SABOTAGE_EFFECTS[SABOTAGE_TYPES.ZONE].moraleLoss;
      if (p.morale < 0) p.morale = 0;
      affected.push(pid);
    }
  }
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
function assignExtraTask(room, targetId) {
  const p = room.players[targetId];
  if (!p) return;
  p.morale -= SABOTAGE_EFFECTS[SABOTAGE_TYPES.EXTRA_TASK].moraleLoss;
  if (p.morale < 0) p.morale = 0;
  p.extraTasks = (p.extraTasks || 0) + 1;
}

/**
 * Baja la moral de un empleado directamente.
 * @param {Object} room
 * @param {string} targetId
 */
function lowerMorale(room, targetId) {
  const p = room.players[targetId];
  if (!p) return;
  p.morale -= SABOTAGE_EFFECTS[SABOTAGE_TYPES.LOWER_MORALE].moraleLoss;
  if (p.morale < 0) p.morale = 0;
}

/**
 * Cierra una puerta (zona) temporalmente.
 * @param {Object} room
 * @param {string} zoneId
 * @param {string} saboteurId
 */
function closeDoor(room, zoneId, saboteurId) {
  room.gameState.activeSabotages.push({
    type: SABOTAGE_TYPES.CLOSE_DOOR,
    zoneId,
    saboteurId,
    expires: Date.now() + SABOTAGE_EFFECTS[SABOTAGE_TYPES.CLOSE_DOOR].duration
  });
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

module.exports = {
  SABOTAGE_TYPES,
  SABOTAGE_EFFECTS,
  sabotageZone,
  assignExtraTask,
  lowerMorale,
  closeDoor,
  cleanExpiredSabotages,
  isInZone
};
