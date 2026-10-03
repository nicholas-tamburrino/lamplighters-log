// Optional model narrator plus the guard that checks its output. The engine's text is always the fallback.
(function (g) {
  'use strict';
  const W = typeof module !== 'undefined' && module.exports ? require('./world') : g.LampWorld;

  const MAX_WORDS = 110;
  const DIRECTIONS = ['north', 'south', 'east', 'west', 'up', 'down'];
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentions = (text, word) => new RegExp('\\b' + esc(word) + '\\b', 'i').test(text);

  // Words that name things in the world, grouped by item id and by room.
  function worldNouns() {
    const out = [];
    for (const id in W.items) {
      // single, distinctive words only: 'box', 'book', 'man' are too common to police
      const words = W.items[id].words.filter((w) => !/\s/.test(w) && w.length >= 3 && !['book', 'door', 'lamp', 'lens', 'drum', 'keeper', 'pot', 'sheet', 'paper', 'can', 'box', 'man', 'match', 'log', 'bin', 'jug'].includes(w));
      out.push({ id, words });
    }
    return out;
  }

  // check(reply, result) -> { ok, reasons[] }
  // Rules: short, plain prose; no invented objects; keeps every visible object and exit from the engine text.
  function check(reply, result) {
    const reasons = [];
    const text = String(reply || '').trim();
    if (!text) return { ok: false, reasons: ['empty reply'] };
    if (text.split(/\s+/).length > MAX_WORDS) reasons.push('too long');
    if (/^\s*([-*•]|\d+[.)])\s/m.test(text) || /^\s*#/m.test(text)) reasons.push('list or heading');
    if (/\d/.test(text) && result.event !== 'win' && result.event !== 'lose') reasons.push('numbers (the engine tracks the clock)');

    const facts = result.facts;
    const allowed = new Set(facts.allowed.concat(facts.inventory));
    const engineText = result.text;
    for (const n of worldNouns()) {
      if (allowed.has(n.id)) continue;
      // an object the engine text itself names is allowed even if not currently present
      if (n.words.some((w) => mentions(engineText, w))) continue;
      const hit = n.words.find((w) => mentions(text, w));
      if (hit) reasons.push(`invented or out-of-place object: "${hit}"`);
    }
    if (result.event === 'room') {
      for (const id of facts.visible) {
        const words = W.items[id].words;
        if (!words.some((w) => mentions(text, w))) reasons.push(`dropped object: ${W.items[id].name}`);
      }
      for (const d of facts.exits) {
        const short = { north: 'n', south: 's', east: 'e', west: 'w', up: 'up', down: 'down' }[d];
        if (!mentions(text, d) && !(d === 'up' && /\bclimb|stair|ladder/i.test(text)) && !(d === 'down' && /\bdescend|ladder|trapdoor/i.test(text)) && short) reasons.push(`dropped exit: ${d}`);
      }
    }
    const wrongDirs = DIRECTIONS.filter((d) => mentions(text, d) && !facts.exits.includes(d) && !mentions(engineText, d));
    if (result.event === 'room' && wrongDirs.length) reasons.push('invented exit: ' + wrongDirs.join(', '));
    return { ok: reasons.length === 0, reasons };
  }

  function buildMessages(result) {
    const system = 'You narrate a short text adventure set in a lighthouse. Rewrite the GAME TEXT as 2 to 4 vivid, plain sentences. Keep every fact. Mention every object and exit in GAME TEXT. Do not add objects, people, exits, numbers or events that are not in GAME TEXT. No lists, no headings.';
    const user = 'GAME TEXT:\n' + result.text;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  // Adapters: async (messages) -> string. Keys are never stored.
  const adapters = {
    ollama: ({ model, host }) => async (messages) => {
      const base = (host || 'http://localhost:11434').replace(/\/$/, '');
      const r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, stream: false, options: { temperature: 0.7 } }) });
      if (!r.ok) throw new Error('Ollama HTTP ' + r.status);
      return (await r.json()).message.content.trim();
    },
    openai: ({ model, baseUrl, apiKey }) => async (messages) => {
      const base = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
      const r = await fetch(base + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey }, body: JSON.stringify({ model, messages, temperature: 0.7 }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return (await r.json()).choices[0].message.content.trim();
    },
  };

  // narrate(result, ask) -> { text, source: 'scripted'|'model', rejected?: string[] }
  async function narrate(result, ask) {
    // Endings and system messages stay as written; only room/warning text is eligible.
    if (!ask || !['room', 'warning', 'rescue'].includes(result.event)) return { text: result.text, source: 'scripted' };
    try {
      const reply = await ask(buildMessages(result));
      const verdict = check(reply, result);
      if (verdict.ok) return { text: reply, source: 'model' };
      return { text: result.text, source: 'scripted', rejected: verdict.reasons };
    } catch (e) {
      return { text: result.text, source: 'scripted', rejected: ['model unavailable: ' + e.message] };
    }
  }

  const api = { check, buildMessages, narrate, adapters, MAX_WORDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.LampNarrator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
