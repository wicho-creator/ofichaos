// gameState.js — Estado del juego, moral, temporizadores y condiciones de victoria

const { assignRoles } = require('./roles');
const { initTaskStates, getCompletionPercent, MAP_WIDTH, MAP_HEIGHT } = require('./tasks');
const { cleanExpiredSabotages } = require('./sabotage');

const GAME_DURATION = 8 * 60 * 1000; // 8 minutos
const MEETING_DURATION = 60 * 1000; // 60 segundos
const VOTING_DURATION = 20 * 1000; // 20 segundos
const BURNOUT_DURATION = 20 * 1000; // 20 segundos
const TASK_WIN_PERCENT = 80;
const BURNOUT_WIN_PERCENT = 50;

/**
 * Crea el estado de juego para una sala.
 * @param {string[]} playerIds
 * @returns {Object} gameState
 */
function createGameState(playerIds) {
  return {
    phase: 'lobby', // lobby | playing | meeting | voting | ended
    startTime: null,
    endTime: null,
    timeRemaining: GAME_DURATION,
    meetingTimer: 0,
    votingTimer: 0,
    players: {}, // playerId -> playerState (se llena en startGame)
    roleAssignments: {},
    taskStates: initTaskStates(),
    zones: [],
    activeSabotages: [],
    meetingActive: false,
    meetingCalledBy: null,
    votes: {}, // playerId -> targetId
    sanctions: {}, // playerId -> count
    winners: null,
    points: {}, // playerId -> points
    burnedOutPlayers: new Set()
  };
}

/**
 * Inicia la partida: asigna roles, posiciones, moral.
 * @param {Object} room - estado de la sala con room.players
 */
function startGame(room) {
  const playerIds = Object.keys(room.players);
  room.gameState = createGameState(playerIds);
  room.gameState.roleAssignments = assignRoles(playerIds);

  for (const pid of playerIds) {
    const assignment = room.gameState.roleAssignments[pid];
    room.players[pid].role = assignment.role;
    room.players[pid].secondaryObjective = assignment.secondaryObjective;
    room.players[pid].secondaryObjectiveText = assignment.secondaryObjectiveText;
    room.players[pid].morale = 100;
    room.players[pid].x = 100 + Math.random() * (MAP_WIDTH - 200);
    room.players[pid].y = 100 + Math.random() * (MAP_HEIGHT - 200);
    room.players[pid].vx = 0;
    room.players[pid].vy = 0;
    room.players[pid].burnoutUntil = 0;
    room.players[pid].sanctions = 0;
    room.players[pid].tasksCompleted = 0;
    room.gameState.points[pid] = 0;
    room.gameState.sanctions[pid] = 0;
  }

  room.gameState.phase = 'playing';
  room.gameState.startTime = Date.now();
  room.gameState.endTime = Date.now() + GAME_DURATION;
}

/**
 * Procesa el tick del juego cada segundo: temporizadores, burnout, sabotajes, victoria.
 * @param {Object} room
 * @returns {Object|null} evento de victoria o null
 */
function tickGame(room) {
  const gs = room.gameState;
  if (!gs || gs.phase !== 'playing') return null;

  const now = Date.now();
  gs.timeRemaining = Math.max(0, gs.endTime - now);

  // Limpiar sabotajes expirados
  cleanExpiredSabotages(room);

  // Verificar burnout
  for (const pid of Object.keys(room.players)) {
    const p = room.players[pid];
    if (p.morale <= 0 && !gs.burnedOutPlayers.has(pid)) {
      p.burnoutUntil = now + BURNOUT_DURATION;
      gs.burnedOutPlayers.add(pid);
      // Jefe gana puntos por provocar burnout (simplificado: al más probable saboteador)
    }
    if (gs.burnedOutPlayers.has(pid) && now >= p.burnoutUntil) {
      gs.burnedOutPlayers.delete(pid);
      p.morale = 30; // recuperación parcial
    }
  }

  // Verificar condiciones de victoria
  const result = checkWinConditions(room);
  if (result) {
    gs.phase = 'ended';
    gs.winners = result;
    calculatePoints(room, result);
    return result;
  }

  return null;
}

/**
 * Verifica condiciones de victoria.
 * @param {Object} room
 * @returns {Object|null} { winners: string[], reason: string } o null
 */
function checkWinConditions(room) {
  const gs = room.gameState;
  const players = Object.values(room.players);
  const employees = players.filter((p) => p.role === 'empleado');
  const completion = getCompletionPercent(gs.taskStates);

  // Empleados ganan si completan 80% de tareas
  if (completion >= TASK_WIN_PERCENT) {
    return { winners: 'empleados', reason: `Tareas completadas al ${completion}%` };
  }

  // Calcular burnout entre empleados
  const burnedOutCount = employees.filter((p) => gs.burnedOutPlayers.has(Object.keys(room.players).find((id) => room.players[id] === p))).length;
  const burnoutPercent = employees.length > 0 ? (burnedOutCount / employees.length) * 100 : 0;

  // Jefe gana si tiempo acaba y tareas < 80%
  if (gs.timeRemaining <= 0) {
    // Lamebotas ganan si jefe gana y no fue sancionado 2 veces
    const lamebotas = players.filter((p) => p.role === 'lamebotas');
    const lamebotasWinners = lamebotas.filter((p) => p.sanctions < 2).map((p) => p.id);
    return {
      winners: 'jefe',
      reason: `Tiempo agotado y tareas al ${completion}%`,
      lamebotasWinners
    };
  }

  // Jefe gana si 50% de empleados en burnout
  if (burnoutPercent >= BURNOUT_WIN_PERCENT && employees.length > 0) {
    const lamebotas = players.filter((p) => p.role === 'lamebotas');
    const lamebotasWinners = lamebotas.filter((p) => p.sanctions < 2).map((p) => p.id);
    return {
      winners: 'jefe',
      reason: `${burnoutPercent}% de empleados en burnout`,
      lamebotasWinners
    };
  }

  return null;
}

/**
 * Calcula puntos finales según rol y resultados.
 * @param {Object} room
 * @param {Object} result - resultado de victoria
 */
function calculatePoints(room, result) {
  const gs = room.gameState;
  for (const pid of Object.keys(room.players)) {
    const p = room.players[pid];
    let pts = 0;

    if (p.role === 'empleado') {
      pts += p.tasksCompleted * 10;
      // Objetivo secundario simplificado
      pts += 20; // placeholder: objetivo completado
      if (result.winners === 'empleados') {
        pts += 50; // bonus victoria
      }
    } else if (p.role === 'jefe') {
      pts += 15 * gs.activeSabotages.length; // sabotajes (aproximado)
      pts += gs.burnedOutPlayers.size * 20; // burnouts provocados
      if (result.winners === 'jefe') pts += 50;
    } else if (p.role === 'lamebotas') {
      pts += 15; // reporte falso (placeholder)
      pts += 20; // defender al jefe (placeholder)
      pts += 10; // bloquear tarea (placeholder)
      if (result.winners === 'jefe' && p.sanctions < 2) pts += 50;
    }

    gs.points[pid] = pts;
  }
}

/**
 * Inicia una reunión.
 * @param {Object} room
 * @param {string} calledBy
 */
function startMeeting(room, calledBy) {
  const gs = room.gameState;
  gs.phase = 'meeting';
  gs.meetingActive = true;
  gs.meetingCalledBy = calledBy;
  gs.meetingTimer = MEETING_DURATION;
  gs.votes = {};
  // El que llama la reunión pierde su capacidad de llamar otra
  if (gs.roleAssignments[calledBy]) {
    gs.roleAssignments[calledBy].meetingCalled = true;
  }
}

/**
 * Inicia la votación después de la reunión.
 * @param {Object} room
 */
function startVoting(room) {
  const gs = room.gameState;
  gs.phase = 'voting';
  gs.votingTimer = VOTING_DURATION;
  gs.votes = {};
}

/**
 * Registra un voto.
 * @param {Object} room
 * @param {string} voterId
 * @param {string} targetId
 */
function castVote(room, voterId, targetId) {
  const gs = room.gameState;
  if (gs.phase !== 'voting') return false;
  gs.votes[voterId] = targetId;
  return true;
}

/**
 * Finaliza la votación y aplica sanciones.
 * @param {Object} room
 * @returns {Object} resultado de la votación
 */
function endVoting(room) {
  const gs = room.gameState;
  // Contar votos
  const tally = {};
  for (const [voter, target] of Object.entries(gs.votes)) {
    if (target && target !== 'skip') {
      tally[target] = (tally[target] || 0) + 1;
    }
  }

  // Encontrar el más votado
  let maxVotes = 0;
  let sanctioned = null;
  for (const [target, count] of Object.entries(tally)) {
    if (count > maxVotes) {
      maxVotes = count;
      sanctioned = target;
    }
  }

  let sanctionType = null;
  if (sanctioned && maxVotes > 0) {
    const p = room.players[sanctioned];
    if (p) {
      p.sanctions = (p.sanctions || 0) + 1;
      p.morale = Math.max(0, p.morale - 20);
      gs.sanctions[sanctioned] = (gs.sanctions[sanctioned] || 0) + 1;

      if (p.sanctions >= 2) {
        // Suspendido 30 segundos
        p.suspendedUntil = Date.now() + 30000;
        sanctionType = 'suspended';
      } else {
        // No puede usar habilidad 30 segundos
        p.abilityBlockedUntil = Date.now() + 30000;
        sanctionType = 'ability_blocked';
      }
    }
  }

  gs.phase = 'playing';
  gs.meetingActive = false;
  gs.meetingCalledBy = null;

  return {
    tally,
    sanctioned,
    sanctionType,
    votes: gs.votes
  };
}

module.exports = {
  GAME_DURATION,
  MEETING_DURATION,
  VOTING_DURATION,
  BURNOUT_DURATION,
  TASK_WIN_PERCENT,
  BURNOUT_WIN_PERCENT,
  createGameState,
  startGame,
  tickGame,
  startMeeting,
  startVoting,
  castVote,
  endVoting,
  checkWinConditions,
  calculatePoints
};
