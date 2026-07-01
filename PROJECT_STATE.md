# Motorburger — Project State

Read this first. Don't ask for history — this file IS the history that matters.

## Business
Motorburger, container kitchen at Detroit Shipping Company, 474 Peterboro St, Detroit. Owner: Jay. Tue–Sun. Square POS.

## URLs / Repo
- Dashboard: motorburger-dashboard.netlify.app
- Staff portal: /staff-portal.html
- Repo: github.com/jaysouilliere/motorburger-dashboard
- Hosting: Netlify Pro

## File Structure
```
index.html              owner dashboard
staff-portal.html       staff portal (current)
staff-portal(old).html  DELETE — cleanup pending
files.zip               DELETE — cleanup pending
netlify.toml
package.json            @netlify/blobs
netlify/functions/
  square-proxy.js       Square + Ticketmaster + Masonic scraper + blob reader
  staff-submit.js        saves close-out to blob storage
  tripleseat-auth.js     one-time OAuth2 setup helper for Tripleseat (see below) — NOT YET DEPLOYED
```

## Env Vars (Netlify)
SQUARE_TOKEN, SQUARE_LOCATION_ID, TICKETMASTER_KEY
**In progress:** TRIPLESEAT_CLIENT_ID, TRIPLESEAT_CLIENT_SECRET (add once OAuth app created — see Tripleseat section below)

## Owner Dashboard Tabs
Prep | Yesterday | Stats | Events (eye-blur button works)

## Staff Portal
PIN login → geofence clock-in (75m, lat 42.3554/lng -83.0521) → 4-step close-out (inventory, low stock, checklist, notes). Manager PIN 202020 → Timesheets/Pay Period/Team.

## Staff Roster
Brian $16, Mitch $17, Tory $15 (dual role: Line Cook/Host), Brandy $15.
**Alberto — REMOVE from STAFF array.** New hire TBD.

## Protein Map
Beef: Classic Motor, Deux Chevaux, Flyin' Hawaiian, Go-Kart, FUNGuY
Chicken: Firebird | Lamb: Lamborghini | Veggie: Veg Engine

## Benchmarks (daily revenue)
Tue 368 / Wed 404 / Thu 581 / Fri 1238 / Sat 2568 / Sun 1796
2026 target: $352,725 — pacing ~$401K

## Active Bugs
- None currently open. Events tab (Ticketmaster + Masonic) fixed this session — see below.
- Blob storage (@netlify/blobs) — needs confirmed working deploy

## Roadmap / Next Up (priority order)
1. ✅ DONE — Fix Events tab (Ticketmaster + Masonic/AXS) — square-proxy.js rewritten, TICKETMASTER_KEY added to Netlify (was missing entirely, not just misconfigured)
2. ✅ DONE — Staff portal shows today's nearby events on staff_home screen (after clock-in), includes persistent Masonic link as fallback since it's highest-impact venue
3. 🔶 IN PROGRESS — Tripleseat integration (DSC booked events: private parties, pedal pubs, etc.) — see dedicated section below. Currently blocked on Jay getting Tripleseat customer admin role to create OAuth app.
4. Remove Alberto, add new hire (dual role)
5. On-site PIN/geofence test at DSC
6. 🔴911 urgent restock flag system (single system — see Prep List spec below, do not build twice)
7. Auto pull tip pool from Square (currently manual entry in Pay Period tab)
8. Build closing checklist out properly on-site
9. Masonic capacity buffer (main theatre 4900cap +35%, small rooms +15%)
10. Repo cleanup: delete staff-portal(old).html, files.zip

## In-Progress: Tripleseat Integration (DSC booked events — private parties, pedal pubs, etc.)
**Goal:** pull DSC's Tripleseat bookings into the Events tab / staff portal alongside public shows (Ticketmaster/Masonic), so staff/owner see private event volume for the day too.

**Why this is harder than Ticketmaster:** Tripleseat is DSC's account, not Motorburger's. Requires OAuth 2.0 (authorization-code flow, one-time login+consent, then refresh token works indefinitely). OAuth 1.0 legacy method was deprecated July 1, 2026 — must use OAuth 2.0.

**Status as of this session:** Jay has full Tripleseat login access. Was initially blocked — creating an OAuth 2.0 Client Application requires **Tripleseat customer admin role** specifically (regular user access isn't enough). Jay was in the process of getting that role elevated when we paused. **Not yet confirmed he has it / not yet created the OAuth app.**

**Exact next steps to resume:**
1. Confirm Jay now has customer admin role in Tripleseat
2. Settings → Tripleseat API & Webhooks → "View or Edit Client Applications" button → opens external client app management page
3. Create new OAuth 2.0 application:
   - Name: Motorburger Dashboard
   - Redirect URL: `https://motorburger-dashboard.netlify.app/.netlify/functions/tripleseat-auth`
   - Scope: read
4. Get Client ID (UID) + Client Secret from the created app
5. Add to Netlify env vars: `TRIPLESEAT_CLIENT_ID`, `TRIPLESEAT_CLIENT_SECRET`
6. Deploy `netlify/functions/tripleseat-auth.js` — **confirmed NOT yet in the repo** (checked directly, 404). Claude generated this file and gave it to Jay to paste in, but it was never committed. File contents can be regenerated from this session, or re-request from Claude — logic: reads TRIPLESEAT_CLIENT_ID/SECRET env vars, redirects to Tripleseat's OAuth authorize URL, then on callback exchanges the code for tokens and displays the refresh_token on screen to copy into Netlify.
7. Redeploy (no-cache)
8. Visit `https://motorburger-dashboard.netlify.app/.netlify/functions/tripleseat-auth` in browser — one-time login/consent flow, redirects back and displays a refresh token
9. Copy that refresh token into Netlify as `TRIPLESEAT_REFRESH_TOKEN`, redeploy
10. THEN (not built yet): build the actual events-fetching logic — uses refresh token to auto-mint access tokens (no more logins needed after this), calls `GET /v1/events/search.json?event_start_date=MM/DD/YYYY&event_end_date=MM/DD/YYYY` (Tripleseat Events API), surfaces event name, account/contact, room, start/end time, guest count, status. May need `location_ids` param if DSC's Tripleseat account has multiple locations/rooms — check `/v1/locations` once authenticated.

**Side note worth following up:** DSC already has a webhook configured in their Tripleseat account pointing to `api.blazeloop.com/v2/webhooks/tripleseat/events/...` (triggers: Create/Update/Delete Event, Create Lead, Create Internal Lead). This means booking data may already be flowing to a third-party tool (Blazeloop — possibly an ops/scheduling platform DSC uses). Worth asking DSC's admin whether that feed could be tapped instead of building a second Tripleseat integration from scratch.

## In-Progress Spec: Ongoing Prep List (additive only — DO NOT replace index.html)
- New section inside existing Prep tab (dashboard) + Prep view after clock-in (staff portal), not a new page
- Build on branch + Netlify deploy preview, test, then publish
- Shared blob storage between both surfaces (confirm key: new key, e.g. motorburger-prep-list — do NOT silently reuse motorburger-closeouts)
- Item fields: id, dayOfWeek, name, target, count, done, addedBy, doneBy, completedAt, carriedDays, flag911, recurring
- Standing templates editable per-weekday (not hardcoded)
- Duty log: name, day, count, doneBy, completedAt — 7-day auto-purge
- recurring:true regenerates each service; recurring:false carries forward (carriedDays++) until done
- Close-out: completed→duty log, open one-offs→next day (Sun→Tue, skip Mon, confirm Monday has no data row), standing list resets
- flag911 feeds the urgent restock list — this IS the 🔴911 roadmap item, one system not two
- Auto-carry + purge run server-side (scheduled function in netlify.toml, not on page load)
- Geofence/PIN unchanged
- OPEN QUESTION before building: does current owner Prep tab get filled, replaced, or sit-beside by this?

## Workflow Rule
End of every session: update this file with what changed. Don't re-summarize conversation in chat — edit this file directly and commit.
