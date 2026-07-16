import '../../../shared/world-data.js';

const world = globalThis.OFICHAOS_WORLD;

export const {
  WORLD_BOUNDS,
  WALL_THICKNESS,
  PLAYER_RADIUS,
  OFFICE_ZONES,
  OFFICE_DOORS,
  OFFICE_OBSTACLES,
  OFFICE_STATIONS,
  OFFICE_WALLS,
  OFFICE_PATHS,
  SPAWN_POINTS
} = world;

export function getZoneById(id) {
  return OFFICE_ZONES.find((zone) => zone.id === id);
}

export function getZoneCenter(id) {
  const zone = getZoneById(id);
  return zone ? Object.freeze({ x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 }) : undefined;
}

export function getTaskStation(taskId) {
  return OFFICE_STATIONS.find((station) => station.taskId === taskId);
}

export function findNearestTaskStation(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return OFFICE_STATIONS.reduce((nearest, station) => {
    const distanceSquared = (station.x - x) ** 2 + (station.y - y) ** 2;
    return !nearest || distanceSquared < nearest.distanceSquared ? { station, distanceSquared } : nearest;
  }, undefined)?.station;
}

export function findNearestTaskZone(x, y) {
  const station = findNearestTaskStation(x, y);
  return station && getZoneById(station.zoneId);
}
