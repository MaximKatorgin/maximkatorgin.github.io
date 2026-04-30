const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildMultiplicationProblems,
  createGameState,
  answerTile,
  restartGame,
  getDisplayTiles,
  getAssemblyOffset,
  getBoardClassName,
} = require('../script.js');

test('buildMultiplicationProblems creates 81 unique problems from 2x2 to 10x10', () => {
  const problems = buildMultiplicationProblems();
  const labels = new Set(problems.map((problem) => problem.label));

  assert.equal(problems.length, 81);
  assert.equal(labels.size, 81);
  assert.ok(labels.has('2 × 2'));
  assert.ok(labels.has('10 × 10'));
  assert.equal(problems.find((problem) => problem.label === '7 × 8').answer, 56);
});

test('createGameState supports the 162 tile maximum with no problem used more than twice', () => {
  const game = createGameState(9, 18, { seed: 42 });
  const counts = new Map();

  for (const tile of game.tiles) {
    counts.set(tile.problem.label, (counts.get(tile.problem.label) || 0) + 1);
  }

  assert.equal(game.rows, 9);
  assert.equal(game.cols, 18);
  assert.equal(game.tiles.length, 162);
  assert.equal(Math.max(...counts.values()), 2);
  assert.equal(game.isComplete, false);
});

test('answerTile rejects wrong answers and solves the tile only with a correct answer', () => {
  const game = createGameState(3, 3, { seed: 7 });
  const firstTile = game.tiles[0];

  const wrong = answerTile(game, firstTile.id, String(firstTile.problem.answer + 1));
  assert.equal(wrong.correct, false);
  assert.equal(game.tiles[0].solved, false);
  assert.equal(game.solvedCount, 0);

  const right = answerTile(game, firstTile.id, ` ${firstTile.problem.answer} `);
  assert.equal(right.correct, true);
  assert.equal(game.tiles[0].solved, true);
  assert.equal(game.solvedCount, 1);
});

test('restartGame keeps the selected size and clears progress', () => {
  const game = createGameState(4, 4, { seed: 3 });
  answerTile(game, game.tiles[0].id, game.tiles[0].problem.answer);

  const restarted = restartGame(game, { seed: 4 });

  assert.equal(restarted.rows, 4);
  assert.equal(restarted.cols, 4);
  assert.equal(restarted.tiles.length, 16);
  assert.equal(restarted.solvedCount, 0);
  assert.equal(restarted.isComplete, false);
  assert.ok(restarted.tiles.every((tile) => tile.solved === false));
});

test('picture pieces are shuffled during play and assembled after every problem is solved', () => {
  const game = createGameState(4, 4, { seed: 11 });
  const initialDisplay = getDisplayTiles(game).map((tile) => tile.imageIndex);

  assert.notDeepEqual(initialDisplay, [...initialDisplay].sort((left, right) => left - right));

  for (const tile of game.tiles) {
    answerTile(game, tile.id, tile.problem.answer);
  }

  const completedVisualPositions = getDisplayTiles(game).map((tile) => tile.positionIndex + getAssemblyOffset(game, tile).y * game.cols + getAssemblyOffset(game, tile).x);

  assert.deepEqual(completedVisualPositions, getDisplayTiles(game).map((tile) => tile.imageIndex));
  assert.equal(game.isComplete, true);
});

test('assembly offsets move shuffled picture pieces to their correct positions only after completion', () => {
  const game = createGameState(4, 4, { seed: 11 });
  const movableTile = game.tiles.find((tile) => tile.positionIndex !== tile.imageIndex);

  assert.ok(movableTile);
  assert.deepEqual(getAssemblyOffset(game, movableTile), { x: 0, y: 0 });

  for (const tile of game.tiles) {
    answerTile(game, tile.id, tile.problem.answer);
  }

  const completedOffset = getAssemblyOffset(game, movableTile);
  const expectedX = (movableTile.imageIndex % game.cols) - (movableTile.positionIndex % game.cols);
  const expectedY = Math.floor(movableTile.imageIndex / game.cols) - Math.floor(movableTile.positionIndex / game.cols);

  assert.deepEqual(completedOffset, { x: expectedX, y: expectedY });
});

test('completed board can be rendered without the complete class before animation starts', () => {
  assert.equal(getBoardClassName(16, true, false), 'board');
  assert.equal(getBoardClassName(16, true, true), 'board board--complete');
  assert.equal(getBoardClassName(128, true, false), 'board board--tiny');
  assert.equal(getBoardClassName(128, true, true), 'board board--tiny board--complete');
});

test('puzzle image is loaded from pic.jpg for easy GitHub Pages replacement', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'script.js'), 'utf8');

  assert.match(source, /const PICTURE_URL = 'pic\.jpg';/);
  assert.doesNotMatch(source, /data:image\/svg\+xml/);
});
