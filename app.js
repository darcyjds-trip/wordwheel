const FALLBACK_WORD_BANK = [
  "about", "above", "acting", "action", "active", "actor", "adapt", "adore", "after",
  "again", "agent", "agile", "almost", "along", "alter", "amber", "anchor", "angle",
  "animal", "answer", "anthem", "anyone", "appeal", "apple", "april", "arcade", "argue",
  "artist", "aspect", "attend", "aurora", "autumn", "avenue", "badge", "banana", "basic",
  "beacon", "beauty", "before", "belong", "better", "binary", "blazer", "blessing",
  "border", "bottle", "brain", "breeze", "bridge", "bright", "broken", "bubble", "button",
  "camera", "candle", "cannon", "captain", "carbon", "castle", "casual", "center",
  "chance", "change", "charge", "charter", "chasing", "circle", "citizen", "clarity",
  "climate", "clock", "coastal", "coffee", "collar", "column", "comet", "common",
  "concert", "cookie", "copper", "corner", "cosmic", "cotton", "cradle", "craft",
  "crayon", "create", "crystal", "custom", "dancer", "danger", "decade", "december",
  "delight", "desert", "design", "detail", "device", "dinner", "distant", "doctor",
  "dolphin", "dragon", "dream", "driven", "echoes", "editor", "effect", "effort",
  "electric", "elegant", "embark", "energy", "engine", "enough", "escape", "estate",
  "evening", "fabric", "factor", "famous", "fantasy", "fashion", "feather", "fellow",
  "figure", "filter", "finger", "finish", "flavor", "flight", "flower", "forest",
  "forget", "formal", "fortune", "fossil", "frozen", "future", "galaxy", "garden",
  "gather", "gentle", "glider", "golden", "gossip", "grace", "grain", "grand", "gravity",
  "harbor", "harmony", "hazard", "helmet", "hidden", "honest", "horizon", "hunter",
  "icicle", "ignite", "impact", "income", "indigo", "injury", "inside", "inspire",
  "island", "jacket", "jasmine", "journey", "juniper", "keeper", "kernel", "kingdom",
  "kitten", "ladder", "lantern", "legend", "letter", "library", "light", "lilac",
  "listen", "lively", "locate", "lonely", "magnet", "marble", "market", "memory",
  "meteor", "middle", "midnight", "mirror", "modern", "moment", "monarch", "morning",
  "mountain", "museum", "music", "native", "nature", "needle", "neither", "nickel",
  "normal", "notice", "number", "object", "ocean", "office", "orange", "orchard",
  "origin", "outline", "oxygen", "packet", "palace", "paper", "parade", "parent",
  "pebble", "people", "pepper", "phrase", "planet", "plasma", "player", "poetry",
  "polish", "ponder", "popular", "pottery", "prairie", "precise", "pretty", "pride",
  "prime", "printer", "puzzle", "quantum", "rabbit", "radar", "random", "reader",
  "reason", "record", "refine", "region", "relief", "rescue", "rhythm", "rocket",
  "rotate", "safety", "sailor", "sample", "satisfy", "school", "science", "screen",
  "season", "secret", "shadow", "signal", "silent", "silver", "simple", "sincere",
  "singer", "socket", "solar", "solver", "spirit", "spring", "square", "stable",
  "station", "story", "stream", "stripe", "studio", "summer", "sunset", "supply",
  "switch", "symbol", "talent", "target", "temple", "tender", "theory", "thunder",
  "ticket", "timber", "tinker", "today", "tomato", "travel", "treaty", "triangle",
  "tunnel", "turbine", "unable", "update", "utopia", "vacuum", "velvet", "victory",
  "violet", "vision", "voyage", "wallet", "wander", "window", "winter", "wisdom",
  "wonder", "writer", "yellow"
];

const VALIDATION_DICTIONARY_URL = "https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt";
const ROUND_DICTIONARY_URL = "https://raw.githubusercontent.com/petey284/word_list/master/popular.txt";
const STORAGE_KEY = "letter-clock-scores-v2";
const REQUIRED_LENGTHS = [4, 5, 6, 7];
const ROUND_TIME_LIMIT = 45;
const SESSION_ROUND_COUNT = 8;
const LENGTH_SCORES = {
  4: 100,
  5: 200,
  6: 350,
  7: 500
};
const ROUND_CLEAR_BONUS = 400;
const ORDER_BONUS = 250;
const TIME_BONUS_PER_SECOND = 10;
const SURVIVAL_STEP = 0.1;
const SURVIVAL_CAP = 3;
const REEL_BUFFER = 2;
const MIN_WORD_LENGTH = REQUIRED_LENGTHS[0];
const MAX_WORD_LENGTH = REQUIRED_LENGTHS[REQUIRED_LENGTHS.length - 1];
const WHEEL_SIZE = 10;
const LETTER_POOL = "abcdefghijklmnopqrstuvwxyz".split("");

const state = {
  score: 0,
  survivalMultiplier: 1,
  consecutiveClears: 0,
  round: 1,
  roundDeadline: 0,
  timerId: null,
  autoSubmitTimerId: null,
  lastTickSecond: null,
  audioContext: null,
  audioUnlocked: false,
  currentRound: null,
  recentWords: [],
  wheelOffsets: [0, 0, 0],
  isSpinning: false,
  hasSubmittedScore: false,
  leaderboardError: "",
  dictionarySource: "fallback",
  dictionaryReady: false,
  validationWords: [],
  validationSet: new Set(),
  roundWords: [],
  rounds: [],
  sessionRounds: [],
  sessionWheelPlans: [],
  sessionIndex: 0,
  usedWords: new Set(),
  scores: loadStoredScores()
};

const elements = {
  wheelGrid: document.getElementById("wheelGrid"),
  score: document.getElementById("score"),
  survivalMultiplier: document.getElementById("survivalMultiplier"),
  timer: document.getElementById("timer"),
  round: document.getElementById("round"),
  bestScore: document.getElementById("bestScore"),
  goalGrid: document.getElementById("goalGrid"),
  modeSummary: document.getElementById("modeSummary"),
  leaderboardButton: document.getElementById("leaderboardButton"),
  leaderboardPanel: document.getElementById("leaderboardPanel"),
  leaderboardList: document.getElementById("leaderboardList"),
  submitScorePanel: document.getElementById("submitScorePanel"),
  submitScoreForm: document.getElementById("submitScoreForm"),
  submitScoreStatus: document.getElementById("submitScoreStatus"),
  playerNameInput: document.getElementById("playerNameInput"),
  submitScoreButton: document.getElementById("submitScoreButton"),
  restartButton: document.getElementById("restartButton"),
  guessForm: document.getElementById("guessForm"),
  guessInput: document.getElementById("guessInput"),
  skipButton: document.getElementById("skipButton"),
  message: document.getElementById("message"),
  foundList: document.getElementById("foundList"),
  foundCount: document.getElementById("foundCount"),
  scorePopups: document.getElementById("scorePopups")
};

function loadStoredScores() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { best: 0, leaderboard: [] };
    }

    const parsed = JSON.parse(raw);
    return {
      best: parsed.best || 0,
      leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : []
    };
  } catch (error) {
    return { best: 0, leaderboard: [] };
  }
}

function persistScores() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.scores));
}

function normalizeWord(word) {
  return word.toLowerCase().replace(/[^a-z]/g, "");
}

function countLetters(word) {
  return [...word].reduce((map, letter) => {
    map[letter] = (map[letter] || 0) + 1;
    return map;
  }, {});
}

function includesLetterRequirements(word, letters) {
  const available = countLetters(word);
  const needed = countLetters(letters.join(""));
  return Object.entries(needed).every(([letter, count]) => (available[letter] || 0) >= count);
}

function uniqueLetters(word) {
  return [...new Set(word.split(""))];
}

function sample(array, rng = Math.random) {
  return array[Math.floor(rng() * array.length)];
}

function shuffle(array, rng = Math.random) {
  const clone = [...array];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(rng() * (index + 1));
    [clone[index], clone[nextIndex]] = [clone[nextIndex], clone[index]];
  }
  return clone;
}

function hashSeed(input) {
  let hash = 2166136261;
  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seedText) {
  let seed = hashSeed(seedText);
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function wordQualityScore(word) {
  const vowels = (word.match(/[aeiou]/g) || []).length;
  const commonLetters = (word.match(/[etaoinshrdlu]/g) || []).length;
  const uniqueCount = uniqueLetters(word).length;
  const repeatedPenalty = word.length - uniqueCount;
  return vowels * 2 + commonLetters + uniqueCount - repeatedPenalty;
}

function isGameFriendlyWord(word) {
  if (!/^[a-z]{4,7}$/.test(word)) {
    return false;
  }

  if (!/[aeiou]/.test(word)) {
    return false;
  }

  if (/(.)\1\1/.test(word)) {
    return false;
  }

  return wordQualityScore(word) >= 6;
}

function normalizeDictionary(words) {
  return [...new Set(words
    .map((word) => normalizeWord(word))
    .filter((word) => word.length >= MIN_WORD_LENGTH && word.length <= MAX_WORD_LENGTH)
    .filter((word) => /^[a-z]+$/.test(word)))];
}

function normalizeRoundDictionary(words) {
  return normalizeDictionary(words).filter((word) => isGameFriendlyWord(word));
}

function buildRounds() {
  const comboMap = new Map();

  for (const word of state.roundWords) {
    const letters = uniqueLetters(word);
    if (letters.length < 3) {
      continue;
    }

    for (let first = 0; first < letters.length - 2; first += 1) {
      for (let second = first + 1; second < letters.length - 1; second += 1) {
        for (let third = second + 1; third < letters.length; third += 1) {
          const combo = [letters[first], letters[second], letters[third]].sort().join("");
          if (!comboMap.has(combo)) {
            comboMap.set(combo, new Set());
          }
          comboMap.get(combo).add(word);
        }
      }
    }
  }

  return [...comboMap.entries()]
    .map(([combo, words]) => {
      const answers = [...words].filter((word) => includesLetterRequirements(word, combo.split("")));
      const answersByLength = REQUIRED_LENGTHS.reduce((bucket, length) => {
        const ranked = answers
          .filter((word) => word.length === length)
          .sort((left, right) => wordQualityScore(right) - wordQualityScore(left));
        bucket[length] = ranked.slice(0, 24);
        return bucket;
      }, {});

      const quality = REQUIRED_LENGTHS.reduce((sum, length) => sum + (answersByLength[length][0] ? wordQualityScore(answersByLength[length][0]) : 0), 0);
      return {
        letters: combo.split(""),
        answers,
        answersByLength,
        quality
      };
    })
    .filter((round) => REQUIRED_LENGTHS.every((length) => round.answersByLength[length].length > 0))
    .sort((left, right) => {
      const leftCount = REQUIRED_LENGTHS.reduce((sum, length) => sum + left.answersByLength[length].length, 0);
      const rightCount = REQUIRED_LENGTHS.reduce((sum, length) => sum + right.answersByLength[length].length, 0);
      return (right.quality + rightCount) - (left.quality + leftCount);
    })
    .slice(0, 700);
}

function makeWheelLetters(targetLetter, rng) {
  const picks = new Set([targetLetter]);
  while (picks.size < WHEEL_SIZE) {
    picks.add(sample(LETTER_POOL, rng));
  }

  const letters = shuffle([...picks], rng);
  const targetIndex = Math.floor(rng() * WHEEL_SIZE);
  const currentIndex = letters.indexOf(targetLetter);
  [letters[targetIndex], letters[currentIndex]] = [letters[currentIndex], letters[targetIndex]];

  return { letters, targetIndex };
}

function buildWheelPlans(roundLettersByRound, rng) {
  return Array.from({ length: 3 }, (_, wheelIndex) => {
    const letters = Array.from({ length: WHEEL_SIZE }, (_, slotIndex) => {
      if (slotIndex < roundLettersByRound.length) {
        return roundLettersByRound[slotIndex][wheelIndex];
      }
      return sample(LETTER_POOL, rng);
    });

    return {
      letters: shuffle(letters.slice(SESSION_ROUND_COUNT), rng).length > 0
        ? [...letters.slice(0, SESSION_ROUND_COUNT), ...shuffle(letters.slice(SESSION_ROUND_COUNT), rng)]
        : letters,
      startIndex: 0
    };
  });
}

function buildRoundInstance(roundTemplate, rng, wheelPlans, roundIndex) {
  const letters = shuffle(roundTemplate.letters, rng);
  return {
    letters,
    answers: roundTemplate.answers,
    answersByLength: roundTemplate.answersByLength,
    solvedLengths: {},
    solveSequence: [],
    roundIndex,
    wheels: letters.map((_, wheelIndex) => ({
      letters: wheelPlans[wheelIndex].letters,
      targetIndex: (wheelPlans[wheelIndex].startIndex + roundIndex) % WHEEL_SIZE
    }))
  };
}

function buildSessionRounds() {
  const seed = `run-${Date.now()}`;
  const rng = createRng(seed);
  const sourceRounds = shuffle(state.rounds, rng);
  const chosen = sourceRounds.slice(0, SESSION_ROUND_COUNT);
  const roundLettersByRound = chosen.map((roundTemplate) => shuffle(roundTemplate.letters, rng));
  state.sessionWheelPlans = buildWheelPlans(roundLettersByRound, rng);
  return chosen.map((roundTemplate, roundIndex) => buildRoundInstance({
    ...roundTemplate,
    letters: roundLettersByRound[roundIndex]
  }, rng, state.sessionWheelPlans, roundIndex));
}

function getBestScore() {
  return state.scores.best || 0;
}

function updateBestScore() {
  const currentBest = getBestScore();
  if (state.score <= currentBest) {
    return;
  }

  state.scores.best = state.score;
  persistScores();
}

function updateHud() {
  elements.score.textContent = String(state.score);
  elements.survivalMultiplier.textContent = `x${state.survivalMultiplier.toFixed(2)}`;
  elements.round.textContent = `${Math.min(state.round, Math.max(state.sessionRounds.length, 1))}/${Math.max(state.sessionRounds.length, 1)}`;
  elements.bestScore.textContent = String(getBestScore());
  elements.foundCount.textContent = `${state.recentWords.length} word${state.recentWords.length === 1 ? "" : "s"} locked in`;
  elements.modeSummary.textContent = "";
}

function updateLeaderboard() {
  elements.leaderboardList.innerHTML = "";

  if (state.scores.leaderboard.length === 0) {
    const item = document.createElement("li");
    item.innerHTML = "<span>No runs yet</span><span>Finish a session to post a score</span>";
    elements.leaderboardList.appendChild(item);
    return;
  }

  state.scores.leaderboard.forEach((entry, index) => {
    const item = document.createElement("li");
    const when = new Date(entry.timestamp).toLocaleDateString();
    item.innerHTML = `<span>#${index + 1} ${entry.score}</span><span>Round ${entry.rounds} | ${when}</span>`;
    elements.leaderboardList.appendChild(item);
  });
}

async function refreshLeaderboard() {
  try {
    const response = await fetch("/api/leaderboard");
    if (!response.ok) {
      throw new Error(`Leaderboard fetch failed with ${response.status}`);
    }
    const payload = await response.json();
    state.scores.leaderboard = Array.isArray(payload.scores) ? payload.scores : [];
    state.scores.best = Math.max(
      state.scores.best || 0,
      state.scores.leaderboard[0]?.score || 0
    );
    state.leaderboardError = "";
    persistScores();
    updateHud();
    updateLeaderboard();
  } catch (error) {
    state.leaderboardError = error.message;
    updateLeaderboard();
  }
}

function updateSubmitScorePanel() {
  const shouldShow = !state.currentRound && state.score > 0 && !state.hasSubmittedScore;
  elements.submitScorePanel.hidden = !shouldShow;
  if (!shouldShow) {
    return;
  }

  elements.submitScoreStatus.textContent = state.leaderboardError
    ? `Leaderboard offline. ${state.leaderboardError}`
    : "Add your name to the leaderboard.";
}

function updateGoals() {
  elements.goalGrid.innerHTML = "";

  if (!state.currentRound) {
    return;
  }

  REQUIRED_LENGTHS.forEach((length) => {
    const card = document.createElement("article");
    const solvedWord = state.currentRound.solvedLengths[length];
    card.className = `goal-card${solvedWord ? " complete" : ""}`;

    const heading = document.createElement("strong");
    heading.textContent = `${length} Letters`;

    const detail = document.createElement("span");
    detail.textContent = solvedWord ? solvedWord.toUpperCase() : "Still needed";

    card.append(heading, detail);
    elements.goalGrid.appendChild(card);
  });

}

function updateRecentWords() {
  elements.foundList.innerHTML = "";
  state.recentWords.slice(0, 10).forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = `${entry.word.toUpperCase()} | +${entry.points} | ${entry.letters.map((letter) => letter.toUpperCase()).join("")}`;
    elements.foundList.appendChild(item);
  });
}

function spawnScorePopup(text, variant = "word", horizontalOffset = 0) {
  const popup = document.createElement("div");
  popup.className = `score-popup ${variant}`;
  popup.textContent = text;
  popup.style.left = `calc(50% + ${horizontalOffset}px)`;
  elements.scorePopups.appendChild(popup);

  window.setTimeout(() => {
    popup.remove();
  }, 1600);
}

function ensureAudioReady() {
  if (state.audioUnlocked) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  if (!state.audioContext) {
    state.audioContext = new AudioContextClass();
  }

  state.audioUnlocked = true;
  if (state.audioContext.state === "suspended") {
    state.audioContext.resume().catch(() => {});
  }
}

function playTone(frequency, startOffset, duration, volume, type = "sine") {
  if (!state.audioContext || !state.audioUnlocked) {
    return;
  }

  const start = state.audioContext.currentTime + startOffset;
  const oscillator = state.audioContext.createOscillator();
  const gainNode = state.audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gainNode);
  gainNode.connect(state.audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.04);
}

function playWheelSettleSound() {
  playTone(420, 0, 0.08, 0.03, "square");
  playTone(560, 0.05, 0.1, 0.025, "triangle");
}

function playWordScoreSound() {
  playTone(660, 0, 0.07, 0.04, "triangle");
  playTone(880, 0.06, 0.12, 0.035, "triangle");
}

function playRoundClearSound() {
  playTone(523.25, 0, 0.12, 0.04, "triangle");
  playTone(659.25, 0.08, 0.12, 0.045, "triangle");
  playTone(783.99, 0.16, 0.18, 0.05, "triangle");
}

function playFailureSound() {
  playTone(220, 0, 0.1, 0.04, "sawtooth");
  playTone(174.61, 0.05, 0.16, 0.03, "sawtooth");
}

function playTickSound() {
  playTone(1200, 0, 0.05, 0.025, "square");
}

function setMessage(text, type = "") {
  elements.message.textContent = text;
  elements.message.className = `message${type ? ` ${type}` : ""}`;
}

function setSpinning(isSpinning) {
  state.isSpinning = isSpinning;
  elements.skipButton.disabled = isSpinning || !state.dictionaryReady;
  elements.guessInput.disabled = isSpinning || !state.dictionaryReady;
}

function clearAutoSubmitTimer() {
  if (state.autoSubmitTimerId) {
    window.clearTimeout(state.autoSubmitTimerId);
    state.autoSubmitTimerId = null;
  }
}

function renderWheels(roundData) {
  const targetSlots = [];
  const stepHeight = window.innerWidth <= 400 ? 32 : window.innerWidth <= 560 ? 40 : window.innerWidth <= 820 ? 52 : 64;
  const reelWindowHeight = window.innerWidth <= 400 ? 124 : window.innerWidth <= 560 ? 144 : window.innerWidth <= 820 ? 178 : 220;
  const targetCenter = Math.round(reelWindowHeight / 2);
  const targetTop = Math.round(targetCenter - stepHeight / 2);
  const shouldAnimateIn = state.round === 1;

  if (elements.wheelGrid.children.length === 0) {
    roundData.wheels.forEach((wheelData) => {
      const card = document.createElement("article");
      card.className = "wheel-card active";

      const frame = document.createElement("div");
      frame.className = "reel-window";

      const targetWindow = document.createElement("div");
      targetWindow.className = "target-window";

      const wheel = document.createElement("div");
      wheel.className = "reel-track";

      const extendedLetters = [
        ...wheelData.letters.slice(-REEL_BUFFER),
        ...wheelData.letters,
        ...wheelData.letters.slice(0, REEL_BUFFER)
      ];

      extendedLetters.forEach((letter, letterIndex) => {
        const slot = document.createElement("div");
        slot.className = "letter-slot";
        slot.dataset.index = String(letterIndex);

        const label = document.createElement("span");
        label.textContent = letter.toUpperCase();
        slot.appendChild(label);
        wheel.appendChild(slot);
      });

      frame.appendChild(targetWindow);
      frame.appendChild(wheel);
      card.appendChild(frame);
      elements.wheelGrid.appendChild(card);
    });
  }

  [...elements.wheelGrid.children].forEach((card, wheelIndex) => {
    const wheelData = roundData.wheels[wheelIndex];
    const wheel = card.querySelector(".reel-track");
    const frame = card.querySelector(".reel-window");
    const slots = [...card.querySelectorAll(".letter-slot")];
    const visualTargetIndex = wheelData.targetIndex + REEL_BUFFER;
    const targetOffset = targetTop - visualTargetIndex * stepHeight;

    frame.style.setProperty("--target-center", `${targetCenter}px`);
    frame.style.setProperty("--target-height", `${stepHeight + 8}px`);
    frame.style.height = `${reelWindowHeight}px`;

    if (shouldAnimateIn && state.wheelOffsets[wheelIndex] === 0) {
      const startOffset = targetOffset - stepHeight * 1.5;
      state.wheelOffsets[wheelIndex] = targetOffset;
      wheel.style.transition = "none";
      wheel.style.transform = `translateY(${startOffset}px)`;
      wheel.getBoundingClientRect();
      window.requestAnimationFrame(() => {
        wheel.style.transition = "";
        wheel.style.transform = `translateY(${targetOffset}px)`;
      });
    } else {
      state.wheelOffsets[wheelIndex] = targetOffset;
      wheel.style.transform = `translateY(${targetOffset}px)`;
    }

    slots.forEach((slot, letterIndex) => {
      const sourceIndex = (letterIndex - REEL_BUFFER + WHEEL_SIZE) % WHEEL_SIZE;
      const isTarget = sourceIndex === wheelData.targetIndex && letterIndex === visualTargetIndex;
      const hasPassedTarget = state.currentRound.roundIndex > 0
        && sourceIndex < state.currentRound.roundIndex
        && letterIndex >= REEL_BUFFER
        && letterIndex < REEL_BUFFER + WHEEL_SIZE;
      slot.classList.toggle("is-target", isTarget);
      slot.classList.toggle("is-passed", hasPassedTarget && !isTarget);
      slot.style.height = `${stepHeight}px`;
      slot.style.minHeight = `${stepHeight}px`;
      slot.style.lineHeight = `${stepHeight}px`;

      if (isTarget) {
        targetSlots.push(slot);
      }
    });
  });

  window.setTimeout(() => {
    targetSlots.forEach((slot) => slot.classList.add("is-pulsing"));
    playWheelSettleSound();
  }, 760);

  window.setTimeout(() => {
    targetSlots.forEach((slot) => slot.classList.remove("is-pulsing"));
  }, 1600);
}

function clearTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
  state.lastTickSecond = null;
}

function updateTimerDisplay() {
  if (!state.currentRound) {
    elements.timer.textContent = `${ROUND_TIME_LIMIT}s`;
    elements.timer.classList.remove("danger");
    return;
  }

  const remainingSeconds = Math.max(0, Math.ceil((state.roundDeadline - Date.now()) / 1000));
  elements.timer.textContent = `${remainingSeconds}s`;
  elements.timer.classList.toggle("danger", remainingSeconds <= 10);
  elements.timer.parentElement.classList.toggle("danger-panel", remainingSeconds <= 10);

  if (remainingSeconds <= 10 && remainingSeconds > 0 && state.lastTickSecond !== remainingSeconds) {
    state.lastTickSecond = remainingSeconds;
    playTickSound();
  }
}

function startRoundTimer() {
  clearTimer();
  state.roundDeadline = Date.now() + ROUND_TIME_LIMIT * 1000;
  state.lastTickSecond = null;
  updateTimerDisplay();
  state.timerId = window.setInterval(() => {
    updateTimerDisplay();
    if (Date.now() >= state.roundDeadline) {
      handleRoundFailure("Time ran out. The survival streak snaps and the wheels move on.");
    }
  }, 250);
}

function chooseNextRound() {
  if (state.sessionIndex >= state.sessionRounds.length) {
    return null;
  }

  const roundData = state.sessionRounds[state.sessionIndex];
  state.sessionIndex += 1;
  return roundData;
}

function loadNextRound(messageText) {
  const nextRound = chooseNextRound();
  if (!nextRound) {
    return;
  }

  state.currentRound = nextRound;
  renderWheels(state.currentRound);
  updateHud();
  updateGoals();
  updateRecentWords();
  setMessage(messageText || "Fresh letters at six. Make them count.");
  elements.guessInput.value = "";
  setSpinning(true);

  window.setTimeout(() => {
    setSpinning(false);
    startRoundTimer();
    elements.guessInput.focus();
  }, 950);
}

function scoreWord(word) {
  const basePoints = LENGTH_SCORES[word.length];
  const points = Math.round(basePoints * state.survivalMultiplier);
  return {
    basePoints,
    points
  };
}

function handleCorrectGuess(word) {
  const { basePoints, points } = scoreWord(word);
  state.currentRound.solvedLengths[word.length] = word;
  state.currentRound.solveSequence.push(word.length);
  state.score += points;
  state.usedWords.add(word);
  state.recentWords.unshift({ word, letters: state.currentRound.letters, points });
  updateBestScore();
  updateHud();
  updateGoals();
  updateRecentWords();
  playWordScoreSound();
  spawnScorePopup(`+${points}`, "word", -40);

  const remaining = REQUIRED_LENGTHS.filter((length) => !state.currentRound.solvedLengths[length]);
  if (remaining.length === 0) {
    clearTimer();
    const secondsLeft = Math.max(0, Math.ceil((state.roundDeadline - Date.now()) / 1000));
    const timeBonus = secondsLeft * TIME_BONUS_PER_SECOND;
    const ordered = hasAscendingSolveOrder();
    const roundBonus = ROUND_CLEAR_BONUS + timeBonus + (ordered ? ORDER_BONUS : 0);
    const appliedSurvivalMultiplier = state.survivalMultiplier;
    const awardedRoundBonus = Math.round(roundBonus * appliedSurvivalMultiplier);
    state.score += awardedRoundBonus;
    state.consecutiveClears += 1;
    state.survivalMultiplier = Math.min(1 + state.consecutiveClears * SURVIVAL_STEP, SURVIVAL_CAP);
    updateBestScore();
    updateHud();
    playRoundClearSound();
    spawnScorePopup(`Round +${awardedRoundBonus}`, "bonus", 0);
    if (ordered) {
      spawnScorePopup("Perfect Order", "combo", 0);
    }

    if (state.sessionIndex >= state.sessionRounds.length) {
      endSession(`Run complete. "${word.toUpperCase()}" closed the final board. Round bonus +${awardedRoundBonus}.`);
      return;
    }

    state.round += 1;
    loadNextRound(`Clean sweep. "${word.toUpperCase()}" scores ${points}. Round bonus +${awardedRoundBonus}. Survival now x${state.survivalMultiplier.toFixed(2)}.`);
    return;
  }

  setMessage(`Locked in "${word.toUpperCase()}" for +${points} (${basePoints} x ${state.survivalMultiplier.toFixed(2)}). Still need ${remaining.join(", ")} letter words.`, "success");
  elements.guessInput.value = "";
  elements.guessInput.focus();
}

function handleRoundFailure(message) {
  if (!state.currentRound) {
    return;
  }

  clearTimer();
  playFailureSound();

  state.consecutiveClears = 0;
  state.survivalMultiplier = 1;
  state.round += 1;
  updateHud();

  if (state.sessionIndex >= state.sessionRounds.length) {
    endSession(message);
    return;
  }

  loadNextRound(message);
}

function isValidGuess(word) {
  return state.validationSet.has(word) && includesLetterRequirements(word, state.currentRound.letters);
}

function endSession(reason = "Run complete.") {
  clearTimer();
  state.currentRound = null;
  state.scores.best = Math.max(state.scores.best || 0, state.score);
  state.hasSubmittedScore = false;
  persistScores();
  updateHud();
  updateLeaderboard();
  updateSubmitScorePanel();
  updateGoals();
  updateRecentWords();
  setSpinning(true);
  const best = getBestScore();
  setMessage(`${reason} Final score: ${state.score}. Best: ${best}. Hit restart to run it again.`, "success");
}

function handleGuess(event) {
  if (event) {
    event.preventDefault();
  }
  ensureAudioReady();
  if (state.isSpinning || !state.dictionaryReady || !state.currentRound) {
    return;
  }

  const guess = normalizeWord(elements.guessInput.value);
  if (guess.length < MIN_WORD_LENGTH || guess.length > MAX_WORD_LENGTH) {
    setMessage("This round only accepts 4, 5, 6, or 7 letter words.", "error");
    return;
  }

  if (!includesLetterRequirements(guess, state.currentRound.letters)) {
    setMessage(`Your word needs ${state.currentRound.letters.map((letter) => letter.toUpperCase()).join(", ")}.`, "error");
    return;
  }

  if (state.usedWords.has(guess)) {
    setMessage(`"${guess.toUpperCase()}" was already played. Find a fresh one.`, "error");
    return;
  }

  if (state.currentRound.solvedLengths[guess.length]) {
    setMessage(`You already solved the ${guess.length} letter slot with "${state.currentRound.solvedLengths[guess.length].toUpperCase()}".`, "error");
    return;
  }

  if (!isValidGuess(guess)) {
    const hint = sample(state.currentRound.answersByLength[guess.length]);
    setMessage(`That one is not in the dictionary I loaded. A ${guess.length} letter word like "${hint.toUpperCase()}" would work.`, "error");
    return;
  }

  handleCorrectGuess(guess);
}

function handleSkip() {
  ensureAudioReady();
  clearAutoSubmitTimer();
  if (state.isSpinning || !state.dictionaryReady || !state.currentRound) {
    return;
  }
  handleRoundFailure("Skipped. Survival reset. New letters incoming.");
}

function restartSession() {
  clearTimer();
  clearAutoSubmitTimer();
  state.score = 0;
  state.survivalMultiplier = 1;
  state.consecutiveClears = 0;
  state.round = 1;
  state.currentRound = null;
  state.recentWords = [];
  state.usedWords = new Set();
  state.hasSubmittedScore = false;
  state.wheelOffsets = [0, 0, 0];
  state.sessionIndex = 0;
  state.sessionRounds = buildSessionRounds();
  elements.wheelGrid.innerHTML = "";
  updateHud();
  updateLeaderboard();
  updateSubmitScorePanel();
  updateGoals();
  updateRecentWords();
  loadNextRound("Run ready. Eight rounds. Build your streak.");
}

function hasAscendingSolveOrder() {
  return state.currentRound.solveSequence.length === REQUIRED_LENGTHS.length
    && state.currentRound.solveSequence.every((length, index) => length === REQUIRED_LENGTHS[index]);
}

async function loadDictionary() {
  setSpinning(true);
  setMessage("Loading proper game dictionary and balancing rounds...");

  try {
    const [validationResponse, roundResponse] = await Promise.all([
      fetch(VALIDATION_DICTIONARY_URL),
      fetch(ROUND_DICTIONARY_URL)
    ]);

    if (!validationResponse.ok) {
      throw new Error(`Validation dictionary fetch failed with ${validationResponse.status}`);
    }

    const validationText = await validationResponse.text();
    state.validationWords = normalizeDictionary(validationText.split(/\r?\n/));
    state.validationSet = new Set(state.validationWords);

    if (roundResponse.ok) {
      const roundText = await roundResponse.text();
      state.roundWords = normalizeRoundDictionary(roundText.split(/\r?\n/))
        .filter((word) => state.validationSet.has(word));
      state.dictionarySource = "enable + common";
    } else {
      state.roundWords = state.validationWords.filter((word) => isGameFriendlyWord(word));
      state.dictionarySource = "enable";
    }
  } catch (error) {
    state.validationWords = normalizeDictionary(FALLBACK_WORD_BANK);
    state.validationSet = new Set(state.validationWords);
    state.roundWords = normalizeRoundDictionary(FALLBACK_WORD_BANK);
    state.dictionarySource = "fallback";
  }

  if (state.roundWords.length === 0) {
    state.roundWords = state.validationWords.filter((word) => isGameFriendlyWord(word));
  }

  state.rounds = buildRounds();
  state.dictionaryReady = state.rounds.length > 0;

  if (!state.dictionaryReady) {
    setMessage("The dictionary loaded, but no playable rounds were built.", "error");
    return;
  }

  restartSession();
  refreshLeaderboard();
}

elements.guessForm.addEventListener("submit", handleGuess);
elements.guessInput.addEventListener("input", () => {
  clearAutoSubmitTimer();

  if (state.isSpinning || !state.dictionaryReady || !state.currentRound) {
    return;
  }

  const guess = normalizeWord(elements.guessInput.value);
  if (guess.length < MIN_WORD_LENGTH || guess.length > MAX_WORD_LENGTH) {
    return;
  }

  state.autoSubmitTimerId = window.setTimeout(() => {
    state.autoSubmitTimerId = null;
    handleGuess();
  }, 220);
});
elements.skipButton.addEventListener("click", handleSkip);
elements.restartButton.addEventListener("click", () => {
  ensureAudioReady();
  restartSession();
});
elements.leaderboardButton.addEventListener("click", () => {
  elements.leaderboardPanel.hidden = !elements.leaderboardPanel.hidden;
});
elements.submitScoreForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = String(elements.playerNameInput.value || "").trim().slice(0, 16);
  if (!name) {
    elements.submitScoreStatus.textContent = "Enter a name first.";
    return;
  }

  elements.submitScoreButton.disabled = true;
  elements.submitScoreStatus.textContent = "Posting score...";

  try {
    const response = await fetch("/api/leaderboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        score: state.score,
        rounds: SESSION_ROUND_COUNT
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `Submit failed with ${response.status}`);
    }

    state.scores.leaderboard = Array.isArray(payload.scores) ? payload.scores : [];
    state.scores.best = Math.max(state.scores.best || 0, state.score);
    state.hasSubmittedScore = true;
    state.leaderboardError = "";
    persistScores();
    updateHud();
    updateLeaderboard();
    updateSubmitScorePanel();
    elements.submitScoreStatus.textContent = "Score posted.";
    elements.playerNameInput.value = "";
  } catch (error) {
    state.leaderboardError = error.message;
    elements.submitScoreStatus.textContent = error.message;
  } finally {
    elements.submitScoreButton.disabled = false;
  }
});

loadDictionary();
