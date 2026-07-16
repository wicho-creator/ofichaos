const test = require('node:test');
const assert = require('node:assert/strict');
const roomManager = require('../server/roomManager');

function startedRoom() {
  const room = roomManager.createRoom(`host-${Date.now()}-${Math.random()}`, 'Host');
  for (let index = 1; index < 4; index += 1) {
    roomManager.joinRoom(room.code, `player-${index}-${Math.random()}`, `Player ${index}`);
  }
  roomManager.startGameInRoom(room.code);
  return room;
}

test('una tarea cercana no puede completarse a través de una pared', () => {
  const room = startedRoom();
  const employee = Object.values(room.players).find((player) => player.role === 'empleado');
  Object.assign(employee, { x: 600, y: 82 });

  const result = roomManager.completeTask(room.code, employee.id, 'correos');

  assert.equal(result.success, undefined);
  assert.equal(room.gameState.taskStates.find(({ id }) => id === 'correos').completed, false);
});

test('la misma tarea puede completarse frente a su estación por un trayecto abierto', () => {
  const room = startedRoom();
  const employee = Object.values(room.players).find((player) => player.role === 'empleado');
  Object.assign(employee, { x: 600, y: 220 });

  const session = roomManager.startTaskSession(room.code, employee.id, 'correos', 1000);
  let result;
  for (const [index, value] of ['responder', 'archivar', 'responder'].entries()) {
    result = roomManager.applyTaskAction(room.code, employee.id, session.sessionId, { type: 'choose', value }, 1100 + index * 150);
  }

  assert.equal(result.completed, true);
});
