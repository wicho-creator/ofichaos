import test from 'node:test';
import assert from 'node:assert/strict';

import { TASKS } from '../client/src/systems/tasks.js';
import {
  WORLD_BOUNDS,
  OFFICE_ZONES,
  OFFICE_OBSTACLES,
  OFFICE_PATHS,
  getZoneById,
  getZoneCenter,
  findNearestTaskZone
} from '../client/src/systems/world.js';

const inside = (point, rect) =>
  point.x >= rect.x && point.x <= rect.x + rect.w &&
  point.y >= rect.y && point.y <= rect.y + rect.h;
const overlaps = (point, rect) =>
  point.x > rect.x && point.x < rect.x + rect.w &&
  point.y > rect.y && point.y < rect.y + rect.h;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('el modelo del mundo es inmutable y conserva el contrato 1200x900', () => {
  assert.deepEqual(WORLD_BOUNDS, { x: 0, y: 0, w: 1200, h: 900 });
  assert.ok(Object.isFrozen(WORLD_BOUNDS));
  assert.ok(Object.isFrozen(OFFICE_ZONES));
  assert.ok(OFFICE_ZONES.every(Object.isFrozen));
  assert.ok(Object.isFrozen(OFFICE_OBSTACLES));
  assert.ok(OFFICE_OBSTACLES.every(Object.isFrozen));
  assert.ok(Object.isFrozen(OFFICE_PATHS));
  assert.ok(OFFICE_PATHS.every(Object.isFrozen));
});

test('las zonas tienen ids únicos, dimensiones válidas y quedan dentro del mundo', () => {
  const ids = OFFICE_ZONES.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 8);

  for (const zone of OFFICE_ZONES) {
    assert.ok(zone.w > 0 && zone.h > 0, `${zone.id}: dimensiones inválidas`);
    assert.ok(inside({ x: zone.x, y: zone.y }, WORLD_BOUNDS), `${zone.id}: origen fuera`);
    assert.ok(inside({ x: zone.x + zone.w, y: zone.y + zone.h }, WORLD_BOUNDS), `${zone.id}: extremo fuera`);
    assert.equal(getZoneById(zone.id), zone);
  }
  assert.equal(getZoneById('no_existe'), undefined);
});

test('cada centro es accesible y no está bloqueado por mobiliario', () => {
  for (const zone of OFFICE_ZONES) {
    const center = getZoneCenter(zone.id);
    assert.ok(inside(center, zone), `${zone.id}: centro fuera de zona`);
    assert.ok(
      !OFFICE_OBSTACLES.some((obstacle) => obstacle.zoneId === zone.id && overlaps(center, obstacle)),
      `${zone.id}: centro bloqueado`
    );
  }
  assert.equal(getZoneCenter('no_existe'), undefined);
});

test('todas las zonas de tareas existen y se puede elegir la más cercana', () => {
  const taskZoneIds = new Set(TASKS.map(({ zone }) => zone));
  for (const id of taskZoneIds) assert.ok(getZoneById(id), `falta zona de tarea ${id}`);

  assert.equal(findNearestTaskZone(210, 490)?.id, 'cocina');
  assert.equal(findNearestTaskZone(620, 730)?.id, 'servidor');
  assert.equal(findNearestTaskZone(Number.NaN, 0), undefined);
});

test('cada obstáculo tiene id único y queda contenido en su zona', () => {
  assert.equal(new Set(OFFICE_OBSTACLES.map(({ id }) => id)).size, OFFICE_OBSTACLES.length);
  for (const obstacle of OFFICE_OBSTACLES) {
    const zone = getZoneById(obstacle.zoneId);
    assert.ok(zone, `${obstacle.id}: zona inexistente`);
    assert.ok(obstacle.w > 0 && obstacle.h > 0, `${obstacle.id}: dimensiones inválidas`);
    assert.ok(inside({ x: obstacle.x, y: obstacle.y }, zone), `${obstacle.id}: origen fuera`);
    assert.ok(inside({ x: obstacle.x + obstacle.w, y: obstacle.y + obstacle.h }, zone), `${obstacle.id}: extremo fuera`);
  }
});

test('las tareas forman una red conectada con trayectos cortos y sin callejones aislados', () => {
  const taskIds = new Set(TASKS.map(({ zone }) => zone));
  const adjacency = new Map(OFFICE_ZONES.map(({ id }) => [id, new Set()]));

  for (const [from, to] of OFFICE_PATHS) {
    assert.ok(adjacency.has(from) && adjacency.has(to), `ruta inválida ${from}-${to}`);
    const length = distance(getZoneCenter(from), getZoneCenter(to));
    assert.ok(length >= 100 && length <= 430, `ruta ${from}-${to} mide ${length.toFixed(1)}`);
    adjacency.get(from).add(to);
    adjacency.get(to).add(from);
  }

  const start = taskIds.values().next().value;
  const visited = new Set([start]);
  const queue = [start];
  while (queue.length) {
    for (const next of adjacency.get(queue.shift())) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  for (const id of taskIds) {
    assert.ok(visited.has(id), `${id}: tarea aislada`);
    assert.ok(adjacency.get(id).size >= 2, `${id}: tarea en callejón sin salida`);
  }
});
