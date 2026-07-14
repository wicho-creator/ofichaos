# Original User Request

## Initial Request — 2026-07-13T20:01:28-06:00

# Teamwork Project Prompt — OfiChaos MVP Completion

OfiChaos is a multiplayer game (Phaser 3 + Node.js + Socket.IO) inspired by "Among Us", set in an office environment. The goal is to review the current project and turn it into a complete, polished, and fully playable MVP.

Working directory: `/Users/luisdeleon/AIWorkspace/games/ofichaos`
Integrity mode: development

## Requirements

### R1. Responsive UI and HUD in GameScene
- Resolve all issues with layout scaling, camera zoom, overlays, and responsiveness on lower viewports.
- Ensure the UI/HUD elements (chat, tasks lists, voting, actions buttons, cooldown indicators) adapt correctly to mobile/small screens without overlapping or clipping.

### R2. Wall and Furniture Collisions
- Add actual collisions between the player character sprites and the office furniture, walls, and obstacle boundaries on the game map.

### R3. Mini-games / Task Interactions
- Replace simple progress-bar tasks with interactive mini-games (e.g., matching colors/cables, solving simple sequences, or quick reaction tests) that fit the theme of the office tasks.
- Polish click/tap and interaction ranges so they feel robust and intuitive across devices.

### R4. Character Sprites & Polish
- Upgrade from basic circular placeholders to polished character sprites with animations (e.g., walking, interacting, sabotaging).
- Clean up the visual style of the office map and improve aesthetic quality.

### R5. Sabotage, Reports & Voting UX
- Polish the visual feedback and UX for sabotage events (e.g. flashing screens, red warning alerts).
- Improve the voting screen and chat UX to make meetings feel exciting and easy to read.

## Acceptance Criteria

### UI & Layout Responsiveness
- [ ] UI/HUD elements adapt dynamically on viewport size changes (resizing the browser doesn't break layout).
- [ ] No visual overlap or text clipping occurs on screens as small as 375x667 (standard mobile viewports).

### Physics & Collisions
- [ ] Players cannot walk through desk sprites, office chairs, server racks, office walls, or out of the room boundaries.

### Tasks and Minigames
- [ ] At least three unique interactive task mini-games are implemented instead of generic progress bars.
- [ ] Tasks can be completed using both mouse clicks/drags and touchscreen touches.

### Aesthetics & Polish
- [ ] Player sprites have walking/idle animation cycles.
- [ ] Sabotages display a prominent visual warning banner or screen-flash effect when active.
- [ ] All elements are aligned with a modern, high-quality dark/neon or office-themed aesthetic.
