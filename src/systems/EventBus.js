export default class EventBus {
  constructor() {
    this._handlers = {};
  }

  on(trigger, listenerId, fn) {
    if (!this._handlers[trigger]) this._handlers[trigger] = [];
    this._handlers[trigger].push({ id: listenerId, fn });
  }

  off(listenerId) {
    for (const trigger of Object.keys(this._handlers)) {
      this._handlers[trigger] = this._handlers[trigger].filter(h => h.id !== listenerId);
    }
  }

  emit(trigger, payload = {}) {
    const list = this._handlers[trigger];
    if (!list) return;
    for (const { fn } of list) fn(payload);
  }

  clear() {
    this._handlers = {};
  }
}
