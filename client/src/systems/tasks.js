// tasks.js — Catálogo visual y mecánico de las tareas del cliente.

const freeze = (task) => Object.freeze(task);

export const TASKS = Object.freeze([
  freeze({
    id: 'cafe',
    name: 'Preparar café',
    zone: 'cocina',
    mechanic: 'timing',
    stationLabel: 'CAFETERA',
    instruction: 'Detén la aguja dentro de la franja verde.'
  }),
  freeze({
    id: 'archivos',
    name: 'Ordenar archivos',
    zone: 'archivo',
    mechanic: 'order',
    stationLabel: 'ARCHIVADOR',
    instruction: 'Pulsa las carpetas en orden: 1, 2, 3 y 4.'
  }),
  freeze({
    id: 'correos',
    name: 'Responder correos',
    zone: 'cubiculos',
    mechanic: 'triage',
    stationLabel: 'COMPUTADORA',
    instruction: 'Responde lo importante y archiva el correo basura.'
  }),
  freeze({
    id: 'reporte',
    name: 'Imprimir reporte',
    zone: 'recepcion',
    mechanic: 'hold',
    holdMs: 2400,
    stationLabel: 'IMPRESORA',
    instruction: 'Mantén presionado hasta que la hoja termine de salir.'
  }),
  freeze({
    id: 'wifi',
    name: 'Arreglar WiFi',
    zone: 'servidor',
    mechanic: 'match',
    stationLabel: 'RACK DE RED',
    instruction: 'Conecta cada símbolo con su pareja del mismo código.'
  })
]);
