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
      this.state.values[index] = normalizeWord(value);
      const validation = this.validateAround(index);
      this.feedback = validation.message;
      this.feedbackTone = validation.valid ? "success" : validation.tone;
      this.lastValidatedArrow = validation.arrowIndex;
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
        message: exact ? "Success - exact chain solved." : "Your chain is valid, but it is not the intended solution.",
        tone: exact ? "success" : "error",
        arrowIndex: puzzle.pattern.length - 1
      };
    }

    submit() {
      const result = this.validateFullChain();
      this.feedback = result.message;
      this.feedbackTone = result.tone;
      this.lastValidatedArrow = result.arrowIndex;
      if (result.valid && result.exact) {
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
        let status = "";
        let helper = "";

        if (!locked && value) {
          const validation = this.validateAround(index - 1);
          status = validation.valid ? "valid" : validation.tone === "neutral" ? "" : "invalid";
          helper = validation.message;
        }

        steps.push({
          index,
          locked,
          label: index === 0 ? "Start" : index === words.length - 1 ? "End" : `Step ${index}`,
          value,
          status,
          helper,
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
      this.bindEvents();
    }

    bindEvents() {
      this.elements.backButton.addEventListener("click", () => {
        this.callbacks.onBack?.();
      });
      this.elements.submitButton.addEventListener("click", () => {
        this.render(this.game.submit());
      });
      this.elements.nextButton.addEventListener("click", () => {
        this.render(this.game.startRandomPuzzle());
      });
    }

    start() {
      this.render(this.game.startRandomPuzzle());
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

      this.elements.root.classList.toggle("solved", !!view.solved);
      this.elements.chain.innerHTML = "";
      this.elements.puzzleLabel.textContent = view.puzzleId;
      const activeEditableIndex = view.solved
        ? -1
        : Math.max(1, view.steps.findIndex((step, index) => !step.locked && !step.value));
      this.elements.difficulty.hidden = view.difficulty == null;
      if (view.difficulty != null) {
        this.elements.difficulty.textContent = `Difficulty ${view.difficulty}`;
      }

      view.steps.forEach((step, index) => {
        const block = document.createElement("div");
        block.className = "lexipath-step";

        const card = document.createElement("article");
        card.className = `lexipath-word-card${step.locked ? " locked" : ""}${step.status ? ` ${step.status}` : ""}${!step.locked && index === activeEditableIndex ? " active" : ""}`;

        const label = document.createElement("div");
        label.className = "lexipath-word-label";
        label.textContent = step.label;
        card.appendChild(label);

        if (step.locked) {
          const value = document.createElement("div");
          value.className = "lexipath-word-value";
          value.textContent = step.value;
          card.appendChild(value);
        } else {
          const input = document.createElement("input");
          input.className = "lexipath-input";
          input.type = "text";
          input.maxLength = 12;
          input.value = step.value;
          input.disabled = view.solved;
          input.placeholder = "ENTER WORD";
          input.addEventListener("input", (event) => {
            this.render(this.game.setValue(step.index - 1, event.target.value));
          });
          card.appendChild(input);

          const helper = document.createElement("div");
          helper.className = `lexipath-step-feedback${step.status ? ` ${step.status}` : ""}`;
          helper.textContent = step.helper || " ";
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
