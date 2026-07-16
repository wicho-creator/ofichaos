# OfiChaos — Estado de verificación

Fecha del último freeze local: **2026-07-16**.

## Estado revisado

- Rama: `feat/ofichaos-minigames-map-pass`.
- Base: `6986346`.
- Producción permanece en `6986346` hasta una decisión explícita de publicación.
- Cambios locales sin push ni deploy al registrar este documento.

## Evidencia

| Gate | Resultado |
|---|---|
| `npm test` | **166/166** |
| `npm run check` | PASS |
| `git diff HEAD --check` | PASS |
| Escaneo de líneas añadidas | sin secretos, `eval`/`Function`, HTML inseguro ni debug nuevo |
| Cuatro Chrome aislados | 4 clientes, 11 etapas, 0 errores |
| Minijuegos compactos | 5 tareas × 2 viewports = 10/10, 0 errores |
| Matriz móvil | `390×844` y `360×640`, PASS |
| Paisaje/compacto | `640×390`, `568×320`, `360×300`, PASS |
| Objetivos táctiles | mínimo 44 px en paneles medidos |

Los logs y reportes de harness son temporales en `/tmp`; no forman parte del repositorio.

## Cobertura adversarial clave

- movimiento solo durante `playing`, sin atravesar sólidos, con ráfagas limitadas y sin retransmitir rechazos a peers;
- cambios de sala validados antes de abandonar la membresía actual;
- payloads Socket.IO `null`, primitivos, arrays, objetos hostiles y ACK no función;
- tokens de tarea falsos, ajenos, cross-task y replay tras completar;
- pérdida transitoria de acceso, bloqueo, puerta, reunión, fin, moral cero y burnout; `0` no activa fallbacks truthy;
- heartbeat continuo de Reporte; blur/visibilidad liberan Reporte y D-pad; shutdown destruye paneles y listeners;
- sabotajes con IDs/objetivos inválidos sin mutación, estadística ni cooldown;
- puerta remota rechazada;
- votos solo de miembros actuales, hacia objetivos actuales, inmutables después del primer envío; sanción y `cause_sanction` requieren una mutación real;
- callbacks `task:start`/`task:action`/cierres tardíos sin afectar panel nuevo;
- proyecciones públicas sin roles ni cooldowns ajenos.

## Cierre

Este resultado es evidencia local, no autorización de publicación. Antes de commit final debe existir revisión independiente vigente sobre el mismo diff. Antes de push/deploy debe repetirse el gate que corresponda al artefacto que se vaya a publicar.
