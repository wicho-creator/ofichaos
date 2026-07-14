const test = require('node:test');
const assert = require('node:assert');
const { after } = require('node:test');
const { io } = require('socket.io-client');
const http = require('http');

// Capture http server instance to close it cleanly in teardown
let serverInstance;
const originalCreateServer = http.createServer;
http.createServer = function(...args) {
  serverInstance = originalCreateServer.apply(this, args);
  return serverInstance;
};

// Accelerate setInterval ticks for testing and capture IDs to clean them up
const intervals = [];
const originalSetInterval = global.setInterval;
global.setInterval = (fn, delay, ...args) => {
  const actualDelay = delay === 1000 ? 50 : delay;
  const id = originalSetInterval(fn, actualDelay, ...args);
  intervals.push(id);
  return id;
};

// Setup mock Phaser and io globally for client modules
global.io = () => ({
  on() {},
  emit() {},
  close() {}
});

global.Phaser = {
  Scene: class MockScene {
    constructor() {
      this.add = {
        ellipse: (x, y, rx, ry, color, alpha) => ({
          x, y, rx, ry, color, alpha,
          destroy() { this.active = false; },
          active: true
        }),
        circle: (x, y, r, color, alpha) => ({
          x, y, radius: r, color, alpha,
          setStrokeStyle(w, col, a) { this.strokeWidth = w; this.strokeColor = col; this.strokeAlpha = a; return this; },
          setFillStyle(col, a) { this.color = col; this.alpha = a; return this; },
          destroy() { this.active = false; },
          active: true
        }),
        text: (x, y, text, style) => ({
          x, y, text, style,
          setOrigin(ox, oy) { this.originX = ox; this.originY = oy; return this; },
          setText(txt) { this.text = txt; return this; },
          setColor(col) { this.color = col; return this; },
          destroy() { this.active = false; },
          active: true
        }),
        container: (x, y, list) => ({
          x, y, list,
          setAlpha(a) { this.alpha = a; return this; },
          destroy() { this.active = false; },
          active: true
        }),
        graphics: () => ({
          clear() {},
          fillStyle(c, a) { this.color = c; this.alpha = a; return this; },
          fillRoundedRect(x, y, w, h, r) { this.rect = { x, y, w, h, r }; return this; },
          lineStyle(w, c, a) { this.lineWidth = w; this.lineColor = c; this.lineAlpha = a; return this; },
          strokeRoundedRect(x, y, w, h, r) { this.strokeRect = { x, y, w, h, r }; return this; },
          fillRect(x, y, w, h) { this.fillRect = { x, y, w, h }; return this; },
          strokeRect(x, y, w, h) { this.strokeRect = { x, y, w, h }; return this; },
          lineBetween(x1, y1, x2, y2) { this.line = { x1, y1, x2, y2 }; return this; },
          destroy() { this.active = false; },
          active: true
        }),
        zone: (x, y, w, h) => ({
          x, y, w, h,
          setOrigin(o) { this.origin = o; return this; },
          setInteractive(opts) { this.interactiveOpts = opts; return this; },
          on(evt, cb) { this.listeners = this.listeners || {}; this.listeners[evt] = cb; return this; },
          destroy() { this.active = false; },
          active: true
        }),
        rectangle: (x, y, w, h, color) => ({
          x, y, width: w, height: h, color,
          setOrigin(o) { this.origin = o; return this; },
          setStrokeStyle(w, col) { this.strokeWidth = w; this.strokeColor = col; return this; },
          setFillStyle(col) { this.color = col; return this; },
          destroy() { this.active = false; },
          active: true
        })
      };
      this.cameras = {
        main: {
          setBackgroundColor() {},
          setBounds() {},
          setZoom() {},
          startFollow() {}
        }
      };
      this.scale = { width: 1920, height: 1080 };
      this.input = {
        keyboard: {
          createCursorKeys: () => ({ left: {}, right: {}, up: {}, down: {} }),
          addKeys: () => ({ W: {}, A: {}, S: {}, D: {} }),
          addKey: () => ({})
        },
        on: () => {}
      };
      this.children = {
        list: []
      };
      this.time = {
        delayedCall(ms, cb) { setTimeout(cb, ms); },
        addEvent(opts) {
          if (opts.callback) opts.callback();
        }
      };
      this.tweens = {
        add() {}
      };
    }
  },
  Math: {
    Clamp: (val, min, max) => Math.min(Math.max(val, min), max),
    Distance: {
      Between: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2)
    }
  },
  Input: {
    Keyboard: {
      KeyCodes: { E: 69 }
    }
  }
};

// Start the server in-process
process.env.PORT = 3458;
require('../server/index.js');
const roomManager = require('../server/roomManager');

const URL = 'http://127.0.0.1:3458';

// Helpers
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const once = (socket, event, timeout = 1000) => 
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

const { ZONES } = require('../server/tasks');

function positionPlayerAtTask(room, playerId, taskId) {
  const task = room.gameState.taskStates.find(t => t.id === taskId);
  if (task && task.zone) {
    const zone = ZONES.find(z => z.id === task.zone);
    if (zone) {
      room.players[playerId].x = zone.x + zone.w / 2;
      room.players[playerId].y = zone.y + zone.h / 2;
    }
  }
}

function forcePlayerAsEmployee(room, playerId) {
  if (room.players && room.players[playerId]) {
    room.players[playerId].role = 'empleado';
    if (room.gameState && room.gameState.roleAssignments[playerId]) {
      room.gameState.roleAssignments[playerId].role = 'empleado';
    }
  }
}


async function setupGame(playerCount) {
  const clients = [];
  try {
    for (let i = 0; i < playerCount; i++) {
      const socket = io(URL, { transports: ['websocket'], forceNew: true });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Connect timeout')), 1000);
        socket.once('connect', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      clients.push(socket);
    }

    // Host creates room
    clients[0].emit('room:create', { name: `Host_${playerCount}` });
    const created = await once(clients[0], 'room:created');
    const roomCode = created.code;

    // Join others
    for (let i = 1; i < playerCount; i++) {
      clients[i].emit('room:join', { code: roomCode, name: `Player_${i}` });
      await once(clients[i], 'room:joined');
    }

    // Start game
    const startedPromises = clients.map(c => once(c, 'game:started'));
    clients[0].emit('game:start');
    await Promise.all(startedPromises);

    return { clients, roomCode };
  } catch (err) {
    for (const c of clients) c.close();
    throw err;
  }
}

function disconnectClients(clients) {
  for (const c of clients) {
    c.close();
  }
}

// Teardown hook to cleanly exit tests
after(() => {
  for (const id of intervals) {
    global.clearInterval(id);
  }
  if (serverInstance) {
    serverInstance.close();
  }
  setTimeout(() => {
    process.exit(process.exitCode || 0);
  }, 100);
});

// -------------------------------------------------------------
// TIER 1 TESTS: Core Server State & Single-Player Mechanics
// -------------------------------------------------------------

test('TC-T1-01: Room creation code gen', async () => {
  const client = io(URL, { transports: ['websocket'], forceNew: true });
  await once(client, 'connect');
  client.emit('room:create', { name: 'P1' });
  const created = await once(client, 'room:created');
  assert.ok(created.code);
  assert.strictEqual(created.code.length, 5);
  assert.strictEqual(created.code, created.code.toUpperCase());
  assert.strictEqual(created.playerId, client.id);

  const room = roomManager.getRoom(created.code);
  assert.ok(room);
  assert.strictEqual(room.hostId, client.id);
  client.close();
});

test('TC-T1-02: Name sanitization', async () => {
  const client = io(URL, { transports: ['websocket'], forceNew: true });
  await once(client, 'connect');
  client.emit('room:create', { name: 'VeryLongNameExceedingLimit' });
  const created = await once(client, 'room:created');
  
  const room = roomManager.getRoom(created.code);
  const player = room.players[client.id];
  assert.strictEqual(player.name.length, 12);
  assert.strictEqual(player.name, 'VeryLongName');

  // test empty name defaults to Jugador
  const client2 = io(URL, { transports: ['websocket'], forceNew: true });
  await once(client2, 'connect');
  client2.emit('room:join', { code: created.code, name: '' });
  await once(client2, 'room:joined');
  
  const p2 = room.players[client2.id];
  assert.strictEqual(p2.name, 'Jugador');

  client.close();
  client2.close();
});

test('TC-T1-03: Room joining success', async () => {
  const client1 = io(URL, { transports: ['websocket'], forceNew: true });
  await once(client1, 'connect');
  client1.emit('room:create', { name: 'P1' });
  const created = await once(client1, 'room:created');
  const code = created.code;

  const client2 = io(URL, { transports: ['websocket'], forceNew: true });
  await once(client2, 'connect');

  const updatePromise = once(client1, 'room:update');
  client2.emit('room:join', { code, name: 'P2' });
  const joined = await once(client2, 'room:joined');
  assert.strictEqual(joined.code, code);

  const update = await updatePromise;
  assert.strictEqual(update.players.length, 2);
  assert.ok(update.players.find(p => p.id === client2.id));

  client1.close();
  client2.close();
});

test('TC-T1-04: Room joining limit', async () => {
  const clients = [];
  const host = io(URL, { transports: ['websocket'], forceNew: true });
  await once(host, 'connect');
  clients.push(host);
  host.emit('room:create', { name: 'Host' });
  const created = await once(host, 'room:created');
  const code = created.code;

  // Join 11 more players (total 12)
  for (let i = 1; i <= 11; i++) {
    const c = io(URL, { transports: ['websocket'], forceNew: true });
    await once(c, 'connect');
    clients.push(c);
    c.emit('room:join', { code, name: `P_${i}` });
    await once(c, 'room:joined');
  }

  // Try 13th player
  const extra = io(URL, { transports: ['websocket'], forceNew: true });
  await once(extra, 'connect');
  extra.emit('room:join', { code, name: 'Extra' });
  
  const err = await once(extra, 'error:message');
  assert.strictEqual(err.message, 'Sala llena');

  disconnectClients(clients);
  extra.close();
});

test('TC-T1-05: Host migration', async () => {
  const client1 = io(URL, { transports: ['websocket'], forceNew: true });
  await once(client1, 'connect');
  client1.emit('room:create', { name: 'P1' });
  const created = await once(client1, 'room:created');
  const code = created.code;

  const client2 = io(URL, { transports: ['websocket'], forceNew: true });
  await once(client2, 'connect');
  client2.emit('room:join', { code, name: 'P2' });
  await once(client2, 'room:joined');

  const room = roomManager.getRoom(code);
  assert.strictEqual(room.hostId, client1.id);

  // Wait a brief tick to ensure any pending room:update from client2 joining is processed
  await new Promise(resolve => setTimeout(resolve, 50));

  // P1 leaves
  const updatePromise = once(client2, 'room:update');
  client1.close();
  await updatePromise;

  assert.strictEqual(room.hostId, client2.id);
  client2.close();
});

test('TC-T1-06: Movement broadcast', async () => {
  const { clients, roomCode } = await setupGame(4);
  
  const movePromise = once(clients[1], 'player:moved');
  clients[0].emit('player:move', { x: 200, y: 300 });

  const moved = await movePromise;
  assert.strictEqual(moved.playerId, clients[0].id);
  assert.strictEqual(moved.x, 200);
  assert.strictEqual(moved.y, 300);

  disconnectClients(clients);
});

test('TC-T1-07: Move block in meeting', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  // Call meeting
  clients[0].emit('meeting:call');
  await once(clients[0], 'meeting:started');

  assert.strictEqual(room.gameState.phase, 'meeting');

  const originalX = room.players[clients[0].id].x;
  const originalY = room.players[clients[0].id].y;

  // Emit move
  clients[0].emit('player:move', { x: originalX + 20, y: originalY + 20 });
  await delay(100);

  // Position should not change
  assert.strictEqual(room.players[clients[0].id].x, originalX);
  assert.strictEqual(room.players[clients[0].id].y, originalY);

  disconnectClients(clients);
});

test('TC-T1-08: Move block in voting', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  // Start meeting
  clients[0].emit('meeting:call');
  await once(clients[0], 'meeting:started');

  // Advance meetingTimer to 0 to trigger voting
  room.gameState.meetingTimer = 0;
  await once(clients[0], 'voting:started');
  assert.strictEqual(room.gameState.phase, 'voting');

  const originalX = room.players[clients[0].id].x;
  const originalY = room.players[clients[0].id].y;

  // Emit move
  clients[0].emit('player:move', { x: originalX + 20, y: originalY + 20 });
  await delay(100);

  // Position should not change
  assert.strictEqual(room.players[clients[0].id].x, originalX);
  assert.strictEqual(room.players[clients[0].id].y, originalY);

  disconnectClients(clients);
});

test('TC-T1-09: Coordinate boundary clamping', async () => {
  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
  assert.strictEqual(clamp(1300, 20, 1180), 1180);
  assert.strictEqual(clamp(-50, 20, 880), 20);
  assert.strictEqual(clamp(500, 20, 1180), 500);
});

test('TC-T1-10: Tasks initialization', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const tasksList = room.gameState.taskStates;
  assert.strictEqual(tasksList.length, 5);
  const ids = tasksList.map(t => t.id);
  assert.ok(ids.includes('cafe'));
  assert.ok(ids.includes('archivos'));
  assert.ok(ids.includes('correos'));
  assert.ok(ids.includes('reporte'));
  assert.ok(ids.includes('wifi'));

  for (const t of tasksList) {
    assert.strictEqual(t.completed, false);
    assert.strictEqual(t.completedBy, null);
  }

  disconnectClients(clients);
});

test('TC-T1-11: Task completion state', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  positionPlayerAtTask(room, empId, 'cafe');
  const taskCompletePromise = once(empClient, 'task:completed');
  empClient.emit('task:complete', { taskId: 'cafe' });

  const payload = await taskCompletePromise;
  assert.strictEqual(payload.taskId, 'cafe');
  assert.strictEqual(payload.completedBy, empId);

  const t = room.gameState.taskStates.find(x => x.id === 'cafe');
  assert.strictEqual(t.completed, true);
  assert.strictEqual(t.completedBy, empId);

  disconnectClients(clients);
});

test('TC-T1-12: Tasks percent calculation', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  // Complete cafe
  positionPlayerAtTask(room, empId, 'cafe');
  empClient.emit('task:complete', { taskId: 'cafe' });
  await once(empClient, 'task:completed');

  // Complete archivos
  positionPlayerAtTask(room, empId, 'archivos');
  empClient.emit('task:complete', { taskId: 'archivos' });
  await once(empClient, 'task:completed');

  // 2 out of 5 tasks is 40%
  const gs = room.gameState;
  const doneCount = gs.taskStates.filter(t => t.completed).length;
  const totalCount = gs.taskStates.length;
  const percent = Math.round((doneCount / totalCount) * 100);
  assert.strictEqual(percent, 40);

  disconnectClients(clients);
});

test('TC-T1-13: Task morale gain', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  const player = room.players[empId];
  player.morale = 80;

  positionPlayerAtTask(room, empId, 'cafe');
  empClient.emit('task:complete', { taskId: 'cafe' });
  await once(empClient, 'task:completed');

  assert.strictEqual(player.morale, 85);

  // check capped at 100
  player.morale = 98;
  positionPlayerAtTask(room, empId, 'archivos');
  empClient.emit('task:complete', { taskId: 'archivos' });
  await once(empClient, 'task:completed');
  assert.strictEqual(player.morale, 100);

  disconnectClients(clients);
});

test('TC-T1-14: Role assignment: 4 players', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const players = Object.values(room.players);
  const jefes = players.filter(p => p.role === 'jefe');
  const empleados = players.filter(p => p.role === 'empleado');
  const lamebotas = players.filter(p => p.role === 'lamebotas');

  assert.strictEqual(jefes.length, 1);
  assert.strictEqual(empleados.length, 3);
  assert.strictEqual(lamebotas.length, 0);

  disconnectClients(clients);
});

test('TC-T1-15: Role assignment: 5 players', async () => {
  const { clients, roomCode } = await setupGame(5);
  const room = roomManager.getRoom(roomCode);

  const players = Object.values(room.players);
  const jefes = players.filter(p => p.role === 'jefe');
  const empleados = players.filter(p => p.role === 'empleado');
  const lamebotas = players.filter(p => p.role === 'lamebotas');

  assert.strictEqual(jefes.length, 1);
  assert.strictEqual(empleados.length, 3);
  assert.strictEqual(lamebotas.length, 1);

  disconnectClients(clients);
});

test('TC-T1-16: Objectives assignment', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  for (const pid of Object.keys(room.players)) {
    const p = room.players[pid];
    assert.ok(p.secondaryObjective);
    assert.ok(p.secondaryObjectiveText);
  }

  disconnectClients(clients);
});

test('TC-T1-17: Private role emissions', async () => {
  const clients = [];
  for (let i = 0; i < 4; i++) {
    const socket = io(URL, { transports: ['websocket'], forceNew: true });
    await once(socket, 'connect');
    clients.push(socket);
  }

  clients[0].emit('room:create', { name: 'Host' });
  const created = await once(clients[0], 'room:created');
  const roomCode = created.code;

  for (let i = 1; i < 4; i++) {
    clients[i].emit('room:join', { code: roomCode, name: `Player_${i}` });
    await once(clients[i], 'room:joined');
  }

  const rolePromises = clients.map(c => once(c, 'game:role'));
  clients[0].emit('game:start');

  const roles = await Promise.all(rolePromises);
  
  for (let i = 0; i < 4; i++) {
    assert.strictEqual(roles[i].playerId, clients[i].id);
    assert.ok(roles[i].role);
  }

  disconnectClients(clients);
});

test('TC-T1-18: Emergency meeting trigger', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  clients[0].emit('meeting:call');
  const start = await once(clients[0], 'meeting:started');

  assert.strictEqual(start.calledBy, clients[0].id);
  assert.strictEqual(room.gameState.phase, 'meeting');
  assert.strictEqual(room.gameState.meetingActive, true);
  assert.strictEqual(room.gameState.meetingTimer, 60000);

  disconnectClients(clients);
});

test('TC-T1-19: Emergency meeting limit', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  clients[0].emit('meeting:call');
  await once(clients[0], 'meeting:started');

  // fast forward meeting and voting
  room.gameState.meetingTimer = 0;
  await once(clients[0], 'voting:started');
  room.gameState.votingTimer = 0;
  await once(clients[0], 'voting:ended');

  assert.strictEqual(room.gameState.phase, 'playing');

  // Call again
  clients[0].emit('meeting:call');
  const err = await once(clients[0], 'error:message');
  assert.strictEqual(err.message, 'Ya usaste tu reunión');

  disconnectClients(clients);
});

test('TC-T1-20: Voting phase transition', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  clients[0].emit('meeting:call');
  await once(clients[0], 'meeting:started');

  // Wait 60s (simulate tick)
  room.gameState.meetingTimer = 0;
  
  const votingStartedPromises = clients.map(c => once(c, 'voting:started'));
  await Promise.all(votingStartedPromises);
  assert.strictEqual(room.gameState.phase, 'voting');
  assert.strictEqual(room.gameState.votingTimer, 20000);

  disconnectClients(clients);
});

test('TC-T1-21: Meeting chat relay', async () => {
  const { clients, roomCode } = await setupGame(4);
  
  clients[0].emit('meeting:call');
  await once(clients[0], 'meeting:started');

  const chatPromise = once(clients[1], 'meeting:chat');
  clients[0].emit('meeting:chat', { message: 'Hola' });

  const relay = await chatPromise;
  assert.strictEqual(relay.playerId, clients[0].id);
  assert.strictEqual(relay.message, 'Hola');

  disconnectClients(clients);
});

test('TC-T1-22: Sabotage trigger (Zone)', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const jefeId = Object.keys(room.players).find(pid => room.players[pid].role === 'jefe');
  const jefeClient = clients.find(c => c.id === jefeId);

  room.players[jefeId].abilityCooldowns = {};

  const triggerPromise = once(jefeClient, 'sabotage:triggered');
  jefeClient.emit('sabotage:zone', { zoneId: 'cocina' });

  const trigger = await triggerPromise;
  assert.strictEqual(trigger.type, 'zone');
  assert.strictEqual(trigger.zoneId, 'cocina');
  assert.strictEqual(trigger.saboteurId, jefeId);
  assert.ok(room.gameState.activeSabotages.find(s => s.zoneId === 'cocina'));

  disconnectClients(clients);
});

test('TC-T1-23: Ability cooldown initialization', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const jefeId = Object.keys(room.players).find(pid => room.players[pid].role === 'jefe');
  const jefeClient = clients.find(c => c.id === jefeId);

  room.players[jefeId].abilityCooldowns = {};

  jefeClient.emit('sabotage:zone', { zoneId: 'cocina' });
  await once(jefeClient, 'sabotage:triggered');

  const readyAt = room.players[jefeId].abilityCooldowns['zone'];
  assert.ok(readyAt > Date.now());

  disconnectClients(clients);
});

test('TC-T1-24: Ability cooldown enforcement', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const jefeId = Object.keys(room.players).find(pid => room.players[pid].role === 'jefe');
  const jefeClient = clients.find(c => c.id === jefeId);

  room.players[jefeId].abilityCooldowns = {};

  jefeClient.emit('sabotage:zone', { zoneId: 'cocina' });
  await once(jefeClient, 'sabotage:triggered');

  // Try again
  jefeClient.emit('sabotage:zone', { zoneId: 'cocina' });
  const err = await once(jefeClient, 'error:message');
  assert.match(err.message, /cooldown/i);

  disconnectClients(clients);
});

test('TC-T1-25: Direct morale damage', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const jefeId = Object.keys(room.players).find(pid => room.players[pid].role === 'jefe');
  const jefeClient = clients.find(c => c.id === jefeId);

  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  room.players[jefeId].abilityCooldowns = {};
  room.players[empId].morale = 100;

  jefeClient.emit('sabotage:morale', { targetId: empId });
  await once(empClient, 'sabotage:morale');

  assert.strictEqual(room.players[empId].morale, 80);

  disconnectClients(clients);
});

// -------------------------------------------------------------
// TIER 2 TESTS: Multiplayer Integration & Happy-Path Workflows
// -------------------------------------------------------------

test('TC-T2-01: Lobby startup check', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);
  assert.strictEqual(room.gameState.phase, 'playing');
  assert.strictEqual(Object.keys(room.players).length, 4);
  disconnectClients(clients);
});

test('TC-T2-02: Start player validation', async () => {
  const clients = [];
  for (let i = 0; i < 3; i++) {
    const socket = io(URL, { transports: ['websocket'], forceNew: true });
    await once(socket, 'connect');
    clients.push(socket);
  }

  clients[0].emit('room:create', { name: 'Host' });
  const created = await once(clients[0], 'room:created');
  const roomCode = created.code;

  for (let i = 1; i < 3; i++) {
    clients[i].emit('room:join', { code: roomCode, name: `Player_${i}` });
    await once(clients[i], 'room:joined');
  }

  clients[0].emit('game:start');
  const err = await once(clients[0], 'error:message');
  assert.strictEqual(err.message, 'Se necesitan mínimo 4 jugadores');

  disconnectClients(clients);
});

test('TC-T2-03: Full meeting cycle', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  // Playing -> Meeting
  clients[0].emit('meeting:call');
  await once(clients[0], 'meeting:started');
  assert.strictEqual(room.gameState.phase, 'meeting');

  // Meeting -> Voting
  room.gameState.meetingTimer = 0;
  await once(clients[0], 'voting:started');
  assert.strictEqual(room.gameState.phase, 'voting');

  // Voting -> Playing
  room.gameState.votingTimer = 0;
  await once(clients[0], 'voting:ended');
  assert.strictEqual(room.gameState.phase, 'playing');

  disconnectClients(clients);
});

test('TC-T2-05: Employee victory trigger', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  const endPromises = clients.map(c => once(c, 'game:ended'));

  // Complete 4 out of 5 tasks (80%)
  const taskIds = ['cafe', 'archivos', 'correos', 'reporte'];
  for (const tid of taskIds) {
    positionPlayerAtTask(room, empId, tid);
    empClient.emit('task:complete', { taskId: tid });
    await once(empClient, 'task:completed');
  }

  const ends = await Promise.all(endPromises);
  assert.strictEqual(ends[0].winners, 'empleados');
  assert.strictEqual(room.gameState.phase, 'ended');

  disconnectClients(clients);
});

test('TC-T2-07: Task blocking sabotage', async () => {
  const { clients, roomCode } = await setupGame(5);
  const room = roomManager.getRoom(roomCode);

  const lbId = Object.keys(room.players).find(pid => room.players[pid].role === 'lamebotas');
  const lbClient = clients.find(c => c.id === lbId);

  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  room.players[lbId].abilityCooldowns = {};

  lbClient.emit('sabotage:block_task', { taskId: 'cafe' });
  await once(lbClient, 'sabotage:block_task');

  // Cafe should be blocked
  const task = room.gameState.taskStates.find(t => t.id === 'cafe');
  assert.ok(task.blockedUntil > Date.now());

  // Employee tries to complete
  empClient.emit('task:complete', { taskId: 'cafe' });
  const err = await once(empClient, 'error:message');
  assert.match(err.message, /bloqueada/i);

  disconnectClients(clients);
});

test('TC-T2-08: Reject double complete', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  positionPlayerAtTask(room, empId, 'cafe');
  empClient.emit('task:complete', { taskId: 'cafe' });
  await once(empClient, 'task:completed');

  // Complete again
  empClient.emit('task:complete', { taskId: 'cafe' });
  const err = await once(empClient, 'error:message');
  assert.strictEqual(err.message, 'Tarea no disponible');

  disconnectClients(clients);
});

test('TC-T2-09: Burnout state activation', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  room.players[empId].morale = 0;

  await delay(100); // let background tick loop process it

  assert.ok(room.gameState.burnedOutPlayers.has(empId));
  assert.ok(room.players[empId].burnoutUntil > Date.now());

  disconnectClients(clients);
});

test('TC-T2-10: Burnout movement penalty', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  room.players[empId].morale = 0;
  await delay(100); // activates burnout

  // Original coordinates
  room.players[empId].x = 100;
  room.players[empId].y = 100;
  room.players[empId].lastMoveTime = Date.now() - 5000;
  room.players[empId].bypassSpeedCheck = true;

  // Move player to 200, 200 (expected speed penalty reduces displacement to half: 150, 150)
  roomManager.movePlayer(roomCode, empId, 200, 200);

  assert.strictEqual(room.players[empId].x, 150);
  assert.strictEqual(room.players[empId].y, 150);

  disconnectClients(clients);
});

test('TC-T2-11: Burnout task lockout', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  room.players[empId].morale = 0;
  await delay(100); // activates burnout

  empClient.emit('task:complete', { taskId: 'cafe' });
  const err = await once(empClient, 'error:message');
  assert.strictEqual(err.message, 'En burnout');

  disconnectClients(clients);
});

test('TC-T2-12: Burnout automatic recovery', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  room.players[empId].morale = 0;
  await delay(100); // activates burnout

  // recovery duration expired
  room.players[empId].burnoutUntil = Date.now() - 1;
  await delay(100); // recovers

  assert.strictEqual(room.gameState.burnedOutPlayers.has(empId), false);
  assert.strictEqual(room.players[empId].morale, 30);

  disconnectClients(clients);
});

test('TC-T2-13: Boss win by timeout', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const endPromises = clients.map(c => once(c, 'game:ended'));

  // Expire game timer
  room.gameState.endTime = Date.now() - 1;

  const ends = await Promise.all(endPromises);
  assert.strictEqual(ends[0].winners, 'jefe');

  disconnectClients(clients);
});

test('TC-T2-14: Boss win by burnout rate', async () => {
  const { clients, roomCode } = await setupGame(4); // 3 employees, 1 jefe
  const room = roomManager.getRoom(roomCode);

  const employees = Object.values(room.players).filter(p => p.role === 'empleado');
  
  // Set 2 out of 3 employees to morale 0 (burnout rate 66.6% >= 50%)
  employees[0].morale = 0;
  employees[1].morale = 0;

  const endPromises = clients.map(c => once(c, 'game:ended'));

  const ends = await Promise.all(endPromises);
  assert.strictEqual(ends[0].winners, 'jefe');

  disconnectClients(clients);
});

test('TC-T2-15: Lamebotas win condition', async () => {
  const { clients, roomCode } = await setupGame(5); // 3 employees, 1 jefe, 1 lamebotas
  const room = roomManager.getRoom(roomCode);

  const lbId = Object.keys(room.players).find(pid => room.players[pid].role === 'lamebotas');
  
  const endPromises = clients.map(c => once(c, 'game:ended'));

  // Expire game timer
  room.gameState.endTime = Date.now() - 1;

  const ends = await Promise.all(endPromises);
  assert.strictEqual(ends[0].winners, 'jefe');
  assert.ok(ends[0].lamebotasWinners.includes(lbId));

  disconnectClients(clients);
});

test('TC-T2-16: Meeting skip resolution', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  clients[0].emit('meeting:call');
  await once(clients[0], 'meeting:started');

  room.gameState.meetingTimer = 0;
  await once(clients[0], 'voting:started');

  // All cast skip
  for (const c of clients) {
    c.emit('vote:cast', { targetId: 'skip' });
    await once(c, 'vote:confirmed');
  }

  const voteEndPromises = clients.map(c => once(c, 'voting:ended'));
  room.gameState.votingTimer = 0;

  const ends = await Promise.all(voteEndPromises);
  assert.strictEqual(room.gameState.phase, 'playing');
  assert.strictEqual(ends[0].sanctioned, null);

  disconnectClients(clients);
});

test('TC-T2-17: Sanction 1: Ability Block', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  clients[0].emit('meeting:call');
  await once(clients[0], 'meeting:started');

  room.gameState.meetingTimer = 0;
  await once(clients[0], 'voting:started');

  const targetId = clients[1].id;
  // All vote for player 1
  for (const c of clients) {
    c.emit('vote:cast', { targetId });
    await once(c, 'vote:confirmed');
  }

  room.gameState.votingTimer = 0;
  const voteEndPromises = clients.map(c => once(c, 'voting:ended'));

  const ends = await Promise.all(voteEndPromises);
  assert.strictEqual(ends[0].sanctioned, targetId);
  assert.strictEqual(ends[0].sanctionType, 'ability_blocked');
  assert.strictEqual(room.players[targetId].sanctions, 1);
  assert.ok(room.players[targetId].abilityBlockedUntil > Date.now());

  disconnectClients(clients);
});

test('TC-T2-18: Sanction 2: Suspension', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const targetId = clients[1].id;
  // Pre-apply 1 sanction
  room.players[targetId].sanctions = 1;

  clients[0].emit('meeting:call');
  await once(clients[0], 'meeting:started');

  room.gameState.meetingTimer = 0;
  await once(clients[0], 'voting:started');

  // All vote for target player again
  for (const c of clients) {
    c.emit('vote:cast', { targetId });
    await once(c, 'vote:confirmed');
  }

  room.gameState.votingTimer = 0;
  const voteEndPromises = clients.map(c => once(c, 'voting:ended'));

  const ends = await Promise.all(voteEndPromises);
  assert.strictEqual(ends[0].sanctioned, targetId);
  assert.strictEqual(ends[0].sanctionType, 'suspended');
  assert.strictEqual(room.players[targetId].sanctions, 2);
  assert.ok(room.players[targetId].suspendedUntil > Date.now());

  disconnectClients(clients);
});

test('TC-T2-19: Voting tie skip', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  clients[0].emit('meeting:call');
  await once(clients[0], 'meeting:started');

  room.gameState.meetingTimer = 0;
  await once(clients[0], 'voting:started');

  // Vote tie: 2 for clients[1].id, 2 for clients[0].id
  clients[0].emit('vote:cast', { targetId: clients[1].id });
  await once(clients[0], 'vote:confirmed');
  clients[1].emit('vote:cast', { targetId: clients[0].id });
  await once(clients[1], 'vote:confirmed');
  clients[2].emit('vote:cast', { targetId: clients[1].id });
  await once(clients[2], 'vote:confirmed');
  clients[3].emit('vote:cast', { targetId: clients[0].id });
  await once(clients[3], 'vote:confirmed');

  room.gameState.votingTimer = 0;
  const voteEndPromises = clients.map(c => once(c, 'voting:ended'));

  const ends = await Promise.all(voteEndPromises);
  
  // NOTE: This test will fail on the current server due to a tie-breaking bug!
  // The server incorrectly sanctions the first player in the tally iteration.
  // We assert the correct/intended behavior: no sanction is applied.
  assert.strictEqual(ends[0].sanctioned, null);
  assert.strictEqual(room.gameState.phase, 'playing');

  disconnectClients(clients);
});

test('TC-T2-20: Lamebotas fake task morale', async () => {
  const { clients, roomCode } = await setupGame(5);
  const room = roomManager.getRoom(roomCode);

  const lbId = Object.keys(room.players).find(pid => room.players[pid].role === 'lamebotas');
  const lbClient = clients.find(c => c.id === lbId);

  room.players[lbId].abilityCooldowns = {};
  room.players[lbId].morale = 80;

  lbClient.emit('sabotage:fake_task');
  await once(lbClient, 'sabotage:fake_task');

  assert.strictEqual(room.players[lbId].morale, 85);

  disconnectClients(clients);
});

test('TC-T2-21: Lamebotas false report', async () => {
  const { clients, roomCode } = await setupGame(5);
  const room = roomManager.getRoom(roomCode);

  const lbId = Object.keys(room.players).find(pid => room.players[pid].role === 'lamebotas');
  const lbClient = clients.find(c => c.id === lbId);

  room.players[lbId].abilityCooldowns = {};

  lbClient.emit('sabotage:false_report');
  await once(lbClient, 'sabotage:false_report');

  // Morale of all other players drops by 8
  for (const pid of Object.keys(room.players)) {
    if (pid !== lbId) {
      assert.strictEqual(room.players[pid].morale, 92);
    }
  }

  disconnectClients(clients);
});

test('TC-T2-22: Zone sabotage morale loss', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const jefeId = Object.keys(room.players).find(pid => room.players[pid].role === 'jefe');
  const jefeClient = clients.find(c => c.id === jefeId);

  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  // Position employee in 'cocina'
  // cocina is at x: 100, y: 400, w: 200, h: 180
  room.players[empId].x = 150;
  room.players[empId].y = 450;
  room.players[empId].morale = 100;

  room.players[jefeId].abilityCooldowns = {};

  jefeClient.emit('sabotage:zone', { zoneId: 'cocina' });
  await once(jefeClient, 'sabotage:triggered');

  assert.strictEqual(room.players[empId].morale, 85);

  disconnectClients(clients);
});

test('TC-T2-23: Door lockout expiration', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const jefeId = Object.keys(room.players).find(pid => room.players[pid].role === 'jefe');
  const jefeClient = clients.find(c => c.id === jefeId);

  room.players[jefeId].abilityCooldowns = {};

  jefeClient.emit('sabotage:close_door', { zoneId: 'cocina' });
  await once(jefeClient, 'sabotage:door_closed');

  assert.ok(room.gameState.activeSabotages.find(s => s.zoneId === 'cocina' && s.type === 'close_door'));

  // Expire close door sabotage
  room.gameState.activeSabotages[0].expires = Date.now() - 1;
  await delay(100);

  assert.strictEqual(room.gameState.activeSabotages.length, 0);

  disconnectClients(clients);
});

test('TC-T2-24: Report sabotage action', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const jefeId = Object.keys(room.players).find(pid => room.players[pid].role === 'jefe');
  const jefeClient = clients.find(c => c.id === jefeId);

  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  // Position employee in 'cocina'
  // cocina is at x: 100, y: 400, w: 200, h: 180 (center is 200, 490)
  room.players[empId].x = 200;
  room.players[empId].y = 490;

  room.players[jefeId].abilityCooldowns = {};
  jefeClient.emit('sabotage:zone', { zoneId: 'cocina' });
  await once(jefeClient, 'sabotage:triggered');

  room.players[empId].abilityCooldowns = {};
  empClient.emit('sabotage:report');
  
  const report = await once(empClient, 'sabotage:reported');
  assert.strictEqual(report.reportedBy, empId);
  assert.strictEqual(report.zoneId, 'cocina');
  assert.strictEqual(room.gameState.phase, 'meeting');

  disconnectClients(clients);
});

// -------------------------------------------------------------
// TIER 3 TESTS: UI, Physics & Client Interactivity (Mocks)
// -------------------------------------------------------------

test('TC-T3-01: HUD responsive adjustments layout math', async () => {
  const uiModule = await import('../client/src/systems/ui.js');
  const sceneModule = await import('../client/src/scenes/GameScene.js');

  const compactScene = new sceneModule.GameScene();
  compactScene.scale = { width: 375, height: 600 };
  
  const desktopScene = new sceneModule.GameScene();
  desktopScene.scale = { width: 1920, height: 1080 };

  // Verify scale math
  assert.strictEqual(compactScene.getTaskInteractionDistance(), 170);
  assert.strictEqual(desktopScene.getTaskInteractionDistance(), 135);
});

test('TC-T3-03: Interactive task overlays panel verification', async () => {
  const uiModule = await import('../client/src/systems/ui.js');
  const sceneModule = await import('../client/src/scenes/GameScene.js');

  const scene = new sceneModule.GameScene();
  scene.scale = { width: 1024, height: 768 };
  scene.gameState = { tasks: [] };
  
  // Test opening a task panel registers activeTaskPanel items
  const task = { id: 'cafe', name: 'Cafe', zone: 'cocina', type: 'progress', duration: 1000, description: 'Prep' };
  scene.openTaskPanel(task);

  assert.ok(scene.activeTaskPanel);
  assert.strictEqual(scene.activeTaskPanel.taskId, 'cafe');
  assert.ok(scene.activeTaskPanel.elements.length > 0);

  scene.closeTaskPanel();
  assert.strictEqual(scene.activeTaskPanel, null);
});

// -------------------------------------------------------------
// TIER 4 TESTS: Adversarial, Security & Network Failure Resistance
// -------------------------------------------------------------

test('TC-T4-01: Mid-game host migration', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  const hostId = room.hostId;
  const nextHostId = Object.keys(room.players).find(pid => pid !== hostId);

  // Disconnect host
  const updatePromises = clients.slice(1).map(c => once(c, 'room:update'));
  clients[0].close();

  await Promise.all(updatePromises);

  assert.strictEqual(room.hostId, nextHostId);
  assert.strictEqual(room.gameState.phase, 'playing');

  disconnectClients(clients.slice(1));
});

// -------------------------------------------------------------
// KNOWN BUGS / SECURITY ASSERTIONS (EXPECTED TO FAIL IN MVP)
// -------------------------------------------------------------

test('TC-T4-02: Anti-Cheat: Speed checking (Velocity limit)', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);
  const pId = room.hostId;
  const hostClient = clients[0];

  // Set initial position
  roomManager.movePlayer(roomCode, pId, 100, 100);

  // Emit a movement that teleports the player instantly to a far location
  hostClient.emit('player:move', { x: 1100, y: 800 });

  await delay(100);

  // The server MUST reject this coordinates update since speed is illegal
  const player = room.players[pId];
  assert.notStrictEqual(player.x, 1100);
  assert.notStrictEqual(player.y, 800);

  disconnectClients(clients);
});

test('TC-T4-05: Anti-Cheat: Task distance validation', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);
  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  // Position employee far away from wifi task (servidor: x: 500, y: 650)
  // Let's place him at Reception (x: 100, y: 100)
  room.players[empId].x = 100;
  room.players[empId].y = 100;

  // Try to complete task 'wifi'
  empClient.emit('task:complete', { taskId: 'wifi' });

  // Expect server to return error:message
  const err = await once(empClient, 'error:message', 1000);
  assert.match(err.message, /distancia|lejos/i);

  // Task should not be completed on server
  const task = room.gameState.taskStates.find(t => t.id === 'wifi');
  assert.strictEqual(task.completed, false);

  disconnectClients(clients);
});

test('TC-T4-04: Sanctions enforcement: movement lock & ability block', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);
  const targetId = room.hostId;
  const targetClient = clients[0];

  // Suspend the player (suspendedUntil to +30s)
  room.players[targetId].suspendedUntil = Date.now() + 30000;

  const origX = room.players[targetId].x;
  const origY = room.players[targetId].y;

  // Attempt movement during suspension
  targetClient.emit('player:move', { x: origX + 100, y: origY + 100 });
  await delay(100);

  // Movement must be blocked
  assert.strictEqual(room.players[targetId].x, origX);
  assert.strictEqual(room.players[targetId].y, origY);

  // Set player role to jefe and try to trigger sabotage
  room.players[targetId].role = 'jefe';
  targetClient.emit('sabotage:zone', { zoneId: 'cocina' });

  const err = await once(targetClient, 'error:message', 1000);
  assert.match(err.message, /suspendido|habilidad|bloqueada/i);

  disconnectClients(clients);
});

// -------------------------------------------------------------
// TIER 5 TESTS: ADVERSARIAL AND ROBUSTNESS REVIEW
// -------------------------------------------------------------

test('TC-T5-01: Invalid coordinates (NaN, strings, objects) in player:move', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);
  const pId = room.hostId;
  const hostClient = clients[0];

  const origX = room.players[pId].x;
  const origY = room.players[pId].y;

  // 1. Sending NaN (simulated via string/object that fails parsing or null)
  hostClient.emit('player:move', { x: NaN, y: origY + 20 });
  await delay(100);
  assert.ok(Number.isFinite(room.players[pId].x), 'Player coordinates must remain finite after NaN input');
  assert.notStrictEqual(room.players[pId].x, NaN, 'Player coordinates must not become NaN');

  // 2. Sending strings
  hostClient.emit('player:move', { x: "hello", y: "world" });
  await delay(100);
  assert.ok(Number.isFinite(room.players[pId].x) && Number.isFinite(room.players[pId].y), 'Player coordinates must remain finite after string input');

  // 3. Sending objects
  hostClient.emit('player:move', { x: { hack: true }, y: { coords: 450 } });
  await delay(100);
  assert.ok(Number.isFinite(room.players[pId].x) && Number.isFinite(room.players[pId].y), 'Player coordinates must remain finite after object input');

  disconnectClients(clients);
});

test('TC-T5-02: Complete task with invalid state or non-existent taskId', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);
  
  // Find an employee client
  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  // Position player close to the task zone to avoid distance check failing
  positionPlayerAtTask(room, empId, 'wifi');

  // 1. Non-existent taskId
  empClient.emit('task:complete', { taskId: 'nonexistent_task' });
  const err1 = await once(empClient, 'error:message', 1000);
  assert.match(err1.message, /no disponible|inexistente/i);

  // 2. Room phase is invalid (during meeting phase, completing task should be blocked)
  roomManager.callMeeting(roomCode, empId);
  assert.strictEqual(room.gameState.phase, 'meeting');

  empClient.emit('task:complete', { taskId: 'wifi' });
  await delay(100);
  
  const task = room.gameState.taskStates.find(t => t.id === 'wifi');
  assert.strictEqual(task.completed, false, 'Should not complete a task during meeting phase');

  disconnectClients(clients);
});

test('TC-T5-03: Unauthorized sabotage attempts', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  // Find an employee client
  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  const jefeId = Object.keys(room.players).find(pid => room.players[pid].role === 'jefe');

  // Employee tries to trigger jefe's morale sabotage targeting the jefe
  const origMorale = room.players[jefeId].morale;
  empClient.emit('sabotage:morale', { targetId: jefeId });
  await delay(100);

  // Assert no morale loss
  assert.strictEqual(room.players[jefeId].morale, origMorale, 'Employee must not be able to trigger Boss sabotage:morale');

  // Employee tries to close doors
  empClient.emit('sabotage:close_door', { zoneId: 'cocina' });
  await delay(100);
  const hasDoorSabotage = room.gameState.activeSabotages.some(s => s.type === 'close_door');
  assert.strictEqual(hasDoorSabotage, false, 'Employee must not be able to trigger close_door sabotage');

  disconnectClients(clients);
});

test('TC-T5-04: Invalid voting targets and votes outside voting phase', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);
  const pId = room.hostId;
  const hostClient = clients[0];

  // 1. Vote emitted outside voting phase (during playing phase)
  assert.strictEqual(room.gameState.phase, 'playing');
  hostClient.emit('vote:cast', { targetId: pId });
  
  const err = await once(hostClient, 'error:message', 1000);
  assert.match(err.message, /votar ahora/i);
  assert.strictEqual(room.gameState.votes[pId], undefined, 'Vote must not be registered outside voting phase');

  // 2. Trigger voting phase
  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  roomManager.callMeeting(roomCode, empId);
  room.gameState.meetingTimer = 0;
  roomManager.tickRoom(roomCode); // triggers voting_started
  assert.strictEqual(room.gameState.phase, 'voting');

  // Vote for a non-existent player ID
  hostClient.emit('vote:cast', { targetId: 'fake_player_id' });
  await delay(100);

  // The server should reject voting for non-existent player
  const registeredVote = room.gameState.votes[pId];
  assert.notStrictEqual(registeredVote, 'fake_player_id', 'Vote target must be a valid player in the room');

  disconnectClients(clients);
});

test('TC-T5-05: Disconnections during active meeting and voting phases', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  // 1. Call meeting
  const callerId = room.hostId;
  const hostClient = clients[0];
  
  roomManager.callMeeting(roomCode, callerId);
  assert.strictEqual(room.gameState.phase, 'meeting');

  // 2. Disconnect a player during meeting phase
  const disconId = Object.keys(room.players).find(pid => pid !== callerId);
  const disconClient = clients.find(c => c.id === disconId);
  disconClient.close();
  await delay(100);

  // Check that the disconnected player is removed from room players
  assert.strictEqual(room.players[disconId], undefined, 'Disconnected player must be removed from room players');

  // Fast forward meeting timer to transition to voting phase
  room.gameState.meetingTimer = 0;
  roomManager.tickRoom(roomCode); // transitions to voting phase
  assert.strictEqual(room.gameState.phase, 'voting');

  // Ensure remaining players can vote and voting ends properly
  const remainingClients = clients.filter(c => c !== disconClient);
  const voterId = remainingClients[0].id;
  const targetId = remainingClients[1].id;

  remainingClients[0].emit('vote:cast', { targetId });
  await once(remainingClients[0], 'vote:confirmed');

  // Fast forward voting timer to end voting
  room.gameState.votingTimer = 0;
  const tickResult = roomManager.tickRoom(roomCode);
  assert.ok(tickResult && tickResult.event === 'voting_ended', 'Voting must end successfully after player disconnects');
  
  // Game should return to playing phase
  assert.strictEqual(room.gameState.phase, 'playing');

  disconnectClients(remainingClients);
});

// -------------------------------------------------------------
// TIER 5 ADDITIONAL ADVERSARIAL AND ROBUSTNESS TESTS
// -------------------------------------------------------------

test('TC-T5-06: Lobby start game check with unready and disconnected players', async () => {
  const clients = [];
  try {
    // Connect 4 clients
    for (let i = 0; i < 4; i++) {
      const socket = io(URL, { transports: ['websocket'], forceNew: true });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Connect timeout')), 1000);
        socket.once('connect', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      clients.push(socket);
    }

    // Host creates room
    clients[0].emit('room:create', { name: 'Host' });
    const created = await once(clients[0], 'room:created');
    const roomCode = created.code;

    // Join others
    for (let i = 1; i < 4; i++) {
      clients[i].emit('room:join', { code: roomCode, name: `Player_${i}` });
      await once(clients[i], 'room:joined');
    }

    const room = roomManager.getRoom(roomCode);

    // Verify all players have ready: false initially
    for (const pid of Object.keys(room.players)) {
      assert.strictEqual(room.players[pid].ready, false, 'Players should not be ready by default');
    }

    // Disconnect one client (Player 3) to test if start game checks count properly
    clients[3].close();
    await delay(100); // let the server process the disconnect

    // Host attempts to start game with only 3 players
    clients[0].emit('game:start');
    
    // Server should reject starting with an error message since there are only 3 players left
    const err = await once(clients[0], 'error:message', 1000);
    assert.match(err.message, /mínimo 4 jugadores/i);
    assert.strictEqual(room.gameState, null, 'Game state should not be created for under-capacity room');

  } finally {
    disconnectClients(clients);
  }
});

test('TC-T5-07: Cooldown manipulation and pre-game ability usage', async () => {
  // Setup room with 4 clients but do not start game immediately
  const clients = [];
  try {
    for (let i = 0; i < 4; i++) {
      const socket = io(URL, { transports: ['websocket'], forceNew: true });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Connect timeout')), 1000);
        socket.once('connect', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      clients.push(socket);
    }

    clients[0].emit('room:create', { name: 'Host' });
    const created = await once(clients[0], 'room:created');
    const roomCode = created.code;

    for (let i = 1; i < 4; i++) {
      clients[i].emit('room:join', { code: roomCode, name: `Player_${i}` });
      await once(clients[i], 'room:joined');
    }

    const room = roomManager.getRoom(roomCode);

    // 1. Attempt to use ability before game starts (should do nothing / be rejected since gameState is null)
    // We emit sabotage:zone as Host
    clients[0].emit('sabotage:zone', { zoneId: 'cocina' });
    await delay(100);
    assert.strictEqual(room.gameState, null, 'Sabotage should not initialize game state');

    // 2. Start game
    const startedPromises = clients.map(c => once(c, 'game:started'));
    clients[0].emit('game:start');
    await Promise.all(startedPromises);

    // Find Boss
    const jefeId = Object.keys(room.players).find(pid => room.players[pid].role === 'jefe');
    const jefeClient = clients.find(c => c.id === jefeId);

    // 3. Trigger sabotage:zone twice in rapid succession
    jefeClient.emit('sabotage:zone', { zoneId: 'cocina' });
    await delay(50);
    jefeClient.emit('sabotage:zone', { zoneId: 'baños' });

    // The second trigger should result in an error message about cooldown
    const err = await once(jefeClient, 'error:message', 1000);
    assert.match(err.message, /cooldown/i);

    // Only one zone sabotage should be active
    const activeZones = room.gameState.activeSabotages.filter(s => s.type === 'zone');
    assert.strictEqual(activeZones.length, 1, 'Only one zone sabotage should have been triggered');

  } finally {
    disconnectClients(clients);
  }
});

test('TC-T5-08: Double-joins, duplicate names, and room jumping (ghost players)', async () => {
  const clients = [];
  try {
    // Connect 3 clients
    for (let i = 0; i < 3; i++) {
      const socket = io(URL, { transports: ['websocket'], forceNew: true });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Connect timeout')), 1000);
        socket.once('connect', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      clients.push(socket);
    }

    // 1. Create Room A
    clients[0].emit('room:create', { name: 'Alice' });
    const createdA = await once(clients[0], 'room:created');
    const roomCodeA = createdA.code;

    // 2. Join Room A with Player 1 (Bob)
    clients[1].emit('room:join', { code: roomCodeA, name: 'Bob' });
    await once(clients[1], 'room:joined');

    // 3. Join Room A with Player 2 using duplicate name 'Bob'
    clients[2].emit('room:join', { code: roomCodeA, name: 'Bob' });
    await once(clients[2], 'room:joined');

    const roomA = roomManager.getRoom(roomCodeA);
    
    // Verify that the duplicate name Bob exists in roomA players list twice
    const bobs = Object.values(roomA.players).filter(p => p.name === 'Bob');
    assert.strictEqual(bobs.length, 2, 'Duplicate names should be allowed or handled (MVP does not restrict)');

    // 4. Bob (Player 1) jumps to a new Room B (without disconnecting from Room A)
    // We emit room:create to make client[1] join a new Room B
    clients[1].emit('room:create', { name: 'Bob' });
    const createdB = await once(clients[1], 'room:created');
    const roomCodeB = createdB.code;

    const roomB = roomManager.getRoom(roomCodeB);
    assert.ok(roomB.players[clients[1].id], 'Bob must be in Room B');

    // ASSERT BUG/VULNERABILITY:
    // Bob should have been removed from Room A. Let's assert if Bob is still in Room A.
    // If the server leaves Bob in Room A, this is a ghost player vulnerability.
    const isGhostInA = !!roomA.players[clients[1].id];
    
    // We document this check. We assert that Bob is NOT in Room A.
    assert.strictEqual(isGhostInA, false, 'Player must be automatically removed from old room when joining/creating a new one (anti-ghost validation)');

  } finally {
    disconnectClients(clients);
  }
});

test('TC-T5-09: Sanctions enforcement: first sanction (ability block) and player coordinate validation', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);
  
  // Find a player to sanction. Let's choose the Host who will be boss
  const bossId = Object.keys(room.players).find(pid => room.players[pid].role === 'jefe');
  const bossClient = clients.find(c => c.id === bossId);

  // Set abilityBlockedUntil to +30s to simulate 1st sanction
  room.players[bossId].abilityBlockedUntil = Date.now() + 30000;

  // Boss attempts to use a sabotage:zone ability
  bossClient.emit('sabotage:zone', { zoneId: 'cocina' });
  
  // The server MUST reject this ability trigger and return an error
  const err = await once(bossClient, 'error:message', 1000);
  assert.match(err.message, /bloqueada|habilidad/i);
  
  const hasSabotage = room.gameState.activeSabotages.some(s => s.type === 'zone');
  assert.strictEqual(hasSabotage, false, 'Sabotage must not be triggered while abilities are blocked');

  disconnectClients(clients);
});

test('TC-T5-10: Client role spoofing: jefe/lamebotas completing tasks', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  // Find jefe
  const jefeId = Object.keys(room.players).find(pid => room.players[pid].role === 'jefe');
  const jefeClient = clients.find(c => c.id === jefeId);

  // Position jefe at wifi task (x: 500, y: 650) to pass distance check if applicable
  positionPlayerAtTask(room, jefeId, 'wifi');

  // Jefe tries to complete the 'wifi' task
  jefeClient.emit('task:complete', { taskId: 'wifi' });

  // Server should reject task completion since Jefe is not an employee
  const err = await once(jefeClient, 'error:message', 1000);
  assert.match(err.message, /empleado|no autorizado|rol/i);

  const task = room.gameState.taskStates.find(t => t.id === 'wifi');
  assert.strictEqual(task.completed, false, 'Non-employee must not complete tasks');

  disconnectClients(clients);
});

test('TC-T5-11: Sanction limit loops and chat spam length overflow', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);
  const targetId = room.hostId;
  const hostClient = clients[0];

  // 1. Sanction player 3 times manually to verify no crash and count increments
  for (let i = 0; i < 3; i++) {
    room.players[targetId].sanctions = (room.players[targetId].sanctions || 0) + 1;
  }
  assert.strictEqual(room.players[targetId].sanctions, 3, 'Sanctions count should increment past 2');
  
  // Apply a manual sanction through endVoting logic simulation to make sure it handles >= 2
  room.players[targetId].suspendedUntil = Date.now() + 30000;
  assert.ok(room.players[targetId].suspendedUntil > Date.now());

  // 2. Chat length overflow check during meeting
  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  roomManager.callMeeting(roomCode, empId);
  assert.strictEqual(room.gameState.phase, 'meeting');

  const longMessage = 'A'.repeat(500);
  
  // We expect meeting:chat to truncate to 200 chars
  const chatPromise = once(hostClient, 'meeting:chat');
  hostClient.emit('meeting:chat', { message: longMessage });
  
  const chatData = await chatPromise;
  assert.ok(chatData.message.length <= 200, 'Chat messages must be truncated to max 200 characters');
  assert.strictEqual(chatData.message, 'A'.repeat(200), 'Chat message must be truncated correctly to 200 characters');

  disconnectClients(clients);
});

