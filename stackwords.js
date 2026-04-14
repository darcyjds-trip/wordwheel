(function () {
  const TILE_COLORS = {
    BLUE: "blue",
    RED: "red",
    ORANGE: "orange",
    GREEN: "green"
  };

  function shuffle(array) {
    const clone = [...array];
    for (let index = clone.length - 1; index > 0; index -= 1) {
      const nextIndex = Math.floor(Math.random() * (index + 1));
      [clone[index], clone[nextIndex]] = [clone[nextIndex], clone[index]];
    }
    return clone;
  }

  class StackWordsPuzzleModel {
    constructor(data) {
      this.id = Number(data.id);
      this.lengths = data.lengths.map((length) => Number(length));
      this.solution = data.solution.map((word) => String(word).toUpperCase());
      this.letters = data.letters.map((letter) => String(letter).toUpperCase());
      this.validate();
    }

    validate() {
      const expectedLengths = [4, 5, 6];
      if (this.lengths.length !== 3 || this.solution.length !== 3) {
        throw new Error(`Triple Stack puzzle ${this.id} must contain exactly 3 words.`);
      }

      if (!expectedLengths.every((length, index) => this.lengths[index] === length)) {
        throw new Error(`Triple Stack puzzle ${this.id} must use 4, 5, and 6 letter words.`);
      }

      this.solution.forEach((word, index) => {
        if (word.length !== this.lengths[index]) {
          throw new Error(`Triple Stack puzzle ${this.id} has a length mismatch.`);
        }
      });

      if (this.letters.length !== 18) {
        throw new Error(`Triple Stack puzzle ${this.id} must contain exactly 18 letters.`);
      }

      const uniqueLetters = new Set(this.letters);
      if (uniqueLetters.size !== this.letters.length) {
        throw new Error(`Triple Stack puzzle ${this.id} cannot contain duplicate letters.`);
      }

      const solutionLetters = this.solution.join("").split("");
      if (new Set(solutionLetters).size !== solutionLetters.length) {
        throw new Error(`Triple Stack puzzle ${this.id} answers cannot reuse letters.`);
      }

      solutionLetters.forEach((letter) => {
        if (!uniqueLetters.has(letter)) {
          throw new Error(`Triple Stack puzzle ${this.id} is missing answer letter "${letter}".`);
        }
      });

      if (this.letters.length - solutionLetters.length !== 3) {
        throw new Error(`Triple Stack puzzle ${this.id} must include exactly 3 decoys.`);
      }
    }

    createLetterPool() {
      return shuffle(this.letters).map((letter, index) => ({
        id: `${this.id}-${index}-${letter}`,
        letter,
        originalIndex: index,
        color: TILE_COLORS.BLUE,
        placedWordIndex: null,
        placedSlotIndex: null
      }));
    }
  }

  class StackWordsLogic {
    constructor(puzzles) {
      this.puzzles = puzzles.map((puzzle) => new StackWordsPuzzleModel(puzzle));
      this.resetLimit = 3;
      this.lifeLimit = 3;
      this.currentPuzzleIndex = 0;
      this.state = null;
      this.message = "Build all three words, then submit the full attempt.";
      this.messageTone = "neutral";
    }

    get currentPuzzle() {
      return this.puzzles[this.currentPuzzleIndex];
    }

    get availableResets() {
      return Math.max(0, this.resetLimit - this.state.resetsUsed);
    }

    get livesRemaining() {
      return Math.max(0, this.state.livesRemaining);
    }

    createEmptyGuesses() {
      return this.currentPuzzle.lengths.map((length) => Array(length).fill(null));
    }

    startPuzzle(index = this.currentPuzzleIndex) {
      this.currentPuzzleIndex = (index + this.puzzles.length) % this.puzzles.length;
      this.state = {
        letters: this.currentPuzzle.createLetterPool(),
        guesses: this.createEmptyGuesses(),
        lastFeedbackRows: this.currentPuzzle.lengths.map((length) => Array(length).fill(null)),
        activeWordIndex: 0,
        resetsUsed: 0,
        livesRemaining: this.lifeLimit,
        completed: false,
        solved: false,
        gaveUp: false,
        failed: false,
        outOfLives: false,
        lastAttemptWords: []
      };
      this.setMessage("Build all three words, then submit the full attempt.", "neutral");
      return this.getViewModel();
    }

    nextPuzzle() {
      return this.startPuzzle(this.currentPuzzleIndex + 1);
    }

    setMessage(text, tone = "neutral") {
      this.message = text;
      this.messageTone = tone;
    }

    getLetterById(id) {
      return this.state.letters.find((letter) => letter.id === id) || null;
    }

    getGuessWord(wordIndex) {
      return this.state.guesses[wordIndex]
        .map((tileId) => this.getLetterById(tileId))
        .filter(Boolean)
        .map((tile) => tile.letter)
        .join("");
    }

    getAttemptWords() {
      return this.state.guesses.map((_, wordIndex) => this.getGuessWord(wordIndex));
    }

    setActiveWord(index) {
      if (!this.state || this.state.completed) {
        return this.getViewModel();
      }
      this.state.activeWordIndex = Math.max(0, Math.min(index, this.state.guesses.length - 1));
      this.setMessage(`Editing the ${this.currentPuzzle.lengths[this.state.activeWordIndex]}-letter word.`, "neutral");
      return this.getViewModel();
    }

    removeTileFromGuess(tileId) {
      for (let wordIndex = 0; wordIndex < this.state.guesses.length; wordIndex += 1) {
        const slotIndex = this.state.guesses[wordIndex].indexOf(tileId);
        if (slotIndex >= 0) {
          this.state.guesses[wordIndex][slotIndex] = null;
          const tile = this.getLetterById(tileId);
          if (tile) {
            tile.placedWordIndex = null;
            tile.placedSlotIndex = null;
          }
          return true;
        }
      }
      return false;
    }

    toggleLetter(id) {
      if (!this.state || this.state.completed) {
        return this.getViewModel();
      }

      const entry = this.getLetterById(id);
      if (!entry) {
        return this.getViewModel();
      }

      if (entry.placedWordIndex != null) {
        this.removeTileFromGuess(id);
        this.setMessage(`Returned ${entry.letter} to the pool.`, "neutral");
        return this.getViewModel();
      }

      const activeGuess = this.state.guesses[this.state.activeWordIndex];
      const nextSlotIndex = activeGuess.indexOf(null);
      if (nextSlotIndex === -1) {
        this.setMessage(`That row already has ${activeGuess.length} letters.`, "error");
        return this.getViewModel();
      }

      activeGuess[nextSlotIndex] = id;
      entry.placedWordIndex = this.state.activeWordIndex;
      entry.placedSlotIndex = nextSlotIndex;
      this.setMessage(`Building the ${activeGuess.length}-letter word.`, "neutral");
      return this.getViewModel();
    }

    removeLastLetter() {
      if (!this.state || this.state.completed) {
        return this.getViewModel();
      }

      const activeGuess = this.state.guesses[this.state.activeWordIndex];
      let removed = false;
      for (let index = activeGuess.length - 1; index >= 0; index -= 1) {
        if (!activeGuess[index]) {
          continue;
        }
        this.removeTileFromGuess(activeGuess[index]);
        removed = true;
        break;
      }

      if (!removed) {
        this.setMessage("No letters placed in that word yet.", "error");
        return this.getViewModel();
      }

      this.setMessage(`Editing the ${activeGuess.length}-letter word.`, "neutral");
      return this.getViewModel();
    }

    removeSelectedLetterAt(wordIndex, slotIndex) {
      if (!this.state || this.state.completed) {
        return this.getViewModel();
      }

      const tileId = this.state.guesses[wordIndex]?.[slotIndex];
      if (!tileId) {
        this.state.activeWordIndex = wordIndex;
        this.setMessage(`Editing the ${this.currentPuzzle.lengths[wordIndex]}-letter word.`, "neutral");
        return this.getViewModel();
      }

      this.removeTileFromGuess(tileId);
      this.state.activeWordIndex = wordIndex;
      this.setMessage(`Editing the ${this.currentPuzzle.lengths[wordIndex]}-letter word.`, "neutral");
      return this.getViewModel();
    }

    clearPlacementsForNextAttempt() {
      // Reset only the current placement state. Tile colors persist so the most recent
      // evaluation still follows each tile back into the pool on the next attempt.
      // The guess rows clear after every attempt so availability is only communicated
      // through the pool once letters return home.
      this.state.guesses = this.createEmptyGuesses();
      this.state.lastFeedbackRows = this.currentPuzzle.lengths.map((length) => Array(length).fill(null));
      this.state.letters.forEach((tile) => {
        tile.placedWordIndex = null;
        tile.placedSlotIndex = null;
      });
    }

    resetBoardForRetry() {
      const resetsUsed = this.state.resetsUsed;
      const livesRemaining = this.state.livesRemaining;
      this.state = {
        letters: this.currentPuzzle.createLetterPool(),
        guesses: this.createEmptyGuesses(),
        lastFeedbackRows: this.currentPuzzle.lengths.map((length) => Array(length).fill(null)),
        activeWordIndex: 0,
        resetsUsed,
        livesRemaining,
        completed: false,
        solved: false,
        gaveUp: false,
        failed: false,
        outOfLives: false,
        lastAttemptWords: []
      };
      this.setMessage("Fresh board. Colors cleared and letters reset.", "neutral");
    }

    evaluateWord(guess, target) {
      // Evaluate each word independently. Because the puzzle forbids duplicate letters,
      // the Wordle-style pass can stay simple: green exact, orange same word wrong slot,
      // red not in that specific word.
      return guess.split("").map((letter, index) => {
        if (target[index] === letter) {
          return TILE_COLORS.GREEN;
        }
        if (target.includes(letter)) {
          return TILE_COLORS.ORANGE;
        }
        return TILE_COLORS.RED;
      });
    }

    submitCurrentWord() {
      if (!this.state || this.state.completed) {
        return this.getViewModel();
      }

      const incompleteWordIndex = this.state.guesses.findIndex((guessRow) => guessRow.includes(null));
      if (incompleteWordIndex >= 0) {
        this.state.activeWordIndex = incompleteWordIndex;
        this.setMessage(`Fill the ${this.currentPuzzle.lengths[incompleteWordIndex]}-letter word before submitting.`, "error");
        return this.getViewModel();
      }

      const attemptWords = this.getAttemptWords();
      this.state.lastAttemptWords = [...attemptWords];

      const evaluations = attemptWords.map((guess, wordIndex) => this.evaluateWord(guess, this.currentPuzzle.solution[wordIndex]));
      this.state.lastFeedbackRows = attemptWords.map((guess, wordIndex) => (
        guess.split("").map((letter, slotIndex) => ({
          letter,
          color: evaluations[wordIndex][slotIndex]
        }))
      ));

      // Latest usage wins: each used tile takes the color from its most recent placement,
      // even if that means overwriting an older green/orange/red state from a prior guess.
      this.state.guesses.forEach((guessRow, wordIndex) => {
        guessRow.forEach((tileId, slotIndex) => {
          const tile = this.getLetterById(tileId);
          if (!tile) {
            return;
          }
          tile.color = evaluations[wordIndex][slotIndex];
        });
      });

      const solved = attemptWords.every((word, index) => word === this.currentPuzzle.solution[index]);
      this.clearPlacementsForNextAttempt();

      if (solved) {
        this.state.completed = true;
        this.state.solved = true;
        this.state.failed = false;
        this.state.outOfLives = false;
        this.setMessage("Puzzle solved.", "success");
        return this.getViewModel();
      }

      this.state.livesRemaining = Math.max(0, this.state.livesRemaining - 1);
      this.state.failed = true;
      this.state.outOfLives = this.state.livesRemaining <= 0;

      if (this.state.outOfLives) {
        this.state.completed = true;
        this.setMessage("Out of lives. That full attempt did not solve the puzzle.", "error");
        return this.getViewModel();
      }

      this.setMessage(
        `Attempt scored. ${this.state.livesRemaining} live${this.state.livesRemaining === 1 ? "" : "s"} left.`,
        "error"
      );
      return this.getViewModel();
    }

    resetPuzzle() {
      if (!this.state || this.availableResets <= 0) {
        this.setMessage("No resets left.", "error");
        return this.getViewModel();
      }

      const resetsUsed = this.state.resetsUsed + 1;
      const livesRemaining = this.state.livesRemaining;
      this.state = {
        letters: this.currentPuzzle.createLetterPool(),
        guesses: this.createEmptyGuesses(),
        lastFeedbackRows: this.currentPuzzle.lengths.map((length) => Array(length).fill(null)),
        activeWordIndex: 0,
        resetsUsed,
        livesRemaining,
        completed: false,
        solved: false,
        gaveUp: false,
        failed: false,
        outOfLives: false,
        lastAttemptWords: []
      };
      this.setMessage(`Puzzle reset. ${this.availableResets} reset${this.availableResets === 1 ? "" : "s"} left.`, "neutral");
      return this.getViewModel();
    }

    giveUp() {
      if (!this.state || this.state.completed) {
        return this.getViewModel();
      }

      this.clearPlacementsForNextAttempt();
      this.state.completed = true;
      this.state.gaveUp = true;
      this.state.solved = false;
      this.state.failed = false;
      this.state.outOfLives = false;
      this.setMessage("Answer revealed.", "error");
      return this.getViewModel();
    }

    getStarsEarned() {
      if (!this.state) {
        return 3;
      }
      if (this.state.resetsUsed === 0) {
        return 3;
      }
      if (this.state.resetsUsed <= 2) {
        return 2;
      }
      return 1;
    }

    getViewModel() {
      const rows = this.currentPuzzle.lengths.map((length, wordIndex) => {
        const currentGuess = this.state.guesses[wordIndex];
        const feedbackRow = this.state.lastFeedbackRows[wordIndex];
        return {
          index: wordIndex,
          length,
          active: !this.state.completed && this.state.activeWordIndex === wordIndex,
          cells: Array.from({ length }, (_, slotIndex) => {
            const tileId = currentGuess[slotIndex];
            if (tileId) {
              const tile = this.getLetterById(tileId);
              return {
                tileId,
                letter: tile?.letter || "",
                color: TILE_COLORS.BLUE,
                filled: true,
                feedback: false
              };
            }

            const feedback = feedbackRow[slotIndex];
            if (feedback) {
              return {
                tileId: null,
                letter: feedback.letter,
                color: feedback.color,
                filled: true,
                feedback: true
              };
            }

            return {
              tileId: null,
              letter: "",
              color: TILE_COLORS.BLUE,
              filled: false,
              feedback: false
            };
          })
        };
      });

      return {
        puzzleIndex: this.currentPuzzleIndex,
        puzzleCount: this.puzzles.length,
        rows,
        resetsUsed: this.state.resetsUsed,
        resetsRemaining: this.availableResets,
        livesRemaining: this.livesRemaining,
        completed: this.state.completed,
        solved: this.state.solved,
        gaveUp: this.state.gaveUp,
        failed: this.state.failed,
        outOfLives: this.state.outOfLives,
        message: this.message,
        messageTone: this.messageTone,
        stars: this.getStarsEarned(),
        canDelete: this.state.guesses[this.state.activeWordIndex].some(Boolean),
        solutionWords: [...this.currentPuzzle.solution],
        lastAttemptWords: [...this.state.lastAttemptWords],
        letters: this.state.letters
          .slice()
          .sort((left, right) => left.originalIndex - right.originalIndex)
          .map((entry) => ({
            ...entry,
            placed: entry.placedWordIndex != null
          }))
      };
    }
  }

  class StackWordsScreen {
    constructor(elements, logic, callbacks = {}) {
      this.elements = elements;
      this.logic = logic;
      this.callbacks = callbacks;
      this.bindEvents();
    }

    bindEvents() {
      this.elements.resetButton.addEventListener("click", () => {
        this.render(this.logic.resetPuzzle());
      });

      this.elements.submitButton.addEventListener("click", () => {
        this.render(this.logic.submitCurrentWord());
      });

      this.elements.backButton.addEventListener("click", () => {
        if (typeof this.callbacks.onBack === "function") {
          this.callbacks.onBack();
        }
      });

      this.elements.deleteButton.addEventListener("click", () => {
        this.render(this.logic.removeLastLetter());
      });

      this.elements.giveUpButton.addEventListener("click", () => {
        this.render(this.logic.giveUp());
      });

      this.elements.nextButton.addEventListener("click", () => {
        if (this.logic.getViewModel().outOfLives || this.logic.getViewModel().gaveUp || this.logic.getViewModel().solved) {
          this.render(this.logic.nextPuzzle());
          return;
        }
        this.render(this.logic.getViewModel());
      });

      this.elements.menuButton.addEventListener("click", () => {
        if (typeof this.callbacks.onMenu === "function") {
          this.callbacks.onMenu();
        }
      });
    }

    start() {
      this.render(this.logic.startPuzzle(this.logic.currentPuzzleIndex));
    }

    render(view) {
      this.elements.puzzleLabel.textContent = `Puzzle ${view.puzzleIndex + 1} of ${view.puzzleCount}`;
      this.elements.message.textContent = view.message;
      this.elements.message.dataset.tone = view.messageTone;
      if (this.elements.debugAnswer) {
        this.elements.debugAnswer.textContent = `Answer: ${view.solutionWords.join(" / ")}`;
      }
      this.elements.resetButton.disabled = view.resetsRemaining <= 0 || view.completed;
      this.elements.deleteButton.disabled = !view.canDelete || view.completed;
      this.elements.giveUpButton.disabled = view.completed;
      this.elements.submitButton.disabled = view.completed;
      this.elements.nextButton.hidden = !view.completed;

      this.renderLivesDots(view);
      this.renderResetDots(view);
      this.renderSlots(view);
      this.renderPool(view);
      this.renderResults(view);
    }

    renderLivesDots(view) {
      this.elements.livesDots.innerHTML = "";
      for (let index = 0; index < 3; index += 1) {
        const dot = document.createElement("span");
        dot.className = `stackwords-reset-dot${index < view.livesRemaining ? " available" : ""}`;
        this.elements.livesDots.appendChild(dot);
      }
    }

    renderResetDots(view) {
      this.elements.resetDots.innerHTML = "";
      for (let index = 0; index < 3; index += 1) {
        const dot = document.createElement("span");
        dot.className = `stackwords-reset-dot${index < view.resetsRemaining ? " available" : ""}`;
        this.elements.resetDots.appendChild(dot);
      }
    }

    renderSlots(view) {
      this.elements.slots.innerHTML = "";

      view.rows.forEach((rowData) => {
        const row = document.createElement("div");
        row.className = `stackwords-slot word-${rowData.index}${rowData.active ? " active" : ""}`;
        row.addEventListener("click", () => {
          this.render(this.logic.setActiveWord(rowData.index));
        });

        const label = document.createElement("div");
        label.className = "stackwords-slot-label";
        label.textContent = `${rowData.length} Letters`;

        const letters = document.createElement("div");
        letters.className = "stackwords-slot-letters";

        rowData.cells.forEach((cellData, slotIndex) => {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = `stackwords-box${cellData.filled ? "" : " empty"}${cellData.feedback ? ` feedback-${cellData.color}` : ""}`;
          cell.textContent = cellData.letter || "_";
          if (cellData.tileId) {
            cell.addEventListener("click", (event) => {
              event.stopPropagation();
              this.render(this.logic.removeSelectedLetterAt(rowData.index, slotIndex));
            });
          } else {
            cell.addEventListener("click", (event) => {
              event.stopPropagation();
              this.render(this.logic.setActiveWord(rowData.index));
            });
          }
          letters.appendChild(cell);
        });

        row.append(label, letters);
        this.elements.slots.appendChild(row);
      });
    }

    renderPool(view) {
      this.elements.pool.innerHTML = "";

      view.letters.forEach((entry) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `stackwords-letter feedback-${entry.color}${entry.placed ? " placed" : ""}`;
        button.textContent = entry.letter;
        button.disabled = view.completed;
        button.addEventListener("click", () => {
          this.render(this.logic.toggleLetter(entry.id));
        });
        this.elements.pool.appendChild(button);
      });
    }

    renderResults(view) {
      const solutionLine = `Solution: ${view.solutionWords.join(" / ")}`;
      this.elements.resultsPanel.hidden = !view.completed;
      this.elements.root.classList.toggle("results-open", view.completed);
      if (!view.completed) {
        this.elements.solutionText.hidden = true;
        this.elements.revealList.hidden = true;
        this.elements.stars.hidden = false;
        return;
      }

      const stars = view.stars;
      this.elements.resultsTitle.textContent = view.gaveUp
        ? "Answer Revealed"
        : view.outOfLives
          ? "Out Of Lives"
          : "Puzzle Solved";
      this.elements.resultsSummary.textContent = view.gaveUp
        ? solutionLine
        : view.outOfLives
          ? `Final attempt: ${view.lastAttemptWords.join(" / ")}`
          : stars === 3
            ? "Perfect clear. No resets used."
            : stars === 2
              ? "Clean solve. A couple resets spent."
              : "Solved with grit. Last reset counted.";

      this.elements.solutionText.hidden = !(view.gaveUp || view.outOfLives);
      this.elements.solutionText.textContent = view.gaveUp || view.outOfLives ? solutionLine : "";
      this.elements.revealList.hidden = !(view.gaveUp || view.outOfLives);
      this.elements.revealList.innerHTML = "";
      if (view.gaveUp || view.outOfLives) {
        view.solutionWords.forEach((word, index) => {
          const card = document.createElement("div");
          card.className = "results-score winner";
          card.innerHTML = `<div><strong>${word}</strong><span>${word.length} letters</span></div><strong>#${index + 1}</strong>`;
          this.elements.revealList.appendChild(card);
        });
      }

      this.elements.stars.hidden = !!view.gaveUp || !!view.outOfLives;
      this.elements.stars.innerHTML = "";
      for (let index = 0; index < 3; index += 1) {
        const star = document.createElement("span");
        star.className = `stackwords-star${index < stars ? " earned" : ""}`;
        star.textContent = "*";
        this.elements.stars.appendChild(star);
      }

      this.elements.nextButton.textContent = "Next Puzzle";
    }
  }

  function createStackWordsController(config) {
    let screen = null;
    let loadPromise = null;

    async function ensureScreen() {
      if (screen) {
        return screen;
      }

      if (!loadPromise) {
        loadPromise = fetch("./data/stackwords-puzzles.json")
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Triple Stack puzzles failed to load (${response.status}).`);
            }
            return response.json();
          })
          .then((puzzles) => {
            const logic = new StackWordsLogic(puzzles);
            screen = new StackWordsScreen(config.elements, logic, config.callbacks);
            return screen;
          });
      }

      return loadPromise;
    }

    return {
      async start() {
        const readyScreen = await ensureScreen();
        readyScreen.start();
      }
    };
  }

  window.StackWordsPuzzleModel = StackWordsPuzzleModel;
  window.StackWordsLogic = StackWordsLogic;
  window.StackWordsScreen = StackWordsScreen;
  window.StackWordsApp = {
    createController: createStackWordsController
  };
}());
