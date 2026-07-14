# Handoff Report & Adversarial Review

## 1. Observation

During static and dynamic analysis of the OfiChaos codebase, the following lines of code and test outputs were observed:

- **Invalid Coordinates in Movement:**
  In `server/roomManager.js` line 117-118:
  ```javascript
  const clampedX = Math.max(20, Math.min(1180, x));
  const clampedY = Math.max(20, Math.min(880, y));
  ```
  If `x` or `y` is a string (e.g. `"hello"`), `Math.min(1180, "hello")` returns `NaN`. `Math.max(20, NaN)` also returns `NaN`. The coordinates are then updated on the player object without further sanitization.
  Running `node --test tests/e2e.test.js` failed on test `TC-T5-01` with:
  ```
  not ok 54 - TC-T5-01: Invalid coordinates (NaN, strings, objects) in player:move
    ---
    duration_ms: 209.885625
    type: 'test'
    location: '/Users/luisdeleon/AIWorkspace/games/ofichaos/tests/e2e.test.js:1366:1'
    failureType: 'testCodeFailure'
    error: 'Player coordinates must remain finite after string input'
    code: 'ERR_ASSERTION'
    name: 'AssertionError'
    expected: true
    actual: false
  ```

- **Completing Tasks Outside of Playing Phase:**
  In `server/roomManager.js` line 152-154:
  ```javascript
  function completeTask(code, playerId, taskId) {
    const room = rooms[code];
    if (!room || !room.gameState) return { error: 'No hay partida activa' };
  ```
  The function checks the existence of `room.gameState` but does not assert that `room.gameState.phase === 'playing'`. This permits completing tasks during meetings, voting, and after the game ends.
  Running the test suite failed on `TC-T5-02` with:
  ```
  not ok 55 - TC-T5-02: Complete task with invalid state or non-existent taskId
    ---
    duration_ms: 108.505042
    type: 'test'
    location: '/Users/luisdeleon/AIWorkspace/games/ofichaos/tests/e2e.test.js:1394:1'
    failureType: 'testCodeFailure'
    error: |-
      Should not complete a task during meeting phase
      
      true !== false
  ```

- **Voting for Arbitrary Non-Existent Player IDs:**
  In `server/gameState.js` line 271-276:
  ```javascript
  function castVote(room, voterId, targetId) {
    const gs = room.gameState;
    if (gs.phase !== 'voting') return false;
    gs.votes[voterId] = targetId;
    return true;
  }
  ```
  No validation exists to ensure `targetId` corresponds to an active player in `room.players` or the special value `'skip'`.
  Running the test suite failed on `TC-T5-04` with:
  ```
  not ok 57 - TC-T5-04: Invalid voting targets and votes outside voting phase
    ---
    duration_ms: 112.255833
    type: 'test'
    location: '/Users/luisdeleon/AIWorkspace/games/ofichaos/tests/e2e.test.js:1450:1'
    failureType: 'testCodeFailure'
    error: 'Vote target must be a valid player in the room'
    code: 'ERR_ASSERTION'
    name: 'AssertionError'
    expected: 'fake_player_id'
    actual: 'fake_player_id'
  ```

- **Unauthorized Sabotages & Disconnections:**
  - `TC-T5-03: Unauthorized sabotage attempts` passed because `server/index.js` restricts trigger commands to specific roles:
    - Morale/Door sabotage: `if (!p || p.role !== 'jefe') return;`
    - Fake task/False report: `if (!p || p.role !== 'lamebotas') return;`
  - `TC-T5-05: Disconnections during active meeting and voting phases` passed, confirming that the server cleans up room players, adjusts hosts, and handles transitions between phases gracefully even with player loss.

---

## 2. Logic Chain

1. **Coordinate Corruption:** Since `Math.max` and `Math.min` do not reject non-numeric inputs (e.g. `NaN`, strings, nested objects) and instead return `NaN`, players can infect their position with `NaN`. Any subsequent operations relying on `Math.hypot` or velocity comparisons will yield `NaN` or bypass anti-cheat speed checks entirely.
2. **Phase Injection in Tasks:** Lacking a phase check in `completeTask` allows clients to continue submitting task completions during meetings/voting. This undermines the core social deduction flow where players should be frozen.
3. **Ghost Voting:** Allowing votes for non-existent IDs means players can dilute vote tallies or manipulate meeting outcomes by throwing votes into untrackable target strings.
4. **Conclusion Support:** These observations logically lead to the conclusion that while authorization filters and disconnections are well-handled, input validations on positions, tasks, and votes are lacking.

---

## 3. Caveats

- We assumed that Socket.io serialization filters out standard `NaN` to `null`, but we verified that passing arbitrary string/object structures bypasses this conversion and forces `NaN` outcomes on the server.
- We did not evaluate the client-side game engine UI rendering impact if a player's coordinates are set to `NaN` (though standard Phaser physics or display systems will likely fail to render or crash).

---

## 4. Conclusion

The OfiChaos server exhibits three major input validation and logical gaps:
1. **Invalid Coordinates Propagation:** Missing `Number.isFinite()` or numeric type checks allow position corruption.
2. **Task Phase Bypass:** Completing tasks is not bounded by the playing phase.
3. **Invalid Voting Target:** Votes can target any arbitrary string, bypassing player existence checks.

*Actionable fix:* Introduce helper validator functions in `server/roomManager.js` and `server/gameState.js` to assert type sanity and check current room phase limits before modifying state.

---

## 5. Verification Method

To verify these findings, run:
```bash
node --test tests/e2e.test.js
```
The newly added Tier 5 tests (TC-T5-01, TC-T5-02, TC-T5-04) will fail due to the noted gaps, while TC-T5-03 and TC-T5-05 will pass.

---

# Adversarial Review & Challenge Report

**Overall risk assessment**: MEDIUM

## Challenges

### [Medium] Challenge 1: Coordinates Sanitation
- **Assumption challenged:** That coordinates sent by client are always numbers or safely clamped.
- **Attack scenario:** Client sends `"hello"` or a custom object.
- **Blast radius:** Server position state becomes `NaN`. Anti-cheat check is bypassed.
- **Mitigation:** Validate `typeof x === 'number' && Number.isFinite(x)`.

### [High] Challenge 2: Task Phase Locking
- **Assumption challenged:** That task completions only occur during live play.
- **Attack scenario:** Player completes tasks via websocket frames while meeting is active.
- **Blast radius:** Morale gains/objective completions can be triggered while players are supposed to be discussing, bypassing social interactions.
- **Mitigation:** In `completeTask`, add `if (room.gameState.phase !== 'playing') return { error: 'Acción no permitida en esta fase' };`.

### [Medium] Challenge 3: Vote Target Verification
- **Assumption challenged:** That cast votes always target active players.
- **Attack scenario:** Player submits vote for `"nonexistent_id"`.
- **Blast radius:** Vote counts are thrown away or logic logs undefined players.
- **Mitigation:** In `castVote`, verify `targetId === 'skip' || room.players[targetId] !== undefined`.

## Stress Test Results

- `TC-T5-01` (Invalid coords) → Server keeps coordinates finite → Actual: Coordinates become `NaN` → **FAIL**
- `TC-T5-02` (Complete task in meeting) → Server blocks task completion → Actual: Task completes successfully → **FAIL**
- `TC-T5-03` (Unauthorized sabotage) → Server ignores unauthorized roles → Actual: Sabotages ignored → **PASS**
- `TC-T5-04` (Vote invalid target) → Server rejects vote target → Actual: Vote confirmed and registered → **FAIL**
- `TC-T5-05` (Meeting disconnects) → Server finishes voting/meeting gracefully → Actual: Finished gracefully → **PASS**

## Unchallenged Areas

- **Voice/Chat moderation** — Chat payload is truncated to 200 characters but content/profanity is not filtered. Out of scope for this review.
