# OfiChaos — Documentación Técnica

## Resumen del Proyecto

OfiChaos es un juego multijugador online tipo *Among Us* ambientado en una oficina tóxica y cómica. Desarrollado como MVP con Phaser.js + Node.js + Socket.IO.

- **URL producción:** https://ofichaos.onrender.com
- **Repo:** https://github.com/wicho-creator/ofichaos
- **Stack:** Phaser 3.80 (frontend) + Node.js/Express/Socket.IO (backend)
- **Plan:** Render free tier (oregon)

---

## Arquitectura

```
Cliente (Phaser.js en browser)
  ⇄ WebSocket (Socket.IO)
    ⇄ Servidor Node.js (Express + Socket.IO)
        ├── roomManager.js  — salas privadas con código de 5 letras
        ├── gameState.js    — estado de partida, moral, temporizadores
        ├── roles.js        — asignación de roles + objetivos secundarios
        ├── tasks.js        — 5 tareas en 8 zonas del mapa
        └── sabotage.js     — sabotajes de zona, moral, puertas
```

### Estado en memoria

Toda la lógica del juego vive en RAM del servidor. No hay base de datos ni persistencia. Si el servidor reinicia, las salas activas se pierden. Esto es aceptable para el MVP.

### Game loop

El servidor corre un `setInterval` cada 1 segundo que:
1. Descuenta el temporizador de partida (8 min)
2. Limpia sabotajes expirados
3. Verifica condiciones de burnout (moral ≤ 0)
4. Verifica condiciones de victoria
5. Si hay reunión activa, descuenta su timer (60 seg → votación 20 seg)
6. Broadcastea `game:tick` con tiempo restante, % de tareas y posiciones

---

## Flujo de juego

### 1. Lobby
- Jugador crea sala → recibe código de 5 letras (ej: `KQKMM`)
- Otros jugadores se unen con el código
- Host ve botón "Iniciar partida" cuando hay ≥ 4 jugadores
- Mínimo 4, máximo 12 jugadores

### 2. Inicio de partida
- `gameState.startGame()` asigna roles:
  - 1 Jefe (si ≥ 4 jugadores)
  - 1 Lamebotas (si ≥ 5 jugadores)
  - Resto: Empleados
- Cada jugador recibe un objetivo secundario aleatorio (8 posibles)
- Cada jugador recibe su rol via `game:role` (evento privado)

### 3. Juego
- Movimiento: WASD o flechas, throttle 80ms al servidor
- Click en zona cercana → abre minijuego de tarea
- 3 tipos de minijuego: progress (barra), click (N clicks), sequence (N pasos)
- Moral: 100 inicial, baja con sabotajes, sube con tareas
- Burnout: moral ≤ 0 → 20 seg sin tareas, movimiento lento

### 4. Reunión
- Activada por: botón de emergencia (1x por partida), reporte de sabotaje
- 60 seg de chat (Socket.IO `meeting:chat`)
- 20 seg de votación (cada jugador vota por otro o skip)
- Más votado: sanción (-20 moral, 30 seg sin habilidad)
- 2 sanciones: suspensión 30 seg

### 5. Victoria
| Quién | Condición |
|-------|-----------|
| Empleados | 80% tareas completadas |
| Jefe | Tiempo acaba y tareas < 80% |
| Jefe | 50% empleados en burnout |
| Lamebotas | Jefe gana + no fue sancionado 2 veces |

### 6. Pantalla final
- Muestra ganadores, razón, puntos por jugador, rol de cada uno
- Botón "Volver al lobby"

---

## Estructura de archivos

```
ofichaos/
├── server/
│   ├── index.js          — Express + Socket.IO, eventos, game loop
│   ├── roomManager.js    — Salas, códigos, join/leave, acciones
│   ├── gameState.js      — startGame, tickGame, meeting, voting, victoria
│   ├── roles.js          — ROLES, SECONDARY_OBJECTIVES, assignRoles()
│   ├── tasks.js          — TASKS, ZONES, initTaskStates, getCompletionPercent
│   └── sabotage.js       — sabotageZone, assignExtraTask, lowerMorale, closeDoor
├── client/
│   ├── index.html        — HTML base, carga Phaser + socket.io
│   └── src/
│       ├── main.js              — Config de Phaser, plugin DOM
│       ├── scenes/
│       │   ├── LobbyScene.js    — Nombre, crear/unirse, lista jugadores, iniciar
│       │   ├── GameScene.js     — Mapa 2D, movimiento, HUD, tareas, sabotaje
│       │   ├── MeetingScene.js  — Chat + votación
│       │   └── EndScene.js      — Resultados finales
│       └── systems/
│           ├── player.js        — createPlayerSprite, updatePlayerSprite
│           ├── tasks.js         — TASKS (mirror del servidor)
│           ├── ui.js            — createButton, createPanel, createText
│           └── networking.js    — Wrapper Socket.IO cliente
├── package.json
├── .gitignore
└── README.md
```

---

## Deploy

### Render.com
- **Tipo:** Web Service (Node.js)
- **Región:** Oregon
- **Plan:** Free
- **Build:** `npm install`
- **Start:** `node server/index.js`
- **AutoDeploy:** Sí (cada push a `main` re-deploya)
- **URL:** https://ofichaos.onrender.com
- **Service ID:** `srv-d97sd2vaqgkc73f4dua0`

### Comando para deploy manual
```bash
cd /home/nas/AIWorkspace/games/ofichaos
git add -A && git commit -m "cambio" && git push origin main
# Render auto-deploya en ~30 seg
```

### Comando para run local
```bash
cd /home/nas/AIWorkspace/games/ofichaos
PORT=3456 npm run dev  # puerto 3000 suele estar ocupado por Hermes
```

---

## Eventos Socket.IO

### Cliente → Servidor
| Evento | Payload | Descripción |
|--------|---------|-------------|
| `room:create` | `{name}` | Crear sala nueva |
| `room:join` | `{code, name}` | Unirse a sala existente |
| `game:start` | — | Iniciar partida (solo host) |
| `player:move` | `{x, y}` | Actualizar posición |
| `task:complete` | `{taskId}` | Completar una tarea |
| `sabotage:zone` | `{zoneId}` | Sabotear zona (jefe/lamebotas) |
| `sabotage:extra_task` | `{targetId}` | Asignar tarea extra (jefe) |
| `sabotage:morale` | `{targetId}` | Bajar moral (jefe) |
| `sabotage:close_door` | `{zoneId}` | Cerrar puerta (jefe) |
| `meeting:call` | — | Convocar reunión |
| `meeting:chat` | `{message}` | Mensaje de chat en reunión |
| `vote:cast` | `{targetId}` | Votar jugador o "skip" |

### Servidor → Cliente
| Evento | Payload | Descripción |
|--------|---------|-------------|
| `room:created` | `{code, playerId}` | Sala creada |
| `room:joined` | `{code, playerId}` | Unión exitosa |
| `room:update` | `{code, hostId, players[]}` | Estado de lobby |
| `game:role` | `{role, secondaryObjectiveText}` | Rol secreto asignado |
| `game:started` | gameState | Partida iniciada |
| `game:update` | gameState | Estado completo actualizado |
| `game:tick` | `{timeRemaining, taskPercent, players}` | Tick cada 1 seg |
| `game:ended` | `{winners, reason, players[]}` | Fin de partida |
| `player:moved` | `{playerId, x, y}` | Otro jugador se movió |
| `task:completed` | `{taskId, completedBy, playerName}` | Tarea completada |
| `sabotage:triggered` | `{type, zoneId, affected[]}` | Sabotaje activado |
| `sabotage:extra_task` | `{from}` | Tarea extra recibida |
| `sabotage:morale` | `{from}` | Moral bajada |
| `sabotage:door_closed` | `{zoneId, expires}` | Puerta cerrada |
| `meeting:started` | `{calledBy, playerName}` | Reunión iniciada |
| `meeting:chat` | `{playerId, playerName, message}` | Mensaje de chat |
| `voting:started` | — | Fase de votación |
| `voting:ended` | `{tally, sanctioned, sanctionType}` | Resultado votación |
| `vote:confirmed` | `{targetId}` | Voto registrado |
| `error:message` | `{message}` | Error |

---

## Configuración de Phaser

```js
{
  type: Phaser.AUTO,
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  dom: { createContainer: true },  // Necesario para add.dom() (inputs HTML)
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [LobbyScene, GameScene, MeetingScene, EndScene]
}
```

**Importante:** `dom: { createContainer: true }` es obligatorio para que los inputs de texto HTML funcionen dentro del canvas de Phaser.

---

## Limitaciones conocidas del MVP

1. **Sin persistencia:** Si el servidor reinicia, las salas activas se pierden
2. **Free tier sleep:** Render free duerme tras 15 min sin tráfico (~30 seg para despertar)
3. **Sprites placeholder:** Los jugadores son círculos de color, no pixel art
4. **Minijuegos simples:** Progress bar, clicks, sequence — no son minijuegos reales
5. **Cámara fija:** El mapa entero se ve de una vez (sin cámara tipo Among Us que sigue al jugador)
6. **Sin colisiones:** Los jugadores se mueven libremente sin chocar con mobiliario
7. **Sistema de puntos simplificado:** Los cálculos de puntos son aproximados
8. **Objetivos secundarios no se verifican:** Se asignan pero no se comprueba su cumplimiento
9. **Sabotajes del lamebotas no implementados:** `fakeTask`, `falseReport`, `blockTask` no tienen eventos socket
10. **Reportar sabotaje no implementado:** El empleado tiene la habilidad pero no hay evento/botón

---

## Credenciales (ver APIS.md)

- **GitHub PAT:** `ghp_...` (wicho-creator, scope repo)
- **Render API Key:** `rnd_...`
- **Render Owner ID:** `tea-d97s9ct8nd3s73ec6glg`
- **Render Service ID:** `srv-d97sd2vaqgkc73f4dua0`
