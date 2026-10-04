# Reddit Live

Personal live comment viewer for Reddit threads.

## Current status

**Phase 0 / mock development**

The app is being built so that the user can paste a public Reddit thread URL and follow comments in a chronological, automatically refreshing stream.

Reddit Data API access has been requested. Until approval arrives, the project uses a mock mode so the frontend and live-stream behavior can be developed and tested without scraping Reddit.

## Architecture

```text
GitHub
  |
  +--> Cloudflare Pages --> static frontend
  |
  +--> Supabase Edge Function --> Reddit provider
                                  |
                                  +--> mock provider (now)
                                  +--> Reddit API provider (after approval)
```

## Files

```text
.
├── index.html
├── styles.css
├── app.js
├── Plan.md
├── README.md
└── supabase/
    └── functions/
        └── reddit-comments/
            └── index.ts
```

## Security

Reddit credentials must never be committed to GitHub. They will be stored as Supabase Edge Function secrets when Reddit access is approved.

## Phase 0 goal

Prove that:

1. the static frontend can call Supabase;
2. a Reddit thread URL can be parsed;
3. normalized comments can be returned;
4. live polling behavior can be tested using mock comments;
5. the Reddit provider can later be switched from mock to real API access without rebuilding the UI.
