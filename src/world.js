// World data: rooms, items, and story text. Add content here without touching the engine.
(function (g) {
  'use strict';

  const world = {
    limit: 50, // the Halcyon reaches the rocks on this turn
    start: 'dock',

    rooms: {
      dock: {
        name: 'The Landing',
        desc: 'A slick stone landing at the foot of Cape Verity. Your boatman has already shoved off, shouting something about weather. Above you a black tower stands against a bruised sky, and its great lamp is dark. A path climbs north.',
        exits: { n: 'path' },
      },
      path: {
        name: 'Cliff Path',
        desc: 'A narrow path of crushed shell climbs the headland. To the west a low keeper\'s cottage hunches against the wind. To the north, the tower\'s iron-banded door. The landing is back south.',
        exits: { s: 'dock', w: 'cottage', n: 'tower_base' },
        locked: { n: 'doorUnlocked' },
      },
      cottage: {
        name: 'Keeper\'s Kitchen',
        desc: 'A cold kitchen: a black stove, a table set for one, a chair knocked on its side. An iron-ringed trapdoor stands open in the floor. The study is north, the path east.',
        exits: { e: 'path', n: 'study', d: 'cellar' },
      },
      study: {
        name: 'Keeper\'s Study',
        desc: 'Charts of the coast cover the walls. A desk faces the window, and the window faces the sea. A wastebasket sits beside the desk. The kitchen is south.',
        exits: { s: 'cottage' },
      },
      cellar: {
        name: 'Oil Cellar',
        desc: 'Cold, damp, and sharp with lamp oil. Empty barrels line the walls and one great drum squats in the corner. Against the far wall stands a heavy shelf of dented tins. A ladder leads up.',
        exits: { u: 'cottage' },
        dark: true,
        extra: (s) => (s.flags.shelfPulled ? 'The shelf has been swung aside, showing a narrow alcove behind it.' : ''),
      },
      tower_base: {
        name: 'Foot of the Tower',
        desc: 'Round walls, sweating stone. A spiral stair winds up into the dark. The door to the path is south.',
        exits: { s: 'path', u: 'stairs' },
      },
      stairs: {
        name: 'Spiral Stair',
        desc: 'Ninety-one iron steps, someone once told you. The wind sings in the slits. On the turn of the stair the rail is scuffed bright, as if something heavy was dragged down it.',
        exits: { d: 'tower_base', u: 'lamp_room' },
      },
      lamp_room: {
        name: 'The Lamp Room',
        desc: 'The great lens, taller than you, stares dark over the sea. Below its glass sits the lamp: a brass reservoir, a burner, a wick. The stair leads down.',
        exits: { d: 'stairs' },
        extra: (s) => {
          const f = s.flags;
          const bits = [];
          bits.push(f.lampFilled ? 'The reservoir is full of oil.' : 'The reservoir is bone dry.');
          bits.push(f.lampTrimmed ? 'The wick is freshly trimmed.' : 'The wick is long, ragged and crusted with soot.');
          return bits.join(' ');
        },
      },
    },

    // words: names the player can type. listed:false means it is part of the room text, not listed separately.
    items: {
      lantern: {
        name: 'ship\'s lantern', words: ['lantern', 'ships lantern', 'lamp post lantern'], at: 'dock', takeable: true,
        desc: (s) => (s.flags.lanternLit ? 'A tin ship\'s lantern, lit and steady. It throws a small warm circle.' : 'A tin ship\'s lantern with oil in the font. It is not lit.'),
      },
      matches: {
        name: 'box of matches', words: ['matches', 'match', 'matchbox', 'box'], at: 'cottage', takeable: true,
        desc: () => 'A dry box of kitchen matches. Plenty left.',
      },
      teapot: {
        name: 'teapot', words: ['teapot', 'pot'], at: 'cottage', listed: false,
        desc: (s) => {
          if (!s.flags.keyFound) { s.flags.keyFound = true; s.loc.key = 'cottage'; return 'A fat brown teapot. You lift the lid and find a brass key lying in the leaves. You set it on the table.'; }
          return 'A fat brown teapot, lid off.';
        },
      },
      key: {
        name: 'brass key', words: ['key', 'brass key'], at: null, takeable: true,
        desc: () => 'A heavy brass key, green at the teeth. Big enough for a tower door.',
      },
      trapdoor: { name: 'trapdoor', words: ['trapdoor', 'hatch', 'ladder'], at: 'cottage', listed: false, desc: () => 'A square trapdoor, propped open. A ladder leads down into the cold.' },
      stove: { name: 'stove', words: ['stove', 'table', 'chair'], at: 'cottage', listed: false, desc: () => 'The stove is cold. Whoever set the table for one did not get to eat. The chair was knocked over in a hurry.' },
      desk: {
        name: 'desk', words: ['desk', 'window'], at: 'study', listed: false,
        desc: () => 'A plain oak desk. A logbook lies open on it, and a pair of scissors beside the inkwell.',
      },
      logbook: {
        name: 'keeper\'s logbook', words: ['logbook', 'log', 'book', 'journal'], at: 'study', takeable: true,
        desc: () => 'The station logbook, kept in a careful hand. Try reading it.',
        read: (s) => { s.flags.readLog = true; return 'The last pages, in the keeper\'s neat hand:\n"3 Oct. New assistant, Pell, sent by the Board. Asks a great many questions about the Halcyon\'s schedule.\n5 Oct. Found Pell writing to Dunmore Salvage. Told him I would report it.\n6 Oct. Pell says the lamp\'s oil store is \'contaminated\'. It is not. Someone wants this light out on the night the Halcyon passes."'; },
      },
      scissors: {
        name: 'scissors', words: ['scissors', 'shears'], at: 'study', takeable: true,
        desc: () => 'Sharp brass scissors with a wick-trimmer\'s long blades.',
      },
      basket: {
        name: 'wastebasket', words: ['basket', 'wastebasket', 'bin'], at: 'study', listed: false,
        desc: (s) => {
          if (!s.flags.letterFound) { s.flags.letterFound = true; s.loc.letter = 'study'; return 'Mostly scraps and pencil shavings. One sheet has been torn in half and thrown in. You smooth it onto the desk.'; }
          return 'Scraps and pencil shavings.';
        },
      },
      letter: {
        name: 'torn letter', words: ['letter', 'sheet', 'paper', 'torn letter'], at: null, takeable: true,
        desc: () => 'A torn letter. Try reading it.',
        read: (s) => { s.flags.readLetter = true; return '"...Dunmore Salvage will pay the second half when the Halcyon is on the rocks. Keep the Cape dark until midnight. Burn this. — D."'; },
      },
      can: {
        name: 'oil can', words: ['can', 'oil can', 'oilcan', 'jug'], at: 'tower_base', takeable: true,
        desc: (s) => (s.flags.canFull ? 'A brass oil can, full to the spout.' : 'A brass oil can with a long spout. It is empty.'),
      },
      drum: {
        name: 'oil drum', words: ['drum', 'oil drum', 'barrel', 'barrels'], at: 'cellar', listed: false,
        desc: () => 'A big iron drum with a tap near the base. The oil in it is clean and clear. Whatever Pell said, nothing is wrong with it.',
      },
      shelf: {
        name: 'shelf', words: ['shelf', 'tins', 'bookshelf'], at: 'cellar', listed: false,
        desc: (s) => (s.flags.shelfPulled ? 'The shelf has been swung aside on a hidden hinge.' : 'A heavy shelf of dented tins. The floor in front of it is scratched in a fresh curve, as if the shelf has moved before. Perhaps you could pull it.'),
      },
      ansel: {
        name: 'Ansel Marrow', words: ['ansel', 'keeper', 'man', 'marrow', 'ansel marrow'], at: null, listed: true,
        desc: (s) => (s.flags.rescued ? 'Ansel Marrow, the keeper, pale but upright, rubbing his wrists.' : 'A grey-bearded man bound hand and foot, gagged with a rag, watching you with wide, furious, relieved eyes.'),
      },
      door: {
        name: 'tower door', words: ['door', 'tower door', 'lock'], at: 'path', listed: false,
        desc: (s) => (s.flags.doorUnlocked ? 'The tower door stands unlocked.' : 'An iron-banded door with a large, old lock. It will not budge.'),
      },
      lamp: {
        name: 'lamp', words: ['lamp', 'wick', 'burner', 'reservoir', 'lens'], at: 'lamp_room', listed: false,
        desc: (s) => {
          const f = s.flags;
          const need = [];
          if (!f.lampFilled) need.push('fuel');
          if (!f.lampTrimmed) need.push('a trimmed wick');
          if (!need.length) return 'Oil in the reservoir and a clean wick. It only needs a flame.';
          return 'The lamp is not ready. It needs ' + need.join(' and ') + '.';
        },
      },
    },

    texts: {
      anselFreed: 'You pull the rag from his mouth and work at the cords until they give. Ansel Marrow drags in a breath. "Pell," he croaks. "Pell tied me up and took the boat to meet Dunmore\'s men. He is going to let the Halcyon hit the rocks. The lamp: fill it, trim the wick, strike a light. Go. I will follow."',
      anselTalk: '"Pell and Dunmore Salvage want the light out. Fill the lamp, trim the wick, light it. Hurry."',
      warnings: {
        15: 'Far out, a ship\'s horn sounds twice: the Halcyon, a grain steamer, is making for the Cape.',
        30: 'The horn again, closer. The Halcyon is steering by a light that is not there.',
        42: 'The steamer\'s masthead lights are plain now, and sliding toward the rocks. Minutes remain.',
      },
      loseText: 'The horn gives one long, terrible note, and then the sound you were afraid of: iron meeting rock. The Halcyon is lost with all hands, and the Cape stays dark. THE END.',
      winBoth: 'The flame catches. The great lens wakes and a beam sweeps the sea. Far out, the Halcyon swings her bow away from the rocks and slips past. Below you, Ansel Marrow climbs the last steps with a hand on the rail and the first smile in a week. By morning the Board has Pell\'s letter, and Dunmore Salvage has the coastguard. THE END: The Keeper\'s Light.',
      winLightOnly: 'The flame catches. The great lens wakes and a beam sweeps the sea. Far out, the Halcyon swings her bow away from the rocks and slips past. It is only later, going down for the logbook, that you hear the knocking from behind the cellar shelf. THE END: The Lamplighter. (There is a better ending: the keeper was still in the cellar.)',
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = world;
  else g.LampWorld = world;
})(typeof globalThis !== 'undefined' ? globalThis : this);
