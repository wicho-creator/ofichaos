## 2026-07-14T02:26:23Z

You are teamwork_preview_explorer. Your working directory is `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/explorer_collisions_1/`.
Your task is to explore and design the collision mechanics and anti-cheat speed checks for OfiChaos.

Follow these instructions:
1. Create your `BRIEFING.md` and `progress.md` in `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/explorer_collisions_1/`.
2. Inspect the office map drawing in `client/src/scenes/GameScene.js` (`drawMap()`). Determine the bounding boxes for:
   - Map boundaries (1200x900 outer limits, and margins).
   - Furniture and obstacles for each zone (recepcion, cubiculos, juntas, cocina, archivo, jefe_oficina, rh, servidor).
3. Design a plan to add these obstacles as static bodies using Phaser Arcade Physics.
4. Refactor the movement logic of the local player in `GameScene.js` (`update()` and player creation in `syncPlayers()`) to use Phaser Arcade Physics body velocity instead of direct coordinate changes, ensuring physics collisions with obstacles are automatically resolved by Phaser.
5. Inspect `server/roomManager.js:movePlayer()`. Design the server-side validation checks for speed limit / velocity to detect and reject teleportation or impossible speed delta hacks (Anti-Cheat). Specifically, compare the distance between the player's previous `(x, y)` and new `(x, y)` relative to the time delta since the last update (or tick), considering burnout status (which halves speed).
6. Document your findings, designs, and code patch in a handoff report at `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/explorer_collisions_1/handoff.md`.
7. Once finished, send a message to parent (Recipient: 99d08cd1-a041-46b6-9a4e-49b13be744c5) stating that your handoff is ready.
