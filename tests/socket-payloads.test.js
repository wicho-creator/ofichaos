const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { io } = require('socket.io-client');

const port = 3471;
const url = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(child) {
  for (let i = 0; i < 40; i++) {
    if (child.exitCode != null) throw new Error(`Servidor terminó antes de tiempo: ${child.exitCode}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await sleep(50);
  }
  throw new Error('Servidor no inició');
}

test('payloads hostiles no tumban ningún handler Socket.IO', async () => {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });

  try {
    await waitForServer(child);
    const socket = io(url, { transports: ['websocket'] });
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    const created = new Promise((resolve) => socket.once('room:created', resolve));
    socket.emit('room:create', { name: 'Host' });
    await created;
    const nullPayloadEvents = [
      'room:create', 'room:join', 'player:move',
      'task:start', 'task:action', 'task:complete',
      'sabotage:zone', 'sabotage:extra_task', 'sabotage:morale',
      'sabotage:close_door', 'sabotage:block_task',
      'meeting:chat', 'vote:cast'
    ];
    for (const event of nullPayloadEvents) {
      for (const payload of [null, true, 7, 'hostil', []]) socket.emit(event, payload, 'no-es-ack');
    }
    socket.emit('room:create', { name: { toString: null } });
    socket.emit('room:join', { code: { toString: null }, name: { toString: null } });
    socket.emit('meeting:chat', { message: { slice: null, toString: null } });
    socket.emit('task:action', {
      sessionId: 'hostil',
      action: { type: 'choose', value: { toString: null } }
    }, () => {});
    await sleep(100);
    socket.close();

    assert.equal(child.exitCode, null, stderr);
    assert.equal((await fetch(url)).ok, true);
  } finally {
    child.kill();
  }
});
