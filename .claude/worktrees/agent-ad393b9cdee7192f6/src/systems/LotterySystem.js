const RARITY_TICKETS = {
  common:    4,
  uncommon:  3,
  rare:      2,
  possessed: 1,
  unholy:    0,
  boss:      0,
};

export default class LotterySystem {
  /**
   * @param {Array}    items    - candidates, each must have { id, rarity, synergies: [] }
   * @param {string[]} ownedIds - flat list of all IDs the player currently owns
   *                             (die types, material ids, rune ids, relic ids)
   */
  constructor(items, ownedIds) {
    this._owned = new Set(ownedIds);
    this._pool  = items
      .map(item => ({ item, tickets: this._calcTickets(item) }))
      .filter(e => e.tickets > 0);
  }

  _calcTickets(item) {
    const base     = RARITY_TICKETS[item.rarity ?? 'common'] ?? 0;
    const synBonus = (item.synergies ?? []).filter(id => this._owned.has(id)).length;
    return base + synBonus;
  }

  /**
   * Draw `count` unique items.
   * After each draw, all remaining tickets for that item are removed.
   */
  draw(count = 1) {
    const pool    = this._pool.map(e => ({ ...e }));
    const results = [];

    for (let i = 0; i < count && pool.length > 0; i++) {
      const total = pool.reduce((s, e) => s + e.tickets, 0);
      if (total <= 0) break;

      let r   = Math.random() * total;
      let idx = 0;
      while (idx < pool.length - 1) {
        if (r < pool[idx].tickets) break;
        r -= pool[idx].tickets;
        idx++;
      }
      results.push(pool.splice(idx, 1)[0].item);
    }

    return results;
  }
}
