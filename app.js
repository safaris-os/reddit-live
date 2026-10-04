const EDGE_FUNCTION_URL =
  "https://llulhbguufhujirowzbu.supabase.co/functions/v1/reddit-comments";

const POLL_INTERVAL_MS = 10_000;
const USE_MOCK_DATA = true;

const form = document.querySelector("#thread-form");
const input = document.querySelector("#thread-url");
const button = document.querySelector("#load-button");
const pauseButton = document.querySelector("#pause-button");
const statusEl = document.querySelector("#status");
const threadCard = document.querySelector("#thread-card");
const subredditEl = document.querySelector("#subreddit");
const titleEl = document.querySelector("#thread-title");
const redditLink = document.querySelector("#reddit-link");
const liveBadge = document.querySelector("#live-badge");
const results = document.querySelector("#results");
const commentsEl = document.querySelector("#comments");
const countEl = document.querySelector("#comment-count");

let currentThreadUrl = null;
let pollTimer = null;
let paused = false;
let requestInFlight = false;
const seenCommentIds = new Set();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const threadUrl = input.value.trim();
  if (!threadUrl) return;

  stopPolling();
  currentThreadUrl = threadUrl;
  paused = false;
  seenCommentIds.clear();
  commentsEl.replaceChildren();

  button.disabled = true;
  button.textContent = "Starting…";

  const ok = await refreshStream({ initial: true });

  button.disabled = false;
  button.textContent = "Start stream";

  if (ok) startPolling();
});

pauseButton.addEventListener("click", () => {
  paused = !paused;

  if (paused) {
    stopPolling();
    pauseButton.textContent = "Resume";
    liveBadge.textContent = "PAUSED";
    liveBadge.classList.add("paused");
    setStatus("Stream paused.");
  } else {
    pauseButton.textContent = "Pause";
    liveBadge.textContent = "LIVE";
    liveBadge.classList.remove("paused");
    setStatus("Resuming…");
    refreshStream().finally(startPolling);
  }
});

async function refreshStream({ initial = false } = {}) {
  if (!currentThreadUrl || requestInFlight || paused) return false;

  requestInFlight = true;

  try {
    const url = new URL(EDGE_FUNCTION_URL);
    url.searchParams.set("url", currentThreadUrl);
    if (USE_MOCK_DATA) url.searchParams.set("mock", "1");

    const response = await fetch(url);
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || `Request failed (${response.status})`);
    }

    renderThreadMeta(payload.thread);

    const newComments = payload.comments.filter(
      (comment) => !seenCommentIds.has(comment.id)
    );

    for (const comment of newComments) {
      seenCommentIds.add(comment.id);
      commentsEl.append(renderComment(comment, !initial));
    }

    countEl.textContent = `${seenCommentIds.size} loaded`;
    threadCard.classList.remove("hidden");
    results.classList.remove("hidden");

    const fetchedAt = new Date(payload.meta.fetchedAt);
    setStatus(
      `${payload.meta.provider === "mock" ? "Mock stream" : "Live stream"} · updated ${fetchedAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      })}${newComments.length ? ` · ${newComments.length} new` : ""}`
    );

    return true;
  } catch (error) {
    setStatus(error.message || "Unable to load the thread.", true);
    return false;
  } finally {
    requestInFlight = false;
  }
}

function renderThreadMeta(thread) {
  subredditEl.textContent = `r/${thread.subreddit || "unknown"}`;
  titleEl.textContent = thread.title || "Reddit thread";
  redditLink.href = `https://www.reddit.com${thread.permalink}`;
}

function renderComment(comment, isNew) {
  const article = document.createElement("article");
  article.className = `comment${isNew ? " new-comment" : ""}`;
  article.dataset.commentId = comment.id;

  const meta = document.createElement("div");
  meta.className = "comment-meta";

  const author = document.createElement("span");
  author.textContent = comment.author || "[deleted]";

  const time = document.createElement("time");
  const date = new Date(comment.createdUtc * 1000);
  time.dateTime = date.toISOString();
  time.textContent = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const body = document.createElement("p");
  body.className = "comment-body";
  body.textContent = comment.body || "";

  meta.append(author, time);
  article.append(meta, body);
  return article;
}

function startPolling() {
  stopPolling();
  if (paused || !currentThreadUrl) return;

  pollTimer = window.setInterval(() => {
    refreshStream();
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}
