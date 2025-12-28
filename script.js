const heatmapContainer = document.getElementById("heatmap");
const statusEl = document.getElementById("status");
const loadButton = document.getElementById("load-heatmap");
const usernameInput = document.getElementById("username");
const urlParams = new URLSearchParams(window.location.search);
const embeddedMode = urlParams.get("embed") === "1";
const usernameFromQuery = urlParams.get("user");
const copyEmbedButton = document.getElementById("copy-embed");
const embedCodeTextarea = document.getElementById("embed-code");

const buildEmbedCode = (username) => {
  const safeName = username || "tuttlepower";
  return `<iframe src="file:///path/to/chess_heatmap/index.html?user=${encodeURIComponent(
    safeName
  )}&embed=1" style="width: 100%; height: 360px; border: none;"></iframe>`;
};

if (embeddedMode) {
  document.body.classList.add("embed");
}

if (usernameFromQuery) {
  usernameInput.value = usernameFromQuery;
}

embedCodeTextarea.value = buildEmbedCode(usernameInput.value.trim());

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TOTAL_DAYS = 365;

const LEVELS = [
  { threshold: 0, className: "level-0" },
  { threshold: 1, className: "level-1" },
  { threshold: 3, className: "level-2" },
  { threshold: 5, className: "level-3" },
  { threshold: 8, className: "level-4" },
];

const sampleCounts = {
  "2024-01-02": 1,
  "2024-01-05": 2,
  "2024-01-09": 4,
  "2024-01-15": 7,
  "2024-01-22": 10,
  "2024-02-03": 2,
  "2024-02-11": 5,
  "2024-02-18": 9,
  "2024-03-05": 3,
  "2024-03-13": 6,
  "2024-03-29": 8,
  "2024-04-07": 1,
  "2024-04-15": 4,
  "2024-05-01": 7,
  "2024-05-14": 2,
  "2024-06-02": 10,
  "2024-06-18": 5,
  "2024-07-09": 3,
  "2024-07-21": 8,
  "2024-08-11": 1,
  "2024-08-19": 6,
  "2024-09-02": 9,
  "2024-09-24": 4,
  "2024-10-03": 7,
  "2024-10-15": 2,
  "2024-11-04": 10,
  "2024-11-18": 5,
  "2024-12-01": 8,
  "2024-12-20": 3,
};

const parseNdjson = (text) =>
  text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

const normalizeDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().split("T")[0];
};

const aggregatePuzzleCounts = (activity) => {
  const counts = {};

  if (!Array.isArray(activity)) {
    return counts;
  }

  activity.forEach((entry) => {
    const dateValue =
      entry.date ?? entry.timestamp ?? entry.time ?? entry.at ?? entry.startedAt;
    const key = normalizeDateKey(dateValue);
    if (!key) {
      return;
    }

    let count = 1;
    if (Array.isArray(entry.puzzles)) {
      count = entry.puzzles.length;
    } else if (typeof entry.puzzleCount === "number") {
      count = entry.puzzleCount;
    } else if (typeof entry.count === "number") {
      count = entry.count;
    }

    counts[key] = (counts[key] ?? 0) + count;
  });

  return counts;
};

const fetchPuzzleActivity = async (username) => {
  const response = await fetch(
    `https://lichess.org/api/user/${encodeURIComponent(username)}/puzzleActivity`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to load puzzle activity.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("ndjson")) {
    const text = await response.text();
    return parseNdjson(text);
  }

  return response.json();
};

const renderHeatmap = (counts, username, message = "") => {
  heatmapContainer.innerHTML = "";
  const today = new Date();
  const startDate = new Date(today.getTime() - MS_PER_DAY * (TOTAL_DAYS - 1));

  for (let i = 0; i < TOTAL_DAYS; i += 1) {
    const currentDate = new Date(startDate.getTime() + MS_PER_DAY * i);
    const dateKey = currentDate.toISOString().split("T")[0];
    const count = counts[dateKey] ?? 0;

    const dayEl = document.createElement("div");
    dayEl.classList.add("day");

    let levelClass = LEVELS[0].className;
    for (const item of LEVELS) {
      if (count >= item.threshold) {
        levelClass = item.className;
      }
    }
    dayEl.classList.add(levelClass);

    const readableDate = currentDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    dayEl.title = `${readableDate}: ${count} puzzle${count === 1 ? "" : "s"}`;

    heatmapContainer.appendChild(dayEl);
  }

  if (message) {
    statusEl.textContent = message;
    return;
  }

  statusEl.textContent = username
    ? `Showing puzzle activity for ${username}.`
    : "Showing puzzle activity.";
};

const loadHeatmap = async () => {
  const username = usernameInput.value.trim();
  embedCodeTextarea.value = buildEmbedCode(username);
  if (!username) {
    renderHeatmap(sampleCounts, "", "Enter a Lichess username to load data.");
    return;
  }

  statusEl.textContent = "Loading puzzle activity...";
  loadButton.disabled = true;

  try {
    const activity = await fetchPuzzleActivity(username);
    const counts = aggregatePuzzleCounts(activity);

    if (Object.keys(counts).length === 0) {
      renderHeatmap(
        sampleCounts,
        username,
        "No puzzle activity returned yet. Showing sample data instead."
      );
      return;
    }

    renderHeatmap(counts, username);
  } catch (error) {
    renderHeatmap(
      sampleCounts,
      username,
      "Unable to load Lichess data. Showing sample data instead."
    );
  } finally {
    loadButton.disabled = false;
  }
};

loadButton.addEventListener("click", loadHeatmap);
copyEmbedButton.addEventListener("click", async () => {
  const embedCode = embedCodeTextarea.value;
  if (!embedCode) {
    statusEl.textContent = "Enter a username to build the embed code.";
    return;
  }

  try {
    await navigator.clipboard.writeText(embedCode);
    statusEl.textContent = "Embed code copied to clipboard.";
  } catch (error) {
    statusEl.textContent = "Copy failed. Please copy the embed code manually.";
  }
});
usernameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadHeatmap();
  }
});

usernameInput.addEventListener("input", () => {
  embedCodeTextarea.value = buildEmbedCode(usernameInput.value.trim());
});

if (embeddedMode || usernameFromQuery) {
  loadHeatmap();
} else {
  renderHeatmap(sampleCounts, usernameInput.value.trim(), "");
}
