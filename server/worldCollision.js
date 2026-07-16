const {
  PLAYER_RADIUS,
  OFFICE_WALLS,
  OFFICE_OBSTACLES,
  OFFICE_DOORS
} = require('../shared/world-data');

const EPSILON = 1e-6;

function pointInside(point, rect) {
  return point.x > rect.x + EPSILON && point.x < rect.x + rect.w - EPSILON &&
    point.y > rect.y + EPSILON && point.y < rect.y + rect.h - EPSILON;
}

function exitsNearestFace(from, to, rect) {
  const faces = [
    { distance: from.x - rect.x, travel: to.x < from.x ? (rect.x - from.x) / (to.x - from.x) : Infinity },
    { distance: rect.x + rect.w - from.x, travel: to.x > from.x ? (rect.x + rect.w - from.x) / (to.x - from.x) : Infinity },
    { distance: from.y - rect.y, travel: to.y < from.y ? (rect.y - from.y) / (to.y - from.y) : Infinity },
    { distance: rect.y + rect.h - from.y, travel: to.y > from.y ? (rect.y + rect.h - from.y) / (to.y - from.y) : Infinity }
  ];
  const firstExit = Math.min(...faces.map(({ travel }) => travel));
  const nearest = Math.min(...faces.map(({ distance }) => distance));
  return faces.some(({ distance, travel }) =>
    Math.abs(travel - firstExit) <= EPSILON && distance <= nearest + EPSILON);
}

function segmentHitsRect(from, to, solid, allowEscape = true) {
  const rect = {
    x: solid.x - PLAYER_RADIUS,
    y: solid.y - PLAYER_RADIUS,
    w: solid.w + PLAYER_RADIUS * 2,
    h: solid.h + PLAYER_RADIUS * 2
  };
  const fromInside = pointInside(from, rect);
  const toInside = pointInside(to, rect);
  if (fromInside) {
    if (!allowEscape || toInside) return true;
    return !exitsNearestFace(from, to, rect);
  }
  if (toInside) return true;

  const strictRect = {
    x: rect.x + EPSILON,
    y: rect.y + EPSILON,
    w: rect.w - EPSILON * 2,
    h: rect.h - EPSILON * 2
  };

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let entry = 0;
  let exit = 1;
  for (const [p, q] of [
    [-dx, from.x - strictRect.x],
    [dx, strictRect.x + strictRect.w - from.x],
    [-dy, from.y - strictRect.y],
    [dy, strictRect.y + strictRect.h - from.y]
  ]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) entry = Math.max(entry, t);
    else exit = Math.min(exit, t);
    if (entry > exit) return false;
  }
  return true;
}

function doorSolid(door) {
  const horizontal = door.orientation === 'horizontal';
  return {
    x: door.x - (horizontal ? door.width : 12) / 2,
    y: door.y - (horizontal ? 12 : door.width) / 2,
    w: horizontal ? door.width : 12,
    h: horizontal ? 12 : door.width
  };
}

function movementBlocked(from, to, activeSabotages = []) {
  const closedDoorIds = new Set(activeSabotages
    .filter((item) => item.type === 'close_door' && item.expires > Date.now())
    .map((item) => item.doorId));
  const closedDoors = OFFICE_DOORS.filter((door) => closedDoorIds.has(door.id)).map(doorSolid);
  return [...OFFICE_WALLS, ...OFFICE_OBSTACLES, ...closedDoors]
    .some((solid) => segmentHitsRect(from, to, solid));
}

function interactionBlocked(from, to, activeSabotages = []) {
  const closedDoorIds = new Set(activeSabotages
    .filter((item) => item.type === 'close_door' && item.expires > Date.now())
    .map((item) => item.doorId));
  const closedDoors = OFFICE_DOORS.filter((door) => closedDoorIds.has(door.id)).map(doorSolid);
  return [...OFFICE_WALLS, ...closedDoors]
    .some((solid) => segmentHitsRect(from, to, solid, false));
}

module.exports = { movementBlocked, interactionBlocked };
