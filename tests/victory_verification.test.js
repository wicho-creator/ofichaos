const test = require('node:test');
const assert = require('node:assert');
const { after } = require('node:test');
const { io } = require('socket.io-client');
const http = require('http');

let serverInstance;
const originalCreateServer = http.createServer;
http.createServer = function(...args) {
  serverInstance = originalCreateServer.apply(this, args);
  return serverInstance;
};

// Start server on a unique port
process.env.PORT = 3460;
require('../server/index.js');
const roomManager = require('../server/roomManager');

const URL = 'http://127.0.0.1:3460';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const once = (socket, event, timeout = 1500) => 
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

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
    clients[0].emit('room:create', { name: `Host` });
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

after(() => {
  if (serverInstance) {
    serverInstance.close();
  }
  setTimeout(() => {
    process.exit(0);
  }, 100);
});

test('Independent Verification: Room manager creation and joining', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);
  
  assert.ok(room, 'Room should exist in roomManager');
  assert.strictEqual(Object.keys(room.players).length, 4, 'Should have exactly 4 players');
  assert.strictEqual(room.gameState.phase, 'playing', 'Room phase should be playing after start');
  
  disconnectClients(clients);
});

test('Independent Verification: Anti-cheat coordinates speed limits validation', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);
  const pId = room.hostId;
  const hostClient = clients[0];

  // Set initial position
  roomManager.movePlayer(roomCode, pId, 100, 100);

  // Emit a movement that teleports the player instantly to a far location
  hostClient.emit('player:move', { x: 1000, y: 800 });
  await delay(100);

  // Server should reject coordinate change (retaining old or clamped position)
  const player = room.players[pId];
  assert.notStrictEqual(player.x, 1000, 'Teleport coordinates should be rejected');
  assert.notStrictEqual(player.y, 800, 'Teleport coordinates should be rejected');

  disconnectClients(clients);
});

test('Independent Verification: Task completion distance checking', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);
  
  const empId = Object.keys(room.players).find(pid => room.players[pid].role === 'empleado');
  const empClient = clients.find(c => c.id === empId);

  // Position employee far away from wifi task (servidor: x: 500, y: 650)
  room.players[empId].x = 100;
  room.players[empId].y = 100;

  // Try to complete task 'wifi'
  empClient.emit('task:complete', { taskId: 'wifi' });
  const err = await once(empClient, 'error:message', 1000);
  assert.match(err.message, /distancia|lejos/i, 'Error message should complain about distance');

  const task = room.gameState.taskStates.find(t => t.id === 'wifi');
  assert.strictEqual(task.completed, false, 'Task should not be completed when out of range');

  disconnectClients(clients);
});

test('Independent Verification: Voting tie-breaker nullifies sanction', async () => {
  const { clients, roomCode } = await setupGame(4);
  const room = roomManager.getRoom(roomCode);

  clients[0].emit('meeting:call');
  await once(clients[0], 'meeting:started');

  // Accelerate meeting timer
  room.gameState.meetingTimer = 0;
  await once(clients[0], 'voting:started');

  // Tie vote: 2 for clients[1], 2 for clients[0]
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

  assert.strictEqual(ends[0].sanctioned, null, 'Tie should result in no player being sanctioned');
  assert.strictEqual(room.gameState.phase, 'playing', 'Phase should revert back to playing');

  disconnectClients(clients);
});
