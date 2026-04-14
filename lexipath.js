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
      if (previous.length !== next.length || previous === next || this.isBlueMove(previous, next)) {
        return false;
      }

      const previousDeleted = deletionSignatures(previous);
      const nextDeleted = deletionSignatures(next);
      for (const signature of previousDeleted) {
        if (nextDeleted.has(signature)) {
          return true;
        }
      }
      return false;
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
          message: "This step should replace one letter."
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
      this.lastPuzzleId = "";
      this.state = null;
      this.feedback = "Trace the chain and submit when it feels right.";
      this.feedbackTone = "neutral";
      this.lastValidatedArrow = -1;
    }

    get currentPuzzle() {
      return this.state?.puzzle || null;
    }

    pickNextPuzzle() {
      const pool = this.puzzles.filter((puzzle) => puzzle.id !== this.lastPuzzleId);
      const source = pool.length ? pool : this.puzzles;
      return source[Math.floor(Math.random() * source.length)];
    }

    startRandomPuzzle() {
      const puzzle = this.pickNextPuzzle();
      this.lastPuzzleId = puzzle.id;
      this.state = {
        puzzle,
        values: Array(Math.max(0, puzzle.sequence.length - 2)).fill(""),
        committed: Array(Math.max(0, puzzle.sequence.length - 2)).fill(false),
        solved: false
      };
      this.feedback = "Trace the chain and submit when it feels right.";
      this.feedbackTone = "neutral";
      this.lastValidatedArrow = -1;
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
      this.feedback = result.message;
      this.feedbackTone = result.tone;
      this.lastValidatedArrow = result.arrowIndex;
      if (result.valid) {
        this.state.solved = true;
      }
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

      return {
        puzzleId: puzzle.id,
        difficulty: puzzle.difficulty,
        solved: this.state.solved,
        feedback: this.feedback,
        feedbackTone: this.feedbackTone,
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
      this.elements.submitButton.addEventListener("click", () => {
        this.commitDrafts();
        this.render(this.game.submit());
      });
      this.elements.nextButton.addEventListener("click", () => {
        this.draftValues = [];
        this.editingIndex = -1;
        this.render(this.game.startRandomPuzzle());
      });
    }

    start() {
      this.draftValues = [];
      this.editingIndex = -1;
      this.render(this.game.startRandomPuzzle());
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
        R: "Red - Replace"
      }[code] || code;
    }

    render(view) {
      if (!view) {
        return;
      }

      this.syncDraftsFromView(view);
      this.elements.root.classList.toggle("solved", !!view.solved);
      this.elements.chain.innerHTML = "";
      this.elements.puzzleLabel.textContent = view.puzzleId;
      this.elements.difficulty.hidden = view.difficulty == null;
      if (view.difficulty != null) {
        this.elements.difficulty.textContent = `Difficulty ${view.difficulty}`;
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
      this.elements.nextButton.hidden = !view.solved;
    }
  }

  function createLexiPathController(config) {
    let screen = null;
    let loadPromise = null;

    async function ensureScreen() {
      if (screen) {
        return screen;
      }

      if (!loadPromise) {
        loadPromise = fetch("./data/lexipath/manifest.json")
          .then((response) => {
            if (!response.ok) {
              throw new Error(`LexiPath manifest failed to load (${response.status}).`);
            }
            return response.json();
          })
          .then(async (manifest) => {
            const files = Array.isArray(manifest?.files)
              ? manifest.files.map((file) => `./data/lexipath/${file}`)
              : ["./data/lexipath/starter.json"];
            const loader = new LexiPathPuzzleLoader(files);
            const puzzles = await loader.load();
            if (!puzzles.length) {
              throw new Error("No LexiPath puzzles loaded.");
            }
            const game = new LexiPathGame(puzzles, {
              wordValidator: config.wordValidator
            });
            screen = new LexiPathScreen(config.elements, game, config.callbacks);
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

  window.LexiPathMoveValidation = LexiPathMoveValidation;
  window.LexiPathPuzzleLoader = LexiPathPuzzleLoader;
  window.LexiPathGame = LexiPathGame;
  window.LexiPathScreen = LexiPathScreen;
  window.LexiPathApp = {
    createController: createLexiPathController
  };
}());
