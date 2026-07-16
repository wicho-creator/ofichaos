---
version: alpha
name: OfiChaos
description: Sátira de oficina en caricatura 2D, brillante, legible y expresiva; el orden cotidiano se descompone visualmente durante sabotajes y burnout.
colors:
  primary: "#2563EB"
  primaryLight: "#60A5FA"
  ink: "#172554"
  background: "#DBEAFE"
  surface: "#F8FAFC"
  surfaceStrong: "#FFFFFF"
  border: "#15203A"
  muted: "#64748B"
  neutral: "#CBD5E1"
  sabotage: "#F05A5A"
  sabotageAccessible: "#D83A4A"
  task: "#F6C344"
  success: "#22C55E"
  disabled: "#94A3B8"
typography:
  display:
    fontFamily: "ui-rounded, Arial Rounded MT Bold, system-ui, sans-serif"
    fontSize: 3rem
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.035em"
  heading:
    fontFamily: "ui-rounded, Arial Rounded MT Bold, system-ui, sans-serif"
    fontSize: 1.5rem
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 1rem
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0em"
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 0.875rem
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "0.02em"
  caption:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 0.75rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 16px
    height: 52px
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 16px
    height: 52px
  button-task:
    backgroundColor: "{colors.task}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 16px
    height: 52px
  alert-sabotage:
    backgroundColor: "{colors.sabotageAccessible}"
    textColor: "#FFFFFF"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 12px
  status-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 12px
  panel:
    backgroundColor: "{colors.surfaceStrong}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 24px
---

## Overview

OfiChaos es un party game web de deducción social para cuatro personas. La dirección aprobada combina caricatura 2D de oficina, lectura inmediata y caos cooperativo: personajes expresivos y volumétricos en 2D, utilería reconocible y una interfaz que parece parte del juego, no un dashboard.

La escena física de referencia es una jornada diurna, luminosa y casi demasiado optimista. Cuando aparece un sabotaje, el orden se rompe mediante cambios observables en el mundo: luces, máquinas, humo, papeles, puertas y animación. El estilo es original; *Two Point Hospital* y *Overcooked* son referencias de energía, legibilidad y expresividad, no plantillas a copiar.

La lámina aprobada vive en `.hermes/art-direction/palette.html`. Es una referencia de tono; este documento es la autoridad normativa.

## Colors

La estrategia es **Full palette funcional**: cuatro colores saturados, cada uno con un significado estable.

- **Azul eléctrico (`primary`)**: identidad, jugador local, navegación y acción principal. No codifica rol.
- **Coral (`sabotage`)**: estrés ambiental, peligro y crisis. Para texto blanco se usa `sabotageAccessible`; el coral brillante queda para superficies grandes, ilustración y estados sin texto pequeño.
- **Amarillo (`task`)**: tareas, pistas e interacción posible. Siempre con tinta azul marino.
- **Verde (`success`)**: progreso confirmado, reparación y recuperación. Siempre con tinta azul marino.
- **Azul marino (`ink`)**: contornos, texto y estructura. Sustituye el negro puro.
- **Blancos azulados (`surface`, `background`)**: oficina diurna y superficies; nunca crema, beige o vidrio decorativo.

Reglas:

1. Ningún color del personaje revela `jefe`, `empleado` o cualquier rol secreto.
2. Color nunca es la única señal: todo estado incluye forma, icono dibujado o etiqueta.
3. Texto normal exige contraste WCAG AA. Blanco sobre `primary` y `sabotageAccessible`; tinta sobre amarillo, verde, sky y coral brillante.
4. El mundo usa color con abundancia; el HUD reserva la saturación para acciones y estados.
5. Prohibidos texto degradado, gradientes morado-azul genéricos, glassmorphism y arcoíris sin semántica.

## Typography

Se usan fuentes nativas para no añadir descarga, bloqueo de render ni dependencia externa.

- `display`: logo, revelación de rol y resultado final; máximo 3rem dentro del juego.
- `heading`: títulos de escena y paneles.
- `body`: instrucciones cortas y chat.
- `label`: botones, estados, nombres de estación y datos críticos.
- `caption`: atajos y metadatos; nunca información esencial en móvil.

El logo puede usar `ui-rounded`; controles y datos usan `system-ui`. No usar tipografías de display en botones pequeños ni textos largos. Números de tiempo y progreso deben usar `font-variant-numeric: tabular-nums` en DOM y un ancho estable equivalente en Phaser.

## Layout

La escala espacial es 4, 8, 12, 16, 24, 32 y 48 px. No introducir valores arbitrarios sin una razón óptica documentada.

### Escritorio

- Mundo centrado con cámara; HUD en tres islas, no una caja gigante: objetivo/progreso arriba, estado personal arriba a la izquierda y acciones abajo a la derecha.
- La acción inmediata domina. Objetivos secundarios y explicación se revelan progresivamente.
- Paneles de tarea, reunión y final ocupan como máximo 90% del viewport y conservan el mundo como contexto cuando sea útil.

### Móvil

- El HUD se recompone; no se limita a encoger.
- Movimiento en zona inferior izquierda; acciones en zona inferior derecha; objetivo/progreso en una banda superior compacta.
- Controles táctiles mínimos de 52×52 px, separados al menos 8 px y respetando safe areas.
- Chat y votación se apilan verticalmente. Nada esencial depende de hover.
- Soportar 320×568, 390×844 y paisaje 844×390 sin clipping.

### Mundo

- El mapa se diseña como una oficina conectada, no ocho rectángulos independientes.
- Pasillos, puertas, estaciones y props crean rutas y líneas de visión. Las colisiones visuales y autoritativas comparten una sola definición.
- Cada estación tiene silueta propia: cafetera, impresora, archivador y rack de red deben reconocerse sin leer la etiqueta.

## Elevation & Depth

El lenguaje visual usa contorno azul marino de 2–4 px y sombras duras cortas, no sombras difusas de interfaz SaaS.

- Mundo: sombra de contacto bajo personajes y props; sombreado plano de dos tonos.
- Controles: elevación de 5–7 px en reposo, 2–3 px al presionar.
- Paneles: máximo una sombra dura de 8 px. Si hay borde completo grueso, no añadir sombra blanda amplia.
- Sabotajes: profundidad mediante color, partículas limitadas y cambios de luz; no blur de pantalla completa.

## Shapes

- Personajes: cabezas grandes, torso compacto, manos/pies claros y siluetas diferentes por cosmética neutral, nunca por rol.
- Props: formas exageradas y reconocibles; detalles pequeños solo si sobreviven a zoom móvil.
- Controles: radios de 8–16 px. Píldoras solo para tags, cooldowns o estados breves.
- Paneles: radio máximo 16 px. Prohibidas cajas de 24–40 px de radio y paneles anidados.
- Iconos: pictogramas vectoriales/canvas coherentes. Los emoji no son arte final ni iconografía principal.

## Components

### Botones

Botones primarios son gruesos, inequívocos y conservan cuatro estados: reposo, hover/focus, presionado y deshabilitado. La acción incluye verbo: `Trabajar`, `Reparar`, `Convocar reunión`, `Votar`, `Revancha`.

### HUD

- **Cuota del turno:** progreso del equipo, tiempo y estado de crisis.
- **Estado personal:** moral propia, objetivo de rol y cooldown relevante.
- **Acciones:** máximo tres botones simultáneos y una interacción contextual.
- La etiqueta correcta es `Tu moral`, no `Moral del equipo`.

### Revelación de rol

Tarjeta de 3–4 segundos al comenzar: rol propio, objetivo principal y dos acciones disponibles. Es privada y nunca deja señales visibles en el personaje para otros clientes.

### Personajes

Cada trabajador tiene cuerpo, cabeza, cara, pelo/accesorio neutral, sombra, nombre y estados animados. El jugador local se distingue con aro azul/puntero, no por uniforme de rol. Burnout usa postura, nube de estrés y desaturación además del coral.

### Tareas

Cada tarea tiene un objeto físico, un prompt contextual, un minijuego corto y feedback de éxito. El panel explica una sola acción. Completar genera reacción del objeto y del personaje, no solo texto flotante.

### Sabotajes

Solo dos sabotajes forman el vertical slice:

1. **Bloquear estación:** cambia físicamente la estación y exige una reparación breve.
2. **Crisis de moral:** afecta una zona cercana y deja una pista espacial observable.

Una crisis muestra causa, zona y contrajuego sin revelar quién la activó.

### Reunión

Se presenta como mesa de juntas caricaturesca con retratos neutrales, discusión de 25 s y votación de 10 s. Tarjetas, chat y color no muestran roles. El resultado comunica consecuencia jugable y vuelve al mundo con una transición breve.

### Final y revancha

La pantalla final revela roles, contribuciones y motivo de victoria. La acción principal es `Revancha con la misma sala`; volver al lobby es secundaria.

## Do's and Don'ts

### Sí

- Construir primero seguridad y coherencia del loop; después arte y polish.
- Hacer que cada sabotaje cambie el mundo y ofrezca contrajuego.
- Reutilizar una definición compartida de mapa, tareas, colisiones y tiempos.
- Mantener 60 fps en escritorio y móvil medio; limitar partículas y objetos activos.
- Validar escritorio, móvil vertical y móvil horizontal con capturas antes de cerrar una fase.
- Respetar `prefers-reduced-motion` y conservar feedback instantáneo sin animación.

### No

- No revelar roles en snapshots, sprites, chat o votación.
- No reintroducir Lamebotas hasta validar el loop de cuatro jugadores.
- No añadir cuentas, ranking, skins, múltiples mapas, bots, base de datos o matchmaking en este slice.
- No usar emojis como sustituto de ilustración o iconos.
- No convertir el mapa en bloques de color rotulados.
- No añadir paneles por cada dato; usar jerarquía, proximidad y revelación progresiva.
- No introducir dependencias o frameworks nuevos para lo que Phaser, DOM y Node ya resuelven.
