# OfiChaos — Handoff para siguiente agente

## Estado actual
- **MVP completo y deployado** en https://ofichaos.onrender.com
- **Repo:** https://github.com/wicho-creator/ofichaos
- **Stack:** Phaser 3.80 + Node.js + Express + Socket.IO
- **Deploy:** Render.com free tier, auto-deploy desde `main`
- **Verificado:** smoke test 4 clientes WebSocket en producción (PASS)
- **Documentación:** `DOCS.md` (arquitectura, eventos, config, limitaciones)

## Cómo correr local
```bash
cd /home/nas/AIWorkspace/games/ofichaos
PORT=3456 npm run dev   # puerto 3000 ocupado por Hermes
```

## Cómo deployar
```bash
cd /home/nas/AIWorkspace/games/ofichaos
git add -A && git commit -m "cambio" && git push origin main
# Render auto-deploya en ~30 seg
```

## Para el siguiente agente
```bash
cd /home/nas/AIWorkspace/games/ofichaos
PORT=3456 npm run dev          # local
git push origin main           # deploy automático a Render
```

Credenciales (GitHub PAT + Render API) están en `WichosBrain/APIS.md`.

## Limitaciones conocidas (prioridades para v2)
1. Sin persistencia (salas se pierden al reiniciar servidor)
2. Free tier sleep (Render duerme tras 15 min inactivo)
3. Sprites placeholder (círculos, no pixel art)
4. Minijuegos simples (barra de progreso, clicks)
5. Cámara fija (no sigue al jugador)
6. Sin colisiones con mobiliario
7. Sistema de puntos simplificado
8. Objetivos secundarios no se verifican automáticamente
9. Sabotajes del lamebotas NO implementados (fakeTask, falseReport, blockTask)
10. Reportar sabotaje del empleado NO implementado

## Top 3 prioridades para v2
1. **Implementar sabotajes del lamebotas** (fakeTask, falseReport, blockTask) — el rol existe pero sus habilidades no tienen eventos socket
2. **Verificación de objetivos secundarios** — se asignan pero nunca se comprueba su cumplimiento para puntos
3. **Cámara que sigue al jugador** + zoom — estructural, cambia la UX completa del GameScene

## Arquitectura para tener en cuenta
- **Todo el estado vive en RAM** del servidor (roomManager.js → rooms object)
- **Game loop** via setInterval cada 1 seg en server/index.js
- **roles.js assignRoles()** instancia 1 jefe (≥4 jugadores) + 1 lamebotas (≥5) + resto empleados
- **gameState.js** maneja meeting → voting → playing transitions
- **client/src/main.js** requiere `dom: { createContainer: true }` para inputs HTML en Phaser
- El cliente carga Phaser desde CDN (`https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`)
- Socket.IO cliente desde el servidor Express (`/socket.io/socket.io.js`)

## Estructura de carpetas
```
ofichaos/
  server/   — 6 archivos JS (index, roomManager, gameState, roles, tasks, sabotage)
  client/   — index.html + src/ (main.js, scenes/*, systems/*)
  DOCS.md   — documentación técnica completa
  README.md — instrucciones de instalación y juego
```

## Convenciones
- Commits en español, prefijos: `feat:`, `fix:`, `docs:`, `refactor:`
- PORT default 3000, usar 3456 local (Hermes ocupa 3000)
- Smoke test: crear 4 clientes socket.io, sala, game:start, verificar roles
