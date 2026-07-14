## 2026-07-13T20:29:48-06:00

You are teamwork_preview_explorer. Your working directory is `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/explorer_tasks_1/`.
Your task is to design three interactive task mini-games and server-side task distance verification.

Follow these instructions:
1. Create your `BRIEFING.md` and `progress.md` in `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/explorer_tasks_1/`.
2. Inspect the task type definitions in `client/src/systems/tasks.js` and task execution in `client/src/scenes/GameScene.js` (`openTaskPanel()`).
3. Design three interactive mini-games within the Phaser scene layout:
   - **Reaction Test (e.g. for id: 'cafe')**: A moving slider goes back and forth on a bar. The player must click a button when the slider lands inside a narrow success zone (colored green in the center). Correct click completes task, wrong click resets.
   - **Ordenar Archivos (e.g. for id: 'archivos')**: Display 4 numbers or files in a disorganized layout. The player must click them in ascending order (1 -> 2 -> 3 -> 4) to file them. Correct order completes task, wrong click resets.
   - **Arreglar WiFi / Cables (e.g. for id: 'wifi' or 'correos')**: Draw 4 colored nodes on the left (Red, Yellow, Green, Blue) and 4 on the right in scrambled order. The player must click and drag lines from left to right matching the colors. Matches remain drawn; completing all 4 matches completes the task.
4. All interactions must use standard Phaser pointer events (`pointerdown`, `pointermove`, `pointerup`) to support both mouse drags/clicks and touchscreen drag/taps natively.
5. Inspect `server/roomManager.js:completeTask()`. Design server-side distance verification:
   - Check distance between the player logical position `(p.x, p.y)` and the center of the task's zone.
   - The threshold should match the client's `getTaskInteractionDistance()` (approx 170px for narrow viewports, 135px for standard, or use a slightly larger server tolerance like 180px to accommodate latency/rounding).
   - If distance exceeds the threshold, reject the completion, return `error: "Demasiado lejos de la tarea"`, and do not mark it complete.
6. Document your findings, layout designs, and proposed code changes in a handoff report at `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/explorer_tasks_1/handoff.md`.
7. Once finished, send a message to parent (Recipient: 99d08cd1-a041-46b6-9a4e-49b13be744c5) stating that your handoff is ready.
