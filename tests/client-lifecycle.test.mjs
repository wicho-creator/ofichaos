import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

class FakeSocket extends EventEmitter {}

const socket = new FakeSocket();
globalThis.io = () => socket;
globalThis.Phaser = {
  Scene: class {
    constructor() {}
  },
  Math: {
    Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2) }
  }
};

const net = await import('../client/src/systems/networking.js');
const { getPlayerVariant } = await import('../client/src/systems/player.js');
const { GameScene } = await import('../client/src/scenes/GameScene.js');
const { MeetingScene } = await import('../client/src/scenes/MeetingScene.js');
const { LobbyScene } = await import('../client/src/scenes/LobbyScene.js');

test('subscribe devuelve un disposer exacto y disposeAll vacía la colección', () => {
  let calls = 0;
  const disposers = [net.subscribe('probe', () => calls++)];

  socket.emit('probe');
  net.disposeAll(disposers);
  socket.emit('probe');

  assert.equal(calls, 1);
  assert.deepEqual(disposers, []);
});

test('la apariencia pública depende del id y nunca del rol secreto', () => {
  assert.equal(getPlayerVariant({ id: 'ana', role: 'empleado' }, false), getPlayerVariant({ id: 'ana', role: 'jefe' }, false));
  assert.equal(getPlayerVariant({ id: 'ana', role: 'lamebotas' }, true), 'local');
});

test('una reunión pausa el juego y lanza un overlay con snapshot público', () => {
  const calls = [];
  const game = new GameScene();
  game.myId = 'ana';
  game.myRole = 'empleado';
  game.roomCode = 'ABCDE';
  game.players = {
    ana: { id: 'ana', name: 'Ana', x: 10, y: 20, morale: 90, role: 'empleado', cooldowns: { report: 1 } },
    bob: { id: 'bob', name: 'Bob', x: 30, y: 40, morale: 80, role: 'jefe', cooldowns: { zone: 1 } }
  };
  game.scene = {
    pause: (key) => calls.push(['pause', key]),
    launch: (key, data) => calls.push(['launch', key, data]),
    bringToTop: (key) => calls.push(['top', key]),
    stop: (key) => calls.push(['stop', key]),
    start: (key) => calls.push(['start', key])
  };
  game.showFloatingText = () => {};

  game.setupSocketListeners();
  socket.emit('meeting:started', { calledBy: 'bob', playerName: 'Bob' });

  assert.deepEqual(calls[0], ['pause', 'GameScene']);
  assert.equal(calls[1][0], 'launch');
  assert.equal(calls[1][1], 'MeetingScene');
  assert.equal(calls.some(([action, key]) => action === 'stop' && key === 'GameScene'), false);
  for (const player of calls[1][2].players) {
    assert.equal('role' in player, false);
    assert.equal('cooldowns' in player, false);
  }

  net.disposeAll(game.networkDisposers);
});

test('al terminar la votación se cierra el overlay y se reanuda GameScene', () => {
  const calls = [];
  const meeting = new MeetingScene();
  meeting.scene = {
    stop: (key) => calls.push(['stop', key]),
    resume: (key) => calls.push(['resume', key]),
    start: (key) => calls.push(['start', key])
  };
  meeting.time = {
    delayedCall: (delay, callback) => {
      calls.push(['delay', delay]);
      callback();
    }
  };
  meeting.showVotingResult = () => calls.push(['result']);

  meeting.setupSocketListeners();
  socket.emit('voting:ended', { tally: {}, sanctioned: null });

  assert.deepEqual(calls, [
    ['result'],
    ['delay', 1600],
    ['stop', 'MeetingScene'],
    ['resume', 'GameScene']
  ]);

  net.disposeAll(meeting.networkDisposers);
});

test('el lobby puede reiniciarse sin acumular listeners globales', () => {
  const lobby = new LobbyScene();
  lobby.showMessage = () => {};
  lobby.updateLobbyUI = () => {};
  lobby.scene = { get: () => ({}), stop: () => {}, start: () => {} };

  lobby.setupSocketListeners();
  const firstCount = socket.listenerCount('room:update');
  lobby.setupSocketListeners();

  assert.equal(firstCount, 1);
  assert.equal(socket.listenerCount('room:update'), 1);
  net.disposeAll(lobby.networkDisposers);
});

test('game:ended durante reunión detiene el overlay antes de abrir resultados', () => {
  const calls = [];
  const game = new GameScene();
  game.scene = {
    stop: (key) => calls.push(['stop', key]),
    start: (key, data) => calls.push(['start', key, data])
  };

  game.setupSocketListeners();
  const result = { winners: 'empleados' };
  socket.emit('game:ended', result);

  assert.deepEqual(calls, [
    ['stop', 'MeetingScene'],
    ['stop', 'GameScene'],
    ['start', 'EndScene', result]
  ]);
  net.disposeAll(game.networkDisposers);
});

test('game:private actualiza solo los cooldowns del jugador local', () => {
  const game = new GameScene();
  game.myId = 'ana';
  game.players = {
    ana: { id: 'ana', cooldowns: {} },
    bob: { id: 'bob' }
  };
  game.gameState = { phase: 'playing' };
  game.updateHUD = () => {};

  game.setupSocketListeners();
  socket.emit('game:private', { playerId: 'ana', cooldowns: { report_sabotage: 4200 } });
  socket.emit('game:private', { playerId: 'bob', cooldowns: { zone: 9000 } });

  assert.deepEqual(game.players.ana.cooldowns, { report_sabotage: 4200 });
  assert.equal(game.players.bob.cooldowns, undefined);
  net.disposeAll(game.networkDisposers);
});

test('el briefing privado bloquea el movimiento hasta confirmarlo', () => {
  const velocities = [];
  const game = new GameScene();
  game.briefingOpen = true;
  game.myId = 'ana';
  game.players = { ana: { id: 'ana', burnout: false } };
  game.sprites = {
    ana: { container: { body: { setVelocity: (x, y) => velocities.push([x, y]) } } }
  };

  game.update(1000, 16);

  assert.deepEqual(velocities, [[0, 0]]);
});

test('cada partida reinicia el estado efímero de la escena', () => {
  const game = new GameScene();
  game.players = { viejo: {} };
  game.sprites = { viejo: {} };
  game.gameState = { phase: 'ended' };
  game.activeTaskPanel = {};
  game.activeSabotageMenu = {};
  game.briefingOpen = true;
  game.mobileInput.left = true;

  game.resetRunState();

  assert.deepEqual(game.players, {});
  assert.deepEqual(game.sprites, {});
  assert.equal(game.gameState, null);
  assert.equal(game.activeTaskPanel, null);
  assert.equal(game.activeSabotageMenu, null);
  assert.equal(game.briefingOpen, false);
  assert.deepEqual(game.mobileInput, { left: false, right: false, up: false, down: false });
});
