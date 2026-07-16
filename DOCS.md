# OfiChaos — Documentación técnica

## Runtime

- **Cliente:** Phaser 3.80 en navegador.
- **Servidor:** Node.js, Express y Socket.IO.
- **Estado:** salas en RAM.
- **Producción:** <https://ofichaos.onrender.com>.
- **Repositorio:** <https://github.com/wicho-creator/ofichaos>.

## Fases

```text
lobby → playing → meeting → voting → playing
                   └───────────────→ ended
playing ───────────────────────────→ ended
```

Movimiento, tareas y habilidades solo se autorizan durante `playing`. Reunión, votación y fin invalidan sesiones de minijuego.

## Trust boundary Socket.IO

Todo payload cliente se trata como no confiable:

- normalizar antes de leer campos;
- no desestructurar `null` en la firma del handler;
- aceptar IDs únicamente si `typeof value === 'string'`;
- exigir números finitos para coordenadas;
- aceptar ACK solo si es función;
- validar rol, fase, cooldown y objetivo antes de mutar estado.

### Cliente → servidor

| Evento | Payload | Regla principal |
|---|---|---|
| `room:create` | `{name}` | nombre saneado |
| `room:join` | `{code, name}` | valida destino antes de abandonar sala actual |
| `game:start` | — | solo host; no reinicia una partida activa |
| `player:move` | `{x, y}` | 50 Hz máx.; autoridad física; solo retransmite cambios |
| `task:start` | `{taskId}` + ACK | acceso completo a estación |
| `task:action` | `{sessionId, action}` + ACK | token propietario y reducer servidor |
| `task:complete` | `{taskId}` | compatibilidad fail-closed; nunca completa |
| `sabotage:zone` | `{zoneId}` | zona allowlisted |
| `sabotage:extra_task` | `{targetId}` | empleado existente |
| `sabotage:morale` | `{targetId}` | empleado existente |
| `sabotage:close_door` | `{doorId}` | puerta exacta cercana |
| `sabotage:block_task` | `{taskId}` | tarea activa |
| `sabotage:report` | — | sabotaje reportable y reunión disponible |
| `meeting:call` | — | reunión disponible |
| `meeting:chat` | `{message}` | fase y texto limitado |
| `vote:cast` | `{targetId}` | un voto inmutable por miembro actual; objetivo actual o `skip` |

### Servidor → cliente

- `game:started` / `game:update`: proyección pública.
- `game:role`: rol y objetivo privados al propietario.
- `game:private`: cooldowns propios.
- `game:tick`: posición, moral y estado visible allowlisted.
- `player:moved`: posición autoritativa; los rechazos se reconcilian solo con el emisor.
- `task:completed`: `taskId` y nombre visible, sin identidad privada adicional.
- `meeting:*`, `voting:*`, `game:ended`: transiciones de fase.

## Minijuegos autoritativos

`shared/minigames.js` expone reducers puros compatibles con navegador y CommonJS. Online, el cliente no aplica progreso optimista: espera el ACK servidor. Controles discretos tienen cadencia mínima; Café usa tiempo servidor; Reporte acredita solo heartbeats continuos y no intervalos retroactivos largos.

## Colisiones e interacción

`shared/world-data.js` es la fuente física única. El servidor valida el segmento completo con el radio real del jugador. Para tareas exige distancia máxima de `170 px` y línea despejada. Una puerta cerrada puede permitir salir a quien quedó atrapado, pero esa excepción de movimiento nunca autoriza interacción.

## Proyecciones

`server/projections.js` construye payloads por allowlist. Roles, objetivos y cooldowns no aparecen en jugadores remotos. Los sabotajes públicos contienen solo tipo, objetivo espacial necesario y expiración.

## Deploy

Producción usa Render. Un push o merge puede activar deploy según la configuración remota; por eso commit, push y deploy son decisiones separadas. Antes de publicar deben pasar los gates de [`TEST_INFRA.md`](TEST_INFRA.md).
