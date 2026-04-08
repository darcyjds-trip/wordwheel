const SEEDED_SCORES = [
  { name: "Maya", score: 8420, rounds: 8 },
  { name: "Leo", score: 7910, rounds: 8 },
  { name: "Ava", score: 7550, rounds: 8 },
  { name: "Noah", score: 7030, rounds: 8 },
  { name: "Ivy", score: 6680, rounds: 8 }
];

const MAX_NAME_LENGTH = 16;
const MAX_SCORE = 500000;

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

function getHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}

async function fetchScores(url, key) {
  const response = await fetch(`${url}/rest/v1/scores?select=id,name,score,rounds,created_at&order=score.desc,created_at.asc&limit=10`, {
    headers: getHeaders(key)
  });

  if (!response.ok) {
    throw new Error(`Score fetch failed with ${response.status}`);
  }

  return response.json();
}

async function seedScores(url, key) {
  const response = await fetch(`${url}/rest/v1/scores`, {
    method: "POST",
    headers: {
      ...getHeaders(key),
      Prefer: "return=representation"
    },
    body: JSON.stringify(SEEDED_SCORES)
  });

  if (!response.ok) {
    throw new Error(`Seed insert failed with ${response.status}`);
  }

  return response.json();
}

async function insertScore(url, key, payload) {
  const response = await fetch(`${url}/rest/v1/scores`, {
    method: "POST",
    headers: {
      ...getHeaders(key),
      Prefer: "return=representation"
    },
    body: JSON.stringify([payload])
  });

  if (!response.ok) {
    throw new Error(`Score insert failed with ${response.status}`);
  }

  return response.json();
}

function sanitizeName(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

export default async function handler(req, res) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return json(res, 500, { error: "Supabase environment variables are missing." });
  }

  try {
    if (req.method === "GET") {
      let scores = await fetchScores(url, key);
      if (scores.length === 0) {
        await seedScores(url, key);
        scores = await fetchScores(url, key);
      }
      return json(res, 200, { scores });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const name = sanitizeName(body.name);
      const score = Number(body.score);
      const rounds = Number(body.rounds);

      if (!name) {
        return json(res, 400, { error: "Name is required." });
      }

      if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
        return json(res, 400, { error: "Score is invalid." });
      }

      if (!Number.isFinite(rounds) || rounds < 1 || rounds > 99) {
        return json(res, 400, { error: "Rounds value is invalid." });
      }

      await insertScore(url, key, { name, score, rounds });
      const scores = await fetchScores(url, key);
      return json(res, 200, { scores });
    }

    return json(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
}
