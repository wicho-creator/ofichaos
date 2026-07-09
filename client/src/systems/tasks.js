// tasks.js — Definición de tareas para el cliente (debe reflejar el servidor)

export const TASKS = [
  { id: 'cafe', name: 'Preparar café', zone: 'cocina', type: 'progress', description: 'Mantén presionado para preparar el café.' },
  { id: 'archivos', name: 'Ordenar archivos', zone: 'archivo', type: 'click', description: 'Haz click para ordenar los archivos.' },
  { id: 'correos', name: 'Responder correos', zone: 'cubiculos', type: 'sequence', description: 'Responde los correos en el orden correcto.' },
  { id: 'reporte', name: 'Imprimir reporte', zone: 'recepcion', type: 'progress', description: 'Mantén presionado para imprimir el reporte.' },
  { id: 'wifi', name: 'Arreglar WiFi', zone: 'servidor', type: 'sequence', description: 'Reconecta los cables en orden.' }
];
