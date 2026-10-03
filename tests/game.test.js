const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/engine');
const N = require('../src/narrator');

const FULL = ['take lantern', 'n', 'w', 'take matches', 'examine teapot', 'take key', 'light lantern', 'n', 'take scissors',
  's', 'd', 'pull shelf', 'free ansel', 'u', 'e', 'unlock door', 'n', 'take can', 's', 'w', 'd', 'fill can', 'u', 'e', 'n', 'u', 'u',
  'fill lamp', 'trim wick', 'light lamp'];
const LIGHT_ONLY = ['take lantern', 'n', 'w', 'take matches', 'examine teapot', 'take key', 'light lantern', 'n', 'take scissors', 's',
  'e', 'unlock door', 'n', 'take can', 's', 'w', 'd', 'fill can', 'u', 'e', 'n', 'u', 'u', 'fill lamp', 'trim wick', 'light lamp'];

function play(cmds) {
  const s = E.newGame();
  let last;
  for (const c of cmds) last = E.step(s, c);
  return { s, last };
}

test('a full playthrough wins with the best ending in 28 turns', () => {
  const { s } = play(FULL);
  assert.strictEqual(s.status, 'won');
  assert.strictEqual(s.ending, 'both');
  assert.strictEqual(s.turn, 28);
});

test('skipping the rescue still wins, with the lesser ending', () => {
  const { s } = play(LIGHT_ONLY);
  assert.strictEqual(s.status, 'won');
  assert.strictEqual(s.ending, 'light');
});

test('waiting out the clock loses at the limit', () => {
  const s = E.newGame();
  let last;
  for (let i = 0; i < E.world.limit; i++) last = E.step(s, 'wait');
  assert.strictEqual(s.status, 'lost');
  assert.strictEqual(last.event, 'lose');
});

test('the lamp refuses to light out of order', () => {
  const s = E.newGame();
  Object.assign(s.loc, { matches: 'inv' });
  s.room = 'lamp_room';
  assert.match(E.step(s, 'light lamp').text, /dry/);
  s.flags.lampFilled = true;
  assert.match(E.step(s, 'light lamp').text, /Trim it first/);
  assert.strictEqual(s.status, 'playing');
});

test('the cellar is unusable in the dark and usable with a lit lantern', () => {
  const s = E.newGame();
  s.room = 'cellar';
  assert.match(E.step(s, 'pull shelf').text, /budges/);
  assert.match(E.step(s, 'examine drum').text, /too dark/);
  s.loc.lantern = 'inv';
  s.flags.lanternLit = true;
  assert.match(E.step(s, 'examine drum').text, /iron drum/);
});

test('the tower door stays locked without the key', () => {
  const s = E.newGame();
  s.room = 'path';
  assert.match(E.step(s, 'n').text, /locked/);
  assert.match(E.step(s, 'unlock door').text, /nothing to open/);
});

test('looking, examining and reading are free; moving and taking cost a turn', () => {
  const s = E.newGame();
  E.step(s, 'look'); E.step(s, 'examine lantern'); E.step(s, 'inventory'); E.step(s, 'hint');
  assert.strictEqual(s.turn, 0);
  assert.strictEqual(s.hints, 1);
  E.step(s, 'take lantern');
  assert.strictEqual(s.turn, 1);
});

test('unknown words and impossible actions do not crash or cost time', () => {
  const s = E.newGame();
  for (const c of ['', 'dance wildly', 'take the moon', 'go sideways', 'fill', 'use', 'x ansel']) E.step(s, c);
  assert.strictEqual(s.turn, 0);
});

test('parser handles articles, phrases and direction shortcuts', () => {
  assert.deepStrictEqual(E.parse('n').dir, 'n');
  assert.strictEqual(E.parse('pick up the lantern').verb, 'take');
  assert.strictEqual(E.parse('look at the lantern').verb, 'examine');
  assert.strictEqual(E.parse('use key on door').ind, 'door');
});

test('after the game ends, further commands do nothing', () => {
  const { s } = play(FULL);
  const r = E.step(s, 'take lantern');
  assert.strictEqual(r.over, true);
  assert.strictEqual(s.turn, 28);
});

// --- narrator guard ---
function roomResult() {
  const s = E.newGame();
  return E.step(s, 'look');
}

test('guard accepts a faithful rewrite', () => {
  const r = roomResult();
  const reply = 'You stand on a slick stone landing below a dark tower. A ship\'s lantern hangs close by, and a path climbs north.';
  assert.deepStrictEqual(N.check(reply, r), { ok: true, reasons: [] });
});

test('guard rejects an invented object', () => {
  const r = roomResult();
  const reply = 'A slick landing. A ship\'s lantern hangs here, a pair of scissors lies beside it, and a path climbs north.';
  const v = N.check(reply, r);
  assert.strictEqual(v.ok, false);
  assert.match(v.reasons.join(' '), /scissors/);
});

test('known limit: the guard cannot catch an invention that is not in the world data', () => {
  const r = roomResult();
  const reply = 'A slick landing. A ship\'s lantern hangs here, a rusty cutlass lies beside it, and a path climbs north.';
  assert.strictEqual(N.check(reply, r).ok, true); // documented in the README
});

test('guard rejects a reply that drops a visible object or an exit', () => {
  const r = roomResult();
  assert.match(N.check('A slick landing under a dark tower. A path climbs north.', r).reasons.join(' '), /dropped object/);
  assert.match(N.check('A slick landing under a dark tower with a ship\'s lantern.', r).reasons.join(' '), /dropped exit/);
});

test('guard rejects an out-of-place item that exists elsewhere in the world', () => {
  const r = roomResult();
  const reply = 'A slick landing. A ship\'s lantern hangs here beside a brass key. A path climbs north.';
  assert.match(N.check(reply, r).reasons.join(' '), /key/);
});

test('guard rejects lists, numbers and long replies', () => {
  const r = roomResult();
  assert.strictEqual(N.check('- a lantern\n- a path north', r).ok, false);
  assert.match(N.check('There are 3 gulls and a lantern, path north.', r).reasons.join(' '), /numbers/);
  assert.match(N.check('word '.repeat(150), r).reasons.join(' '), /too long/);
});

test('narrate falls back to the engine text when the model fails or is rejected', async () => {
  const r = roomResult();
  const bad = await N.narrate(r, async () => 'A rusty cutlass gleams on the landing.');
  assert.strictEqual(bad.source, 'scripted');
  assert.strictEqual(bad.text, r.text);
  const down = await N.narrate(r, async () => { throw new Error('offline'); });
  assert.strictEqual(down.source, 'scripted');
  assert.match(down.rejected[0], /offline/);
  const none = await N.narrate(r, null);
  assert.strictEqual(none.source, 'scripted');
});

test('narrate uses a good model reply, but never rewrites endings', async () => {
  const r = roomResult();
  const good = await N.narrate(r, async () => 'You stand on a slick stone landing. A ship\'s lantern hangs nearby and a path climbs north.');
  assert.strictEqual(good.source, 'model');
  const { last } = play(FULL);
  const end = await N.narrate(last, async () => 'rewritten');
  assert.strictEqual(end.text, last.text);
});
