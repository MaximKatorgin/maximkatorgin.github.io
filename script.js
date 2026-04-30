(function () {
  const MIN_ROWS = 3;
  const MAX_ROWS = 9;
  const MIN_COLS = 3;
  const MAX_COLS = 18;
  const MAX_TILES = 162;

  const PICTURE_URL = 'pic.jpg';

  function seededRandom(seed) {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return function nextRandom() {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  function buildMultiplicationProblems() {
    const problems = [];

    for (let left = 2; left <= 10; left += 1) {
      for (let right = 2; right <= 10; right += 1) {
        problems.push({
          left,
          right,
          label: `${left} × ${right}`,
          answer: left * right,
        });
      }
    }

    return problems;
  }

  function shuffle(items, random) {
    const copy = items.slice();

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
  }

  function validateSize(rows, cols) {
    if (!Number.isInteger(rows) || !Number.isInteger(cols)) {
      throw new Error('Размер поля должен быть целым числом.');
    }

    if (rows < MIN_ROWS || rows > MAX_ROWS || cols < MIN_COLS || cols > MAX_COLS) {
      throw new Error('Размер поля выходит за допустимые границы.');
    }

    if (rows * cols > MAX_TILES) {
      throw new Error('Поле не может быть больше 162 плиток.');
    }
  }

  function createGameState(rows, cols, options = {}) {
    validateSize(rows, cols);

    const seed = options.seed ?? Date.now();
    const random = seededRandom(seed);
    const tileCount = rows * cols;
    const problems = buildMultiplicationProblems();
    const problemPool = shuffle([...problems, ...problems], random).slice(0, tileCount);
    const shuffledImageIndexes = shuffle(
      Array.from({ length: tileCount }, (_, index) => index),
      random,
    );

    const tiles = Array.from({ length: tileCount }, (_, index) => ({
      id: `tile-${index}`,
      positionIndex: index,
      imageIndex: shuffledImageIndexes[index],
      problem: problemPool[index],
      solved: false,
    }));

    return {
      rows,
      cols,
      seed,
      tiles,
      solvedCount: 0,
      isComplete: false,
    };
  }

  function getDisplayTiles(game) {
    return game.tiles.slice().sort((left, right) => left.positionIndex - right.positionIndex);
  }

  function getAssemblyOffset(game, tile) {
    if (!game.isComplete) {
      return { x: 0, y: 0 };
    }

    const currentCol = tile.positionIndex % game.cols;
    const currentRow = Math.floor(tile.positionIndex / game.cols);
    const targetCol = tile.imageIndex % game.cols;
    const targetRow = Math.floor(tile.imageIndex / game.cols);

    return {
      x: targetCol - currentCol,
      y: targetRow - currentRow,
    };
  }

  function tileFontClass(tileCount) {
    if (tileCount >= 120) return 'board--tiny';
    if (tileCount >= 64) return 'board--dense';
    return '';
  }

  function getBoardClassName(tileCount, isComplete, assemblyActive = isComplete) {
    return ['board', tileFontClass(tileCount), isComplete && assemblyActive ? 'board--complete' : '']
      .filter(Boolean)
      .join(' ');
  }

  function answerTile(game, tileId, rawAnswer) {
    const tile = game.tiles.find((item) => item.id === tileId);
    const answer = Number(String(rawAnswer).trim());

    if (!tile) {
      throw new Error('Плитка не найдена.');
    }

    if (!Number.isFinite(answer) || answer !== tile.problem.answer) {
      return { correct: false, tile, game };
    }

    if (!tile.solved) {
      tile.solved = true;
      game.solvedCount += 1;
      game.isComplete = game.solvedCount === game.tiles.length;
    }

    return { correct: true, tile, game };
  }

  function restartGame(game, options = {}) {
    return createGameState(game.rows, game.cols, options);
  }

  function createApp() {
    const elements = {
      setup: document.querySelector('[data-screen="setup"]'),
      game: document.querySelector('[data-screen="game"]'),
      rowsInput: document.querySelector('#rows'),
      colsInput: document.querySelector('#cols'),
      rowsValue: document.querySelector('#rowsValue'),
      colsValue: document.querySelector('#colsValue'),
      tileCount: document.querySelector('#tileCount'),
      startButton: document.querySelector('#startGame'),
      restartButton: document.querySelector('#restartGame'),
      changeSizeButton: document.querySelector('#changeSize'),
      board: document.querySelector('#board'),
      progress: document.querySelector('#progress'),
      status: document.querySelector('#status'),
      modal: document.querySelector('#answerModal'),
      modalProblem: document.querySelector('#modalProblem'),
      answerForm: document.querySelector('#answerForm'),
      answerInput: document.querySelector('#answerInput'),
      feedback: document.querySelector('#feedback'),
      closeModal: document.querySelector('#closeModal'),
    };

    let game = null;
    let selectedTileId = null;

    function syncSetupLabels() {
      const rows = Number(elements.rowsInput.value);
      const cols = Number(elements.colsInput.value);
      elements.rowsValue.textContent = rows;
      elements.colsValue.textContent = cols;
      elements.tileCount.textContent = rows * cols;
    }

    function setScreen(screenName) {
      elements.setup.hidden = screenName !== 'setup';
      elements.game.hidden = screenName !== 'game';
    }

    function renderBoard(options = {}) {
      const animateAssembly = Boolean(options.animateAssembly);
      const assemblyActive = game.isComplete && !animateAssembly;

      elements.board.innerHTML = '';
      elements.board.style.setProperty('--rows', game.rows);
      elements.board.style.setProperty('--cols', game.cols);
      elements.board.style.setProperty('--picture-url', `url("${PICTURE_URL}")`);
      elements.board.className = getBoardClassName(game.tiles.length, game.isComplete, assemblyActive);

      for (const tile of getDisplayTiles(game)) {
        const row = Math.floor(tile.imageIndex / game.cols);
        const col = tile.imageIndex % game.cols;
        const offset = getAssemblyOffset(game, tile);
        const button = document.createElement('button');

        button.type = 'button';
        button.className = `tile${tile.solved ? ' tile--solved' : ''}`;
        button.dataset.tileId = tile.id;
        button.style.setProperty('--tile-x', col);
        button.style.setProperty('--tile-y', row);
        button.style.setProperty('--move-x', offset.x);
        button.style.setProperty('--move-y', offset.y);
        button.style.setProperty('--bg-x', game.cols === 1 ? '0%' : `${(col / (game.cols - 1)) * 100}%`);
        button.style.setProperty('--bg-y', game.rows === 1 ? '0%' : `${(row / (game.rows - 1)) * 100}%`);
        button.setAttribute('aria-label', tile.solved ? `Открытая часть картинки ${tile.imageIndex + 1}` : `Пример ${tile.problem.label}`);
        button.disabled = tile.solved;
        button.innerHTML = `
          <span class="tile__face tile__front" aria-hidden="true"></span>
          <span class="tile__face tile__back">${tile.problem.label}</span>
        `;

        elements.board.appendChild(button);
      }

      updateProgress();

      if (animateAssembly) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            elements.board.className = getBoardClassName(game.tiles.length, game.isComplete, true);
          });
        });
      }
    }

    function updateProgress() {
      elements.progress.textContent = `${game.solvedCount} из ${game.tiles.length}`;

      if (game.isComplete) {
        elements.status.textContent = 'Картинка собрана! Можно рассмотреть ее или начать заново кнопкой перезапуска.';
      } else {
        elements.status.textContent = 'Выбери пример, реши его и открой часть картинки.';
      }
    }

    function startGame(rows, cols) {
      game = createGameState(rows, cols);
      selectedTileId = null;
      renderBoard({ animateAssembly: game.isComplete });
      setScreen('game');
    }

    function openModal(tileId) {
      const tile = game.tiles.find((item) => item.id === tileId);

      if (!tile || tile.solved) return;

      selectedTileId = tileId;
      elements.modalProblem.textContent = tile.problem.label;
      elements.answerInput.value = '';
      elements.feedback.textContent = '';
      elements.modal.showModal();
      elements.answerInput.focus();
    }

    function closeModal() {
      elements.modal.close();
      selectedTileId = null;
    }

    elements.rowsInput.addEventListener('input', syncSetupLabels);
    elements.colsInput.addEventListener('input', syncSetupLabels);

    elements.startButton.addEventListener('click', () => {
      startGame(Number(elements.rowsInput.value), Number(elements.colsInput.value));
    });

    elements.restartButton.addEventListener('click', () => {
      game = restartGame(game);
      selectedTileId = null;
      renderBoard();
    });

    elements.changeSizeButton.addEventListener('click', () => {
      setScreen('setup');
    });

    elements.board.addEventListener('click', (event) => {
      const tileButton = event.target.closest('.tile');
      if (tileButton) openModal(tileButton.dataset.tileId);
    });

    elements.answerForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const result = answerTile(game, selectedTileId, elements.answerInput.value);

      if (!result.correct) {
        elements.feedback.textContent = 'Ответ неправильный. Попробуй еще раз.';
        elements.answerInput.select();
        return;
      }

      closeModal();
      renderBoard();
    });

    elements.closeModal.addEventListener('click', closeModal);

    elements.modal.addEventListener('click', (event) => {
      if (event.target === elements.modal) closeModal();
    });

    syncSetupLabels();
    setScreen('setup');
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', createApp);
  }

  if (typeof module !== 'undefined') {
    module.exports = {
      buildMultiplicationProblems,
      createGameState,
      answerTile,
      restartGame,
      validateSize,
      getDisplayTiles,
      getAssemblyOffset,
      getBoardClassName,
    };
  }
}());
