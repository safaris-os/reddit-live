# Reddit Live — MVP Plan

**Working language:** English  
**Preferred stack:** GitHub + Cloudflare Pages + Supabase  
**Primary goal:** A lightweight personal web app that turns a public Reddit thread into an automatically refreshing chronological comment stream.

## 1. Product goal

> Paste a Reddit thread URL → see new comments appear automatically without manually refreshing Reddit.

The first version should remain small, reliable, effectively free for personal use, and easy to maintain.

## 2. Architecture

```text
Cloudflare Pages
      |
      v
Frontend (HTML/CSS/JS)
      |
      v
Supabase Edge Function
      |
      v
RedditProvider abstraction
      |
      +--> Mock provider during development
      |
      +--> Approved Reddit API provider when access is available
```

The frontend must consume provider-neutral JSON rather than Reddit's raw response format.

## 3. Phase 0

Before depending on Reddit access, prove:

1. Reddit thread URLs can be parsed.
2. Cloudflare-hosted/static frontend can call Supabase.
3. Supabase can return normalized thread/comment data.
4. Mock comments can simulate a live thread.
5. The provider can later be swapped for the real Reddit API.

## 4. Normalized response

```json
{
  "thread": {
    "id": "abc123",
    "title": "Match Thread",
    "subreddit": "soccer",
    "permalink": "/r/soccer/comments/abc123/..."
  },
  "comments": [
    {
      "id": "def456",
      "author": "username",
      "body": "What a goal",
      "createdUtc": 1791141420,
      "parentId": "t3_abc123",
      "permalink": null
    }
  ],
  "meta": {
    "provider": "mock",
    "fetchedAt": "..."
  }
}
```

## 5. Phase 1 MVP

After the data pipeline works:

- paste a normal Reddit thread URL
- load existing comments
- flatten comments into chronological order
- poll about every 10 seconds
- deduplicate by comment ID
- append only new comments
- pause/resume
- smart auto-scroll
- show LIVE / PAUSED / update status
- tolerate temporary failures

## 6. Data handling

For v0.1:

- no permanent Reddit comment storage
- no user account
- no Supabase database
- comments live only in browser memory
- harmless UI preferences may use localStorage

## 7. Important Reddit-specific test

Before real v0.1 is finished, verify new replies deep inside older branches are discovered, including Reddit `more` placeholders if applicable.

Required cases:

```text
New top-level comment       ✓
New reply                   ✓
Reply to reply              ✓
Deeply nested reply         ✓
Deleted comment             ✓
Duplicate after refresh     ✓
Busy match thread           ✓
```

## 8. Out of scope for v0.1

- posting
- voting
- user accounts
- multiple simultaneous threads
- push notifications
- permanent comment storage
- AI features
- subreddit browsing
- keyword alerts
- native mobile app

## 9. Definition of done

v0.1 is done when:

> I can open the deployed Cloudflare URL, paste a busy Reddit match thread, press Start, leave it open for at least an hour, and see new comments and replies appear automatically without manually refreshing Reddit.

Additionally:

- no duplicate comments
- pause/resume works
- smart auto-scroll works
- desktop and mobile work
- credentials remain server-side
- running cost remains effectively zero for personal use

## 10. Guiding principles

1. Function before polish.
2. Reuse GitHub, Cloudflare and Supabase.
3. No database unless needed.
4. No permanent Reddit-data storage for the MVP.
5. Keep credentials server-side.
6. Keep Reddit access replaceable.
7. Prefer vanilla HTML/CSS/JS while the app remains small.
8. Optimize for a personal utility, not a public SaaS product.
