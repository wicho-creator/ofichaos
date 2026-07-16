// Fuente única del layout lógico. Las coordenadas conservan el contrato del servidor.
const freezeItems = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

export const WORLD_BOUNDS = Object.freeze({ x: 0, y: 0, w: 1200, h: 900 });

export const OFFICE_ZONES = freezeItems([
  { id: 'recepcion', name: 'Recepción', x: 100, y: 100, w: 250, h: 200, task: true },
  { id: 'cubiculos', name: 'Cubículos', x: 450, y: 100, w: 300, h: 200, task: true },
  { id: 'juntas', name: 'Sala de Juntas', x: 850, y: 100, w: 250, h: 200, task: false },
  { id: 'cocina', name: 'Cocina', x: 100, y: 400, w: 200, h: 180, task: true },
  { id: 'archivo', name: 'Archivo', x: 400, y: 400, w: 200, h: 180, task: true },
  { id: 'jefe_oficina', name: 'Oficina del Jefe', x: 700, y: 400, w: 200, h: 180, task: false },
  { id: 'rh', name: 'Recursos Humanos', x: 100, y: 650, w: 250, h: 180, task: false },
  { id: 'servidor', name: 'Servidor / IT', x: 500, y: 650, w: 250, h: 180, task: true }
]);

export const OFFICE_OBSTACLES = freezeItems([
  { id: 'recepcion_mostrador', zoneId: 'recepcion', x: 125, y: 125, w: 180, h: 35 },
  { id: 'cubiculos_escritorios_norte', zoneId: 'cubiculos', x: 475, y: 120, w: 250, h: 35 },
  { id: 'cubiculos_escritorios_sur', zoneId: 'cubiculos', x: 475, y: 245, w: 250, h: 35 },
  { id: 'juntas_mesa', zoneId: 'juntas', x: 875, y: 120, w: 200, h: 45 },
  { id: 'cocina_encimera', zoneId: 'cocina', x: 115, y: 415, w: 170, h: 30 },
  { id: 'archivo_estante', zoneId: 'archivo', x: 415, y: 415, w: 30, h: 145 },
  { id: 'jefe_escritorio', zoneId: 'jefe_oficina', x: 720, y: 415, w: 160, h: 35 },
  { id: 'rh_archivador', zoneId: 'rh', x: 115, y: 665, w: 35, h: 145 },
  { id: 'servidor_rack_oeste', zoneId: 'servidor', x: 515, y: 665, w: 35, h: 145 },
  { id: 'servidor_rack_este', zoneId: 'servidor', x: 700, y: 665, w: 35, h: 145 }
]);

// Enlaces transitables entre centros; la malla evita aislar tareas en callejones.
export const OFFICE_PATHS = freezeItems([
  ['recepcion', 'cubiculos'],
  ['recepcion', 'cocina'],
  ['cubiculos', 'juntas'],
  ['cubiculos', 'archivo'],
  ['cocina', 'archivo'],
  ['cocina', 'rh'],
  ['archivo', 'jefe_oficina'],
  ['archivo', 'servidor'],
  ['jefe_oficina', 'servidor'],
  ['rh', 'servidor']
]);

export function getZoneById(id) {
  return OFFICE_ZONES.find((zone) => zone.id === id);
}

export function getZoneCenter(id) {
  const zone = getZoneById(id);
  return zone
    ? Object.freeze({ x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 })
    : undefined;
}

export function findNearestTaskZone(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;

  let nearest;
  let nearestDistanceSquared = Infinity;
  for (const zone of OFFICE_ZONES) {
    if (!zone.task) continue;
    const center = getZoneCenter(zone.id);
    const distanceSquared = (center.x - x) ** 2 + (center.y - y) ** 2;
    if (distanceSquared < nearestDistanceSquared) {
      nearest = zone;
      nearestDistanceSquared = distanceSquared;
    }
  }
  return nearest;
}
