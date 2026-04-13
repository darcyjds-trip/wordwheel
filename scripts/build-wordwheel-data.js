const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ENABLE_PATH = path.join(ROOT, "data", "enable1.txt");
const POPULAR_PATH = path.join(ROOT, "data", "popular.txt");
const ARCADE_OUTPUT = path.join(ROOT, "data", "arcade-rounds.json");
const PUZZLE_OUTPUT = path.join(ROOT, "data", "puzzle-boards.json");

const SUPPORTED_LENGTHS = [4, 5, 6, 7, 8];
const ARCADE_REQUIRED_LENGTHS = [4, 5, 6, 7];
const PUZZLE_REQUIRED_LENGTHS = [5, 6, 7, 8];
const MAX_ARCADE_ROUNDS = 700;
const MAX_PUZZLE_BOARDS = 500;

function normalizeWord(word) {
  return String(word || "").trim().toLowerCase().replace(/[^a-z]/g, "");
}

function normalizeDictionary(words) {
  return [...new Set(words.map(normalizeWord).filter((word) => word.length >= 4 && word.length <= 8))];
}

function normalizeRoundDictionary(words) {
  return normalizeDictionary(words).filter((word) => isGameFriendlyWord(word));
}

function isGameFriendlyWord(word) {
  return /^[a-z]+$/.test(word) && word.length >= 4 && word.length <= 8;
}

function uniqueLetters(word) {
  return [...new Set(word.split(""))];
}

function includesLetterRequirements(word, letters) {
  return letters.every((letter) => word.includes(letter));
}

function wordQualityScore(word) {
  const uniqueCount = uniqueLetters(word).length;
  const vowelCount = (word.match(/[aeiou]/g) || []).length;
  const repeatedPenalty = word.length - uniqueCount;
  return uniqueCount * 3 + vowelCount - repeatedPenalty;
}

function createRng(seedText) {
  let value = 0;
  for (const char of String(seedText)) {
    value = (value * 31 + char.charCodeAt(0)) >>> 0;
  }
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function shuffle(array, rng = Math.random) {
  const clone = [...array];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(rng() * (index + 1));
    [clone[index], clone[nextIndex]] = [clone[nextIndex], clone[index]];
  }
  return clone;
}

function buildRounds(roundWords) {
  const comboMap = new Map();

  for (const word of roundWords) {
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
      const answersByLength = SUPPORTED_LENGTHS.reduce((bucket, length) => {
        const ranked = answers
          .filter((word) => word.length === length)
          .sort((left, right) => wordQualityScore(right) - wordQualityScore(left));
        bucket[length] = ranked.slice(0, 24).map((word) => word.toUpperCase());
        return bucket;
      }, {});

      const quality = SUPPORTED_LENGTHS.reduce((sum, length) => {
        const topWord = answersByLength[length][0];
        return sum + (topWord ? wordQualityScore(topWord.toLowerCase()) : 0);
      }, 0);

      return {
        letters: combo.toUpperCase().split(""),
        answersByLength,
        quality
      };
    })
    .filter((round) => ARCADE_REQUIRED_LENGTHS.every((length) => round.answersByLength[length].length > 0))
    .sort((left, right) => {
      const leftCount = SUPPORTED_LENGTHS.reduce((sum, length) => sum + left.answersByLength[length].length, 0);
      const rightCount = SUPPORTED_LENGTHS.reduce((sum, length) => sum + right.answersByLength[length].length, 0);
      return (right.quality + rightCount) - (left.quality + leftCount);
    });
}

function getRandomPuzzleCount(length, availableCount, rng) {
  const maxCount = Math.min(availableCount, 3);
  const minCount = 1;
  return Math.max(minCount, Math.floor(rng() * maxCount) + 1);
}

function getBoardClueCount(wordLength) {
  if (wordLength >= 7) {
    return 2;
  }
  return 1;
}

function buildClueIndices(word) {
  const clueCount = getBoardClueCount(word.length);
  if (clueCount <= 1) {
    return [0];
  }
  return [0, word.length - 1];
}

function buildPuzzleBoards(rounds) {
  return rounds
    .filter((round) => PUZZLE_REQUIRED_LENGTHS.every((length) => round.answersByLength[length].length > 0))
    .slice(0, MAX_PUZZLE_BOARDS)
    .map((round, index) => {
      const rng = createRng(`puzzle-board-${index}-${round.letters.join("")}`);
      const puzzleWordsByLength = PUZZLE_REQUIRED_LENGTHS.reduce((groups, length) => {
        const sourceWords = shuffle(round.answersByLength[length], rng);
        const targetCount = getRandomPuzzleCount(length, sourceWords.length, rng);
        groups[length] = sourceWords
          .slice(0, targetCount)
          .sort((left, right) => left.localeCompare(right))
          .map((word) => ({
            word,
            clueIndices: buildClueIndices(word)
          }));
        return groups;
      }, {});

      return {
        letters: [...round.letters],
        puzzleWordsByLength
      };
    });
}

function main() {
  const enableWords = normalizeDictionary(fs.readFileSync(ENABLE_PATH, "utf8").split(/\r?\n/));
  const validationSet = new Set(enableWords);
  const roundWords = normalizeRoundDictionary(fs.readFileSync(POPULAR_PATH, "utf8").split(/\r?\n/))
    .filter((word) => validationSet.has(word));

  const rounds = buildRounds(roundWords)
    .slice(0, MAX_ARCADE_ROUNDS)
    .map((round) => ({
      letters: round.letters,
      answersByLength: round.answersByLength,
      quality: round.quality
    }));

  const puzzleBoards = buildPuzzleBoards(rounds);

  fs.writeFileSync(ARCADE_OUTPUT, `${JSON.stringify(rounds, null, 2)}\n`);
  fs.writeFileSync(PUZZLE_OUTPUT, `${JSON.stringify(puzzleBoards, null, 2)}\n`);

  console.log(`Wrote ${rounds.length} arcade rounds to ${path.relative(ROOT, ARCADE_OUTPUT)}`);
  console.log(`Wrote ${puzzleBoards.length} puzzle boards to ${path.relative(ROOT, PUZZLE_OUTPUT)}`);
}

main();
