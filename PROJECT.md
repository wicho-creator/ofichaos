# OfiChaos — Proyecto

## Mapa del código

```text
client/
  src/scenes/        LobbyScene, GameScene, MeetingScene, EndScene
  src/systems/       networking, world, minigames, layouts, UI y sprites
server/
  index.js           Express, Socket.IO y game loop
  roomManager.js     salas, movimiento, sesiones y tareas
  gameState.js       fases, reuniones, votación, burnout y victoria
  sabotage.js        efectos, cooldowns y validación de objetivos
  projections.js     estado público/privado/final
  worldCollision.js  geometría autoritativa
shared/
  world-data.js      mundo físico compartido
  minigames.js       reducers compartidos de minijuegos
tests/               integración, seguridad, lifecycle, layouts y autoridad
```

## Contratos de autoridad

### Movimiento

`player:move {x, y}` es una solicitud, no una verdad. El servidor acepta solo números finitos durante `playing`, aplica límites y presupuesto de velocidad, valida el segmento contra paredes/obstáculos/puertas y retransmite la posición autoritativa. Una corrección explícita se aplica sin deadband en el cliente.

### Mundo físico

`shared/world-data.js` define:

- mundo `1200×900`;
- collider del jugador de radio `18`;
- ocho zonas, obstáculos, estaciones y 22 puertas;
- paredes derivadas de zonas menos aperturas de puerta.

Cliente y servidor consumen esa misma definición. `server/worldCollision.js` diferencia movimiento con escape permitido de interacción sin escape.

### Tareas

Hay cinco mecánicas:

| Tarea | Mecánica |
|---|---|
| Café | detener indicador en ventana válida |
| Archivos | seleccionar orden correcto |
| Correos | clasificar cada correo |
| Reporte | hold con heartbeat continuo |
| Wi‑Fi | emparejar conectores por ID y forma |

Flujo online:

1. `task:start {taskId}` valida rol, fase, moral, bloqueo, distancia y línea de interacción.
2. El servidor devuelve `sessionId` y estado inicial.
3. `task:action {sessionId, action}` normaliza y reduce en servidor.
4. Solo el servidor marca la tarea completada y emite `task:completed`.

Los tokens se invalidan ante cualquier pérdida de acceso. ACKs y aperturas tardías del cliente están protegidos por token de solicitud e identidad de panel.

### Sabotajes

El servidor valida tipo string, allowlist, fase, rol, objetivo y proximidad antes de mutar estado. Los cooldowns se consumen únicamente después de una acción aceptada. `sabotage:close_door` usa `doorId` exacto y exige que sea la puerta válida más cercana a `≤170 px`.

### Privacidad

- Público: nombre, posición, moral visible, progreso, estado de tarea y sabotajes visibles.
- Privado: rol, objetivo secundario y cooldowns propios.
- Final: roles y puntuaciones se revelan al terminar.

## Lifecycle cliente

`GameScene` elimina suscripciones de red al reiniciarse. Cerrar panel o hacer shutdown invalida solicitudes pendientes y destruye listeners de teclado, `blur`, `visibilitychange`, timers y tweens del minijuego. Reunión neutraliza D-pad y cierra el panel activo; resize cancela el panel para reconstruir hitboxes con geometría fresca.

## Límites deliberados

- Estado solo en RAM; reiniciar servidor pierde salas.
- Una instancia de proceso; sin coordinación horizontal.
- Phaser se carga desde CDN.
- Sin cuentas, ranking, DB, matchmaking ni reconexión persistente.
