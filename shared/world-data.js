(function exposeWorld(root, factory) {
  const data = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  root.OFICHAOS_WORLD = data;
})(globalThis, () => {
  const freezeItems = (items) => Object.freeze(items.map((item) => Object.freeze(item)));
  const WORLD_BOUNDS = Object.freeze({ x: 0, y: 0, w: 1200, h: 900 });
  const WALL_THICKNESS = 8;
  const PLAYER_RADIUS = 18;

  const OFFICE_ZONES = freezeItems([
    { id: 'recepcion', name: 'Recepción', x: 100, y: 100, w: 250, h: 200, task: true },
    { id: 'cubiculos', name: 'Cubículos', x: 450, y: 100, w: 300, h: 200, task: true },
    { id: 'juntas', name: 'Sala de Juntas', x: 850, y: 100, w: 250, h: 200, task: false },
    { id: 'cocina', name: 'Cocina', x: 100, y: 400, w: 200, h: 180, task: true },
    { id: 'archivo', name: 'Archivo', x: 400, y: 400, w: 200, h: 180, task: true },
    { id: 'jefe_oficina', name: 'Oficina del Jefe', x: 700, y: 400, w: 200, h: 180, task: false },
    { id: 'rh', name: 'Recursos Humanos', x: 100, y: 650, w: 250, h: 180, task: false },
    { id: 'servidor', name: 'Servidor / IT', x: 500, y: 650, w: 250, h: 180, task: true }
  ]);

  const OFFICE_DOORS = freezeItems([
    { id: 'recepcion-este', zoneId: 'recepcion', x: 350, y: 200, width: 84, orientation: 'vertical', side: 'right' },
    { id: 'recepcion-sur', zoneId: 'recepcion', x: 225, y: 300, width: 84, orientation: 'horizontal', side: 'bottom' },
    { id: 'cubiculos-oeste', zoneId: 'cubiculos', x: 450, y: 200, width: 84, orientation: 'vertical', side: 'left' },
    { id: 'cubiculos-este', zoneId: 'cubiculos', x: 750, y: 200, width: 84, orientation: 'vertical', side: 'right' },
    { id: 'cubiculos-sur', zoneId: 'cubiculos', x: 600, y: 300, width: 84, orientation: 'horizontal', side: 'bottom' },
    { id: 'juntas-oeste', zoneId: 'juntas', x: 850, y: 200, width: 84, orientation: 'vertical', side: 'left' },
    { id: 'juntas-sur', zoneId: 'juntas', x: 975, y: 300, width: 84, orientation: 'horizontal', side: 'bottom' },
    { id: 'cocina-norte', zoneId: 'cocina', x: 255, y: 400, width: 80, orientation: 'horizontal', side: 'top' },
    { id: 'cocina-este', zoneId: 'cocina', x: 300, y: 500, width: 80, orientation: 'vertical', side: 'right' },
    { id: 'cocina-sur', zoneId: 'cocina', x: 225, y: 580, width: 80, orientation: 'horizontal', side: 'bottom' },
    { id: 'archivo-norte', zoneId: 'archivo', x: 500, y: 400, width: 84, orientation: 'horizontal', side: 'top' },
    { id: 'archivo-oeste', zoneId: 'archivo', x: 400, y: 520, width: 80, orientation: 'vertical', side: 'left' },
    { id: 'archivo-este', zoneId: 'archivo', x: 600, y: 540, width: 80, orientation: 'vertical', side: 'right' },
    { id: 'archivo-sur', zoneId: 'archivo', x: 500, y: 580, width: 84, orientation: 'horizontal', side: 'bottom' },
    { id: 'jefe-norte', zoneId: 'jefe_oficina', x: 858, y: 400, width: 84, orientation: 'horizontal', side: 'top' },
    { id: 'jefe-oeste', zoneId: 'jefe_oficina', x: 700, y: 500, width: 80, orientation: 'vertical', side: 'left' },
    { id: 'jefe-sur', zoneId: 'jefe_oficina', x: 800, y: 580, width: 84, orientation: 'horizontal', side: 'bottom' },
    { id: 'rh-norte', zoneId: 'rh', x: 225, y: 650, width: 84, orientation: 'horizontal', side: 'top' },
    { id: 'rh-este', zoneId: 'rh', x: 350, y: 750, width: 80, orientation: 'vertical', side: 'right' },
    { id: 'servidor-norte', zoneId: 'servidor', x: 625, y: 650, width: 84, orientation: 'horizontal', side: 'top' },
    { id: 'servidor-oeste', zoneId: 'servidor', x: 500, y: 750, width: 80, orientation: 'vertical', side: 'left' },
    { id: 'servidor-este', zoneId: 'servidor', x: 750, y: 750, width: 80, orientation: 'vertical', side: 'right' }
  ]);

  const OFFICE_OBSTACLES = freezeItems([
    { id: 'recepcion_mostrador', zoneId: 'recepcion', name: 'Escritorio Recepción', kind: 'desk', x: 145, y: 140, w: 155, h: 40, color: 0x2563eb },
    { id: 'recepcion_planta', zoneId: 'recepcion', name: 'Planta Recepción', kind: 'plant', x: 118, y: 120, w: 30, h: 30, color: 0x2563eb },
    { id: 'cubiculo_1', zoneId: 'cubiculos', name: 'Escritorio Cubículo 1', kind: 'desk', x: 475, y: 135, w: 105, h: 42, color: 0x22c55e },
    { id: 'cubiculo_2', zoneId: 'cubiculos', name: 'Escritorio Cubículo 2', kind: 'desk', x: 620, y: 135, w: 105, h: 42, color: 0x22c55e },
    { id: 'juntas_mesa', zoneId: 'juntas', name: 'Mesa de Juntas', kind: 'meeting', x: 890, y: 120, w: 170, h: 62, color: 0xf6c344 },
    { id: 'juntas_planta', zoneId: 'juntas', name: 'Planta Juntas', kind: 'plant', x: 1050, y: 120, w: 30, h: 30, color: 0xf6c344 },
    { id: 'cocina_barra', zoneId: 'cocina', name: 'Barra Cocina', kind: 'counter', x: 115, y: 420, w: 110, h: 34, color: 0xf05a5a },
    { id: 'cocina_refri', zoneId: 'cocina', name: 'Refrigerador', kind: 'fridge', x: 248, y: 520, w: 36, h: 50, color: 0xf05a5a },
    { id: 'cocina_mesa', zoneId: 'cocina', name: 'Mesa Cocina', kind: 'table', x: 125, y: 500, w: 52, h: 52, color: 0xf05a5a },
    { id: 'archivo_1', zoneId: 'archivo', name: 'Archivero 1', kind: 'cabinet', x: 430, y: 425, w: 34, h: 88, color: 0x8b5cf6 },
    { id: 'archivo_2', zoneId: 'archivo', name: 'Archivero 2', kind: 'cabinet', x: 540, y: 425, w: 34, h: 88, color: 0x8b5cf6 },
    { id: 'jefe_escritorio', zoneId: 'jefe_oficina', name: 'Escritorio Jefe', kind: 'desk', x: 745, y: 425, w: 110, h: 42, color: 0xd83a4a },
    { id: 'jefe_librero', zoneId: 'jefe_oficina', name: 'Archivero Jefe', kind: 'cabinet', x: 710, y: 525, w: 70, h: 24, color: 0xd83a4a },
    { id: 'rh_escritorio_1', zoneId: 'rh', name: 'Escritorio RH 1', kind: 'desk', x: 120, y: 690, w: 82, h: 40, color: 0x06b6d4 },
    { id: 'rh_escritorio_2', zoneId: 'rh', name: 'Escritorio RH 2', kind: 'desk', x: 245, y: 690, w: 82, h: 40, color: 0x06b6d4 },
    { id: 'servidor_rack_oeste', zoneId: 'servidor', name: 'Rack 1', kind: 'rack', x: 530, y: 650, w: 50, h: 100, color: 0x6366f1 },
    { id: 'servidor_rack_este', zoneId: 'servidor', name: 'Rack 2', kind: 'rack', x: 650, y: 680, w: 50, h: 120, color: 0x6366f1 }
  ]);

  const OFFICE_STATIONS = freezeItems([
    { taskId: 'cafe', zoneId: 'cocina', x: 220, y: 476, label: 'CAFETERA' },
    { taskId: 'archivos', zoneId: 'archivo', x: 510, y: 520, label: 'ARCHIVADOR' },
    { taskId: 'correos', zoneId: 'cubiculos', x: 600, y: 220, label: 'COMPUTADORA' },
    { taskId: 'reporte', zoneId: 'recepcion', x: 325, y: 245, label: 'IMPRESORA' },
    { taskId: 'wifi', zoneId: 'servidor', x: 615, y: 745, label: 'RACK DE RED' }
  ]);

  const SPAWN_POINTS = freezeItems([
    { x: 430, y: 350 }, { x: 520, y: 350 }, { x: 680, y: 350 }, { x: 770, y: 350 }
  ]);
  const OFFICE_PATHS = freezeItems([
    ['recepcion', 'cubiculos'], ['recepcion', 'cocina'], ['cubiculos', 'juntas'],
    ['cubiculos', 'archivo'], ['cocina', 'archivo'], ['cocina', 'rh'],
    ['archivo', 'jefe_oficina'], ['archivo', 'servidor'], ['jefe_oficina', 'servidor'], ['rh', 'servidor']
  ]);

  const subtractOpenings = (start, end, openings) => {
    const sorted = openings.map(({ center, width }) => [Math.max(start, center - width / 2), Math.min(end, center + width / 2)])
      .filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
    const segments = [];
    let cursor = start;
    for (const [a, b] of sorted) {
      if (a > cursor) segments.push([cursor, a]);
      cursor = Math.max(cursor, b);
    }
    if (cursor < end) segments.push([cursor, end]);
    return segments;
  };

  const walls = [];
  for (const zone of OFFICE_ZONES) {
    const doors = OFFICE_DOORS.filter(({ zoneId }) => zoneId === zone.id);
    const horizontal = (side) => doors.filter((door) => door.side === side).map((door) => ({ center: door.x, width: door.width }));
    const vertical = (side) => doors.filter((door) => door.side === side).map((door) => ({ center: door.y, width: door.width }));
    const addHorizontal = (side, y) => subtractOpenings(zone.x, zone.x + zone.w, horizontal(side)).forEach(([a, b], index) => {
      walls.push({ id: `${zone.id}-${side}-${index}`, zoneId: zone.id, side, x: a, y: y - WALL_THICKNESS / 2, w: b - a, h: WALL_THICKNESS });
    });
    const addVertical = (side, x) => subtractOpenings(zone.y, zone.y + zone.h, vertical(side)).forEach(([a, b], index) => {
      walls.push({ id: `${zone.id}-${side}-${index}`, zoneId: zone.id, side, x: x - WALL_THICKNESS / 2, y: a, w: WALL_THICKNESS, h: b - a });
    });
    addHorizontal('top', zone.y);
    addHorizontal('bottom', zone.y + zone.h);
    addVertical('left', zone.x);
    addVertical('right', zone.x + zone.w);
  }

  return Object.freeze({
    WORLD_BOUNDS, WALL_THICKNESS, PLAYER_RADIUS, OFFICE_ZONES, OFFICE_DOORS,
    OFFICE_OBSTACLES, OFFICE_STATIONS, OFFICE_WALLS: freezeItems(walls), SPAWN_POINTS, OFFICE_PATHS
  });
});
