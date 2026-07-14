// proposed_GameScene_changes.js
// Proposed changes for client/src/scenes/GameScene.js to polish the map & obstacles

// -------------------------------------------------------------
// CHANGE 1: Inside create(data) - Replace lines 77-84
// -------------------------------------------------------------

/* BEFORE:
    for (const obs of obstacleData) {
      const cx = obs.x + obs.w / 2;
      const cy = obs.y + obs.h / 2;
      const rect = this.add.rectangle(cx, cy, obs.w, obs.h, 0x1f2937, 0.9);
      rect.setStrokeStyle(2, obs.color, 0.8);
      this.physics.add.existing(rect, true);
      this.obstacles.add(rect);
    }
*/

// AFTER:
    // Create custom floor textures before drawing obstacles and map
    this.createMapTextures();

    for (const obs of obstacleData) {
      const cx = obs.x + obs.w / 2;
      const cy = obs.y + obs.h / 2;

      // Base rectangle for physics collisions (made transparent so we can draw decorations on top)
      const rect = this.add.rectangle(cx, cy, obs.w, obs.h, 0x1f2937, 0.0);
      this.physics.add.existing(rect, true);
      this.obstacles.add(rect);

      // Draw custom visual decorations representing desk, chairs, plant, racks, etc.
      this.drawObstacleDecoration(obs, cx, cy);
    }


// -------------------------------------------------------------
// CHANGE 2: Replace drawMap() entirely (originally lines 121-182)
// -------------------------------------------------------------

  drawMap() {
    // 1. Draw tiled background carpet floor
    this.add.tileSprite(0, 0, 1200, 900, 'floor_carpet_general').setOrigin(0);

    // Zonas del mapa
    const zoneColors = {
      recepcion: 0x3b82f6,
      cubiculos: 0x10b981,
      juntas: 0xf59e0b,
      cocina: 0xef4444,
      archivo: 0x8b5cf6,
      jefe_oficina: 0xdc2626,
      rh: 0x06b6d4,
      servidor: 0x6366f1
    };

    const zones = [
      { id: 'recepcion', name: 'Recepción', x: 100, y: 100, w: 250, h: 200 },
      { id: 'cubiculos', name: 'Cubículos', x: 450, y: 100, w: 300, h: 200 },
      { id: 'juntas', name: 'Sala de Juntas', x: 850, y: 100, w: 250, h: 200 },
      { id: 'cocina', name: 'Cocina', x: 100, y: 400, w: 200, h: 180 },
      { id: 'archivo', name: 'Archivo', x: 400, y: 400, w: 200, h: 180 },
      { id: 'jefe_oficina', name: 'Oficina del Jefe', x: 700, y: 400, w: 200, h: 180 },
      { id: 'rh', name: 'Recursos Humanos', x: 100, y: 650, w: 250, h: 180 },
      { id: 'servidor', name: 'Servidor / IT', x: 500, y: 650, w: 250, h: 180 }
    ];

    const g = this.add.graphics();

    for (const z of zones) {
      // 2. Tile backgrounds or colored overlay for rooms
      if (z.id === 'cocina') {
        // Checkered tile floor
        this.add.tileSprite(z.x, z.y, z.w, z.h, 'floor_kitchen_tile').setOrigin(0);
        g.fillStyle(0xef4444, 0.06);
        g.fillRect(z.x, z.y, z.w, z.h);
      } else if (z.id === 'servidor') {
        // Tech metallic grid floor
        this.add.tileSprite(z.x, z.y, z.w, z.h, 'floor_server_grid').setOrigin(0);
        g.fillStyle(0x6366f1, 0.06);
        g.fillRect(z.x, z.y, z.w, z.h);
      } else {
        // Semi-transparent colored overlay to tint carpet
        const color = zoneColors[z.id] || 0x475569;
        g.fillStyle(color, 0.12);
        g.fillRect(z.x, z.y, z.w, z.h);
      }

      // 3. Double-outline walls with outer shadow and neon glow strip
      const color = zoneColors[z.id] || 0x475569;

      // Soft shadow border
      g.lineStyle(8, 0x000000, 0.35);
      g.strokeRect(z.x - 2, z.y - 2, z.w + 4, z.h + 4);

      // Main thick slate wall core
      g.lineStyle(6, 0x1e293b, 1.0);
      g.strokeRect(z.x, z.y, z.w, z.h);

      // Glowing inner divider strip
      g.lineStyle(2, color, 0.85);
      g.strokeRect(z.x, z.y, z.w, z.h);

      // Inner border offset for double line style
      g.lineStyle(1, 0x0f172a, 0.5);
      g.strokeRect(z.x + 3, z.y + 3, z.w - 6, z.h - 6);

      // Room Title
      this.add.text(z.x + z.w / 2, z.y + 16, z.name, {
        fontSize: '13px',
        color: '#f8fafc',
        fontStyle: 'bold',
        shadow: { fill: true, blur: 4, color: '#000000', y: 1 }
      }).setOrigin(0.5);

      // Task in Zone text
      const taskInZone = CLIENT_TASKS.find((t) => t.zone === z.id);
      if (taskInZone) {
        this.add.text(z.x + z.w / 2, z.y + z.h - 16, `📋 ${taskInZone.name}`, {
          fontSize: '11px',
          color: '#fbbf24',
          fontStyle: 'bold',
          shadow: { fill: true, blur: 2, color: '#000000', y: 1 }
        }).setOrigin(0.5);
      }
    }

    // Nice visual pathways between offices
    g.lineStyle(4, 0x334155, 0.45);
    g.lineBetween(350, 200, 450, 200); // recepción -> cubículos
    g.lineBetween(750, 200, 850, 200); // cubículos -> juntas
    g.lineBetween(225, 300, 225, 400); // recepción -> cocina
    g.lineBetween(500, 300, 500, 400); // cubículos -> archivo
    g.lineBetween(800, 300, 800, 400); // juntas -> jefe
  }


// -------------------------------------------------------------
// CHANGE 3: Add new helper methods to GameScene class
// -------------------------------------------------------------

  /**
   * Generates custom tilesets programmatically using HTML5 Canvas contexts.
   */
  createMapTextures() {
    // 1. General carpet texture
    if (!this.textures.exists('floor_carpet_general')) {
      const tex = this.textures.createCanvas('floor_carpet_general', 60, 60);
      const ctx = tex.context;
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.fillRect(0, 0, 60, 60);

      // Carpet grain effect
      ctx.fillStyle = '#0f172a';
      for (let i = 0; i < 35; i++) ctx.fillRect(Math.random() * 60, Math.random() * 60, 1.5, 1.5);
      ctx.fillStyle = '#334155';
      for (let i = 0; i < 25; i++) ctx.fillRect(Math.random() * 60, Math.random() * 60, 1.5, 1.5);

      // Fine grid tile boundaries
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(0, 0, 60, 60);
      tex.refresh();
    }

    // 2. Kitchen checkered tiles
    if (!this.textures.exists('floor_kitchen_tile')) {
      const tex = this.textures.createCanvas('floor_kitchen_tile', 40, 40);
      const ctx = tex.context;
      ctx.fillStyle = '#e2e8f0'; // light slate-200
      ctx.fillRect(0, 0, 20, 20);
      ctx.fillRect(20, 20, 20, 20);
      ctx.fillStyle = '#cbd5e1'; // darker slate-300
      ctx.fillRect(20, 0, 20, 20);
      ctx.fillRect(0, 20, 20, 20);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(0, 0, 40, 40);
      ctx.strokeRect(0, 0, 20, 20);
      ctx.strokeRect(20, 20, 20, 20);
      tex.refresh();
    }

    // 3. Server room tech floor grid
    if (!this.textures.exists('floor_server_grid')) {
      const tex = this.textures.createCanvas('floor_server_grid', 80, 80);
      const ctx = tex.context;
      ctx.fillStyle = '#090d16'; // deep futuristic dark blue
      ctx.fillRect(0, 0, 80, 80);

      // Metallic frame lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, 80, 80);

      // Tech circuit microdots
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(10, 10, 3, 3);
      ctx.fillRect(50, 45, 3, 3);
      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(11, 11); ctx.lineTo(11, 35); ctx.lineTo(30, 35);
      ctx.moveTo(51, 46); ctx.lineTo(70, 46);
      ctx.stroke();
      tex.refresh();
    }
  }

  /**
   * Draws nice polished visuals representing desks, plants, meeting tables, files, or server racks.
   */
  drawObstacleDecoration(obs, cx, cy) {
    const rx = obs.x;
    const ry = obs.y;

    // 1. Office Desks
    if (obs.name.includes('Escritorio')) {
      const deskColor = obs.name.includes('Jefe') ? 0x3e2723 : 0x334155; // Wood for boss, slate for standard desks
      this.add.rectangle(cx, cy, obs.w, obs.h, deskColor).setStrokeStyle(1.5, 0x1e293b);

      if (obs.w > obs.h) {
        // Monitor
        this.add.rectangle(cx, cy - 8, 42, 4, 0x0f172a); // Screen
        this.add.rectangle(cx, cy - 5, 8, 2, 0x64748b);  // Neck
        this.add.rectangle(cx, cy - 3, 14, 3, 0x475569); // Foot
        // Keyboard
        this.add.rectangle(cx, cy + 5, 24, 6, 0x94a3b8).setStrokeStyle(0.5, 0x475569);
        // Mouse
        this.add.circle(cx + 18, cy + 5, 1.5, 0xd1d5db);
        // Papers
        this.add.rectangle(cx - 32, cy + 2, 12, 14, 0xf8fafc).setStrokeStyle(0.5, 0xcbd5e1);
      } else {
        // Vertical Desk Layout
        this.add.rectangle(cx - 8, cy, 4, 42, 0x0f172a); // Screen
        this.add.rectangle(cx - 5, cy, 2, 8, 0x64748b);
        this.add.rectangle(cx - 3, cy, 3, 14, 0x475569);
        this.add.rectangle(cx + 5, cy, 6, 24, 0x94a3b8).setStrokeStyle(0.5, 0x475569);
        this.add.circle(cx + 5, cy + 18, 1.5, 0xd1d5db);
      }
      return;
    }

    // 2. Plants
    if (obs.name.includes('Planta')) {
      // Pot
      this.add.circle(cx, cy, 9, 0xb45309).setStrokeStyle(1.5, 0x78350f);
      // Foliage (overlapping green circles)
      this.add.circle(cx - 3, cy - 2, 8, 0x15803d);
      this.add.circle(cx + 3, cy - 3, 9, 0x166534);
      this.add.circle(cx, cy + 3, 8, 0x22c55e);
      return;
    }

    // 3. Meeting Room Table
    if (obs.name.includes('Mesa de Juntas')) {
      // Large Wood Table
      this.add.rectangle(cx, cy, obs.w, obs.h, 0x5c4033).setStrokeStyle(2.5, 0x3e2723);
      // Conference speakerphone
      this.add.triangle(cx, cy - 4, cx - 6, cy + 6, cx + 6, cy + 6, 0x1e293b);
      // Office Chairs
      const chairColor = 0x1e293b;
      for (let xOff = -50; xOff <= 50; xOff += 25) {
        this.add.circle(cx + xOff, cy - obs.h / 2 - 3, 5, chairColor).setStrokeStyle(1, 0x475569); // Top chairs
        this.add.circle(cx + xOff, cy + obs.h / 2 + 3, 5, chairColor).setStrokeStyle(1, 0x475569); // Bottom chairs
      }
      return;
    }

    // 4. Server Racks (IT Room)
    if (obs.name.includes('Rack')) {
      this.add.rectangle(cx, cy, obs.w, obs.h, 0x0f172a).setStrokeStyle(1.5, 0x334155);

      // Vent grills
      const grills = this.add.graphics();
      grills.lineStyle(1.5, 0x1e293b, 0.5);
      for (let vy = cy - obs.h / 2 + 8; vy < cy + obs.h / 2 - 8; vy += 6) {
        grills.lineBetween(cx - obs.w / 2 + 5, vy, cx + obs.w / 2 - 5, vy);
      }

      // Blinking status LEDs (Green/Red)
      const lights = [];
      for (let ly = cy - obs.h / 2 + 12; ly < cy + obs.h / 2 - 12; ly += 16) {
        const ledG = this.add.circle(cx - 12, ly, 2, 0x22c55e);
        const ledR = this.add.circle(cx - 6, ly, 2, 0xef4444);
        lights.push(ledG, ledR);
      }

      // LED Blinker animation
      this.tweens.add({
        targets: lights,
        alpha: 0.15,
        duration: 450,
        yoyo: true,
        repeat: -1,
        delay: (target, key, value, index) => index * 80
      });
      return;
    }

    // 5. Kitchen Refrigerator
    if (obs.name.includes('Refrigerador')) {
      // Refrigerator metallic base
      this.add.rectangle(cx, cy, obs.w, obs.h, 0x94a3b8).setStrokeStyle(1.5, 0x475569);
      // Freezer boundary line
      const line = this.add.graphics();
      line.lineStyle(1.5, 0x334155);
      line.lineBetween(cx - obs.w / 2, cy - 2, cx + obs.w / 2, cy - 2);
      // Handles
      this.add.rectangle(cx + obs.w / 2 - 2, cy - 10, 2, 6, 0x334155);
      this.add.rectangle(cx + obs.w / 2 - 2, cy + 8, 2, 8, 0x334155);
      // Magnet post-its
      this.add.rectangle(cx - 5, cy + 6, 5, 5, 0xfef08a); // Yellow
      this.add.rectangle(cx + 3, cy + 4, 4, 4, 0xfecdd3); // Pink
      return;
    }

    // 6. Archiveros (File Cabinets)
    if (obs.name.includes('Archivero')) {
      this.add.rectangle(cx, cy, obs.w, obs.h, 0x475569).setStrokeStyle(1.5, 0x1e293b);
      const cabinetLine = this.add.graphics();
      cabinetLine.lineStyle(1.5, 0x1e293b);

      if (obs.h > obs.w) {
        // Vertical cabinet drawers
        for (let dy = cy - obs.h / 2 + 20; dy < cy + obs.h / 2; dy += 24) {
          cabinetLine.lineBetween(cx - obs.w / 2, dy, cx + obs.w / 2, dy);
          this.add.rectangle(cx, dy - 12, 6, 2, 0xd1d5db); // Silver handle
        }
      } else {
        // Horizontal cabinet drawers
        for (let dx = cx - obs.w / 2 + 20; dx < cx + obs.w / 2; dx += 24) {
          cabinetLine.lineBetween(dx, cy - obs.h / 2, dx, cy + obs.h / 2);
          this.add.rectangle(dx - 12, cy, 2, 6, 0xd1d5db); // Silver handle
        }
      }
      return;
    }

    // Default fallback rect outline
    this.add.rectangle(cx, cy, obs.w, obs.h, 0x1f2937).setStrokeStyle(2, obs.color, 0.85);
  }
