const test = require('node:test');
const assert = require('node:assert/strict');
const { assignExtraTask, blockTask, closeDoor, fakeTask, falseReport, lowerMorale, sabotageZone } = require('../server/sabotage');
const { movementBlocked } = require('../server/worldCollision');

const makeRoom = () => ({
  players: { jefe: { x: 300, y: 500 } },
  gameState: {
    zones: [{ id: 'cocina' }, { id: 'jefe_oficina' }],
    activeSabotages: [],
    sabotageStats: { jefe: { closeDoor: 0 } }
  }
});

test('closeDoor rechaza una puerta inexistente sin mutar sabotajes ni estadísticas', () => {
  const room = makeRoom();

  assert.equal(closeDoor(room, 'bodega-fantasma', 'jefe'), null);
  assert.deepEqual(room.gameState.activeSabotages, []);
  assert.equal(room.gameState.sabotageStats.jefe.closeDoor, 0);
});

test('closeDoor conserva la puerta exacta elegida dentro de una zona con varios accesos', () => {
  const room = makeRoom();

  const result = closeDoor(room, 'cocina-este', 'jefe');

  assert.equal(result.doorId, 'cocina-este');
  assert.equal(result.zoneId, 'cocina');
  assert.ok(result.expires > Date.now());
  assert.equal(room.gameState.activeSabotages.length, 1);
  assert.equal(room.gameState.sabotageStats.jefe.closeDoor, 1);
});

test('closeDoor rechaza una puerta remota sin consumir estadística', () => {
  const room = makeRoom();

  assert.equal(closeDoor(room, 'jefe-norte', 'jefe'), null);
  assert.deepEqual(room.gameState.activeSabotages, []);
  assert.equal(room.gameState.sabotageStats.jefe.closeDoor, 0);
});

test('sabotajes con IDs hostiles no mutan estado ni estadísticas', () => {
  const room = makeRoom();
  room.players.empleado = { role: 'empleado', morale: 100 };
  room.gameState.taskStates = [{ id: 'reporte', completed: false }];
  room.gameState.sabotageStats.jefe = { zone: 0, extraTask: 0, lowerMorale: 0, blockTask: 0 };

  assert.equal(sabotageZone(room, { toString: null }, 'jefe'), null);
  assert.equal(assignExtraTask(room, { toString: null }, 'jefe'), null);
  assert.equal(lowerMorale(room, { toString: null }, 'jefe'), null);
  assert.deepEqual(room.gameState.activeSabotages, []);
  assert.deepEqual(room.gameState.sabotageStats.jefe, { zone: 0, extraTask: 0, lowerMorale: 0, blockTask: 0 });
});

test('moral cero nunca usa el fallback de 100 en fake task ni false report', () => {
  const room = makeRoom();
  room.players.jefe = { role: 'jefe', morale: 100 };
  room.players.lamebotas = { role: 'lamebotas', morale: 0 };
  room.players.empleado = { role: 'empleado', morale: 0, taskSession: { taskId: 'reporte' } };

  fakeTask(room, 'lamebotas');
  assert.equal(room.players.lamebotas.morale, 5);

  falseReport(room, 'jefe');
  assert.equal(room.players.lamebotas.morale, 0);
  assert.equal(room.players.empleado.morale, 0);
  assert.equal(room.players.empleado.taskSession, undefined);
});

test('cualquier sabotaje que deja moral en cero invalida la sesión inmediatamente', () => {
  const cases = [
    (room) => sabotageZone(room, 'cocina', 'jefe'),
    (room) => assignExtraTask(room, 'empleado', 'jefe'),
    (room) => lowerMorale(room, 'empleado', 'jefe'),
    (room) => falseReport(room, 'jefe')
  ];
  for (const apply of cases) {
    const room = makeRoom();
    room.gameState.zones = [{ id: 'cocina', x: 0, y: 0, w: 100, h: 100 }];
    room.players.empleado = { x: 50, y: 50, role: 'empleado', morale: 1, taskSession: { taskId: 'reporte' } };
    apply(room);
    assert.equal(room.players.empleado.morale, 0);
    assert.equal(room.players.empleado.taskSession, undefined);
  }
});

test('bloquear una tarea invalida inmediatamente sus sesiones activas', () => {
  const room = makeRoom();
  room.players.empleado = { role: 'empleado', taskSession: { taskId: 'reporte' } };
  room.gameState.taskStates = [{ id: 'reporte', completed: false }];

  assert.ok(blockTask(room, 'reporte', 'jefe'));
  assert.equal(room.players.empleado.taskSession, undefined);
});

test('cerrar una puerta invalida una sesión cuya línea a la estación queda bloqueada', () => {
  const room = makeRoom();
  room.players.jefe = { x: 225, y: 325 };
  room.players.empleado = { x: 225, y: 325, role: 'empleado', taskSession: { taskId: 'reporte' } };
  room.gameState.zones.push({ id: 'recepcion' });

  assert.ok(closeDoor(room, 'recepcion-sur', 'jefe'));
  assert.equal(room.players.empleado.taskSession, undefined);
});

test('la autoridad física rechaza cruzar una pared aunque el movimiento sea corto', () => {
  assert.equal(movementBlocked({ x: 170, y: 388 }, { x: 170, y: 412 }, []), true);
});

test('la autoridad física permite una puerta abierta y bloquea esa puerta al sabotearla', () => {
  const from = { x: 255, y: 375 };
  const to = { x: 255, y: 425 };

  assert.equal(movementBlocked(from, to, []), false);
  assert.equal(movementBlocked(from, to, [{ type: 'close_door', doorId: 'cocina-norte', expires: Date.now() + 1000 }]), true);
});

test('si una puerta cierra sobre el jugador solo permite salir por el lado más cercano', () => {
  const closed = [{ type: 'close_door', doorId: 'cocina-norte', expires: Date.now() + 1000 }];
  const threshold = { x: 255, y: 399 };

  assert.equal(movementBlocked(threshold, { x: 255, y: 375 }, closed), false);
  assert.equal(movementBlocked(threshold, { x: 255, y: 425 }, closed), true);
});

test('un jugador tangente puede deslizarse paralelo a una pared', () => {
  assert.equal(movementBlocked({ x: 170, y: 378 }, { x: 190, y: 378 }, []), false);
});
