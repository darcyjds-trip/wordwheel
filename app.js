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

const VALIDATION_DICTIONARY_URL = "./data/enable1.txt";
const ROUND_DICTIONARY_URL = "./data/popular.txt";
const STORAGE_KEY = "letter-clock-scores-v3";
const PLAYER_NAME_KEY = "word-wheel-player-name";
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
const RACE_RIVAL_NAME = "Rival";
const MIN_WORD_LENGTH = REQUIRED_LENGTHS[0];
const MAX_WORD_LENGTH = REQUIRED_LENGTHS[REQUIRED_LENGTHS.length - 1];
const WHEEL_SIZE = 10;
const LETTER_POOL = "abcdefghijklmnopqrstuvwxyz".split("");

const state = {
  activeScreen: "home",
  gameMode: "single",
  singlePlayerVariant: "arcade",
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
  racePlayers: [],
  rivalTimers: [],
  supabaseClient: null,
  supabaseConfigReady: false,
  realtimeChannel: null,
  roomPresence: [],
  roomPresenceSnapshot: new Map(),
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
  room: null,
  lobbyTimerId: null,
  countdownTimerIds: [],
  puzzleWordsByLength: {},
  playerId: crypto.randomUUID ? crypto.randomUUID() : `player-${Math.random().toString(36).slice(2, 10)}`,
  playerName: loadStoredPlayerName(),
  playerReady: false,
  matchEnded: false,
  raceOpponentName: RACE_RIVAL_NAME,
  usedWords: new Set(),
  scores: loadStoredScores()
};

const elements = {
  homeScreen: document.getElementById("homeScreen"),
  singlePlayerScreen: document.getElementById("singlePlayerScreen"),
  multiplayerScreen: document.getElementById("multiplayerScreen"),
  rulesScreen: document.getElementById("rulesScreen"),
  lobbyScreen: document.getElementById("lobbyScreen"),
  gamePanel: document.getElementById("gamePanel"),
  racePanel: document.querySelector(".race-panel"),
  homeStatus: document.getElementById("homeStatus"),
  singlePlayerButton: document.getElementById("singlePlayerButton"),
  arcadeModeButton: document.getElementById("arcadeModeButton"),
  puzzleModeButton: document.getElementById("puzzleModeButton"),
  singlePlayerBackButton: document.getElementById("singlePlayerBackButton"),
  multiplayerButton: document.getElementById("multiplayerButton"),
  rulesButton: document.getElementById("rulesButton"),
  createRoomButton: document.getElementById("createRoomButton"),
  playerNameForm: document.getElementById("playerNameForm"),
  playerNameMenuInput: document.getElementById("playerNameMenuInput"),
  joinRoomForm: document.getElementById("joinRoomForm"),
  joinRoomInput: document.getElementById("joinRoomInput"),
  multiplayerStatus: document.getElementById("multiplayerStatus"),
  backToHomeButton: document.getElementById("backToHomeButton"),
  rulesBackButton: document.getElementById("rulesBackButton"),
  lobbyRoomCode: document.getElementById("lobbyRoomCode"),
  lobbyRole: document.getElementById("lobbyRole"),
  lobbyStatus: document.getElementById("lobbyStatus"),
  lobbyPlayers: document.getElementById("lobbyPlayers"),
  copyRoomCodeButton: document.getElementById("copyRoomCodeButton"),
  readyToggleButton: document.getElementById("readyToggleButton"),
  startMatchButton: document.getElementById("startMatchButton"),
  leaveLobbyButton: document.getElementById("leaveLobbyButton"),
  wheelGrid: document.getElementById("wheelGrid"),
  score: document.getElementById("score"),
  survivalMultiplier: document.getElementById("survivalMultiplier"),
  timer: document.getElementById("timer"),
  round: document.getElementById("round"),
  bestScore: document.getElementById("bestScore"),
  raceBoard: document.getElementById("raceBoard"),
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
  resultsPanel: document.getElementById("resultsPanel"),
  resultsTitle: document.getElementById("resultsTitle"),
  resultsSummary: document.getElementById("resultsSummary"),
  resultsScores: document.getElementById("resultsScores"),
  rematchButton: document.getElementById("rematchButton"),
  leaveMatchButton: document.getElementById("leaveMatchButton"),
  restartButton: document.getElementById("restartButton"),
  guessForm: document.getElementById("guessForm"),
  guessInput: document.getElementById("guessInput"),
  mysteryPanel: document.getElementById("mysteryPanel"),
  mysteryGroups: document.getElementById("mysteryGroups"),
  skipButton: document.getElementById("skipButton"),
  message: document.getElementById("message"),
  foundList: document.getElementById("foundList"),
  foundCount: document.getElementById("foundCount"),
  scorePopups: document.getElementById("scorePopups"),
  countdownOverlay: document.getElementById("countdownOverlay"),
  toastStack: document.getElementById("toastStack")
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
      leaderboard: normalizeLeaderboardEntries(Array.isArray(parsed.leaderboard) ? parsed.leaderboard : [])
    };
  } catch (error) {
    return { best: 0, leaderboard: [] };
  }
}

function persistScores() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.scores));
}

function loadStoredPlayerName() {
  try {
    const saved = window.localStorage.getItem(PLAYER_NAME_KEY);
    return saved ? saved.trim().slice(0, 16) : "";
  } catch (error) {
    return "";
  }
}

function persistPlayerName(name) {
  const clean = String(name || "").trim().slice(0, 16);
  state.playerName = clean || "Player";
  try {
    window.localStorage.setItem(PLAYER_NAME_KEY, state.playerName);
  } catch (error) {
    return;
  }
}

function setScreen(screenName) {
  state.activeScreen = screenName;
  elements.homeScreen.hidden = screenName !== "home";
  elements.singlePlayerScreen.hidden = screenName !== "single-player-menu";
  elements.multiplayerScreen.hidden = screenName !== "multiplayer-menu";
  elements.rulesScreen.hidden = screenName !== "rules";
  elements.lobbyScreen.hidden = screenName !== "lobby";
  elements.gamePanel.hidden = screenName !== "game";
}

function updateModePanels() {
  elements.racePanel.hidden = state.gameMode !== "multiplayer";
  elements.goalGrid.parentElement.hidden = state.gameMode === "single" && state.singlePlayerVariant === "puzzle";
  elements.mysteryPanel.hidden = !(state.gameMode === "single" && state.singlePlayerVariant === "puzzle");
}

function updateEntryButtons() {
  const disabled = !state.dictionaryReady;
  elements.singlePlayerButton.disabled = disabled;
  elements.multiplayerButton.disabled = disabled;
  elements.createRoomButton.disabled = disabled;
  elements.joinRoomInput.disabled = disabled;
  elements.joinRoomForm.querySelector("button").disabled = disabled;

  if (!state.dictionaryReady) {
    elements.homeStatus.textContent = "Loading dictionary...";
    elements.multiplayerStatus.textContent = "";
  } else {
    elements.homeStatus.textContent = "Dictionary ready.";
    elements.multiplayerStatus.textContent = "";
  }
}

function clearLobbyTimer() {
  if (state.lobbyTimerId) {
    window.clearTimeout(state.lobbyTimerId);
    state.lobbyTimerId = null;
  }
}

function updateResultsPanel() {
  if (state.gameMode !== "multiplayer") {
    elements.resultsPanel.hidden = true;
    elements.gamePanel.classList.remove("results-open");
    return;
  }

  const shouldShow = state.matchEnded;
  elements.resultsPanel.hidden = !shouldShow;
  elements.gamePanel.classList.toggle("results-open", shouldShow);
  if (!shouldShow) {
    return;
  }

  const you = getRacePlayer("you");
  const rival = getRacePlayer("rival");
  const youScore = you?.score || state.score;
  const rivalScore = rival?.score || 0;
  const winner = youScore === rivalScore ? "tie" : youScore > rivalScore ? "you" : "rival";

  elements.resultsTitle.textContent = winner === "tie"
    ? "Dead Heat"
    : winner === "you"
      ? "You Win"
      : `${rival?.name || "Opponent"} Wins`;

  if (winner === "tie") {
    elements.resultsSummary.textContent = `Both players landed on ${youScore}.`;
  } else {
    const gap = Math.abs(youScore - rivalScore);
    elements.resultsSummary.textContent = `${winner === "you" ? "You" : rival?.name || "Opponent"} finished ahead by ${gap}.`;
  }

  elements.resultsScores.innerHTML = "";
  [
    { name: you?.name || "You", score: youScore, winner: winner === "you" },
    { name: rival?.name || state.raceOpponentName || "Opponent", score: rivalScore, winner: winner === "rival" }
  ].forEach((entry) => {
    const card = document.createElement("div");
    card.className = `results-score${entry.winner ? " winner" : ""}`;
    card.innerHTML = `<div><strong>${entry.name}</strong><span>${entry.winner ? "Winner" : "Final Score"}</span></div><strong>${entry.score}</strong>`;
    elements.resultsScores.appendChild(card);
  });
}

function showToast(text) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = text;
  elements.toastStack.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 2600);
}

function clearCountdown() {
  state.countdownTimerIds.forEach((timerId) => window.clearTimeout(timerId));
  state.countdownTimerIds = [];
  elements.countdownOverlay.hidden = true;
}

function showCountdown(startAt) {
  clearCountdown();
  const update = () => {
    const remainingMs = startAt - Date.now();
    if (remainingMs <= 0) {
      elements.countdownOverlay.textContent = "GO";
      elements.countdownOverlay.hidden = false;
      const hideId = window.setTimeout(() => {
        elements.countdownOverlay.hidden = true;
      }, 380);
      state.countdownTimerIds.push(hideId);
      return;
    }

    const seconds = Math.ceil(remainingMs / 1000);
    elements.countdownOverlay.textContent = String(seconds);
    elements.countdownOverlay.hidden = false;
    const timerId = window.setTimeout(update, 120);
    state.countdownTimerIds.push(timerId);
  };

  update();
}

async function updateOwnPresence(extra = {}) {
  if (!state.realtimeChannel) {
    return;
  }

  await state.realtimeChannel.track({
    playerId: state.playerId,
    name: getPlayerName(),
    isHost: !!state.room?.isHost,
    ready: !!state.playerReady,
    inGame: state.activeScreen === "game" && !state.matchEnded,
    joinedAt: new Date().toISOString(),
    ...extra
  });
}

function sanitizePlayerName(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .slice(0, 16);
}

function getPlayerName() {
  const typed = sanitizePlayerName(elements.playerNameMenuInput.value);
  if (typed) {
    persistPlayerName(typed);
    return state.playerName;
  }

  if (state.playerName) {
    return state.playerName;
  }

  persistPlayerName("Player");
  elements.playerNameMenuInput.value = state.playerName;
  return state.playerName;
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function ensureSupabaseClient() {
  if (state.supabaseClient) {
    return state.supabaseClient;
  }

  if (!window.supabase?.createClient) {
    throw new Error("Supabase client failed to load in the browser.");
  }

  const response = await fetch("/api/runtime-config");
  if (!response.ok) {
    throw new Error("Runtime config is missing.");
  }

  const payload = await response.json();
  if (!payload.supabaseUrl || !payload.supabasePublishableKey) {
    throw new Error("Supabase multiplayer config is incomplete.");
  }

  state.supabaseClient = window.supabase.createClient(payload.supabaseUrl, payload.supabasePublishableKey);
  state.supabaseConfigReady = true;
  return state.supabaseClient;
}

async function disconnectRealtimeRoom() {
  if (state.realtimeChannel && state.supabaseClient) {
    await state.supabaseClient.removeChannel(state.realtimeChannel);
  }
  state.realtimeChannel = null;
  state.roomPresence = [];
  state.roomPresenceSnapshot = new Map();
}

function buildLobbyPlayers() {
  if (!state.room) {
    return [];
  }

  const roster = state.roomPresence
    .slice()
    .sort((left, right) => Number(right.isHost) - Number(left.isHost) || left.name.localeCompare(right.name))
    .map((player) => ({
      name: player.name,
      status: player.isHost
        ? player.ready ? "Host · Ready" : "Host · Not Ready"
        : player.ready ? "Ready" : "Not Ready",
      ready: !!player.ready
    }));

  while (roster.length < 2) {
    roster.push({ name: "Open Slot", status: "Waiting..." });
  }

  return roster.slice(0, 2);
}

function syncRoomPresence(channel) {
  const presenceState = channel.presenceState();
  const players = Object.values(presenceState).flatMap((entries) => entries);
  const nextSnapshot = new Map(players.map((player) => [player.playerId, player]));

  if (state.activeScreen === "lobby" || state.activeScreen === "multiplayer-menu") {
    nextSnapshot.forEach((player, playerId) => {
      const previous = state.roomPresenceSnapshot.get(playerId);
      if (!previous && playerId !== state.playerId) {
        showToast(`${player.name} joined the room.`);
      } else if (previous && previous.ready !== player.ready && playerId !== state.playerId) {
        showToast(player.ready ? `${player.name} is ready.` : `${player.name} is no longer ready.`);
      }
    });

    state.roomPresenceSnapshot.forEach((player, playerId) => {
      if (!nextSnapshot.has(playerId) && playerId !== state.playerId) {
        showToast(`${player.name} left the room.`);
      }
    });
  }

  state.roomPresence = players;
  state.roomPresenceSnapshot = nextSnapshot;

  if (!state.room) {
    return;
  }

  state.room.players = buildLobbyPlayers();
  const opponent = players.find((player) => player.playerId !== state.playerId);
  state.room.opponentName = opponent?.name || "Opponent";
  state.room.ready = players.length >= 2 && players.every((player) => player.ready);

  if (state.activeScreen === "game" && state.gameMode === "multiplayer" && !state.matchEnded && players.length < 2) {
    endSession(`${state.raceOpponentName} left the match.`);
    return;
  }

  if (state.room.status !== "live") {
    state.room.status = state.room.ready
      ? state.room.isHost
        ? "Both players are ready. Start when ready."
        : "Both players are ready. Waiting for host..."
      : state.room.isHost
        ? players.length < 2
          ? "Waiting for player 2 to join..."
          : "Waiting for both players to ready up..."
        : players.length < 2
          ? "Joined room. Waiting for host..."
          : "Ready up to begin."
  }

  updateLobbyView();
}

function applyRemoteProgress(payload) {
  const rival = getRacePlayer("rival");
  if (!rival || payload.playerId === state.playerId) {
    return;
  }

  rival.name = payload.name || rival.name;

  if (payload.type === "solve") {
    if (rival.round !== payload.round) {
      rival.currentSolved = {};
    }
    rival.score = payload.score;
    rival.round = payload.round;
    rival.currentSolved = {};
    (payload.solvedLengths || []).forEach((length) => {
      rival.currentSolved[length] = true;
    });
    rival.flashLength = payload.length || null;
    rival.flashUntil = Date.now() + 850;
    showToast(`${rival.name} solved ${payload.length}.`);
  }

  if (payload.type === "round-clear") {
    rival.score = payload.score;
    rival.round = payload.round;
    rival.currentSolved = {};
    rival.flashLength = null;
    showToast(`${rival.name} cleared the round.`);
  }

  if (payload.type === "round-fail") {
    rival.score = payload.score;
    rival.round = payload.round;
    rival.currentSolved = {};
    rival.flashLength = null;
  }

  if (payload.type === "session-end") {
    rival.score = payload.score;
    rival.round = SESSION_ROUND_COUNT;
    rival.finished = true;
    rival.currentSolved = {};
    rival.flashLength = null;
    if (!state.matchEnded) {
      endSession(`${rival.name} finished first.`, { broadcast: false });
      return;
    }
  }

  updateRaceBoard();
}

async function broadcastRoomEvent(event, payload) {
  if (!state.realtimeChannel) {
    return;
  }

  await state.realtimeChannel.send({
    type: "broadcast",
    event,
    payload
  });
}

async function returnToLobbyFromMatch(statusText = "Back in lobby.") {
  state.matchEnded = false;
  state.currentRound = null;
  state.playerReady = false;
  clearCountdown();
  state.room.status = statusText;
  state.room.startAt = null;
  setScreen("lobby");
  updateResultsPanel();
  await updateOwnPresence();
  updateLobbyView();
}

async function connectRealtimeRoom(room, isHost) {
  const supabase = await ensureSupabaseClient();
  await disconnectRealtimeRoom();

  state.room = {
    code: room.code,
    roomId: room.id,
    isHost,
    ready: false,
    opponentName: "Opponent",
    status: isHost ? "Waiting for player 2 to join..." : "Joined room. Waiting for host...",
    players: [
      { name: getPlayerName(), status: isHost ? "Host" : "Joined" },
      { name: "Open Slot", status: "Waiting..." }
    ]
  };

  const channel = supabase.channel(`room:${room.code}`, {
    config: {
      broadcast: { self: true },
      presence: { key: state.playerId }
    }
  });

  channel
    .on("presence", { event: "sync" }, () => {
      syncRoomPresence(channel);
    })
    .on("broadcast", { event: "match-start" }, ({ payload }) => {
      if (!state.room || payload.hostId === undefined) {
        return;
      }
      state.room.status = "live";
      state.room.seed = payload.seed;
      state.room.startAt = payload.startAt;
      startMultiplayerGame();
    })
    .on("broadcast", { event: "progress" }, ({ payload }) => {
      applyRemoteProgress(payload);
    })
    .on("broadcast", { event: "return-lobby" }, async () => {
      if (!state.room) {
        return;
      }
      await returnToLobbyFromMatch("Back in lobby. Ready up for the next match.");
    });

  await new Promise((resolve, reject) => {
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        try {
          await updateOwnPresence({ isHost });
          resolve();
        } catch (error) {
          reject(error);
        }
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(new Error("Realtime room connection failed."));
      }
    });
  });

  state.realtimeChannel = channel;
  syncRoomPresence(channel);
  updateLobbyView();
  setScreen("lobby");
}

function updateLobbyView() {
  if (!state.room) {
    return;
  }

  elements.lobbyRoomCode.textContent = state.room.code;
  elements.lobbyRole.textContent = state.room.isHost ? "Host" : "Guest";
  elements.lobbyStatus.textContent = state.room.status;
  elements.lobbyPlayers.innerHTML = "";

  state.room.players.forEach((player) => {
    const row = document.createElement("div");
    row.className = `lobby-player${player.ready ? " ready" : ""}`;
    row.innerHTML = `<span>${player.name}</span><span>${player.status}</span>`;
    elements.lobbyPlayers.appendChild(row);
  });

  elements.readyToggleButton.textContent = state.playerReady ? "Unready" : "Ready Up";
  elements.startMatchButton.hidden = !state.room.isHost;
  elements.startMatchButton.disabled = !state.room.isHost || !state.room.ready;
}

async function leaveLobby() {
  clearLobbyTimer();
  clearCountdown();
  await disconnectRealtimeRoom();
  state.playerReady = false;
  state.room = null;
  setScreen("multiplayer-menu");
}

function startSinglePlayerGame(variant = "arcade") {
  state.gameMode = "single";
  state.singlePlayerVariant = variant;
  state.raceOpponentName = RACE_RIVAL_NAME;
  state.matchEnded = false;
  clearLobbyTimer();
  clearCountdown();
  disconnectRealtimeRoom();
  state.playerReady = false;
  state.room = null;
  elements.restartButton.textContent = "Restart Run";
  updateModePanels();
  setScreen("game");
  restartSession();
}

function startMultiplayerGame() {
  state.gameMode = "multiplayer";
  state.raceOpponentName = state.room?.opponentName || "Opponent";
  state.matchEnded = false;
  clearLobbyTimer();
  clearCountdown();
  elements.restartButton.textContent = "Leave Match";
  updateModePanels();
  setScreen("game");
  restartSession();
  updateResultsPanel();
  updateOwnPresence().catch(() => {});
  setMessage(`Room ${state.room?.code || "LIVE"} started. Beat ${state.raceOpponentName}.`);
}

async function createRoom() {
  state.gameMode = "multiplayer";
  state.playerReady = false;
  clearLobbyTimer();
  const supabase = await ensureSupabaseClient();
  const playerName = getPlayerName();

  let code = makeRoomCode();
  for (let tries = 0; tries < 5; tries += 1) {
    const { data: existing } = await supabase
      .from("game_rooms")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (!existing) {
      break;
    }

    code = makeRoomCode();
  }

  const { data, error } = await supabase
    .from("game_rooms")
    .insert({
      code,
      host_player_id: state.playerId,
      host_name: playerName,
      status: "waiting"
    })
    .select("id, code")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await connectRealtimeRoom(data, true);
}

async function joinRoom(code) {
  state.gameMode = "multiplayer";
  state.playerReady = false;
  clearLobbyTimer();
  const supabase = await ensureSupabaseClient();

  const { data, error } = await supabase
    .from("game_rooms")
    .select("id, code, status")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Room not found.");
  }

  if (data.status === "live") {
    throw new Error("That room has already started.");
  }

  await connectRealtimeRoom(data, false);
}

async function startRoomMatch() {
  if (!state.room?.isHost || !state.room.ready) {
    return;
  }

  const supabase = await ensureSupabaseClient();
  const seed = `room-${state.room.code}-${Date.now()}`;
  const startAt = Date.now() + 4000;

  const { error } = await supabase
    .from("game_rooms")
    .update({
      status: "live",
      seed
    })
    .eq("id", state.room.roomId);

  if (error) {
    throw new Error(error.message);
  }

  state.room.status = "live";
  state.room.seed = seed;
  state.room.startAt = startAt;
  await broadcastRoomEvent("match-start", {
    hostId: state.playerId,
    seed,
    startAt
  });
}

async function toggleReadyState() {
  state.playerReady = !state.playerReady;
  await updateOwnPresence();
  updateLobbyView();
}

async function rematchMatch() {
  if (!state.room) {
    return;
  }

  const supabase = await ensureSupabaseClient();
  if (state.room.isHost) {
    const { error } = await supabase
      .from("game_rooms")
      .update({
        status: "waiting",
        seed: null
      })
      .eq("id", state.room.roomId);

    if (error) {
      throw new Error(error.message);
    }
  }

  await broadcastRoomEvent("return-lobby", {
    roomCode: state.room.code
  });
  await returnToLobbyFromMatch("Back in lobby. Ready up for the next match.");
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

function buildSessionRounds(seedText = null) {
  const seed = seedText || `run-${Date.now()}`;
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

function getRandomPuzzleCount(length, availableCount) {
  const maxCount = Math.min(availableCount, length === 4 ? 4 : 3);
  const minCount = 1;
  return Math.max(minCount, Math.floor(Math.random() * maxCount) + 1);
}

function buildPuzzleWords(roundData) {
  return REQUIRED_LENGTHS.reduce((groups, length) => {
    const sourceWords = shuffle([...roundData.answersByLength[length]]);
    const targetCount = getRandomPuzzleCount(length, sourceWords.length);
    groups[length] = sourceWords
      .slice(0, targetCount)
      .sort((left, right) => left.localeCompare(right))
      .map((word) => ({
        word,
        solved: false
      }));
    return groups;
  }, {});
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

function normalizeLeaderboardEntries(entries) {
  const seen = new Set();

  return entries
    .map((entry) => ({
      name: String(entry?.name || "Player").trim().slice(0, 16) || "Player",
      score: Number(entry?.score || 0),
      rounds: Number(entry?.rounds || SESSION_ROUND_COUNT),
      timestamp: entry?.created_at || entry?.timestamp || null
    }))
    .filter((entry) => Number.isFinite(entry.score) && entry.score >= 0)
    .filter((entry) => {
      const key = `${entry.name}|${entry.score}|${entry.rounds}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
}

function updateHud() {
  elements.score.textContent = String(state.score);
  elements.survivalMultiplier.textContent = `x${state.survivalMultiplier.toFixed(2)}`;
  elements.round.textContent = `${Math.min(state.round, Math.max(state.sessionRounds.length, 1))}/${Math.max(state.sessionRounds.length, 1)}`;
  elements.bestScore.textContent = String(getBestScore());
  elements.foundCount.textContent = `${state.recentWords.length} word${state.recentWords.length === 1 ? "" : "s"} locked in`;
  elements.modeSummary.textContent = state.gameMode === "single" && state.singlePlayerVariant === "puzzle"
    ? "Puzzle Mode"
    : "";
}

function clearRivalTimers() {
  state.rivalTimers.forEach((timerId) => window.clearTimeout(timerId));
  state.rivalTimers = [];
}

function createRacePlayers() {
  state.racePlayers = [{
    id: "you",
    name: "You",
    score: 0,
    round: 1,
    currentSolved: {},
    finished: false,
    isYou: true
  }];

  if (state.gameMode === "multiplayer") {
    state.racePlayers.push({
      id: "rival",
      name: state.raceOpponentName || RACE_RIVAL_NAME,
      score: 0,
      round: 1,
      currentSolved: {},
      finished: false,
      isYou: false
    });
  }
}

function updateRaceBoard() {
  elements.raceBoard.innerHTML = "";
  const sortedPlayers = state.racePlayers.slice().sort((left, right) => right.score - left.score);
  const leadingScore = sortedPlayers[0]?.score ?? 0;

  sortedPlayers
    .forEach((player) => {
      const lane = document.createElement("article");
      const isLeading = player.score === leadingScore && leadingScore > 0;
      lane.className = `race-lane${player.isYou ? " you" : ""}${player.finished ? " finished" : ""}${isLeading ? " leading" : ""}`;

      const name = document.createElement("div");
      name.className = "race-lane-name";
      name.innerHTML = `<strong>${player.name}</strong><span>${player.finished ? "Done" : isLeading ? "Leading" : player.isYou ? "You" : "Live"}</span>`;

      const score = document.createElement("div");
      score.className = "race-lane-score";
      score.innerHTML = `<strong>${player.score}</strong><span>Score</span>`;

      const round = document.createElement("div");
      round.className = "race-lane-round";
      round.innerHTML = `<strong>${Math.min(player.round, SESSION_ROUND_COUNT)}/${SESSION_ROUND_COUNT}</strong><span>Rd</span>`;

      const progress = document.createElement("div");
      progress.className = "race-progress";

      REQUIRED_LENGTHS.forEach((length) => {
        const cell = document.createElement("div");
        const shouldFlash = player.flashLength === length && (player.flashUntil || 0) > Date.now();
        cell.className = `race-cell${player.currentSolved[length] ? " complete" : ""}${shouldFlash ? " flash" : ""}`;
        cell.textContent = String(length);
        progress.appendChild(cell);
      });

      lane.append(name, score, round, progress);
      elements.raceBoard.appendChild(lane);
    });
}

function getRacePlayer(id) {
  return state.racePlayers.find((player) => player.id === id);
}

function getRivalWordPoints(length, round) {
  const survival = Math.min(1 + Math.max(round - 1, 0) * SURVIVAL_STEP, SURVIVAL_CAP);
  return Math.round(LENGTH_SCORES[length] * survival);
}

function getRivalRoundBonus(round) {
  const survival = Math.min(1 + Math.max(round - 1, 0) * SURVIVAL_STEP, SURVIVAL_CAP);
  return Math.round((ROUND_CLEAR_BONUS + 120) * survival);
}

function scheduleRivalRound() {
  clearRivalTimers();
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
    const when = entry.timestamp ? new Date(entry.timestamp) : null;
    const whenLabel = when && !Number.isNaN(when.getTime())
      ? when.toLocaleDateString()
      : "Seeded";
    item.innerHTML = `<span>#${index + 1} ${entry.name} ${entry.score}</span><span>Round ${entry.rounds} | ${whenLabel}</span>`;
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
    state.scores.leaderboard = normalizeLeaderboardEntries(Array.isArray(payload.scores) ? payload.scores : []);
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
  const shouldShow = state.gameMode === "single" && !state.currentRound && state.score > 0 && !state.hasSubmittedScore;
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

  if (state.gameMode === "single" && state.singlePlayerVariant === "puzzle") {
    return;
  }

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

function updateMysteryPanel() {
  elements.mysteryGroups.innerHTML = "";

  if (!(state.gameMode === "single" && state.singlePlayerVariant === "puzzle") || !state.currentRound) {
    return;
  }

  REQUIRED_LENGTHS.forEach((length) => {
    const words = state.currentRound.puzzleWordsByLength?.[length] || [];
    const group = document.createElement("div");
    group.className = "mystery-group";

    const title = document.createElement("div");
    title.className = "mystery-group-title";
    title.textContent = `${length} Letters`;
    group.appendChild(title);

    words.forEach((entry) => {
      const row = document.createElement("div");
      row.className = `mystery-word${entry.solved ? " solved" : ""}`;

      entry.word.split("").forEach((letter) => {
        const cell = document.createElement("div");
        cell.className = "mystery-letter";
        cell.textContent = entry.solved ? letter.toUpperCase() : letter.toUpperCase();
        row.appendChild(cell);
      });

      group.appendChild(row);
    });

    elements.mysteryGroups.appendChild(group);
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
  if (state.gameMode === "single" && state.singlePlayerVariant === "puzzle") {
    elements.timer.textContent = "Free";
    elements.timer.classList.remove("danger");
    elements.timer.parentElement.classList.remove("danger-panel");
    return;
  }

  if (!state.currentRound) {
    elements.timer.textContent = `${ROUND_TIME_LIMIT}s`;
    elements.timer.classList.remove("danger");
    elements.timer.parentElement.classList.remove("danger-panel");
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

function startRoundTimerAt(startAt) {
  clearTimer();
  state.roundDeadline = startAt + ROUND_TIME_LIMIT * 1000;
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

function loadNextRound(messageText, startAt = null) {
  const nextRound = chooseNextRound();
  if (!nextRound) {
    return;
  }

  state.currentRound = nextRound;
  if (state.gameMode === "single" && state.singlePlayerVariant === "puzzle") {
    state.currentRound.puzzleWordsByLength = buildPuzzleWords(state.currentRound);
  }
  const you = getRacePlayer("you");
  if (you) {
    you.round = state.round;
    you.currentSolved = {};
  }
  renderWheels(state.currentRound);
  updateHud();
  updateRaceBoard();
  updateGoals();
  updateMysteryPanel();
  updateRecentWords();
  setMessage(messageText || "Fresh letters at six. Make them count.");
  elements.guessInput.value = "";
  setSpinning(true);

  const startDelay = startAt ? Math.max(startAt - Date.now(), 0) : 950;
  if (startAt) {
    showCountdown(startAt);
  } else {
    clearCountdown();
  }

  const waitTime = startAt ? Math.max(startDelay, 0) : 950;
  window.setTimeout(() => {
    setSpinning(false);
    clearCountdown();
    if (state.gameMode === "single" && state.singlePlayerVariant === "puzzle") {
      clearTimer();
      updateTimerDisplay();
    } else if (startAt) {
      startRoundTimerAt(startAt);
    } else {
      startRoundTimer();
    }
    scheduleRivalRound();
    elements.guessInput.focus();
  }, waitTime);
}

function scoreWord(word) {
  const basePoints = LENGTH_SCORES[word.length];
  const points = state.gameMode === "single" && state.singlePlayerVariant === "puzzle"
    ? basePoints
    : Math.round(basePoints * state.survivalMultiplier);
  return {
    basePoints,
    points
  };
}

function getRemainingPuzzleWords() {
  return REQUIRED_LENGTHS.flatMap((length) => (state.currentRound.puzzleWordsByLength?.[length] || []).filter((entry) => !entry.solved));
}

function handlePuzzleGuess(word) {
  const words = state.currentRound.puzzleWordsByLength?.[word.length] || [];
  const match = words.find((entry) => entry.word === word);

  if (!match) {
    setMessage(`"${word.toUpperCase()}" is valid, but not one of this board's mystery words.`, "error");
    return;
  }

  if (match.solved) {
    setMessage(`"${word.toUpperCase()}" is already solved.`, "error");
    return;
  }

  const { points } = scoreWord(word);
  match.solved = true;
  state.score += points;
  state.recentWords.unshift({ word, letters: state.currentRound.letters, points });
  updateBestScore();
  updateHud();
  updateMysteryPanel();
  updateRecentWords();
  playWordScoreSound();
  spawnScorePopup(`+${points}`, "word", -40);

  const remaining = getRemainingPuzzleWords();
  if (remaining.length === 0) {
    if (state.sessionIndex >= state.sessionRounds.length) {
      endSession(`Puzzle run complete. "${word.toUpperCase()}" finished the final board.`);
      return;
    }

    state.round += 1;
    loadNextRound(`Board cleared. "${word.toUpperCase()}" solved the final mystery word for this combo.`);
    return;
  }

  setMessage(`Solved "${word.toUpperCase()}" for +${points}. ${remaining.length} mystery word${remaining.length === 1 ? "" : "s"} left.`, "success");
  elements.guessInput.value = "";
  elements.guessInput.focus();
}

function handleCorrectGuess(word) {
  if (state.gameMode === "single" && state.singlePlayerVariant === "puzzle") {
    handlePuzzleGuess(word);
    return;
  }

  const { basePoints, points } = scoreWord(word);
  state.currentRound.solvedLengths[word.length] = word;
  state.currentRound.solveSequence.push(word.length);
  state.score += points;
  state.usedWords.add(word);
  state.recentWords.unshift({ word, letters: state.currentRound.letters, points });
  updateBestScore();
  updateHud();
  const you = getRacePlayer("you");
  if (you) {
    you.score = state.score;
    you.currentSolved[word.length] = true;
  }
  updateRaceBoard();
  if (state.gameMode === "multiplayer") {
    broadcastRoomEvent("progress", {
      type: "solve",
      playerId: state.playerId,
      name: state.playerName,
      score: state.score,
      round: state.round,
      length: word.length,
      solvedLengths: Object.keys(state.currentRound.solvedLengths).map((length) => Number(length))
    }).catch(() => {});
  }
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
    if (you) {
      you.score = state.score;
      you.round += 1;
      you.currentSolved = {};
      if (you.round > SESSION_ROUND_COUNT) {
        you.finished = true;
      }
    }
    updateRaceBoard();
    if (state.gameMode === "multiplayer") {
      broadcastRoomEvent("progress", {
        type: "round-clear",
        playerId: state.playerId,
        name: state.playerName,
        score: state.score,
        round: you?.round || state.round + 1
      }).catch(() => {});
    }
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

  if (state.gameMode === "single" && state.singlePlayerVariant === "puzzle") {
    return;
  }

  clearTimer();
  clearRivalTimers();
  playFailureSound();

  state.consecutiveClears = 0;
  state.survivalMultiplier = 1;
  state.round += 1;
  updateHud();
  const you = getRacePlayer("you");
  if (you) {
    you.score = state.score;
    you.round = state.round;
    you.currentSolved = {};
    if (you.round > SESSION_ROUND_COUNT) {
      you.finished = true;
    }
  }
  updateRaceBoard();
  if (state.gameMode === "multiplayer") {
    broadcastRoomEvent("progress", {
      type: "round-fail",
      playerId: state.playerId,
      name: state.playerName,
      score: state.score,
      round: you?.round || state.round
    }).catch(() => {});
  }

  if (state.sessionIndex >= state.sessionRounds.length) {
    endSession(message);
    return;
  }

  loadNextRound(message);
}

function isValidGuess(word) {
  return state.validationSet.has(word) && includesLetterRequirements(word, state.currentRound.letters);
}

function endSession(reason = "Run complete.", options = {}) {
  const { broadcast = true } = options;
  clearTimer();
  clearRivalTimers();
  if (state.gameMode === "multiplayer" && broadcast) {
    broadcastRoomEvent("progress", {
      type: "session-end",
      playerId: state.playerId,
      name: state.playerName,
      score: state.score
    }).catch(() => {});
  }
  state.currentRound = null;
  state.matchEnded = state.gameMode === "multiplayer";
  state.scores.best = Math.max(state.scores.best || 0, state.score);
  state.hasSubmittedScore = false;
  persistScores();
  updateHud();
  updateLeaderboard();
  updateRaceBoard();
  updateSubmitScorePanel();
  updateResultsPanel();
  updateGoals();
  updateMysteryPanel();
  updateRecentWords();
  if (state.gameMode === "multiplayer") {
    updateOwnPresence().catch(() => {});
  }
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

  if (!(state.gameMode === "single" && state.singlePlayerVariant === "puzzle") && state.usedWords.has(guess)) {
    setMessage(`"${guess.toUpperCase()}" was already played. Find a fresh one.`, "error");
    return;
  }

  if (state.gameMode === "single" && state.singlePlayerVariant === "puzzle") {
    handleCorrectGuess(guess);
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
  clearRivalTimers();
  state.matchEnded = false;
  state.score = 0;
  state.survivalMultiplier = 1;
  state.consecutiveClears = 0;
  state.round = 1;
  state.currentRound = null;
  state.puzzleWordsByLength = {};
  state.recentWords = [];
  state.usedWords = new Set();
  state.hasSubmittedScore = false;
  state.wheelOffsets = [0, 0, 0];
  state.sessionIndex = 0;
  state.sessionRounds = buildSessionRounds(state.gameMode === "multiplayer" ? state.room?.seed : null);
  createRacePlayers();
  elements.wheelGrid.innerHTML = "";
  updateHud();
  updateLeaderboard();
  updateRaceBoard();
  updateSubmitScorePanel();
  updateResultsPanel();
  updateGoals();
  updateMysteryPanel();
  updateRecentWords();
  loadNextRound("Run ready. Eight rounds. Build your streak.", state.gameMode === "multiplayer" ? state.room?.startAt : null);
}

function hasAscendingSolveOrder() {
  return state.currentRound.solveSequence.length === REQUIRED_LENGTHS.length
    && state.currentRound.solveSequence.every((length, index) => length === REQUIRED_LENGTHS[index]);
}

async function loadDictionary() {
  setSpinning(true);
  setMessage("Loading proper game dictionary and balancing rounds...");
  updateEntryButtons();

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
    elements.homeStatus.textContent = "Dictionary failed to load.";
    setMessage("The dictionary loaded, but no playable rounds were built.", "error");
    updateEntryButtons();
    return;
  }

  elements.homeStatus.textContent = "Choose a mode.";
  updateEntryButtons();
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
elements.restartButton.addEventListener("click", async () => {
  ensureAudioReady();
  if (state.gameMode === "multiplayer") {
    clearCountdown();
    await disconnectRealtimeRoom();
    state.room = null;
    state.gameMode = "single";
    elements.restartButton.textContent = "Restart Run";
    setScreen("home");
    return;
  }
  restartSession();
});
elements.leaderboardButton.addEventListener("click", () => {
  elements.leaderboardPanel.hidden = !elements.leaderboardPanel.hidden;
});
elements.singlePlayerButton.addEventListener("click", () => {
  setScreen("single-player-menu");
});
elements.arcadeModeButton.addEventListener("click", () => {
  ensureAudioReady();
  startSinglePlayerGame("arcade");
});
elements.puzzleModeButton.addEventListener("click", () => {
  ensureAudioReady();
  startSinglePlayerGame("puzzle");
});
elements.singlePlayerBackButton.addEventListener("click", () => {
  setScreen("home");
});
elements.multiplayerButton.addEventListener("click", () => {
  elements.playerNameMenuInput.value = state.playerName;
  setScreen("multiplayer-menu");
});
elements.rulesButton.addEventListener("click", () => {
  setScreen("rules");
});
elements.rulesBackButton.addEventListener("click", () => {
  setScreen("home");
});
elements.playerNameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  persistPlayerName(sanitizePlayerName(elements.playerNameMenuInput.value) || "Player");
  elements.playerNameMenuInput.value = state.playerName;
});
elements.createRoomButton.addEventListener("click", async () => {
  ensureAudioReady();
  elements.multiplayerStatus.textContent = "Creating room...";
  try {
    persistPlayerName(sanitizePlayerName(elements.playerNameMenuInput.value) || "Player");
    elements.playerNameMenuInput.value = state.playerName;
    await createRoom();
    elements.multiplayerStatus.textContent = "";
  } catch (error) {
    elements.multiplayerStatus.textContent = error.message;
  }
});
elements.joinRoomForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = String(elements.joinRoomInput.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (!code) {
    elements.multiplayerStatus.textContent = "Enter a room code first.";
    return;
  }
  ensureAudioReady();
  elements.multiplayerStatus.textContent = "Joining room...";
  persistPlayerName(sanitizePlayerName(elements.playerNameMenuInput.value) || "Player");
  elements.playerNameMenuInput.value = state.playerName;
  elements.joinRoomInput.value = code;
  try {
    await joinRoom(code);
    elements.multiplayerStatus.textContent = "";
  } catch (error) {
    elements.multiplayerStatus.textContent = error.message;
  }
});
elements.backToHomeButton.addEventListener("click", async () => {
  clearLobbyTimer();
  await disconnectRealtimeRoom();
  state.room = null;
  elements.multiplayerStatus.textContent = "";
  setScreen("home");
});
elements.leaveLobbyButton.addEventListener("click", async () => {
  await leaveLobby();
});
elements.copyRoomCodeButton.addEventListener("click", async () => {
  if (!state.room?.code) {
    return;
  }
  try {
    await navigator.clipboard.writeText(state.room.code);
    showToast(`Copied ${state.room.code}.`);
  } catch (error) {
    showToast(`Room code: ${state.room.code}`);
  }
});
elements.readyToggleButton.addEventListener("click", async () => {
  try {
    await toggleReadyState();
  } catch (error) {
    elements.lobbyStatus.textContent = error.message;
  }
});
elements.startMatchButton.addEventListener("click", async () => {
  if (!state.room?.ready) {
    return;
  }
  ensureAudioReady();
  elements.lobbyStatus.textContent = "Starting match...";
  try {
    await startRoomMatch();
  } catch (error) {
    elements.lobbyStatus.textContent = error.message;
  }
});
elements.rematchButton.addEventListener("click", async () => {
  try {
    await rematchMatch();
  } catch (error) {
    elements.resultsSummary.textContent = error.message;
  }
});
elements.leaveMatchButton.addEventListener("click", async () => {
  clearCountdown();
  await disconnectRealtimeRoom();
  state.room = null;
  state.gameMode = "single";
  state.matchEnded = false;
  state.playerReady = false;
  elements.restartButton.textContent = "Restart Run";
  setScreen("home");
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

setScreen("home");
elements.playerNameMenuInput.value = state.playerName;
updateModePanels();
updateEntryButtons();
loadDictionary();
