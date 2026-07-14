## 2026-07-14T07:12:03Z
You are teamwork_preview_worker. Your working directory is `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/worker_final_remediation/`.
Your task is to fix the server validation bugs, the race condition in `TC-T1-05`, and the role verification failures in `TC-T1-11`, `TC-T1-12`, `TC-T1-13`, `TC-T2-05`, `TC-T2-08`.

Follow these instructions:
1. Create your `BRIEFING.md` and `progress.md` in `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/worker_final_remediation/`.
2. Edit `server/roomManager.js` to:
   - In `movePlayer(code, playerId, x, y)`: Add validation to ensure `x` and `y` are finite numbers. If not, return the player `p` without changing their coordinates.
     ```javascript
     if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
       return p;
     }
     ```
   - In `completeTask(code, playerId, taskId)`: Add a check to verify that `room.gameState.phase === 'playing'`. If not, return `{ error: 'Acción no permitida en esta fase' }`.
3. Edit `server/gameState.js` to:
   - In `castVote(room, voterId, targetId)`: Add validation to verify that `targetId` is either `'skip'` or a valid player ID present in `room.players`. If not, return `false`.
     ```javascript
     if (targetId !== 'skip' && (!room.players || !room.players[targetId])) {
       return false;
     }
     ```
4. Edit `tests/e2e.test.js` to:
   - Define the helper function `forcePlayerAsEmployee(room, playerId)` right after `positionPlayerAtTask(room, playerId, taskId)`:
     ```javascript
     function forcePlayerAsEmployee(room, playerId) {
       if (room.players && room.players[playerId]) {
         room.players[playerId].role = 'empleado';
         if (room.gameState && room.gameState.roleAssignments[playerId]) {
           room.gameState.roleAssignments[playerId].role = 'empleado';
         }
       }
     }
     ```
   - In `TC-T1-05: Host migration` (around line 323), replace the client1 closing and updatePromise wait block (lines 338-344) with a robust waiting block:
     ```javascript
       // P1 leaves - wait robustly for host migration to complete
       await new Promise((resolve) => {
         client2.on('room:update', function listener(data) {
           if (data.hostId === client2.id) {
             client2.off('room:update', listener);
             resolve();
           }
         });
         client1.close();
       });

       assert.strictEqual(room.hostId, client2.id);
       client2.close();
     ```
   - In `TC-T1-11: Task completion state` (around line 440), call `forcePlayerAsEmployee(room, clients[0].id);` right after `positionPlayerAtTask(room, clients[0].id, 'cafe');`.
   - In `TC-T1-12: Tasks percent calculation` (around line 460), call `forcePlayerAsEmployee(room, clients[0].id);` right after the first `positionPlayerAtTask(room, clients[0].id, 'cafe');`.
   - In `TC-T1-13: Task morale gain` (around line 483), call `forcePlayerAsEmployee(room, clients[0].id);` right after `positionPlayerAtTask(room, clients[0].id, 'cafe');`.
   - In `TC-T2-05: Employee victory trigger` (around line 791), call `forcePlayerAsEmployee(room, clients[0].id);` right before the loop that completes the tasks (line 799).
   - In `TC-T2-08: Reject double complete` (around line 839), call `forcePlayerAsEmployee(room, clients[0].id);` right after `positionPlayerAtTask(room, clients[0].id, 'cafe');`.
5. Run the test suite: `node --test tests/e2e.test.js`. Verify that all 64 test cases pass cleanly without any failures!
6. Write a detailed handoff report in `/Users/luisdeleon/AIWorkspace/games/ofichaos/.agents/worker_final_remediation/handoff.md`.
7. Once finished, send a message to parent (Recipient: 99d08cd1-a041-46b6-9a4e-49b13be744c5) stating that your handoff is ready.
