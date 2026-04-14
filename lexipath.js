(function () {
  function normalizeWord(word) {
    return String(word || "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  }

  function letterCounts(word) {
    return word.split("").reduce((counts, letter) => {
      counts[letter] = (counts[letter] || 0) + 1;
      return counts;
    }, {});
  }

  function sameMultiset(left, right) {
    if (left.length !== right.length) {
      return false;
    }
    const leftCounts = letterCounts(left);
    const rightCounts = letterCounts(right);
    const letters = new Set([...Object.keys(leftCounts), ...Object.keys(rightCounts)]);
    for (const letter of letters) {
      if ((leftCounts[letter] || 0) !== (rightCounts[letter] || 0)) {
        return false;
      }
    }
    return true;
  }

  function isSubsequence(source, target) {
    let sourceIndex = 0;
    let targetIndex = 0;
    while (sourceIndex < source.length && targetIndex < target.length) {
      if (source[sourceIndex] === target[targetIndex]) {
        sourceIndex += 1;
      }
      targetIndex += 1;
    }
    return sourceIndex === source.length;
  }

  function deletionSignatures(word) {
    const sorted = word.split("").sort().join("");
    const signatures = new Set();
    for (let index = 0; index < sorted.length; index += 1) {
      signatures.add(sorted.slice(0, index) + sorted.slice(index + 1));
    }
    return signatures;
  }

  function shuffleArray(values) {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function samplePuzzles(puzzles, count) {
    return shuffleArray(puzzles).slice(0, Math.min(count, puzzles.length));
  }

  function capitalizeWord(word) {
    const normalized = String(word || "").trim();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase() : "";
  }

  class LexiPathMoveValidation {
    static isBlueMove(previous, next) {
      return previous.length === next.length
        && previous !== next
        && sameMultiset(previous, next);
    }

    static isYellowMove(previous, next) {
      if (next.length !== previous.length + 1) {
        return false;
      }
      return isSubsequence(previous, next);
    }

    static isGreenMove(previous, next) {
      if (next.length !== previous.length + 1) {
        return false;
      }
      return [...deletionSignatures(next)].includes(previous.split("").sort().join(""));
    }

    static isRedMove(previous, next) {
      if (previous.length !== next.length || previous === next) {
        return false;
      }
      let differences = 0;
      for (let index = 0; index < previous.length; index += 1) {
        if (previous[index] !== next[index]) {
          differences += 1;
          if (differences > 1) {
            return false;
          }
        }
      }
      return differences === 1;
    }

    static validateMove(previous, next, moveCode) {
      const normalizedPrevious = normalizeWord(previous);
      const normalizedNext = normalizeWord(next);
      if (!normalizedNext) {
        return { valid: false, message: "Enter a word for this step." };
      }

      const handlers = {
        B: () => ({
          valid: this.isBlueMove(normalizedPrevious, normalizedNext),
          message: "This step should keep the same letters and rearrange them."
        }),
        Y: () => ({
          valid: this.isYellowMove(normalizedPrevious, normalizedNext),
          message: "This step should add one letter without rearranging the existing order."
        }),
        G: () => ({
          valid: this.isGreenMove(normalizedPrevious, normalizedNext),
          message: "This step should add one letter and allow rearranging."
        }),
        R: () => ({
          valid: this.isRedMove(normalizedPrevious, normalizedNext),
          message: "This step should replace one letter without rearranging."
        })
      };

      const result = handlers[moveCode]?.() || { valid: false, message: "Unknown move rule." };
      return {
        valid: result.valid,
        message: result.valid ? "This follows the rule." : result.message
      };
    }
  }

  class LexiPathPuzzleLoader {
    constructor(files) {
      this.files = files;
    }

    async load() {
      const payloads = await Promise.all(this.files.map((file) => fetch(file).then((response) => {
        if (!response.ok) {
          throw new Error(`LexiPath data failed to load from ${file}.`);
        }
        return response.json().then((json) => ({ file, json }));
      })));

      return payloads.flatMap(({ file, json }) => (
        Array.isArray(json?.chains)
          ? json.chains.map((chain, index) => ({ chain, index, file }))
          : []
      ))
        .map(({ chain, index, file }) => this.normalizeChain(chain, index, file))
        .filter(Boolean);
    }

    normalizeChain(chain, index, sourceFile = "") {
      const sequence = Array.isArray(chain?.sequence) ? chain.sequence.map(normalizeWord).filter(Boolean) : [];
      const pattern = Array.isArray(chain?.pattern) ? chain.pattern.map((step) => String(step || "").toUpperCase()) : [];
      if (sequence.length < 2 || pattern.length !== sequence.length - 1) {
        console.warn(`Skipping LexiPath chain ${chain?.id || index + 1} from ${sourceFile}: sequence/pattern length mismatch.`);
        return null;
      }

      if (pattern.some((step) => !["B", "Y", "G", "R"].includes(step))) {
        console.warn(`Skipping LexiPath chain ${chain?.id || index + 1} from ${sourceFile}: unknown move code present.`);
        return null;
      }

      for (let patternIndex = 0; patternIndex < pattern.length - 1; patternIndex += 1) {
        if (pattern[patternIndex] === "B" && pattern[patternIndex + 1] === "B") {
          console.warn(
            `Skipping LexiPath chain ${chain?.id || index + 1} from ${sourceFile}: adjacent blue moves are not allowed.`
          );
          return null;
        }
      }

      const normalized = {
        id: chain?.id || `lexi_${index + 1}`,
        sequence,
        pattern,
        start: normalizeWord(chain?.start || sequence[0]),
        end: normalizeWord(chain?.end || sequence[sequence.length - 1]),
        difficulty: Number.isFinite(Number(chain?.difficulty)) ? Number(chain.difficulty) : null
      };

      if (normalized.start !== normalized.sequence[0] || normalized.end !== normalized.sequence[normalized.sequence.length - 1]) {
        console.warn(`Skipping LexiPath chain ${normalized.id} from ${sourceFile}: start/end do not match sequence bounds.`);
        return null;
      }

      for (let stepIndex = 0; stepIndex < normalized.pattern.length; stepIndex += 1) {
        const previous = normalized.sequence[stepIndex];
        const next = normalized.sequence[stepIndex + 1];
        const moveCode = normalized.pattern[stepIndex];
        const result = LexiPathMoveValidation.validateMove(previous, next, moveCode);
        if (!result.valid) {
          console.warn(
            `Skipping LexiPath chain ${normalized.id} from ${sourceFile}: ${previous} -> ${next} does not satisfy ${moveCode}.`
          );
          return null;
        }
      };

      return normalized;
    }
  }

  class LexiPathGame {
    constructor(puzzles, options = {}) {
      this.puzzles = puzzles;
      this.wordValidator = options.wordValidator;
      this.modeLabel = options.modeLabel || "Mixed Session";
      this.state = null;
      this.feedback = "Trace the chain and submit when it feels right.";
      this.feedbackTone = "neutral";
      this.lastValidatedArrow = -1;
    }

    get currentPuzzle() {
      if (!this.state) {
        return null;
      }
      return this.puzzles[this.state.puzzleIndex] || null;
    }

    resetPuzzleState(puzzleIndex = 0) {
      const puzzle = this.puzzles[puzzleIndex];
      this.state = {
        puzzleIndex,
        values: Array(Math.max(0, puzzle.sequence.length - 2)).fill(""),
        committed: Array(Math.max(0, puzzle.sequence.length - 2)).fill(false),
        solved: false,
        gaveUp: false,
        sessionComplete: false
      };
      this.lastValidatedArrow = -1;
    }

    startSession() {
      this.resetPuzzleState(0);
      this.feedback = "Trace the chain and submit when it feels right.";
      this.feedbackTone = "neutral";
      return this.getViewModel();
    }

    advancePuzzle() {
      if (!this.state) {
        return this.startSession();
      }
      if (this.state.sessionComplete) {
        return this.startSession();
      }

      const nextIndex = this.state.puzzleIndex + 1;
      if (nextIndex >= this.puzzles.length) {
        this.state.sessionComplete = true;
        return this.getViewModel();
      }

      this.resetPuzzleState(nextIndex);
      this.feedback = "Nice. Next path ready.";
      this.feedbackTone = "neutral";
      return this.getViewModel();
    }

    setValue(index, value) {
      if (!this.state || this.state.solved) {
        return this.getViewModel();
      }
      const normalized = normalizeWord(value);
      this.state.values[index] = normalized;
      this.state.committed[index] = !!normalized;
      this.feedback = normalized
        ? "Word locked. Click it again if you want to edit it."
        : "Slot cleared.";
      this.feedbackTone = "neutral";
      this.lastValidatedArrow = -1;
      return this.getViewModel();
    }

    unlockValue(index) {
      if (!this.state || this.state.solved) {
        return this.getViewModel();
      }
      this.state.committed[index] = false;
      this.feedback = "Editing reopened for that step.";
      this.feedbackTone = "neutral";
      this.lastValidatedArrow = -1;
      return this.getViewModel();
    }

    validateAround(index) {
      const puzzle = this.currentPuzzle;
      const entry = this.state.values[index];
      if (!entry) {
        return { valid: false, message: "Enter a word for this step.", tone: "neutral", arrowIndex: index };
      }

      if (typeof this.wordValidator === "function" && !this.wordValidator(entry)) {
        return { valid: false, message: "That word is not in the dictionary I loaded.", tone: "error", arrowIndex: index };
      }

      const previousWord = index === 0 ? puzzle.start : this.state.values[index - 1];
      if (!previousWord) {
        return { valid: false, message: "Fill the previous step first.", tone: "error", arrowIndex: index - 1 };
      }

      const incoming = LexiPathMoveValidation.validateMove(previousWord, entry, puzzle.pattern[index]);
      if (!incoming.valid) {
        return { valid: false, message: incoming.message, tone: "error", arrowIndex: index };
      }

      const nextExpected = index === this.state.values.length - 1 ? puzzle.end : this.state.values[index + 1];
      if (nextExpected) {
        const outgoing = LexiPathMoveValidation.validateMove(entry, nextExpected, puzzle.pattern[index + 1]);
        if (!outgoing.valid) {
          return { valid: false, message: "Good path so far.", tone: "success", arrowIndex: index };
        }
      }

      return { valid: true, message: "Good path so far.", tone: "success", arrowIndex: index };
    }

    getChainWords() {
      return [this.currentPuzzle.start, ...this.state.values, this.currentPuzzle.end];
    }

    validateFullChain() {
      const puzzle = this.currentPuzzle;
      const chain = this.getChainWords();

      for (let index = 0; index < this.state.values.length; index += 1) {
        const word = this.state.values[index];
        if (!word) {
          return { valid: false, exact: false, message: "Fill every intermediate slot before submitting.", tone: "error", arrowIndex: index };
        }
        if (typeof this.wordValidator === "function" && !this.wordValidator(word)) {
          return { valid: false, exact: false, message: `"${word}" is not in the dictionary I loaded.`, tone: "error", arrowIndex: index };
        }
      }

      for (let index = 0; index < puzzle.pattern.length; index += 1) {
        const result = LexiPathMoveValidation.validateMove(chain[index], chain[index + 1], puzzle.pattern[index]);
        if (!result.valid) {
          return { valid: false, exact: false, message: result.message, tone: "error", arrowIndex: index };
        }
      }

      const exact = this.state.values.every((word, index) => word === puzzle.sequence[index + 1]);
      return {
        valid: true,
        exact,
        message: exact ? "Success - exact chain solved." : "Success - alternate valid chain solved.",
        tone: "success",
        arrowIndex: puzzle.pattern.length - 1
      };
    }

    submit() {
      const result = this.validateFullChain();
      const finalPuzzle = this.state && this.state.puzzleIndex === this.puzzles.length - 1;
      this.feedback = result.message;
      this.feedbackTone = result.tone;
      this.lastValidatedArrow = result.arrowIndex;
      if (result.valid) {
        this.state.solved = true;
        if (finalPuzzle) {
          this.state.sessionComplete = true;
          this.feedback = result.exact
            ? "Success - exact chain solved. Congratulations, you cleared all 6 LexiPaths."
            : "Success - alternate valid chain solved. Congratulations, you cleared all 6 LexiPaths.";
        }
      }
      return this.getViewModel();
    }

    giveUp() {
      if (!this.state || this.state.solved) {
        return this.getViewModel();
      }

      const puzzle = this.currentPuzzle;
      const finalPuzzle = this.state.puzzleIndex === this.puzzles.length - 1;
      this.state.values = puzzle.sequence.slice(1, -1);
      this.state.committed = this.state.values.map(() => true);
      this.state.solved = true;
      this.state.gaveUp = true;
      this.state.sessionComplete = finalPuzzle;
      this.lastValidatedArrow = puzzle.pattern.length - 1;
      this.feedback = finalPuzzle
        ? "Authored chain revealed. Session complete."
        : "Authored chain revealed. Take a look, then move on when you're ready.";
      this.feedbackTone = "neutral";
      return this.getViewModel();
    }

    getViewModel() {
      if (!this.state) {
        return null;
      }

      const puzzle = this.currentPuzzle;
      const words = [puzzle.start, ...this.state.values, puzzle.end];
      const steps = [];

      for (let index = 0; index < words.length; index += 1) {
        const locked = index === 0 || index === words.length - 1;
        const value = words[index];

        steps.push({
          index,
          locked,
          label: index === 0 ? "Start" : index === words.length - 1 ? "End" : `Step ${index}`,
          value,
          committed: !locked ? !!this.state.committed[index - 1] : true,
          status: "",
          helper: "",
          moveAfter: puzzle.pattern[index] || null,
          pulseArrow: this.lastValidatedArrow === index
        });
      }

      const sessionIndex = this.state.puzzleIndex + 1;
      const sessionTotal = this.puzzles.length;
      const difficultyLabel = puzzle.sessionBucket ? `${capitalizeWord(puzzle.sessionBucket)} Path` : null;

      return {
        puzzleLabel: `Path ${sessionIndex} of ${sessionTotal}`,
        difficulty: difficultyLabel,
        solved: this.state.solved,
        gaveUp: !!this.state.gaveUp,
        sessionComplete: !!this.state.sessionComplete,
        feedback: this.feedback,
        feedbackTone: this.feedbackTone,
        nextButtonLabel: this.state.sessionComplete ? "Play Another Session" : "Next Puzzle",
        steps
      };
    }
  }

  class LexiPathScreen {
    constructor(elements, game, callbacks = {}) {
      this.elements = elements;
      this.game = game;
      this.callbacks = callbacks;
      this.draftValues = [];
      this.editingIndex = -1;
      this.bindEvents();
    }

    bindEvents() {
      this.elements.backButton.addEventListener("click", () => {
        this.callbacks.onBack?.();
      });
      this.elements.giveUpButton.addEventListener("click", () => {
        this.commitDrafts();
        this.render(this.game.giveUp());
      });
      this.elements.submitButton.addEventListener("click", () => {
        this.commitDrafts();
        this.render(this.game.submit());
      });
      this.elements.nextButton.addEventListener("click", () => {
        this.draftValues = [];
        this.editingIndex = -1;
        this.render(this.game.advancePuzzle());
      });
    }

    start() {
      this.draftValues = [];
      this.editingIndex = -1;
      this.render(this.game.startSession());
    }

    ensureDraftSize(count) {
      if (this.draftValues.length !== count) {
        this.draftValues = Array.from({ length: count }, (_, index) => this.draftValues[index] || "");
      }
    }

    syncDraftsFromView(view) {
      const editableSteps = view.steps.filter((step) => !step.locked);
      this.ensureDraftSize(editableSteps.length);
      editableSteps.forEach((step, index) => {
        if (!this.draftValues[index]) {
          this.draftValues[index] = step.value || "";
        }
      });
    }

    commitDraft(index) {
      const draft = this.draftValues[index] || "";
      return this.game.setValue(index, draft);
    }

    reopenDraft(index) {
      this.editingIndex = index;
      return this.game.unlockValue(index);
    }

    commitDrafts() {
      for (let index = 0; index < this.draftValues.length; index += 1) {
        this.game.setValue(index, this.draftValues[index] || "");
      }
    }

    moveLabel(code) {
      return {
        B: "Blue - Rearrange",
        Y: "Yellow - Add",
        G: "Green - Add + Rearrange",
        R: "Red - Replace In Place"
      }[code] || code;
    }

    render(view) {
      if (!view) {
        return;
      }

      this.syncDraftsFromView(view);
      this.elements.root.classList.toggle("solved", !!view.solved);
      this.elements.chain.innerHTML = "";
      this.elements.puzzleLabel.textContent = view.puzzleLabel || "Random Path";
      this.elements.difficulty.hidden = view.difficulty == null;
      if (view.difficulty != null) {
        this.elements.difficulty.textContent = view.difficulty;
      }

      view.steps.forEach((step, index) => {
        const block = document.createElement("div");
        block.className = "lexipath-step";
        const draftIndex = step.index - 1;
        const isEditing = !step.locked && !view.solved && this.editingIndex === draftIndex;
        const showCommittedCard = !step.locked && step.committed && !isEditing;

        const card = document.createElement("article");
        card.className = `lexipath-word-card${step.locked ? " locked" : ""}${showCommittedCard ? " committed" : ""}${step.status ? ` ${step.status}` : ""}${isEditing ? " active" : ""}`;

        const label = document.createElement("div");
        label.className = "lexipath-word-label";
        label.textContent = step.label;
        card.appendChild(label);

        if (step.locked) {
          const value = document.createElement("div");
          value.className = "lexipath-word-value";
          value.textContent = step.value;
          card.appendChild(value);
        } else if (showCommittedCard) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "lexipath-word-button";
          button.textContent = step.value || "ENTER WORD";
          button.addEventListener("click", () => {
            const nextView = this.reopenDraft(draftIndex);
            this.render(nextView);
            const input = this.elements.chain.querySelector(`input[data-slot="${step.index}"]`);
            input?.focus();
            input?.select();
          });
          card.appendChild(button);

          const helper = document.createElement("div");
          helper.className = "lexipath-step-feedback";
          helper.textContent = "Locked in. Click to edit.";
          card.appendChild(helper);
        } else {
          const input = document.createElement("input");
          input.className = "lexipath-input";
          input.type = "text";
          input.maxLength = 12;
          input.autocomplete = "off";
          input.spellcheck = false;
          input.enterKeyHint = "done";
          input.value = this.draftValues[draftIndex] || "";
          input.disabled = view.solved;
          input.placeholder = "ENTER WORD";
          input.addEventListener("input", (event) => {
            this.draftValues[draftIndex] = normalizeWord(event.target.value);
          });
          input.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") {
              return;
            }
            event.preventDefault();
            const normalized = normalizeWord(event.currentTarget.value);
            if (normalized.length < 2) {
              this.draftValues[draftIndex] = normalized;
              return;
            }
            this.draftValues[draftIndex] = normalized;
            this.editingIndex = -1;
            const nextView = this.commitDraft(draftIndex);
            this.render(nextView);
          });
          input.dataset.slot = String(step.index);
          card.appendChild(input);

          const helper = document.createElement("div");
          helper.className = `lexipath-step-feedback${step.status ? ` ${step.status}` : ""}`;
          helper.textContent = step.helper || "Press Enter to lock this word in.";
          card.appendChild(helper);
        }

        block.appendChild(card);
        this.elements.chain.appendChild(block);

        if (step.moveAfter) {
          const arrow = document.createElement("div");
          const colorClass = {
            B: "blue",
            Y: "yellow",
            G: "green",
            R: "red"
          }[step.moveAfter] || "blue";
          arrow.className = `lexipath-arrow ${colorClass}${step.pulseArrow ? " pulse" : ""}`;
          arrow.textContent = this.moveLabel(step.moveAfter);
          this.elements.chain.appendChild(arrow);
        }
      });

      this.elements.message.textContent = view.feedback;
      this.elements.message.className = `message${view.feedbackTone && view.feedbackTone !== "neutral" ? ` ${view.feedbackTone}` : ""}`;
      this.elements.giveUpButton.hidden = !!view.solved;
      this.elements.submitButton.disabled = !!view.solved;
      this.elements.nextButton.hidden = !view.solved;
      this.elements.nextButton.textContent = view.nextButtonLabel || "Next Puzzle";
    }
  }

  function createLexiPathController(config) {
    let screen = null;
    let screenPromise = null;
    const puzzleCache = new Map();

    const DIFFICULTY_FILE_CANDIDATES = {
      easy: ["./data/lexipath/generated-quality-overlap-filtered-pooled-easy.json"],
      medium: ["./data/lexipath/generated-quality-overlap-filtered-pooled-medium.json"],
      hard: ["./data/lexipath/generated-quality-overlap-filtered-pooled-hard.json"]
    };

    async function loadDifficultyPuzzles(difficulty) {
      if (puzzleCache.has(difficulty)) {
        return puzzleCache.get(difficulty);
      }

      const files = DIFFICULTY_FILE_CANDIDATES[difficulty] || DIFFICULTY_FILE_CANDIDATES.easy;
      let lastError = null;

      for (const file of files) {
        try {
          const loader = new LexiPathPuzzleLoader([file]);
          const puzzles = await loader.load();
          if (puzzles.length) {
            puzzleCache.set(difficulty, puzzles);
            return puzzles;
          }
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error(`No LexiPath puzzles loaded for ${difficulty}.`);
    }

    function buildMixedSessionPuzzles(pools) {
      const easyPicks = samplePuzzles(pools.easy, 3).map((puzzle) => ({ ...puzzle, sessionBucket: "easy" }));
      const mediumPicks = samplePuzzles(pools.medium, 2).map((puzzle) => ({ ...puzzle, sessionBucket: "medium" }));
      const hardPicks = samplePuzzles(pools.hard, 1).map((puzzle) => ({ ...puzzle, sessionBucket: "hard" }));

      if (easyPicks.length < 3 || mediumPicks.length < 2 || hardPicks.length < 1) {
        throw new Error("LexiPath needs 3 easy, 2 medium, and 1 hard puzzle to build a session.");
      }

      return [
        easyPicks[0],
        easyPicks[1],
        mediumPicks[0],
        easyPicks[2],
        mediumPicks[1],
        hardPicks[0]
      ];
    }

    async function ensureScreen() {
      if (screen) {
        return screen;
      }

      if (!screenPromise) {
        screenPromise = Promise.resolve().then(() => {
          const game = new LexiPathGame([], {
            wordValidator: config.wordValidator,
            modeLabel: "Mixed Session"
          });
          screen = new LexiPathScreen(config.elements, game, config.callbacks);
          return screen;
        });
      }

      return screenPromise;
    }

    return {
      async start() {
        const readyScreen = await ensureScreen();
        const [easyPuzzles, mediumPuzzles, hardPuzzles] = await Promise.all([
          loadDifficultyPuzzles("easy"),
          loadDifficultyPuzzles("medium"),
          loadDifficultyPuzzles("hard")
        ]);
        const sessionPuzzles = buildMixedSessionPuzzles({
          easy: easyPuzzles,
          medium: mediumPuzzles,
          hard: hardPuzzles
        });
        readyScreen.game = new LexiPathGame(sessionPuzzles, {
          wordValidator: config.wordValidator,
          modeLabel: "Mixed Session"
        });
        readyScreen.start();
      }
    };
  }

  window.LexiPathMoveValidation = LexiPathMoveValidation;
  window.LexiPathPuzzleLoader = LexiPathPuzzleLoader;
  window.LexiPathGame = LexiPathGame;
  window.LexiPathScreen = LexiPathScreen;
  window.LexiPathApp = {
    createController: createLexiPathController
  };
}());
