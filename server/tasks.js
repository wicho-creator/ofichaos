// tasks.js — Definición de tareas y zonas del mapa

const TASKS = [
  {
    id: 'cafe',
    name: 'Preparar café',
    zone: 'cocina',
    type: 'progress',
    duration: 5000,
    description: 'Mantén presionado para preparar el café.'
  },
  {
    id: 'archivos',
    name: 'Ordenar archivos',
    zone: 'archivo',
    type: 'click',
    clicksNeeded: 10,
    description: 'Haz click para ordenar los archivos.'
  },
  {
    id: 'correos',
    name: 'Responder correos',
    zone: 'cubiculos',
    type: 'sequence',
    steps: 5,
    description: 'Responde los correos en el orden correcto.'
  },
  {
    id: 'reporte',
    name: 'Imprimir reporte',
    zone: 'recepcion',
    type: 'progress',
    duration: 3000,
    description: 'Mantén presionado para imprimir el reporte.'
  },
  {
    id: 'wifi',
    name: 'Arreglar WiFi',
    zone: 'servidor',
    type: 'sequence',
    steps: 4,
    description: 'Reconecta los cables en orden.'
  }
];

// Zonas del mapa: centro (x,y) y dimensiones para colisión/detección
const ZONES = [
  { id: 'recepcion', name: 'Recepción', x: 100, y: 100, w: 250, h: 200 },
  { id: 'cubiculos', name: 'Cubículos', x: 450, y: 100, w: 300, h: 200 },
  { id: 'juntas', name: 'Sala de Juntas', x: 850, y: 100, w: 250, h: 200 },
  { id: 'cocina', name: 'Cocina', x: 100, y: 400, w: 200, h: 180 },
  { id: 'archivo', name: 'Archivo', x: 400, y: 400, w: 200, h: 180 },
  { id: 'jefe_oficina', name: 'Oficina del Jefe', x: 700, y: 400, w: 200, h: 180 },
  { id: 'rh', name: 'Recursos Humanos', x: 100, y: 650, w: 250, h: 180 },
  { id: 'servidor', name: 'Servidor / IT', x: 500, y: 650, w: 250, h: 180 }
];

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;

/**
 * Inicializa el estado de tareas para una partida.
 * Cada tarea tiene completada=false y assignee=null (se asigna dinámicamente).
 * @returns {Object[]} array de tareas con estado
 */
function initTaskStates() {
  return TASKS.map((t) => ({
    ...t,
    completed: false,
    completedBy: null,
    inProgressBy: null
  }));
}

/**
 * Calcula el porcentaje de tareas completadas.
 * @param {Object[]} taskStates
 * @returns {number} 0-100
 */
function getCompletionPercent(taskStates) {
  if (taskStates.length === 0) return 0;
  const done = taskStates.filter((t) => t.completed).length;
  return Math.round((done / taskStates.length) * 100);
}

module.exports = { TASKS, ZONES, MAP_WIDTH, MAP_HEIGHT, initTaskStates, getCompletionPercent };
