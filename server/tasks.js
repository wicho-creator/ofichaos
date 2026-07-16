// tasks.js — Definición de tareas y zonas del mapa

const TASKS = [
  {
    id: 'cafe',
    mechanic: 'timing',
    name: 'Preparar café',
    zone: 'cocina',
    type: 'progress',
    duration: 5000,
    description: 'Mantén presionado para preparar el café.'
  },
  {
    id: 'archivos',
    mechanic: 'order',
    name: 'Ordenar archivos',
    zone: 'archivo',
    type: 'click',
    clicksNeeded: 10,
    description: 'Haz click para ordenar los archivos.'
  },
  {
    id: 'correos',
    mechanic: 'triage',
    name: 'Responder correos',
    zone: 'cubiculos',
    type: 'sequence',
    steps: 5,
    description: 'Responde los correos en el orden correcto.'
  },
  {
    id: 'reporte',
    mechanic: 'hold',
    holdMs: 2400,
    name: 'Imprimir reporte',
    zone: 'recepcion',
    type: 'progress',
    duration: 3000,
    description: 'Mantén presionado para imprimir el reporte.'
  },
  {
    id: 'wifi',
    mechanic: 'match',
    name: 'Arreglar WiFi',
    zone: 'servidor',
    type: 'sequence',
    steps: 4,
    description: 'Reconecta los cables en orden.'
  }
];

// Zonas, mundo y spawns comparten la fuente física con el cliente.
const { WORLD_BOUNDS, OFFICE_ZONES: ZONES, SPAWN_POINTS } = require('../shared/world-data');
const MAP_WIDTH = WORLD_BOUNDS.w;
const MAP_HEIGHT = WORLD_BOUNDS.h;

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

module.exports = { TASKS, ZONES, MAP_WIDTH, MAP_HEIGHT, SPAWN_POINTS, initTaskStates, getCompletionPercent };
