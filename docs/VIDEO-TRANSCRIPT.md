# Demonstration video transcript

[Watch online](https://dileepmaurya800.github.io/Kitchen-Spurs/) · [Download MP4](media/demonstration-full-voice.mp4)

Duration: 4 minutes 5 seconds. Every section has English narration. The speech is synthesized using local AI voice matching based on Dileep Maurya's authorized reference recording; similarity is approximate. The reference microphone audio is not mixed into the output.

Voice conversion uses [OpenVoice V2 by MyShell and MIT](https://github.com/myshell-ai/OpenVoice), released under the MIT license. Model provenance watermarking remains enabled. Reference recordings and private voice embeddings are excluded from the repository.

The dashboard contains the new ₹640 order and the earlier ₹760 review order. The video shows the real local application, not a hosted live backend.

## 00:00 · Kitchen Spurs | Analytics SDK & Dashboard

This demonstration shows the Kitchen Spurs analytics assignment running locally. It connects a React restaurant, reusable browser and server tracking clients, event ingestion, SQLite storage, and an analytics dashboard. This is an edited recording of the working application, with synthetic narration.

## 00:19 · 1. Track real page navigation

Navigating to the menu generates a page view through the browser SDK. The application calls the tracker after each actual route change. Query strings and fragments are excluded. A random visitor identifier persists in local storage, while a session identifier rotates after thirty minutes of inactivity. These identifiers represent anonymous browser activity, rather than verified people.

## 00:43 · 2. Capture custom browser events

Category filtering and adding items generate explicit custom events. Here, a pizza and citrus cooler produce a cart total of six hundred and forty rupees. The SDK batches delivery, normally flushing every three seconds. Its bounded session storage queue can survive reloads. Transient failures retry with backoff and the same event identifiers, allowing ingestion to deduplicate replays.

## 01:09 · 3. Create an order and its server event atomically

Placing the order calls the business API. Prices are calculated from the server menu, not trusted from the browser. The order and its order created event are committed in one SQLite transaction. If event persistence fails, the order rolls back too. A repeated request with the same idempotency key returns the existing order instead of creating another one. No payment is collected in this demonstration.

## 01:34 · 4. Query persisted analytics

The dashboard reads authenticated API reports from persisted events. It shows page views, distinct anonymous visitor identifiers, total events, orders, and order value. The two orders shown include an earlier review order and the new six hundred and forty rupee order. These values come from the database. Dashboard navigation itself is excluded from browser page tracking.

## 01:58 · 5. Connect browser activity to trusted business events

Popular pages and the event breakdown reveal how people use the restaurant. Recent activity shows the new order as a server event alongside browser checkout and cart events. The same anonymous visitor identifier connects the flow. The browser cannot submit an order created event. The ingestion endpoint assigns the source, and trusted server ingestion requires a separate private credential.

## 02:21 · 6. Verify date filters and empty states

The Today preset narrows the report to one UTC day. Next, both date pickers select the previous day, which has no events. All metrics become zero and the activity lists show empty states. Date boundaries are inclusive calendar dates, implemented in SQL with an inclusive start and an exclusive end at the following midnight.

## 02:42 · 7. Restore the report and explain delivery guarantees

Restoring the seven day range brings the recorded activity back. Stable event identifiers make retried persistence idempotent, but browser delivery remains best effort. Closing a tab, clearing storage, or exhausting the queue can lose events. The standalone server helper uses bounded authenticated retries. External business systems should persist an outbox with their own business transaction for crash safe delivery.

## 03:08 · Engineering decisions and limits

SQLite keeps setup simple and provides real transactions, but synchronous queries and a single writer limit throughput. Payload validation, body and batch limits, timestamp checks, origin restrictions, and rate limiting bound abuse. A public browser key is only a project identifier. Before production, add proper user authentication, retention controls, monitoring, backups, and distributed ingestion and rate limiting.

## 03:35 · Run and review the submission

The public repository includes setup instructions, SDK examples, architecture, assumptions, and known limitations. With Node twenty four, run npm ci, then npm run dev. Fourteen automated tests, the production build, formatting checks, and GitHub continuous integration passed. The tests cover retries, deduplication, order replay, transaction rollback, authentication, date boundaries, and persistence. Thank you for reviewing the demonstration.
