# Demonstration video guide

[Watch online](https://dileepmaurya800.github.io/Kitchen-Spurs/) · [Download MP4](media/demonstration-dileep.mp4)

Duration: approximately 2 minutes 23 seconds. The first 83 seconds use Dileep Maurya's original supplied recording, with mild noise reduction and level normalization. Subsequent steps use on-screen explanations without AI narration. These guide captions summarize the technical points; they are not a verbatim speech transcript.

The recording covers the introduction, page tracking, and custom cart events. The visual continuation demonstrates order creation, reporting, date filtering, and engineering decisions. The dashboard contains the new ₹640 order plus the earlier ₹760 review order.

## 00:00 · Kitchen Spurs | Analytics SDK & Dashboard

A restaurant analytics system connects browser activity, server events, and dashboard reporting. The application uses React, Express, SQLite, and reusable tracking clients.

## 00:22 · 1. Track page navigation

Opening the menu generates a page-view event through the browser SDK. An anonymous visitor ID links activity; session IDs rotate after thirty minutes of inactivity. Page tracking excludes URL query parameters and fragments.

## 00:50 · 2. Capture custom events and queue delivery

Filtering categories and adding items generate custom browser events. The pizza and citrus cooler total ₹640. Events are queued and delivered in batches. Transient delivery failures retry with the same event IDs, preventing duplicate persistence.

## 01:22 · 3. Create the order | On-screen explanation

The server calculates the ₹640 order price from its own menu. Order and server event persist in one transaction; retrying the same order key does not create a duplicate.

## 01:31 · 4. Query persisted analytics | On-screen explanation

Dashboard metrics are calculated from stored events, rather than browser-local counters. The report includes the earlier ₹760 review order and the new ₹640 order.

## 01:40 · 5. Connect browser and trusted server events

Cart actions are browser events; order_created is a trusted server event. The browser cannot claim order_created. Trusted server ingestion uses a separate private credential.

## 01:48 · 6. Check date boundaries and empty results

The Today preset and native date pickers change the queried UTC reporting range. Selecting a day with no activity returns zero counts and empty lists. The complete end date is included.

## 02:00 · Engineering decisions and limits

Stable event IDs support deduplication; a transaction protects local order/event consistency. SQLite has a single writer and synchronous queries. Browser delivery is best effort. Production work includes user authentication, durable outboxes, retention, monitoring, and backups.

## 02:12 · Run and review the submission

Install Node 24, run npm ci, and then npm run dev. Fourteen tests, formatting checks, the production build, and repository CI passed. See README for setup and limitations.
