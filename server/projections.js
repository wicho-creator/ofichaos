const sabotage = require('./sabotage');
const { ZONES } = require('./tasks');

function taskPercent(room) {
  const tasks = room.gameState.taskStates;
  return tasks.length === 0 ? 0 : Math.round((tasks.filter(task => task.completed).length / tasks.length) * 100);
}

function publicPlayer(player, gameState) {
  return {
    id: player.id,
    name: player.name,
    x: player.x,
    y: player.y,
    morale: player.morale,
    tasksCompleted: player.tasksCompleted || 0,
    burnout: gameState.burnedOutPlayers.has(player.id)
  };
}

function publicSabotages(gameState) {
  return gameState.activeSabotages.map(sabotageState => ({
    type: sabotageState.type,
    doorId: sabotageState.doorId,
    zoneId: sabotageState.zoneId,
    taskId: sabotageState.taskId,
    expires: sabotageState.expires
  }));
}

function projectPublic(room) {
  if (!room || !room.gameState) return null;
  const gameState = room.gameState;
  return {
    phase: gameState.phase,
    timeRemaining: gameState.timeRemaining,
    taskPercent: taskPercent(room),
    tasks: gameState.taskStates.map(task => ({
      id: task.id,
      name: task.name,
      zone: task.zone,
      completed: task.completed,
      blockedUntil: task.blockedUntil || 0,
      blocked: !!(task.blockedUntil && task.blockedUntil > Date.now())
    })),
    zones: ZONES,
    players: Object.values(room.players).map(player => publicPlayer(player, gameState)),
    meetingTimer: gameState.meetingTimer,
    votingTimer: gameState.votingTimer,
    activeSabotages: publicSabotages(gameState)
  };
}

function projectPrivate(player) {
  return {
    role: player.role,
    secondaryObjectiveText: player.secondaryObjectiveText,
    playerId: player.id
  };
}

function projectRuntimePrivate(player) {
  return {
    playerId: player.id,
    cooldowns: sabotage.getCooldownPayload(player)
  };
}

function projectTick(room) {
  const players = {};
  for (const player of Object.values(room.players)) {
    players[player.id] = { x: player.x, y: player.y, morale: player.morale };
  }
  return {
    timeRemaining: room.gameState.timeRemaining,
    taskPercent: taskPercent(room),
    players,
    activeSabotages: publicSabotages(room.gameState)
  };
}

function projectFinal(room, result) {
  if (!room) return null;
  const gameState = room.gameState;
  return {
    winners: result.winners,
    reason: result.reason,
    lamebotasWinners: result.lamebotasWinners || [],
    players: Object.values(room.players).map(player => ({
      id: player.id,
      name: player.name,
      role: player.role,
      points: gameState.points[player.id] || 0,
      tasksCompleted: player.tasksCompleted || 0,
      sanctions: player.sanctions || 0,
      secondaryObjectiveText: player.secondaryObjectiveText || '',
      secondaryObjectiveDone: !!player.secondaryObjectiveDone
    }))
  };
}

module.exports = { projectPublic, projectPrivate, projectRuntimePrivate, projectTick, projectFinal };
