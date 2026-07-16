// networking.js — Wrapper de Socket.IO para el cliente

export const socket = io();

export function subscribe(event, handler) {
  socket.on(event, handler);
  return () => socket.off(event, handler);
}

export function disposeAll(disposers) {
  for (const dispose of disposers.splice(0)) dispose();
}

export function createRoom(name) {
  socket.emit('room:create', { name });
}

export function joinRoom(code, name) {
  socket.emit('room:join', { code, name });
}

export function startGame() {
  socket.emit('game:start');
}

export function sendMove(x, y) {
  socket.emit('player:move', { x, y });
}

export function completeTask(taskId) {
  socket.emit('task:complete', { taskId });
}

export function callMeeting() {
  socket.emit('meeting:call');
}

export function sendChat(message) {
  socket.emit('meeting:chat', { message });
}

export function castVote(targetId) {
  socket.emit('vote:cast', { targetId });
}

export function sabotageZone(zoneId) {
  socket.emit('sabotage:zone', { zoneId });
}

export function sabotageExtraTask(targetId) {
  socket.emit('sabotage:extra_task', { targetId });
}

export function sabotageMorale(targetId) {
  socket.emit('sabotage:morale', { targetId });
}

export function sabotageCloseDoor(zoneId) {
  socket.emit('sabotage:close_door', { zoneId });
}


export function sabotageFakeTask() {
  socket.emit('sabotage:fake_task');
}

export function sabotageFalseReport() {
  socket.emit('sabotage:false_report');
}

export function sabotageBlockTask(taskId) {
  socket.emit('sabotage:block_task', { taskId });
}


export function reportSabotage() {
  socket.emit('sabotage:report');
}
