const { io } = require('socket.io-client');
const URL = process.env.URL || 'http://127.0.0.1:3458';
const clients = [];
const once = (s, e, t = 12000) => new Promise((res, rej) => { const id = setTimeout(() => rej(new Error('timeout ' + e)), t); s.once(e, d => { clearTimeout(id); res(d); }); });
async function main() {
  for (let i = 0; i < 5; i++) { const s = io(URL, { transports: ['websocket'], forceNew: true }); clients.push(s); await once(s, 'connect', 20000); }
  clients[0].emit('room:create', { name: 'P0' });
  const created = await once(clients[0], 'room:created');
  for (let i = 1; i < 5; i++) { clients[i].emit('room:join', { code: created.code, name: `P${i}` }); await once(clients[i], 'room:joined'); }
  const rolesP = clients.map(s => once(s, 'game:role'));
  const startedP = clients.map(s => once(s, 'game:started'));
  clients[0].emit('game:start');
  const roles = await Promise.all(rolesP); await Promise.all(startedP);
  const lameIndex = roles.findIndex(r => r.role === 'lamebotas');
  const empIndex = roles.findIndex(r => r.role === 'empleado');
  if (lameIndex < 0 || empIndex < 0) throw new Error('missing expected roles');
  const lame = clients[lameIndex]; const emp = clients[empIndex];
  let upd = once(lame, 'game:update'); lame.emit('sabotage:false_report'); let state = await upd;
  const lameState = state.players.find(p => p.id === roles[lameIndex].playerId);
  if (!lameState.cooldowns || !lameState.cooldowns.false_report) throw new Error('false_report cooldown missing');
  const errP = once(lame, 'error:message'); lame.emit('sabotage:false_report'); const err = await errP;
  if (!/cooldown/i.test(err.message)) throw new Error('cooldown error not returned');
  const reportP = once(emp, 'sabotage:reported'); const meetingP = once(emp, 'meeting:started'); emp.emit('sabotage:report'); const report = await reportP; await meetingP;
  if (report.sabotageType !== 'false_report') throw new Error('report sabotage did not report false_report');
  console.log(JSON.stringify({ ok: true, code: created.code, roles: roles.map(r => r.role), cooldownRejected: err.message, report }, null, 2));
}
main().finally(() => clients.forEach(s => s.close())).catch(e => { console.error(e); process.exit(1); });
