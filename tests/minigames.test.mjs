import test from 'node:test';
import assert from 'node:assert/strict';

import { TASKS } from '../client/src/systems/tasks.js';
import { createMinigameState, nextMinigameState, reduceMinigame } from '../client/src/systems/minigames.js';
import { bindHoldLifecycle, minigameLayout, shouldCancelMinigameOnResize, shouldTickHold } from '../client/src/systems/minigame-ui.js';

const byId = Object.fromEntries(TASKS.map((task) => [task.id, task]));

test('cada tarea tiene una mecánica jugable distinta y configuración completa', () => {
  assert.deepEqual(TASKS.map(({ mechanic }) => mechanic), ['timing', 'order', 'triage', 'hold', 'match']);
  for (const task of TASKS) {
    assert.ok(task.instruction?.length >= 12, `${task.id}: falta instrucción`);
    assert.ok(task.stationLabel?.length >= 3, `${task.id}: falta estación`);
  }
});

test('café solo termina al detener la aguja dentro del objetivo', () => {
  let state = createMinigameState(byId.cafe);
  state = reduceMinigame(state, { type: 'stop', position: 0.1 });
  assert.equal(state.completed, false);
  assert.equal(state.attempts, 1);
  state = reduceMinigame(state, { type: 'stop', position: 0.5 });
  assert.equal(state.completed, true);
});

test('archivos exige el orden indicado y reinicia ante un error', () => {
  let state = createMinigameState(byId.archivos);
  state = reduceMinigame(state, { type: 'pick', value: 1 });
  state = reduceMinigame(state, { type: 'pick', value: 3 });
  assert.equal(state.index, 0);
  for (const value of [1, 2, 3, 4]) state = reduceMinigame(state, { type: 'pick', value });
  assert.equal(state.completed, true);
});

test('correos avanza solo con la decisión correcta para cada mensaje', () => {
  let state = createMinigameState(byId.correos);
  const first = state.items[0];
  state = reduceMinigame(state, { type: 'choose', value: first.action === 'responder' ? 'archivar' : 'responder' });
  assert.equal(state.index, 0);
  assert.equal(state.mistakes, 1);
  for (const item of state.items) state = reduceMinigame(state, { type: 'choose', value: item.action });
  assert.equal(state.completed, true);
});

test('reporte solo progresa mientras se mantiene presionado', () => {
  let state = createMinigameState(byId.reporte);
  state = reduceMinigame(state, { type: 'tick', delta: 1000 });
  assert.equal(state.elapsed, 0);
  state = reduceMinigame(state, { type: 'hold', active: true });
  state = reduceMinigame(state, { type: 'tick', delta: 1000 });
  state = reduceMinigame(state, { type: 'hold', active: false });
  state = reduceMinigame(state, { type: 'tick', delta: 1000 });
  assert.equal(state.elapsed, 1000);
  state = reduceMinigame(state, { type: 'hold', active: true });
  state = reduceMinigame(state, { type: 'tick', delta: byId.reporte.holdMs });
  assert.equal(state.completed, true);
});

test('wifi rechaza cruces incorrectos y termina al emparejar etiqueta con etiqueta', () => {
  let state = createMinigameState(byId.wifi);
  const [first, second] = state.connectors;
  state = reduceMinigame(state, { type: 'connect', from: first.id, to: second.id });
  assert.equal(state.matches.length, 0);
  assert.equal(state.mistakes, 1);
  for (const connector of state.connectors) {
    state = reduceMinigame(state, { type: 'connect', from: connector.id, to: connector.id });
  }
  assert.equal(state.completed, true);
});

test('el modo autoritativo no aplica una acción antes del estado servidor', () => {
  const state = createMinigameState(byId.cafe);
  const action = { type: 'stop', position: 0.5 };

  assert.equal(nextMinigameState(state, action, true), state);
  assert.equal(nextMinigameState(state, action, false).completed, true);
});

test('reporte online solo envía ticks mientras el control está sostenido', () => {
  assert.equal(shouldTickHold(true, false, { active: true }), false);
  assert.equal(shouldTickHold(true, true, { active: false }), true);
  assert.equal(shouldTickHold(false, false, { active: true }), true);
});

test('reporte libera el hold al perder foco o visibilidad', () => {
  const listeners = new Map();
  const target = {
    hidden: false,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name)
  };
  let releases = 0;
  const cleanup = bindHoldLifecycle(target, target, () => releases++);

  listeners.get('blur')();
  target.hidden = true;
  listeners.get('visibilitychange')();
  assert.equal(releases, 2);
  cleanup();
  assert.equal(listeners.size, 0);
});

test('un resize invalida el panel abierto para reconstruir hitboxes', () => {
  assert.equal(shouldCancelMinigameOnResize(390, 844, 844, 390), true);
  assert.equal(shouldCancelMinigameOnResize(360, 300, 360, 300), false);
});

test('los cinco minijuegos compactos conservan hitboxes sin solapes', () => {
  for (const [width, height] of [[568, 320], [360, 300]]) {
    for (const mechanic of ['timing', 'order', 'triage', 'hold', 'match']) {
      const layout = minigameLayout(width, height, mechanic);
      const boxes = [...layout.controls, layout.cancel];
      for (const box of boxes) {
        assert.ok(box.width >= 44 && box.height >= 44, `${width}x${height} ${mechanic}: hitbox pequeño`);
        assert.ok(Math.abs(box.x) + box.width / 2 <= layout.width / 2 - 8, `${mechanic}: fuera horizontal`);
        assert.ok(Math.abs(box.y) + box.height / 2 <= layout.height / 2 - 8, `${mechanic}: fuera vertical`);
      }
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i]; const b = boxes[j];
          const separated = Math.abs(a.x - b.x) >= (a.width + b.width) / 2 + 8
            || Math.abs(a.y - b.y) >= (a.height + b.height) / 2 + 8;
          assert.ok(separated, `${width}x${height} ${mechanic}: controles solapados`);
        }
      }
    }
  }
});
