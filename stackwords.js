(function () {
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
      if (this.lengths.length !== 3 || this.solution.length !== 3) {
        throw new Error(`StackWords puzzle ${this.id} must contain exactly 3 words.`);
      }

      this.solution.forEach((word, index) => {
        if (word.length !== this.lengths[index]) {
          throw new Error(`StackWords puzzle ${this.id} has a length mismatch.`);
        }
      });

      const totalLength = this.lengths.reduce((sum, length) => sum + length, 0);
      if (totalLength !== this.letters.length) {
        throw new Error(`StackWords puzzle ${this.id} must use every letter exactly once.`);
      }
    }

    createLetterPool() {
      return shuffle(this.letters).map((letter, index) => ({
        id: `${this.id}-${index}-${letter}`,
        letter,
        consumed: false
      }));
    }
  }

  class StackWordsLogic {
    constructor(puzzles, wordValidator) {
      this.puzzles = puzzles.map((puzzle) => new StackWordsPuzzleModel(puzzle));
      this.wordValidator = wordValidator;
      this.resetLimit = 3;
      this.currentPuzzleIndex = 0;
      this.state = null;
      this.message = "Solve the smallest word first.";
      this.messageTone = "neutral";
    }

    get currentPuzzle() {
      return this.puzzles[this.currentPuzzleIndex];
    }

    get activeWordIndex() {
      if (!this.state) {
        return 0;
      }
      const unsolvedIndex = this.state.solvedWords.findIndex((word) => !word);
      return unsolvedIndex === -1 ? this.state.solvedWords.length - 1 : unsolvedIndex;
    }

    get activeLength() {
      return this.currentPuzzle.lengths[this.activeWordIndex];
    }

    get availableResets() {
      return Math.max(0, this.resetLimit - this.state.resetsUsed);
    }

    get currentGuess() {
      return this.state.selectedIds
        .map((id) => this.state.letters.find((letter) => letter.id === id))
        .filter(Boolean)
        .map((entry) => entry.letter)
        .join("");
    }

    startPuzzle(index = this.currentPuzzleIndex) {
      this.currentPuzzleIndex = (index + this.puzzles.length) % this.puzzles.length;
      this.state = {
        letters: this.currentPuzzle.createLetterPool(),
        selectedIds: [],
        solvedWords: Array(this.currentPuzzle.solution.length).fill(""),
        resetsUsed: 0,
        completed: false,
        gaveUp: false
      };
      this.setMessage(`Build the ${this.activeLength}-letter word first.`, "neutral");
      return this.getViewModel();
    }

    nextPuzzle() {
      return this.startPuzzle(this.currentPuzzleIndex + 1);
    }

    setMessage(text, tone = "neutral") {
      this.message = text;
      this.messageTone = tone;
    }

    toggleLetter(id) {
      if (!this.state || this.state.completed) {
        return this.getViewModel();
      }

      const entry = this.state.letters.find((letter) => letter.id === id);
      if (!entry || entry.consumed) {
        return this.getViewModel();
      }

      const selectedIndex = this.state.selectedIds.indexOf(id);
      if (selectedIndex >= 0) {
        this.state.selectedIds.splice(selectedIndex, 1);
        this.setMessage(`Editing the ${this.activeLength}-letter slot.`, "neutral");
        return this.getViewModel();
      }

      if (this.state.selectedIds.length >= this.activeLength) {
        this.setMessage(`That slot only takes ${this.activeLength} letters.`, "error");
        return this.getViewModel();
      }

      this.state.selectedIds.push(id);
      this.setMessage(`Editing the ${this.activeLength}-letter slot.`, "neutral");
      return this.getViewModel();
    }

    removeLastLetter() {
      if (!this.state || this.state.completed) {
        return this.getViewModel();
      }

      if (this.state.selectedIds.length === 0) {
        this.setMessage("No letters selected yet.", "error");
        return this.getViewModel();
      }

      this.state.selectedIds.pop();
      this.setMessage(`Editing the ${this.activeLength}-letter slot.`, "neutral");
      return this.getViewModel();
    }

    removeSelectedLetterAt(index) {
      if (!this.state || this.state.completed) {
        return this.getViewModel();
      }

      if (index < 0 || index >= this.state.selectedIds.length) {
        return this.getViewModel();
      }

      this.state.selectedIds.splice(index, 1);
      this.setMessage(`Editing the ${this.activeLength}-letter slot.`, "neutral");
      return this.getViewModel();
    }

    clearSelectedLetters(message = `Try the ${this.activeLength}-letter word again.`) {
      this.state.selectedIds = [];
      this.setMessage(message, "error");
      return this.getViewModel();
    }

    submitCurrentWord() {
      if (!this.state || this.state.completed) {
        return this.getViewModel();
      }

      if (this.state.selectedIds.length !== this.activeLength) {
        this.setMessage(`Fill all ${this.activeLength} boxes before submitting.`, "error");
        return this.getViewModel();
      }

      const guess = this.currentGuess;
      const target = this.currentPuzzle.solution[this.activeWordIndex];

      if (guess === target) {
        this.state.solvedWords[this.activeWordIndex] = guess;
        this.state.letters.forEach((entry) => {
          if (this.state.selectedIds.includes(entry.id)) {
            entry.consumed = true;
          }
        });
        this.state.selectedIds = [];

        if (this.state.solvedWords.every(Boolean)) {
          this.state.completed = true;
          this.setMessage("Puzzle solved.", "success");
        } else {
          this.setMessage(`Word locked in. Next: ${this.activeLength}-letter word.`, "success");
        }

        return this.getViewModel();
      }

      const isValidWord = typeof this.wordValidator === "function"
        ? this.wordValidator(guess)
        : false;

      if (!isValidWord) {
        return this.clearSelectedLetters("Not a valid word. Try that slot again.");
      }

      return this.clearSelectedLetters("That word does not fit this puzzle. Try again.");
    }

    resetPuzzle() {
      if (!this.state || this.availableResets <= 0) {
        this.setMessage("No resets left.", "error");
        return this.getViewModel();
      }

      const resetsUsed = this.state.resetsUsed + 1;
      this.state = {
        letters: this.currentPuzzle.createLetterPool(),
        selectedIds: [],
        solvedWords: Array(this.currentPuzzle.solution.length).fill(""),
        resetsUsed,
        completed: false,
        gaveUp: false
      };
      this.setMessage(`Puzzle reset. ${this.availableResets} reset${this.availableResets === 1 ? "" : "s"} left.`, "neutral");
      return this.getViewModel();
    }

    giveUp() {
      if (!this.state || this.state.completed) {
        return this.getViewModel();
      }

      this.state.solvedWords = [...this.currentPuzzle.solution];
      this.state.selectedIds = [];
      this.state.completed = true;
      this.state.gaveUp = true;
      this.state.letters.forEach((entry) => {
        entry.consumed = true;
      });
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
      return {
        puzzleIndex: this.currentPuzzleIndex,
        puzzleCount: this.puzzles.length,
        activeWordIndex: this.activeWordIndex,
        activeLength: this.activeLength,
        letters: this.state.letters.map((entry) => ({
          ...entry,
          selected: this.state.selectedIds.includes(entry.id)
        })),
        solvedWords: [...this.state.solvedWords],
        selectedWord: this.currentGuess,
        lengths: [...this.currentPuzzle.lengths],
        resetsUsed: this.state.resetsUsed,
        resetsRemaining: this.availableResets,
        completed: this.state.completed,
        gaveUp: this.state.gaveUp,
        message: this.message,
        messageTone: this.messageTone,
        stars: this.getStarsEarned(),
        canDelete: this.state.selectedIds.length > 0,
        solutionWords: [...this.currentPuzzle.solution]
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
        this.render(this.logic.nextPuzzle());
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
      this.elements.resetButton.disabled = view.resetsRemaining <= 0 || view.completed;
      this.elements.deleteButton.disabled = !view.canDelete || view.completed;
      this.elements.giveUpButton.disabled = view.completed;

      this.renderResetDots(view);
      this.renderSlots(view);
      this.renderPool(view);
      this.renderResults(view);
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

      view.lengths.forEach((length, index) => {
        const row = document.createElement("div");
        const solvedWord = view.solvedWords[index];
        const isActive = !view.completed && index === view.activeWordIndex;
        row.className = `stackwords-slot${solvedWord ? " solved" : ""}${isActive ? " active" : ""}`;

        const label = document.createElement("div");
        label.className = "stackwords-slot-label";
        label.textContent = `${length} Letters`;

        const letters = document.createElement("div");
        letters.className = "stackwords-slot-letters";

        const activePreview = isActive ? view.selectedWord.split("") : [];
        for (let charIndex = 0; charIndex < length; charIndex += 1) {
          const cell = document.createElement("button");
          cell.type = "button";
          const char = solvedWord
            ? solvedWord[charIndex]
            : activePreview[charIndex] || "_";
          cell.className = `stackwords-box${char === "_" ? " empty" : ""}`;
          cell.textContent = char;
          cell.disabled = !!solvedWord || !isActive || char === "_";
          if (!solvedWord && isActive && char !== "_") {
            cell.addEventListener("click", () => {
              this.render(this.logic.removeSelectedLetterAt(charIndex));
            });
          }
          letters.appendChild(cell);
        }

        row.append(label, letters);
        this.elements.slots.appendChild(row);
      });
    }

    renderPool(view) {
      this.elements.pool.innerHTML = "";

      view.letters.forEach((entry) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `stackwords-letter${entry.selected ? " selected" : ""}${entry.consumed ? " consumed" : ""}`;
        button.textContent = entry.letter;
        button.disabled = entry.consumed || view.completed;
        button.addEventListener("click", () => {
          this.render(this.logic.toggleLetter(entry.id));
        });
        this.elements.pool.appendChild(button);
      });
    }

    renderResults(view) {
      this.elements.resultsPanel.hidden = !view.completed;
      this.elements.root.classList.toggle("results-open", view.completed);
      if (!view.completed) {
        this.elements.solutionText.hidden = true;
        this.elements.revealList.hidden = true;
        this.elements.stars.hidden = false;
        return;
      }

      const stars = view.stars;
      this.elements.resultsTitle.textContent = view.gaveUp ? "Answer Revealed" : "Puzzle Solved";
      this.elements.resultsSummary.textContent = view.gaveUp
        ? "Here was the full solution."
        : stars === 3
          ? "Perfect clear. No resets used."
          : stars === 2
            ? "Clean solve. A couple resets spent."
            : "Solved with grit. Last reset counted.";

      this.elements.solutionText.hidden = !view.gaveUp;
      this.elements.solutionText.textContent = view.gaveUp
        ? `Solution: ${view.solutionWords.join(" / ")}`
        : "";
      this.elements.revealList.hidden = !view.gaveUp;
      this.elements.revealList.innerHTML = "";
      if (view.gaveUp) {
        view.solutionWords.forEach((word, index) => {
          const card = document.createElement("div");
          card.className = "results-score winner";
          card.innerHTML = `<div><strong>${word}</strong><span>${word.length} letters</span></div><strong>#${index + 1}</strong>`;
          this.elements.revealList.appendChild(card);
        });
      }

      this.elements.stars.hidden = !!view.gaveUp;
      this.elements.stars.innerHTML = "";
      for (let index = 0; index < 3; index += 1) {
        const star = document.createElement("span");
        star.className = `stackwords-star${index < stars ? " earned" : ""}`;
        star.textContent = "*";
        this.elements.stars.appendChild(star);
      }
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
              throw new Error(`StackWords puzzles failed to load (${response.status}).`);
            }
            return response.json();
          })
          .then((puzzles) => {
            const logic = new StackWordsLogic(puzzles, config.wordValidator);
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
