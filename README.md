# The Lamplighter's Log

[![tests](https://github.com/nicholas-tamburrino/lamplighters-log/actions/workflows/tests.yml/badge.svg)](https://github.com/nicholas-tamburrino/lamplighters-log/actions/workflows/tests.yml)

A lighthouse mystery you play in the browser. The keeper of Cape Verity has stopped answering his signals, the great lamp is dark, and a grain steamer called the Halcyon reaches the rocks on turn 50. Find out what happened to the keeper and relight the lamp in time.

**Play it:** https://nicholas-tamburrino.github.io/lamplighters-log/ (or open `index.html` locally; no install, no build, no network needed).

It is a real game first: eight rooms, a clock, an order-dependent lamp puzzle, a hidden rescue, three endings (the keeper's light, the lamplighter, the wreck), and a turn count and hint count to beat on a second run. It is also a small experiment in using a language model safely inside a game.

## How the model fits in

The game works completely without a model. The text you read is written by hand.

Optionally you can let a model (a local one through [Ollama](https://ollama.com), or any OpenAI-compatible API) rewrite what you see in its own words. The design rule is that **the engine owns the truth and the model only narrates**:

- The engine decides what exists, where it is, and what happens. The model never changes state.
- Before any model text is shown, a rule-based **guard** checks it. It rejects replies that are too long, contain lists or numbers, mention an object that is not in the room, drop an object or exit the engine listed, or invent an exit.
- If the model fails the guard (or is offline), the player sees the hand-written text instead, and the page counts accepted and rejected replies and shows the reason. Nothing is hidden.
- Endings and the clock are never rewritten.

### Honest limits of the guard

- It only knows the nouns in `src/world.js`. A model that invents a brand-new object (say, a cutlass) will slip through. There is a test that documents this on purpose.
- It checks words, not meaning. A reply can mention the right things and still be dull or slightly wrong in tone.
- It has been tested with hand-written replies, not against a published set of model outputs. I have not measured how often any real model passes it, so I make no claim about that.

## Commands

`go north` (or `n`, `s`, `e`, `w`, `u`, `d`), `look`, `examine <thing>`, `take <thing>`, `drop <thing>`, `inventory`, `read <thing>`, `use <thing> on <thing>`, `light`, `fill`, `trim`, `unlock`, `pull`, `free`, `talk`, `wait`, `hint`, `help`.

Moving, taking and acting cost a turn. Looking, examining, reading and asking for a hint are free, but hints are counted.

## Run and test

```bash
node --test            # 18 tests: full playthroughs, endings, puzzle order, parser, guard
python tools/bundle.py > lamplighters-log.html   # optional: one self-contained file
```

Only Node 20+ is needed for the tests; the game itself is plain JavaScript with no dependencies.

## Layout

```
index.html        the page (loads the three scripts below)
src/world.js      rooms, items and story text: add content here
src/engine.js     parser, state and rules (no DOM, no network)
src/narrator.js   optional model adapters and the guard
tests/            node:test suite
tools/bundle.py   builds a single-file version
```

## Status

Version 0.1: one scenario. The fastest route I know takes 28 turns and the clock allows 50. Ideas I may add: a second location, saving a game, and a harness for measuring how often a given model passes the guard.

Built by Nicholas Tamburrino, with Claude as a development aid. Design decisions and review of the code are my responsibility.

## License

MIT, see [LICENSE](LICENSE).
