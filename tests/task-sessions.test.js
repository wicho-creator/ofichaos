const test = require('node:test');
const assert = require('node:assert/strict');
const roomManager = require('../server/roomManager');

function startedRoom() {
  const host = `host-${Date.now()}-${Math.random()}`;
  const room = roomManager.createRoom(host, 'Host');
  for (let index = 1; index < 4; index += 1) roomManager.joinRoom(room.code, `p-${index}-${Math.random()}`, `P${index}`);
  roomManager.startGameInRoom(room.code);
  return room;
}

test('un taskId directo no puede completar un minijuego', () => {
  const room = startedRoom();
  const employee = Object.values(room.players).find(({ role }) => role === 'empleado');
  Object.assign(employee, { x: 510, y: 520 });

  const result = roomManager.completeTask(room.code, employee.id, 'archivos');

  assert.match(result.error, /minijuego/i);
  assert.equal(room.gameState.taskStates.find(({ id }) => id === 'archivos').completed, false);
});

test('la sesión autoritativa completa archivos solo después del orden correcto', () => {
  const room = startedRoom();
  const [employee, otherEmployee] = Object.values(room.players).filter(({ role }) => role === 'empleado');
  Object.assign(employee, { x: 510, y: 520 });
  Object.assign(otherEmployee, { x: 510, y: 520 });
  const started = roomManager.startTaskSession(room.code, employee.id, 'archivos', 1000);
  const concurrent = roomManager.startTaskSession(room.code, otherEmployee.id, 'archivos', 1000);

  assert.ok(started.sessionId);
  assert.equal(started.state.completed, false);
  assert.equal(roomManager.applyTaskAction(room.code, employee.id, 'sesion-falsa', { type: 'pick', value: 1 }, 1100).success, undefined);
  for (const [index, value] of started.state.order.slice(0, -1).entries()) {
    const step = roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'pick', value }, 1150 + index * 150);
    assert.equal(step.completed, false);
  }
  assert.equal(room.gameState.taskStates.find(({ id }) => id === 'archivos').completed, false);

  const done = roomManager.applyTaskAction(room.code, employee.id, started.sessionId, {
    type: 'pick', value: started.state.order.at(-1)
  }, 1600);

  assert.equal(done.completed, true);
  assert.equal(room.gameState.taskStates.find(({ id }) => id === 'archivos').completed, true);
  assert.equal(otherEmployee.taskSession, undefined);
  assert.match(roomManager.applyTaskAction(room.code, otherEmployee.id, concurrent.sessionId, { type: 'pick', value: 1 }, 1700).error, /sesión/i);
  assert.match(roomManager.applyTaskAction(room.code, otherEmployee.id, started.sessionId, { type: 'pick', value: 1 }, 1700).error, /sesión/i);
  assert.match(roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'pick', value: 1 }, 1700).error, /sesión/i);
});

test('un token queda ligado a su tarea y no sobrevive abrir otra', () => {
  const room = startedRoom();
  const employee = Object.values(room.players).find(({ role }) => role === 'empleado');
  Object.assign(employee, { x: 510, y: 520 });
  const archivos = roomManager.startTaskSession(room.code, employee.id, 'archivos', 1000);
  Object.assign(employee, { x: 615, y: 745 });
  const wifi = roomManager.startTaskSession(room.code, employee.id, 'wifi', 1100);

  assert.ok(wifi.sessionId);
  assert.match(roomManager.applyTaskAction(room.code, employee.id, archivos.sessionId, { type: 'pick', value: 1 }, 1200).error, /sesión/i);
  assert.equal(employee.taskSession.id, wifi.sessionId);
});

test('acciones discretas simultáneas no pueden falsificar un minijuego completo', () => {
  const room = startedRoom();
  const employee = Object.values(room.players).find(({ role }) => role === 'empleado');
  Object.assign(employee, { x: 510, y: 520 });
  const started = roomManager.startTaskSession(room.code, employee.id, 'archivos', 1000);

  let result;
  for (const value of started.state.order) {
    result = roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'pick', value }, 1100);
  }

  assert.equal(result.completed, false);
  assert.equal(result.state.index, 1);
  assert.equal(room.gameState.taskStates.find(({ id }) => id === 'archivos').completed, false);
});

test('café ignora una posición de aguja inventada por el cliente', () => {
  const room = startedRoom();
  const employee = Object.values(room.players).find(({ role }) => role === 'empleado');
  Object.assign(employee, { x: 220, y: 476 });
  const started = roomManager.startTaskSession(room.code, employee.id, 'cafe', 1000);

  const forged = roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'stop', position: 0.5 }, 1000);
  assert.equal(forged.completed, false);
  assert.equal(room.gameState.taskStates.find(({ id }) => id === 'cafe').completed, false);

  const legitimate = roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'stop', position: 0 }, 2425);
  assert.equal(legitimate.completed, true);
});

test('reporte usa tiempo servidor e ignora deltas inflados', () => {
  const room = startedRoom();
  const employee = Object.values(room.players).find(({ role }) => role === 'empleado');
  Object.assign(employee, { x: 325, y: 245 });
  const started = roomManager.startTaskSession(room.code, employee.id, 'reporte', 1000);

  roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'hold', active: true }, 1000);
  const forged = roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'tick', delta: 999999 }, 1100);
  assert.equal(forged.completed, false);
  assert.equal(forged.state.elapsed, 100);

  const delayed = roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'tick', delta: 1 }, 3500);
  assert.equal(delayed.completed, false);
  assert.ok(delayed.state.elapsed <= 200);

  roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'hold', active: true }, 3600);
  let heartbeat;
  for (let now = 3700; now <= 6000 && !heartbeat?.completed; now += 100) {
    heartbeat = roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'tick' }, now);
  }
  assert.equal(heartbeat.completed, true);
});

test('una reunión invalida el hold de reporte y no acredita tiempo pausado', () => {
  const room = startedRoom();
  const employee = Object.values(room.players).find(({ role }) => role === 'empleado');
  Object.assign(employee, { x: 325, y: 245 });
  const started = roomManager.startTaskSession(room.code, employee.id, 'reporte', 1000);
  roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'hold', active: true }, 1000);

  assert.equal(roomManager.callMeeting(room.code, employee.id).success, true);
  assert.equal(employee.taskSession, undefined);
  room.gameState.phase = 'playing';
  const stale = roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'tick' }, 4000);

  assert.match(stale.error, /sesión/i);
  assert.equal(room.gameState.taskStates.find(({ id }) => id === 'reporte').completed, false);
});

test('perder acceso invalida una sesión hold por distancia, burnout o bloqueo', () => {
  const cases = [
    (room, employee) => Object.assign(employee, { x: 1000, y: 800 }),
    (room, employee) => { employee.burnoutUntil = 5000; },
    (room) => { room.gameState.taskStates.find(({ id }) => id === 'reporte').blockedUntil = 5000; }
  ];

  for (const deny of cases) {
    const room = startedRoom();
    const employee = Object.values(room.players).find(({ role }) => role === 'empleado');
    Object.assign(employee, { x: 325, y: 245 });
    const started = roomManager.startTaskSession(room.code, employee.id, 'reporte', 1000);
    roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'hold', active: true }, 1000);
    deny(room, employee);

    assert.ok(roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'tick' }, 2000).error);
    assert.equal(employee.taskSession, undefined);
    assert.match(roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'tick' }, 4000).error, /sesión/i);
  }
});

test('movimiento solo ocurre en playing e invalida la sesión al dejar la estación', () => {
  const room = startedRoom();
  const employee = Object.values(room.players).find(({ role }) => role === 'empleado');
  Object.assign(employee, { x: 510, y: 520, bypassSpeedCheck: true });
  const started = roomManager.startTaskSession(room.code, employee.id, 'archivos', 1000);

  for (const [x, y] of [[510, 560], [510, 610], [430, 610], [330, 610]]) {
    roomManager.movePlayer(room.code, employee.id, x, y);
  }
  assert.deepEqual({ x: employee.x, y: employee.y }, { x: 330, y: 610 });
  assert.equal(employee.taskSession, undefined);
  assert.match(roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'pick', value: 1 }, 1100).error, /sesión/i);

  Object.assign(employee, { x: 510, y: 520 });
  room.gameState.phase = 'ended';
  roomManager.movePlayer(room.code, employee.id, 520, 520);
  assert.deepEqual({ x: employee.x, y: employee.y }, { x: 510, y: 520 });
});

test('una sesión expirada se elimina al rechazar la acción', () => {
  const room = startedRoom();
  const employee = Object.values(room.players).find(({ role }) => role === 'empleado');
  Object.assign(employee, { x: 510, y: 520 });
  const started = roomManager.startTaskSession(room.code, employee.id, 'archivos', 1000);

  const result = roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'pick', value: 1 }, 121001);

  assert.match(result.error, /sesión/i);
  assert.equal(employee.taskSession, undefined);
});

test('el transporte limita ráfagas de movimiento sin perder una actualización posterior', () => {
  const room = startedRoom();
  const player = Object.values(room.players)[0];
  Object.assign(player, { x: 400, y: 350, lastMoveTime: 1000, bypassSpeedCheck: true });

  const first = roomManager.movePlayerFromClient(room.code, player.id, 410, 350, 1000);
  const firstSnapshot = { moved: first.moved, x: first.player.x };
  const flood = roomManager.movePlayerFromClient(room.code, player.id, 420, 350, 1001);
  const later = roomManager.movePlayerFromClient(room.code, player.id, 420, 350, 1020);

  assert.deepEqual(firstSnapshot, { moved: true, x: 410 });
  assert.deepEqual(flood, { rateLimited: true });
  assert.deepEqual({ moved: later.moved, x: later.player.x }, { moved: true, x: 420 });
});

test('una ráfaga de intentos de café no encuentra la ventana por fuerza bruta', () => {
  const room = startedRoom();
  const employee = Object.values(room.players).find(({ role }) => role === 'empleado');
  Object.assign(employee, { x: 220, y: 476 });
  const started = roomManager.startTaskSession(room.code, employee.id, 'cafe', 1000);

  for (let now = 1000; now < 1500; now += 10) {
    roomManager.applyTaskAction(room.code, employee.id, started.sessionId, { type: 'stop' }, now);
  }

  assert.equal(room.gameState.taskStates.find(({ id }) => id === 'cafe').completed, false);
});

test('una partida activa no puede reiniciarse con game:start', () => {
  const room = startedRoom();
  const original = room.gameState;
  room.gameState.phase = 'meeting';

  const result = roomManager.startGameInRoom(room.code);

  assert.match(result.error, /ya empezó/i);
  assert.equal(room.gameState, original);
  assert.equal(room.gameState.phase, 'meeting');
});