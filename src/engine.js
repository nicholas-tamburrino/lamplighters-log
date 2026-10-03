// Game engine: parser, state and rules. No DOM, no network. The engine owns the truth.
(function (g) {
  'use strict';
  const W = typeof module !== 'undefined' && module.exports ? require('./world') : g.LampWorld;

  const DIR_NAMES = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down' };
  const DIR_ALIASES = { north: 'n', south: 's', east: 'e', west: 'w', up: 'u', down: 'd', n: 'n', s: 's', e: 'e', w: 'w', u: 'u', d: 'd' };
  const VERBS = {
    go: 'go', walk: 'go', run: 'go', climb: 'go', enter: 'go',
    look: 'look', l: 'look', examine: 'examine', x: 'examine', inspect: 'examine', check: 'examine', search: 'examine',
    take: 'take', get: 'take', grab: 'take', drop: 'drop', i: 'inventory', inv: 'inventory', inventory: 'inventory',
    use: 'use', light: 'light', ignite: 'light', strike: 'light', unlock: 'unlock', open: 'unlock',
    fill: 'fill', refuel: 'fill', trim: 'trim', cut: 'trim', read: 'read', pull: 'pull', move: 'pull', push: 'pull',
    free: 'free', untie: 'free', rescue: 'free', help: 'help', hint: 'hint', wait: 'wait', talk: 'talk', speak: 'talk', ask: 'talk',
  };
  const STOP = new Set(['the', 'a', 'an', 'to', 'my', 'at', 'up', 'of', 'some', 'out']);
  const PREPS = new Set(['on', 'with', 'in', 'from', 'into', 'using']);

  function newGame() {
    const loc = {};
    for (const id in W.items) loc[id] = W.items[id].at || null;
    return { room: W.start, turn: 0, hints: 0, loc, flags: {}, status: 'playing', ending: null };
  }

  const held = (s, id) => s.loc[id] === 'inv';
  const near = (s, id) => s.loc[id] === s.room || held(s, id);
  const isDark = (s) => !!W.rooms[s.room].dark && !(held(s, 'lantern') && s.flags.lanternLit);
  const nameOf = (id) => W.items[id].name;

  // ---- parser ----
  function parse(input) {
    let text = String(input || '').toLowerCase().replace(/[^a-z0-9' ]/g, ' ');
    text = text.replace(/\bpick up\b/g, 'take').replace(/\blook (at|in|inside|under)\b/g, 'examine').replace(/\bturn on\b/g, 'light')
      .replace(/\bgo (to|into|up|down|north|south|east|west)\b/g, 'go $1').replace(/\bswing\b/g, 'pull');
    const tokens = text.split(/\s+/).filter(Boolean);
    if (!tokens.length) return { verb: null, raw: '' };
    if (DIR_ALIASES[tokens[0]] && tokens.length === 1) return { verb: 'go', dir: DIR_ALIASES[tokens[0]], raw: text };
    const verb = VERBS[tokens[0]];
    if (!verb) return { verb: null, unknown: tokens[0], raw: text };
    const rest = tokens.slice(1);
    if (verb === 'go') {
      const d = rest.map((t) => DIR_ALIASES[t]).find(Boolean);
      return { verb, dir: d || null, noun: rest.filter((t) => !STOP.has(t)).join(' '), raw: text };
    }
    let first = [];
    let second = [];
    let seenPrep = false;
    for (const t of rest) {
      if (PREPS.has(t)) { seenPrep = true; continue; }
      if (STOP.has(t)) continue;
      (seenPrep ? second : first).push(t);
    }
    return { verb, noun: first.join(' '), ind: second.join(' '), raw: text };
  }

  // find an item id by what the player typed; scope = ids to search
  function resolve(phrase, ids) {
    if (!phrase) return null;
    const words = phrase.split(' ');
    for (const id of ids) {
      for (const w of W.items[id].words) if (phrase === w || phrase.includes(w)) return id;
    }
    for (const id of ids) {
      for (const w of W.items[id].words) if (words.includes(w)) return id;
    }
    return null;
  }
  const allIds = Object.keys(W.items);
  const presentIds = (s) => (isDark(s) ? allIds.filter((id) => held(s, id)) : allIds.filter((id) => near(s, id)));

  // ---- view helpers ----
  function exitsOf(s) {
    const r = W.rooms[s.room];
    return Object.keys(r.exits);
  }
  function describe(s) {
    const r = W.rooms[s.room];
    if (isDark(s)) return 'It is pitch black. You can hear water dripping somewhere close, and nothing else. Up the ladder, perhaps, there is light.';
    let t = r.name + '\n' + r.desc;
    const x = r.extra ? r.extra(s) : '';
    if (x) t += ' ' + x;
    const listed = allIds.filter((id) => s.loc[id] === s.room && W.items[id].listed !== false);
    if (listed.length) t += '\nYou can see: ' + listed.map(nameOf).join(', ') + '.';
    t += '\nExits: ' + exitsOf(s).map((d) => DIR_NAMES[d]).join(', ') + '.';
    return t;
  }

  function hint(s) {
    const f = s.flags;
    if (!held(s, 'lantern') && !f.lanternLit) return 'The cellar will be dark. A ship\'s lantern hangs near the landing, and the kitchen should have matches.';
    if (!held(s, 'matches') && !f.lanternLit) return 'You need matches to light anything. Try the kitchen, west of the path.';
    if (!f.lanternLit) return 'Light the lantern with the matches. Then the cellar becomes usable.';
    if (!f.keyFound) return 'Something in the kitchen holds the key to the tower door. Look at the things on the table.';
    if (!f.shelfPulled) return 'There is a cellar under the kitchen. The shelf there looks like it has moved before.';
    if (!f.rescued) return 'Someone is behind the shelf. Free him.';
    if (!f.doorUnlocked) return 'The tower door is north of the cliff path, and you have the key.';
    if (!held(s, 'can') && !f.lampFilled) return 'An oil can sits at the foot of the tower. The oil is in the cellar.';
    if (!f.canFull && !f.lampFilled) return 'Fill the oil can from the drum in the cellar, with the lantern lit.';
    if (!f.lampFilled) return 'Take the full oil can up to the lamp room and fill the lamp.';
    if (!f.lampTrimmed) return 'The wick needs trimming. The study has scissors.';
    return 'The lamp is ready. Strike a light.';
  }

  // ---- command handlers: each returns { text, cost, event? } ----
  function doGo(s, c) {
    if (!c.dir) return { text: 'Go where? (north, south, east, west, up, down)', cost: 0 };
    const r = W.rooms[s.room];
    const dest = r.exits[c.dir];
    if (!dest) return { text: "You can't go that way.", cost: 0 };
    if (r.locked && r.locked[c.dir] && !s.flags[r.locked[c.dir]]) return { text: 'The tower door is locked.', cost: 0 };
    s.room = dest;
    return { text: describe(s), cost: 1, event: 'room' };
  }
  function doTake(s, c) {
    if (!c.noun) return { text: 'Take what?', cost: 0 };
    const id = resolve(c.noun, presentIds(s));
    if (!id) return { text: allIds.some((i) => resolve(c.noun, [i])) ? "You don't see that here." : "You can't see anything like that.", cost: 0 };
    if (held(s, id)) return { text: 'You already have it.', cost: 0 };
    if (!W.items[id].takeable) return { text: "You can't take that.", cost: 0 };
    s.loc[id] = 'inv';
    return { text: `Taken: ${nameOf(id)}.`, cost: 1 };
  }
  function doDrop(s, c) {
    const id = resolve(c.noun, allIds.filter((i) => held(s, i)));
    if (!id) return { text: "You aren't carrying that.", cost: 0 };
    s.loc[id] = s.room;
    return { text: `Dropped: ${nameOf(id)}.`, cost: 1 };
  }
  function doExamine(s, c) {
    if (!c.noun || c.noun === 'room' || c.noun === 'around') return { text: describe(s), cost: 0, event: 'room' };
    const id = resolve(c.noun, presentIds(s));
    if (!id) return { text: isDark(s) ? "It's too dark to see." : "You don't see that here.", cost: 0 };
    return { text: W.items[id].desc(s), cost: 0 };
  }
  function doRead(s, c) {
    const id = resolve(c.noun, presentIds(s));
    if (!id) return { text: 'Read what?', cost: 0 };
    if (!W.items[id].read) return { text: "There's nothing to read on that.", cost: 0 };
    return { text: W.items[id].read(s), cost: 0 };
  }
  function doPull(s, c) {
    const id = resolve(c.noun, presentIds(s));
    if (id !== 'shelf') return { text: "Nothing budges.", cost: 0 };
    if (s.flags.shelfPulled) return { text: 'The shelf is already swung aside.', cost: 0 };
    s.flags.shelfPulled = true;
    s.loc.ansel = 'cellar';
    return { text: 'The shelf swings aside on a hidden hinge. Behind it, in a narrow alcove, a man is lying bound on the floor.', cost: 1 };
  }
  function doFree(s, c) {
    const id = resolve(c.noun || 'ansel', presentIds(s));
    if (id !== 'ansel') return { text: 'There is no one here to free.', cost: 0 };
    if (s.flags.rescued) return { text: 'Ansel is already free.', cost: 0 };
    s.flags.rescued = true;
    return { text: W.texts.anselFreed, cost: 1, event: 'rescue' };
  }
  function doTalk(s, c) {
    if (resolve(c.noun || 'ansel', presentIds(s)) !== 'ansel') return { text: 'There is no one here to talk to.', cost: 0 };
    return { text: s.flags.rescued ? W.texts.anselTalk : 'He tries to speak around the gag. Free him first.', cost: 0 };
  }
  function doUnlock(s, c) {
    const id = resolve(c.noun, presentIds(s));
    if (id === 'trapdoor') return { text: 'The trapdoor is already open.', cost: 0 };
    if (id !== 'door') return { text: "There's nothing here that opens that way.", cost: 0 };
    if (s.flags.doorUnlocked) return { text: 'The door is already unlocked.', cost: 0 };
    if (!held(s, 'key')) return { text: 'The door is locked, and you have nothing to open it with.', cost: 0 };
    s.flags.doorUnlocked = true;
    return { text: 'The key turns with a groan of old iron. The tower door is open.', cost: 1 };
  }
  function lightLamp(s) {
    if (s.room !== 'lamp_room') return { text: "There's no great lamp here.", cost: 0 };
    if (!held(s, 'matches')) return { text: 'You have nothing to light it with.', cost: 0 };
    if (!s.flags.lampFilled) return { text: 'The reservoir is dry. It needs oil first.', cost: 0 };
    if (!s.flags.lampTrimmed) return { text: 'The wick is too ragged and sooty. It would only smoke. Trim it first.', cost: 0 };
    s.status = 'won';
    s.ending = s.flags.rescued ? 'both' : 'light';
    return { text: s.flags.rescued ? W.texts.winBoth : W.texts.winLightOnly, cost: 0, event: 'win' };
  }
  function doLight(s, c) {
    const id = resolve(c.noun, presentIds(s));
    if (id === 'lamp') return lightLamp(s);
    if (id === 'lantern' || id === 'matches' || !c.noun) {
      if (!held(s, 'lantern')) return { text: 'You need to be holding the lantern.', cost: 0 };
      if (!held(s, 'matches')) return { text: 'You have nothing to light it with.', cost: 0 };
      if (s.flags.lanternLit) return { text: 'The lantern is already lit.', cost: 0 };
      s.flags.lanternLit = true;
      return { text: 'You strike a match and touch it to the wick. The lantern catches and holds, a small steady flame.', cost: 1 };
    }
    return { text: "That won't burn.", cost: 0 };
  }
  function doFill(s, c) {
    const id = resolve(c.noun, presentIds(s));
    if (id === 'lamp') {
      if (s.room !== 'lamp_room') return { text: 'There is no lamp to fill here.', cost: 0 };
      if (s.flags.lampFilled) return { text: 'The reservoir is already full.', cost: 0 };
      if (!held(s, 'can')) return { text: 'You have nothing to carry oil in.', cost: 0 };
      if (!s.flags.canFull) return { text: 'The oil can is empty.', cost: 0 };
      s.flags.lampFilled = true; s.flags.canFull = false;
      return { text: 'You pour the oil into the reservoir until it laps the rim. The can is empty again.', cost: 1 };
    }
    if (id === 'can' || id === 'drum') {
      if (!held(s, 'can')) return { text: 'You need to be holding the oil can.', cost: 0 };
      if (s.room !== 'cellar') return { text: 'There is no oil here to fill it from.', cost: 0 };
      if (s.flags.canFull) return { text: 'The can is already full.', cost: 0 };
      s.flags.canFull = true;
      return { text: 'You open the tap and fill the can with clean oil. Whatever Pell claimed, it is fine.', cost: 1 };
    }
    return { text: 'Fill what?', cost: 0 };
  }
  function doTrim(s, c) {
    if (resolve(c.noun, presentIds(s)) !== 'lamp') return { text: 'Trim what?', cost: 0 };
    if (s.flags.lampTrimmed) return { text: 'The wick is already trimmed.', cost: 0 };
    if (!held(s, 'scissors')) return { text: 'You need something to cut with.', cost: 0 };
    s.flags.lampTrimmed = true;
    return { text: 'You snip the charred end off the wick until it burns white at the edge.', cost: 1 };
  }
  function doUse(s, c) {
    const a = resolve(c.noun, presentIds(s));
    const b = resolve(c.ind, presentIds(s));
    if (!a) return { text: 'Use what?', cost: 0 };
    if (a === 'key') return doUnlock(s, { noun: 'door' });
    if (a === 'matches') return doLight(s, { noun: b === 'lamp' ? 'lamp' : 'lantern' });
    if (a === 'scissors') return b === 'ansel' ? doFree(s, {}) : doTrim(s, { noun: 'lamp' });
    if (a === 'can') return doFill(s, { noun: b === 'drum' ? 'drum' : 'lamp' });
    if (a === 'lantern') return doLight(s, { noun: 'lantern' });
    return { text: 'Nothing happens.', cost: 0 };
  }

  const HANDLERS = {
    go: doGo, take: doTake, drop: doDrop, examine: doExamine, read: doRead, pull: doPull, free: doFree, talk: doTalk,
    unlock: doUnlock, light: doLight, fill: doFill, trim: doTrim, use: doUse,
    look: (s) => ({ text: describe(s), cost: 0, event: 'room' }),
    wait: () => ({ text: 'You wait. The wind moves on without you.', cost: 1 }),
    inventory: (s) => {
      const ids = allIds.filter((i) => held(s, i));
      return { text: ids.length ? 'You are carrying: ' + ids.map(nameOf).join(', ') + '.' : 'You are carrying nothing.', cost: 0 };
    },
    help: () => ({
      text: 'Type short commands: go north (or n, s, e, w, u, d), look, examine <thing>, take <thing>, drop <thing>, inventory, read <thing>, use <thing> on <thing>, light, fill, trim, unlock, pull, free, talk, wait, hint.\nTime passes when you move or act; looking, reading and examining are free. The Halcyon reaches the rocks on turn ' + W.limit + '.',
      cost: 0,
    }),
    hint: (s) => { s.hints++; return { text: 'Hint: ' + hint(s), cost: 0 }; },
  };

  function tick(s) {
    const w = W.texts.warnings[s.turn];
    if (s.turn >= W.limit) {
      s.status = 'lost';
      s.ending = 'wreck';
      return '\n' + W.texts.loseText;
    }
    return w ? '\n' + w : '';
  }

  function viewFacts(s) {
    const ids = presentIds(s);
    return {
      room: s.room,
      roomName: W.rooms[s.room].name,
      dark: isDark(s),
      turn: s.turn,
      limit: W.limit,
      visible: ids.filter((i) => s.loc[i] === s.room && W.items[i].listed !== false && !isDark(s)),
      inventory: allIds.filter((i) => held(s, i)),
      exits: isDark(s) ? [] : exitsOf(s).map((d) => DIR_NAMES[d]),
      allowed: ids,
    };
  }

  // step(state, input) -> { text, event, facts, over, cost }
  function step(s, input) {
    if (s.status !== 'playing') {
      return { text: 'The story is over. Start a new game to play again.', event: 'over', facts: viewFacts(s), over: true, cost: 0 };
    }
    const c = parse(input);
    let res;
    if (!c.verb) {
      res = { text: c.raw ? `I don't know how to "${c.unknown || c.raw}". Type help for commands.` : 'Say something.', cost: 0 };
    } else {
      res = HANDLERS[c.verb](s, c);
    }
    if (res.cost && s.status === 'playing') {
      s.turn += res.cost;
      const t = tick(s);
      res.text += t;
      if (s.status === 'lost') res.event = 'lose';
      else if (t) res.event = res.event || 'warning';
    }
    res.facts = viewFacts(s);
    res.over = s.status !== 'playing';
    return res;
  }

  const api = { newGame, step, parse, describe, hint, viewFacts, DIR_NAMES, world: W };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.LampEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
