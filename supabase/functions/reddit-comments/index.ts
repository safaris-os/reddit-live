type NormalizedComment = {
  id: string;
  author: string | null;
  body: string;
  createdUtc: number;
  parentId: string | null;
  permalink: string | null;
};

type RedditToken = {
  value: string;
  expiresAt: number;
};

let cachedToken: RedditToken | null = null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const requestUrl = new URL(request.url);
    const redditUrl = requestUrl.searchParams.get("url");

    if (!redditUrl) {
      return json({ error: "Missing ?url=<reddit thread URL>." }, 400);
    }

    const parsed = parseRedditThreadUrl(redditUrl);

    if (requestUrl.searchParams.get("mock") === "1") {
      return json(buildMockResponse(parsed));
    }

    return json(await fetchFromReddit(parsed));
  } catch (error) {
    console.error(error);
    return json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error.",
      },
      500
    );
  }
});

async function fetchFromReddit(parsed: ReturnType<typeof parseRedditThreadUrl>) {
  const token = await getApplicationToken();

  const apiUrl = new URL(
    `https://oauth.reddit.com/comments/${encodeURIComponent(parsed.threadId)}.json`
  );
  apiUrl.searchParams.set("raw_json", "1");
  apiUrl.searchParams.set("limit", "500");
  apiUrl.searchParams.set("depth", "10");
  apiUrl.searchParams.set("sort", "new");

  const redditResponse = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": requiredEnv("REDDIT_USER_AGENT"),
    },
  });

  if (!redditResponse.ok) {
    const text = await redditResponse.text();
    throw new Error(
      `Reddit returned ${redditResponse.status}: ${text.slice(0, 300)}`
    );
  }

  const raw = await redditResponse.json();

  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error("Unexpected Reddit response shape.");
  }

  const threadData = raw[0]?.data?.children?.[0]?.data;
  if (!threadData) {
    throw new Error("Thread metadata was missing from Reddit's response.");
  }

  const comments: NormalizedComment[] = [];
  const moreIds = new Set<string>();

  traverseChildren(raw[1]?.data?.children ?? [], comments, moreIds);

  comments.sort((a, b) => {
    if (a.createdUtc !== b.createdUtc) return a.createdUtc - b.createdUtc;
    return a.id.localeCompare(b.id);
  });

  return {
    thread: {
      id: String(threadData.id ?? parsed.threadId),
      title: String(threadData.title ?? ""),
      subreddit: String(threadData.subreddit ?? parsed.subreddit ?? ""),
      permalink: String(threadData.permalink ?? parsed.permalink),
    },
    comments,
    meta: {
      provider: "reddit-data-api",
      fetchedAt: new Date().toISOString(),
      unresolvedMoreChildren: moreIds.size,
    },
  };
}

function buildMockResponse(parsed: ReturnType<typeof parseRedditThreadUrl>) {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / 10);
  const firstBucket = bucket - 4;
  const maxComments = 12;
  const available = Math.min(maxComments, bucket - firstBucket + 1);

  const messages = [
    "This is the first simulated comment.",
    "The mock stream is working — no Reddit data is being used yet.",
    "A new comment appears every ten seconds in development mode.",
    "This lets us test polling and deduplication before API approval.",
    "Pause should stop new requests until you resume.",
    "Replies will later be flattened into the same chronological stream.",
    "The frontend does not know whether the provider is mock or Reddit.",
    "That separation makes the Reddit integration replaceable.",
    "Next we can test the deployed page on mobile.",
    "The real API provider will use the same normalized format.",
    "Almost there — this is another simulated live update.",
    "Mock sequence complete."
  ];

  const comments: NormalizedComment[] = [];

  for (let i = 0; i < available; i += 1) {
    const commentBucket = firstBucket + i;

    comments.push({
      id: `mock-${commentBucket}`,
      author: i % 3 === 0 ? "match_thread_fan" : i % 3 === 1 ? "another_user" : "reddit_live_test",
      body: messages[i],
      createdUtc: commentBucket * 10,
      parentId: i === 0 ? `t3_${parsed.threadId}` : i % 3 === 0 ? `t1_mock-${commentBucket - 1}` : `t3_${parsed.threadId}`,
      permalink: null,
    });
  }

  return {
    thread: {
      id: parsed.threadId,
      title: "Development Mock Thread",
      subreddit: parsed.subreddit ?? "soccer",
      permalink: parsed.permalink,
    },
    comments,
    meta: {
      provider: "mock",
      fetchedAt: new Date().toISOString(),
      unresolvedMoreChildren: 0,
    },
  };
}

function parseRedditThreadUrl(input: string) {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error("That is not a valid URL.");
  }

  const host = url.hostname.toLowerCase();
  const allowed =
    host === "reddit.com" ||
    host === "www.reddit.com" ||
    host === "old.reddit.com" ||
    host === "new.reddit.com";

  if (!allowed) {
    throw new Error("Please paste a reddit.com thread URL.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const commentsIndex = parts.indexOf("comments");

  if (commentsIndex < 0 || !parts[commentsIndex + 1]) {
    throw new Error("This URL does not look like a Reddit thread.");
  }

  const subreddit =
    parts[0]?.toLowerCase() === "r" && parts[1] ? parts[1] : null;

  return {
    threadId: parts[commentsIndex + 1],
    subreddit,
    permalink: url.pathname,
  };
}

function traverseChildren(
  children: any[],
  output: NormalizedComment[],
  moreIds: Set<string>
) {
  for (const child of children) {
    if (!child || typeof child !== "object") continue;

    if (child.kind === "t1" && child.data) {
      const data = child.data;

      output.push({
        id: String(data.id ?? ""),
        author: data.author ? String(data.author) : null,
        body: String(data.body ?? ""),
        createdUtc: Number(data.created_utc ?? 0),
        parentId: data.parent_id ? String(data.parent_id) : null,
        permalink: data.permalink ? String(data.permalink) : null,
      });

      const replies = data.replies;
      if (replies && typeof replies === "object") {
        traverseChildren(replies?.data?.children ?? [], output, moreIds);
      }
    }

    if (child.kind === "more" && child.data) {
      for (const id of child.data.children ?? []) {
        if (id) moreIds.add(String(id));
      }
    }
  }
}

async function getApplicationToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const clientId = requiredEnv("REDDIT_CLIENT_ID");
  const clientSecret = requiredEnv("REDDIT_CLIENT_SECRET");
  const userAgent = requiredEnv("REDDIT_USER_AGENT");

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const tokenResponse = await fetch(
    "https://www.reddit.com/api/v1/access_token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    }
  );

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(
      `Reddit OAuth failed (${tokenResponse.status}): ${text.slice(0, 300)}`
    );
  }

  const tokenPayload = await tokenResponse.json();
  const accessToken = tokenPayload?.access_token;
  const expiresIn = Number(tokenPayload?.expires_in ?? 3600);

  if (!accessToken) {
    throw new Error("Reddit OAuth response did not contain an access token.");
  }

  cachedToken = {
    value: String(accessToken),
    expiresAt: now + expiresIn * 1000,
  };

  return cachedToken.value;
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing Supabase secret: ${name}`);
  }
  return value;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
