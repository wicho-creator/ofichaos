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
const { bindMobileInputLifecycle, GameScene } = await import('../client/src/scenes/GameScene.js');
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
  game.mobileInput = { left: true, right: false, up: true, down: false };

  game.setupSocketListeners();
  socket.emit('meeting:started', { calledBy: 'bob', playerName: 'Bob' });

  assert.deepEqual(calls[0], ['pause', 'GameScene']);
  assert.equal(calls[1][0], 'launch');
  assert.equal(calls[1][1], 'MeetingScene');
  assert.equal(calls.some(([action, key]) => action === 'stop' && key === 'GameScene'), false);
  assert.deepEqual(game.mobileInput, { left: false, right: false, up: false, down: false });
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

test('una corrección autoritativa corta reconcilia al jugador local', () => {
  const positions = [];
  const resets = [];
  const game = new GameScene();
  game.myId = 'ana';
  game.players = { ana: { id: 'ana', x: 170, y: 424 } };
  game.sprites = {
    ana: {
      container: {
        x: 170,
        y: 424,
        setPosition: (x, y) => positions.push([x, y]),
        body: { reset: (x, y) => resets.push([x, y]) }
      }
    }
  };

  game.setupSocketListeners();
  socket.emit('player:moved', { playerId: 'ana', x: 170, y: 400 });

  assert.deepEqual(positions, [[170, 400]]);
  assert.deepEqual(resets, [[170, 400]]);
  assert.deepEqual({ x: game.players.ana.x, y: game.players.ana.y }, { x: 170, y: 400 });
  net.disposeAll(game.networkDisposers);
});

test('el clic de estación respeta la restricción de rol', () => {
  const game = new GameScene();
  const messages = [];
  game.myRole = 'jefe';
  game.showFloatingText = (text) => messages.push(text);

  game.handleMapClick({ worldX: 220, worldY: 476 });

  assert.deepEqual(messages, ['Solo los empleados pueden completar encargos']);
});

test('un ACK tardío no cierra el panel que reemplazó a su sesión', () => {
  const game = new GameScene();
  const messages = [];
  const stale = { destroy() {} };
  const current = { destroyed: false, destroy() { this.destroyed = true; } };
  const request = Symbol('current-request');
  game.activeTaskPanel = current;
  game.taskPanelRequest = request;
  game.showFloatingText = (message) => messages.push(message);

  game.closeTaskPanel(stale);
  assert.equal(game.taskPanelRequest, request);
  game.applyTaskActionResult(stale, { error: 'Sesión anterior inválida' });

  assert.equal(game.activeTaskPanel, current);
  assert.equal(current.destroyed, false);
  assert.deepEqual(messages, []);

  game.applyTaskActionResult(current, { error: 'Sesión actual inválida' });
  assert.equal(game.activeTaskPanel, null);
  assert.equal(current.destroyed, true);
  assert.deepEqual(messages, ['Sesión actual inválida']);
});

test('un task:start tardío no abre un panel después de cancelación', async () => {
  const game = new GameScene();
  const opened = [];
  const task = { id: 'reporte' };
  const stale = Symbol('stale');
  const current = Symbol('current');
  game.taskPanelRequest = current;
  game.openTaskPanel = (...args) => opened.push(args);
  game.showFloatingText = () => {};

  await game.applyTaskStartResult(task, stale, { sessionId: 'stale-session' });
  assert.deepEqual(opened, []);

  await game.applyTaskStartResult(task, current, { sessionId: 'current-session' });
  assert.deepEqual(opened, [[task, 'current-session', current]]);
});

test('shutdown destruye el panel activo e invalida solicitudes pendientes', () => {
  const game = new GameScene();
  const panel = { destroyed: false, destroy() { this.destroyed = true; } };
  game.activeTaskPanel = panel;
  game.taskPanelRequest = Symbol('pending');
  game.networkDisposers = [];
  game.scale = { off() {} };

  game.shutdown();

  assert.equal(panel.destroyed, true);
  assert.equal(game.activeTaskPanel, null);
  assert.equal(game.taskPanelRequest, null);
});

test('GameScene hidrata el snapshot público recibido durante la transición desde Lobby', () => {
  const game = new GameScene();
  const calls = [];
  const snapshot = {
    phase: 'playing',
    players: [{ id: 'ana', name: 'Ana', x: 430, y: 350 }],
    activeSabotages: []
  };
  game.syncPlayers = (state) => calls.push(['players', state]);
  game.updateHUD = (state) => calls.push(['hud', state]);

  game.applyGameState(snapshot);

  assert.equal(game.gameState, snapshot);
  assert.deepEqual(calls, [['players', snapshot], ['hud', snapshot]]);
});

test('blur y visibilidad neutralizan el D-pad y retiran sus listeners', () => {
  class Target extends EventEmitter {
    addEventListener(event, handler) { this.on(event, handler); }
    removeEventListener(event, handler) { this.off(event, handler); }
  }
  const windowTarget = new Target();
  const documentTarget = new Target();
  documentTarget.hidden = false;
  const input = { left: true, right: false, up: true, down: false };
  const cleanup = bindMobileInputLifecycle(windowTarget, documentTarget, input);

  windowTarget.emit('blur');
  assert.deepEqual(input, { left: false, right: false, up: false, down: false });
  input.right = true;
  documentTarget.hidden = true;
  documentTarget.emit('visibilitychange');
  assert.deepEqual(input, { left: false, right: false, up: false, down: false });

  cleanup();
  input.down = true;
  windowTarget.emit('blur');
  assert.equal(input.down, true);
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
