# Motorburger — Project Summary
*(condensed from PROJECT_STATE.md — updated 2026-08-25)*

## The business
Motorburger — container kitchen at Detroit Shipping Company (DSC), 474 Peterboro St, Detroit. Owner: Jay. Open Tue–Sun (Mon off). Runs on Square POS.

## The app (motorburger-dashboard.netlify.app)
A custom owner dashboard + staff portal, hosted on Netlify, backed by Netlify Functions + Blob storage.

- **Owner dashboard** (`index.html`): Prep / Yesterday / Stats / Events tabs. Events tab shows three color-coded, collapsible groups — Tripleseat (DSC private bookings, green), Ticketmaster (public shows/games, red), Masonic (blue, currently broken — see below).
- **Staff portal** (`staff-portal.html`): PIN login, geofence-enforced clock in/out (100m radius, manager-PIN override for edge cases), 4-step close-out, today's nearby events, manager-gated Timesheets/Pay Period/Manual Entry/Team tools.
- **Data sources feeding `?events=true`:** Square (sales/tips), Ticketmaster API (public shows/games citywide), an AXS scrape for Masonic Temple (currently broken — 0 events, page structure changed), and Tripleseat (DSC's own private-event booking system, fully live via OAuth2).

## What's solid and working
- Tripleseat integration: real bookings flow in, correctly scoped to DSC's site (not their second site, "The Social Brews"), correctly excluding unconfirmed/dead leads (whitelist: only DEFINITE and TENTATIVE statuses pass — a real LOST event leaking through once caused real kitchen confusion, now fixed).
- Pay Period tab: fully rebuilt — shifts and tips now persist server-side (not localStorage), tip-splitting math matches Jay's original tracker logic exactly, full 2-year historical CSV import completed and verified (1,409 shift rows, 547 days).
- Geofence clock-in/out: both directions now enforced (clock-out previously had no check at all, which was the actual source of lost hours).
- Net-revenue calculation and protein-count matching fixed and verified against Square's own reports.

## What's still open
- **Manager PIN override on geofence block doesn't work on phone** — reported live, not yet diagnosed (likely an iOS Safari `prompt()` quirk in PWA mode).
- **End-to-end close-out test** (blob storage fix) still needs a real live confirmation.
- **Masonic/AXS scraper is broken** — returns 0 events. Dashboard and the weekly email both just link out to AXS directly as a workaround for now.
- Repo cleanup (delete stale files), a few naming/tech-debt items, and the "911 urgent restock" + ongoing prep-list feature (spec'd, not yet built).

## Today's work: Weekly DSC Events Email
Set up as a Tuesday-8am scheduled task, then substantially reworked the same day based on live feedback:

- **Two recipients patterns:** Jay + Mitch + Brandy get it every Tuesday. Jay's copy includes a clickable link into his actual Tripleseat calendar on each confirmed booking; Mitch/Brandy's copy doesn't.
- **Scope:** originally DSC bookings only; expanded to also include nearby Ticketmaster events (concerts, Tigers games) since those affect foot traffic/parking too — but restricted to a hand-picked list of venues actually close to DSC (Comerica Park, Ford Field, Little Caesars Arena, Fox Theatre, Saint Andrew's Hall/The Shelter, The Fillmore, Music Hall Center). Far-off venues (Aretha Franklin Amphitheatre, Lager House, Garden Theater at Midtown) are excluded entirely.
- **Labeling:** confirmed DSC bookings show green and marked "(EVENT)"; the small recurring weekly in-house stuff (which Tripleseat marks "Tentative" purely as a color convenience, not real doubt) shows as plain "(In House)" text — so a busy day's real booking doesn't get lost in the noise.
- **High-impact flagging:** nearby city events likely to actually spike traffic get flagged red, based on live research each week (opponent draw, team momentum, tour buzz, sellout signals) rather than a blanket "big venue = flag" rule, which produced false alarms at first.

**Two things this surfaced that are now on the project roadmap, both worth considering for the dashboard app itself, not just the email:** the venue allowlist and the researched high-impact flag could both improve the owner dashboard's own Events tab, which currently shows every Ticketmaster result citywide with no filtering.

## Blocked on Tripleseat API access
Jay is pursuing this (Settings → API in the Tripleseat account). Once available, it unlocks two things neither the dashboard nor the email can do today:
1. Flagging confirmed bookings that have a "MOTOR" menu item on file, so the BEO can be printed and kitchen can prep ahead — not possible with the current data feed, which has zero menu/F&B/BEO data.
2. Upgrading the email's Tripleseat link from a week-view calendar link to a true one-click link to the specific booking — not possible today because the feed has no event ID.

## Still unsolved
Pedal pub group stops have no data source anywhere (not Tripleseat, Ticketmaster, or the Masonic scrape) — proposed fix is to log each stop as a lightweight Tripleseat entry so it flows through the integration that already works, rather than building something new.
