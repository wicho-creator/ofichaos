import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SPAWN_POINTS } = require('../server/tasks.js');

import { TASKS } from '../client/src/systems/tasks.js';
import {
  WORLD_BOUNDS,
  OFFICE_ZONES,
  OFFICE_OBSTACLES,
  OFFICE_WALLS,
  OFFICE_DOORS,
  OFFICE_STATIONS,
  OFFICE_PATHS,
  getZoneById,
  getZoneCenter,
  findNearestTaskZone
} from '../client/src/systems/world.js';

const inside = (point, rect) =>
  point.x >= rect.x && point.x <= rect.x + rect.w &&
  point.y >= rect.y && point.y <= rect.y + rect.h;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const PLAYER_RADIUS = 18;
const pointHitsObstacle = (point, obstacle) =>
  point.x + PLAYER_RADIUS > obstacle.x && point.x - PLAYER_RADIUS < obstacle.x + obstacle.w &&
  point.y + PLAYER_RADIUS > obstacle.y && point.y - PLAYER_RADIUS < obstacle.y + obstacle.h;
const doorHasClearLane = (door) => {
  const colliders = [...OFFICE_OBSTACLES, ...OFFICE_WALLS];
  for (let offset = -door.width / 2 + PLAYER_RADIUS; offset <= door.width / 2 - PLAYER_RADIUS; offset += 2) {
    let clear = true;
    for (let depth = -30; depth <= 30; depth += 2) {
      const point = door.orientation === 'horizontal'
        ? { x: door.x + offset, y: door.y + depth }
        : { x: door.x + depth, y: door.y + offset };
      if (colliders.some((collider) => pointHitsObstacle(point, collider))) {
        clear = false;
        break;
      }
    }
    if (clear) return true;
  }
  return false;
};

test('el modelo del mundo es inmutable y conserva el contrato 1200x900', () => {
  assert.deepEqual(WORLD_BOUNDS, { x: 0, y: 0, w: 1200, h: 900 });
  assert.ok(Object.isFrozen(WORLD_BOUNDS));
  assert.ok(Object.isFrozen(OFFICE_ZONES));
  assert.ok(OFFICE_ZONES.every(Object.isFrozen));
  assert.ok(Object.isFrozen(OFFICE_OBSTACLES));
  assert.ok(OFFICE_OBSTACLES.every(Object.isFrozen));
  assert.ok(Object.isFrozen(OFFICE_WALLS));
  assert.ok(OFFICE_WALLS.every(Object.isFrozen));
  assert.ok(Object.isFrozen(OFFICE_DOORS));
  assert.ok(OFFICE_DOORS.every(Object.isFrozen));
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
      !OFFICE_OBSTACLES.some((obstacle) => obstacle.zoneId === zone.id && pointHitsObstacle(center, obstacle)),
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

test('las estaciones están libres y representan exactamente las cinco tareas', () => {
  assert.deepEqual(new Set(OFFICE_STATIONS.map(({ taskId }) => taskId)), new Set(TASKS.map(({ id }) => id)));
  for (const station of OFFICE_STATIONS) {
    assert.ok(getZoneById(station.zoneId), `${station.taskId}: zona inexistente`);
    assert.ok(![...OFFICE_OBSTACLES, ...OFFICE_WALLS].some((obstacle) => pointHitsObstacle(station, obstacle)), `${station.taskId}: estación bloqueada`);
  }
});

test('los puntos de aparición son seguros y quedan en circulación abierta', () => {
  assert.ok(SPAWN_POINTS.length >= 4);
  for (const point of SPAWN_POINTS) {
    assert.ok(inside(point, WORLD_BOUNDS), `spawn fuera del mundo: ${JSON.stringify(point)}`);
    assert.ok(![...OFFICE_OBSTACLES, ...OFFICE_WALLS].some((obstacle) => pointHitsObstacle(point, obstacle)), `spawn bloqueado: ${JSON.stringify(point)}`);
  }
});

test('cada puerta representa una apertura física legible y transitable', () => {
  assert.equal(new Set(OFFICE_DOORS.map(({ id }) => id)).size, OFFICE_DOORS.length);
  assert.ok(OFFICE_DOORS.length >= OFFICE_ZONES.length);

  for (const door of OFFICE_DOORS) {
    assert.ok(getZoneById(door.zoneId), `${door.id}: zona inexistente`);
    assert.ok(['horizontal', 'vertical'].includes(door.orientation), `${door.id}: orientación inválida`);
    assert.ok(door.width >= PLAYER_RADIUS * 2 + 36, `${door.id}: apertura menor a 72px`);
    assert.ok(inside({ x: door.x, y: door.y }, WORLD_BOUNDS), `${door.id}: puerta fuera del mundo`);
    assert.ok(!OFFICE_OBSTACLES.some((obstacle) => pointHitsObstacle(door, obstacle)), `${door.id}: umbral bloqueado`);
    assert.ok(doorHasClearLane(door), `${door.id}: no hay trayectoria para el cuerpo del jugador`);
  }

  for (const zone of OFFICE_ZONES) {
    assert.ok(OFFICE_DOORS.some((door) => door.zoneId === zone.id), `${zone.id}: habitación sin puerta`);
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
