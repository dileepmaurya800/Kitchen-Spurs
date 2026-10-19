# Demo walkthrough (about 3 minutes)

This is a recording script and repeatable review guide. The completed [demonstration video](https://dileepmaurya800.github.io/Kitchen-Spurs/) has full English narration through Setup and closing, using local AI voice matching based on Dileep Maurya's authorized reference recording. It is synthesized speech with approximate voice similarity, rather than a continuous original recording. Its actual sequence and narration are documented in [the transcript](VIDEO-TRANSCRIPT.md).

## 0:00–0:30 · Setup and scope

Show `npm ci`, `npm test`, `npm run build`, and `npm start`. Open `http://localhost:3000`.

“This is a small end-to-end analytics system integrated into a restaurant. It uses React, Express and SQLite, with separate reusable browser and server SDKs. I chose this stack to make it easy to run with one prerequisite, Node 24.”

## 0:30–1:15 · Browser activity and checkout

Navigate from Discover to Our menu, filter a category, and add an item. Open Our story and return to the menu if desired; note that navigation preserves cart state within the restaurant. Place the order and show the confirmation.

“Page views are tracked after actual route changes, while filters and cart actions are explicit custom events. A random visitor ID links those events to the business order. The order total is calculated from the server menu. Browser analytics cannot claim that an order was created.”

## 1:15–1:50 · Dashboard and dates

Open Analytics. Enter `local-review-token`. Allow up to ten seconds for refresh. Point to page views, unique visitors, total events, and order value. Show popular pages, event breakdown and recent activity. Select Today, then choose a range with no events and show its empty state.

“The dashboard queries persisted events, not browser-local counters. It aggregates occurrence times with inclusive UTC date filters. Unique visitors count anonymous identifiers; I don't claim this identifies real people. Dashboard visits themselves are excluded.”

## 1:50–2:30 · Failure handling

Open `sdk/browser.js`, `sdk/server.js` and `server/store.js`.

“The browser queues a bounded number of events in session storage and retries transient failures with the same IDs. The database deduplicates IDs. Beacon delivery is deliberately replayable because sendBeacon doesn't acknowledge persistence. Business order and order event share one transaction, so an analytics insert failure rolls back the order. The standalone server helper uses bounded retries; external business applications need a durable outbox for crash-safe delivery.”

Show the tests for duplicate delivery, order replay and rollback.

## 2:30–3:00 · Boundaries and tradeoffs

“The public write key is an identifier, not a secret. Server event ingestion and analytics reads use separate private tokens. Inputs, batch size, timestamps, origins and request rate are bounded. SQLite keeps setup simple but synchronous queries and a single writer limit throughput. Before production I would add real authentication, durable queueing for external producers, retention controls, distributed rate limiting, and operational monitoring.”

Use your own words and be ready to modify and debug each path. Only claim tests or deployment behavior that you have personally verified.
