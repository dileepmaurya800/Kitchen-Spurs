# Verification record

Environment: Windows, Node.js v24.16.0, npm 12.2.0. Local verification performed on 19 October 2026.

## Automated checks

- `npm test`: 14 tests passed.
- `npm run build`: Vite production build passed.
- SQLite persistence verified by closing and reopening a temporary database.
- HTTP tests use real loopback servers; no public service is required.

Tests cover both positive paths and failure boundaries. SDK browser tests use isolated mocked browser primitives, not a full browser engine. UI behavior is checked manually below.

## Manual UI flow

1. Opened the restaurant in the in-app browser.
2. Navigated to `/menu` and added Pesto rigatoni and a Harvest bowl.
3. Placed a real demo order with server-calculated value **₹760**.
4. Opened `/dashboard` and authenticated with the local review token.
5. Verified **2 page views, 1 unique visitor, 6 total events, 1 order and ₹760 order value** for that initial session.
6. Verified browser `page_view`, `add_to_cart`, `checkout_started` alongside server `order_created` in recent events.
7. Selected Today, then used the native date pickers to query 18 October 2026 alone; verified all metrics became zero and the activity lists showed empty states. Restored the seven-day range and verified the original totals returned.
8. Inspected desktop (1440px), mobile (390px), and default browser layouts. Restored the browser's default viewport.

These values describe the captured session, not hardcoded values or expected totals after further use. Application data is local and excluded from the repository.

## Boundaries

No production load test, hosted application backend, or personal introduction recording was performed. Screenshots show actual application state.

## Demonstration recording

An edited live browser recording with synthetic narration was added on 19 October 2026. It includes a new ₹640 order, dashboard activity, native date-picker filtering, empty results, and technical explanation cards. The video lasts 244.76 seconds, uses H.264 video and AAC audio, and includes English subtitles.

The complete MP4 decoded without errors. Sample frames across all ten chapters were visually inspected. The public [playback page](https://dileepmaurya800.github.io/Kitchen-Spurs/) returned HTTP 200 without authentication. In-browser playback was verified: the video loaded with no media error and its playback time advanced beyond 14 seconds. GitHub Pages deployment and repository CI both succeeded for the video publication commit.
