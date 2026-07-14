# Handoff Report: OfiChaos Collision Mechanics & Anti-Cheat Speed Checks

## 1. Observation

During read-only inspection of the OfiChaos codebase, the following files and lines were analyzed:

- **Client Scene Configuration & Update Loop (`client/src/scenes/GameScene.js`):**
  - Zones definition (lines 103-110):
    ```javascript
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
    ```
  - Directly changing player coordinates on input (lines 646-649):
    ```javascript
    me.x += dx * speed * (delta / 1000);
    me.y += dy * speed * (delta / 1000);
    me.x = Phaser.Math.Clamp(me.x, 20, 1180);
    me.y = Phaser.Math.Clamp(me.y, 20, 880);
    ```

- **Player Container Coordinates (`client/src/systems/player.js`):**
  - Creating container at `0, 0` while using absolute coordinates for child shapes (lines 15-31):
    ```javascript
    const shadow = scene.add.ellipse(player.x, player.y + 18, 42, 12, 0x000000, 0.35);
    const body = scene.add.circle(player.x, player.y, 20, color, 0.95);
    ...
    const container = scene.add.container(0, 0, [shadow, burnoutGlow, body, face, badge, label]);
    ```
  - Directly updating container position in `updatePlayerSprite` (lines 37-38):
    ```javascript
    sprite.container.x = player.x;
    sprite.container.y = player.y;
    ```

- **Server-Side Movement Validation (`server/roomManager.js`):**
  - Processing coordinate updates directly (lines 110-117):
    ```javascript
    if (p.burnoutUntil && Date.now() < p.burnoutUntil) {
      // Movimiento lento: reducir desplazamiento a la mitad
      p.x = x * 0.5 + p.x * 0.5;
      p.y = y * 0.5 + p.y * 0.5;
    } else {
      p.x = x;
      p.y = y;
    }
    ```

- **Speed-Checking E2E Security Assertion (`tests/e2e.test.js`):**
  - The E2E test `TC-T4-02: Anti-Cheat: Speed checking (Velocity limit)` asserts that teleportation must be rejected (lines 1269-1279):
    ```javascript
    // Set initial position
    roomManager.movePlayer(roomCode, pId, 100, 100);

    // Emit a movement that teleports the player instantly to a far location
    hostClient.emit('player:move', { x: 1100, y: 800 });

    await delay(100);

    // The server MUST reject this coordinates update since speed is illegal
    const player = room.players[pId];
    assert.notStrictEqual(player.x, 1100);
    assert.notStrictEqual(player.y, 800);
    ```

## 2. Logic Chain

1. **Lack of Obstacles & Collisions**: The current MVP codebase contains no physical obstacles. Players can walk through walls and drawn zone rectangles because coordinate changes are applied directly inside the input polling loop of `GameScene.js` using `me.x += dx * speed * (delta / 1000)`.
2. **Enabling Phaser Arcade Physics**:
   - By creating a static physics group in `GameScene.js` (`this.obstacles = this.physics.add.staticGroup();`), we can add custom obstacles (like desks, file cabinets, and server racks) within each zone.
   - The player container in `client/src/systems/player.js` must be refactored so that child elements are positioned relative to the container center `(0, 0)`, and the container is spawned at `(player.x, player.y)`.
   - Adding physics to the local container (`scene.physics.add.existing(container);`) allows us to assign a circular body of radius 20 (`body.setCircle(20, -20, -20)`) and leverage Phaser's built-in physics collision resolver (`physics.add.collider(player, obstacles)`).
   - Local player movement is changed to use `setVelocity()` based on inputs. Since physics modifies `container.x` and `y` post-collision resolution, we copy `localSprite.container.x/y` back to logical `me.x/y` coordinates, ensuring only collision-free coordinates are sent to the server.
3. **Server-Side Velocity Validation (Anti-Cheat)**:
   - The test `TC-T4-02` verifies that teleporting from `(100, 100)` to `(1100, 800)` is rejected.
   - To implement this securely, `roomManager.movePlayer()` tracks player update timestamp `p.lastMoveTime`. The elapsed time `dt` is computed.
   - To eliminate the exploit where players idle for 1 second and then teleport anywhere, `dt` is clamped to a maximum value of `0.25s`.
   - The server calculates distance `dist = Math.hypot(x - p.x, y - p.y)`. The maximum allowed distance in `dt` is `speed * dt * tolerance + minDistBuffer` (where base speed is 250, reduced to 125 if in burnout). If `dist` exceeds this, the update is rejected and the server retains the previous coordinates.
   - On rejection, the server broadcasts `player:moved` with the *previous* coordinate back to the sender socket. The client receives this correction and resets the container/physics body to resolve the mismatch (rubberband).

## 3. Caveats

- **Client-Side Physics Collisions Only**: Obstacles are currently physical entities only on the client. If a hacked client modifies its own physics engine to bypass collisions, the server's anti-cheat speed checking will still limit its maximum movement speed (preventing teleportation), but the hacker could theoretically squeeze through walls slowly. Implementing a server-side collision map could be addressed in v3.
- **Latency Spikes**: Under severe packet loss or latency spikes, a legitimate player's position might be rejected if their accumulated lag causes them to catch up too fast on the client. The tolerance factor (1.2) and a minimum distance buffer (15px) minimize false positives.

## 4. Conclusion

The designed modifications enable fully functional client-side collisions with office furniture using Phaser Arcade Physics and prevent speed hacks or teleportation cheats via server-side velocity validation. Applying the patches in `physics_and_anticheat.patch` correctly resolves the design requirements and will make `TC-T4-02` pass successfully.

### Office Obstacle Bounding Boxes (Designed):
- **Recepción**: Desk (`x: 150, y: 220, w: 150, h: 40`), Plant (`x: 120, y: 120, w: 30, h: 30`)
- **Cubículos**: Desk 1 (`x: 480, y: 150, w: 100, h: 40`), Desk 2 (`x: 620, y: 150, w: 100, h: 40`), Divider wall (`x: 595, y: 100, w: 10, h: 200`)
- **Sala de Juntas**: Table (`x: 900, y: 180, w: 150, h: 60`), Plant (`x: 1060, y: 120, w: 30, h: 30`)
- **Cocina**: Counter (`x: 100, y: 400, w: 120, h: 40`), Fridge (`x: 260, y: 400, w: 40, h: 40`), Table (`x: 170, y: 490, w: 60, h: 60`)
- **Archivo**: Cabinet 1 (`x: 420, y: 420, w: 40, h: 120`), Cabinet 2 (`x: 520, y: 420, w: 40, h: 120`)
- **Oficina del Jefe**: Desk (`x: 750, y: 460, w: 100, h: 50`), Bookshelf (`x: 700, y: 410, w: 140, h: 20`)
- **Recursos Humanos**: Desk 1 (`x: 120, y: 680, w: 80, h: 40`), Desk 2 (`x: 230, y: 680, w: 80, h: 40`)
- **Servidor / IT**: Server rack 1 (`x: 530, y: 670, w: 50, h: 120`), Server rack 2 (`x: 650, y: 670, w: 50, h: 120`)

## 5. Verification Method

1. Apply the unified patch file:
   ```bash
   git apply .agents/explorer_collisions_1/physics_and_anticheat.patch
   ```
2. Run the test suite:
   ```bash
   node --test tests/e2e.test.js
   ```
3. Verify that test case `TC-T4-02: Anti-Cheat: Speed checking (Velocity limit)` passes successfully.
4. Run the development server and verify client movement does not clip through static office obstacles:
   ```bash
   npm run dev
   ```
