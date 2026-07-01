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
staff-portal.html       staff portal (current) — ROOT LEVEL, not netlify/functions/
staff-portal(old).html  DELETE — cleanup pending
files.zip               DELETE — cleanup pending
netlify.toml
package.json            @netlify/blobs
netlify/functions/
  square-proxy.js       Square + Ticketmaster + Masonic scraper + blob reader
  staff-submit.js        saves close-out to blob storage — ⚠️ CONFIRMED MISSING FROM REPO (see Active Bugs)
  tripleseat-auth.js     one-time OAuth2 setup helper for Tripleseat — DEPLOYED & WORKING as of this session
```
**⚠️ Deploy gotcha (recurring — bit us twice now):** Files placed in the wrong spot deploy silently with no error, they just don't work.
- Session N-1: `staff-portal.html` accidentally uploaded into `netlify/functions/` instead of repo root — sat invisible while Jay redeployed and saw no changes.
- This session: `tripleseat-auth.js` was committed with a trailing period in the filename (`tripleseat-auth.js.` — literal typo, extra dot). Netlify's bundler silently skipped it — no build error, it just never appeared in "Packaging Functions from netlify/functions directory" in the deploy log, and the URL 404'd. Fixed by renaming the file in GitHub to remove the trailing dot; redeployed clean and function bundled correctly (confirmed in deploy log + "2 functions deployed" summary).
- Lesson: when a deployed function 404s and the file *looks* right in GitHub, check the exact filename character-by-character, and check the deploy log's "Functions bundling" section to see which files it actually packaged.

## Env Vars (Netlify)
SQUARE_TOKEN, SQUARE_LOCATION_ID, TICKETMASTER_KEY
TRIPLESEAT_CLIENT_ID, TRIPLESEAT_CLIENT_SECRET, TRIPLESEAT_REFRESH_TOKEN — ✅ ALL SET as of this session, OAuth flow completed successfully

## Owner Dashboard Tabs
Prep | Yesterday | Stats | Events (eye-blur button works)

## Staff Portal
PIN login → geofence clock-in (75m, lat 42.3554/lng -83.0521) → 4-step close-out (inventory, low stock, checklist, notes). Manager PIN 202020 → Timesheets/Pay Period/Team.
**Wage privacy:** staff-facing screens (home screen, role-selection for dual-role staff) show position name only — no $/hr rate, no tip-share badge. Rates only visible on manager-PIN-gated screens (Pay Period, Team roster, Timesheets). Rationale: staff shouldn't see each other's pay if a phone is glanced at.
**Today's events on staff home:** shows only TODAY's events (not tomorrow) with a persistent Masonic Temple link as fallback. If a big show is tomorrow (e.g. Ford Field), it intentionally won't show on staff portal yet — only appears on owner dashboard's "Tomorrow" section. Not yet decided whether staff view should also surface a "tomorrow" heads-up.

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
- 🔴 **`netlify/functions/staff-submit.js` confirmed MISSING from repo.** Discovered this session while debugging the Tripleseat deploy — the functions folder listing shows only `square-proxy.js` and `tripleseat-auth.js`. Was previously deleted once (commit `472cbbc`) and restored from git history in an earlier session, but it's gone again now — either re-deleted, or the earlier restore was never actually committed. **This is higher priority than it looks:** if it's really gone, staff close-out submissions (inventory, low stock, checklist, notes) may not be saving to blob storage right now. Needs checking first thing next session — check git history in `netlify/functions/` for the file, restore if found, confirm it's committed and deployed, then do a live test submission.
- Blob storage (@netlify/blobs) — needs confirmed working deploy (tied to the staff-submit.js issue above)

## Roadmap / Next Up (priority order)
1. ✅ DONE — Fix Events tab (Ticketmaster + Masonic/AXS)
2. ✅ DONE — Staff portal shows today's nearby events on staff_home screen
3. ✅ DONE — Fixed date/timezone bug in index.html (Detroit local time)
4. ✅ DONE — Removed wage/rate visibility from staff-facing screens
5. ✅ DONE — Tripleseat OAuth 2.0 app created, credentials obtained, all three env vars set, one-time auth flow completed, refresh token captured and saved. Integration is authenticated and ready — events-fetching logic is the only piece left (see dedicated section below).
6. 🔴 **NEW TOP PRIORITY — Restore `staff-submit.js`.** Confirmed missing from repo this session. Check if close-out submissions are actually saving right now.
7. Remove Alberto, add new hire (dual role)
8. On-site PIN/geofence test at DSC
9. 🔴 911 urgent restock flag system (single system — see Prep List spec below, do not build twice)
10. Auto pull tip pool from Square (currently manual entry in Pay Period tab)
11. Build closing checklist out properly on-site
12. Masonic capacity buffer (main theatre 4900cap +35%, small rooms +15%)
13. Repo cleanup: delete staff-portal(old).html, files.zip
14. Consider: should staff portal also show a "tomorrow" events heads-up, not just today?

## In-Progress: Tripleseat Integration (DSC booked events — private parties, pedal pubs, etc.)
**Goal:** pull DSC's Tripleseat bookings into the Events tab / staff portal alongside public shows (Ticketmaster/Masonic), so staff/owner see private event volume for the day too.

**Status as of this session: AUTHENTICATION FULLY COMPLETE.** Jay got Tripleseat customer admin role, created the OAuth 2.0 app ("Motorburger Dashboard"), and completed the full one-time auth flow. All three credentials are live in Netlify:
- `TRIPLESEAT_CLIENT_ID` ✅
- `TRIPLESEAT_CLIENT_SECRET` ✅
- `TRIPLESEAT_REFRESH_TOKEN` ✅

`netlify/functions/tripleseat-auth.js` is deployed and confirmed working (after fixing the trailing-dot filename bug — see Deploy Gotcha section above). This function's one-time job is done — it doesn't need to be run again. Verified OAuth endpoints for reference: authorize at `https://login.tripleseat.com/oauth2/authorize`, token exchange at `https://api.tripleseat.com/oauth2/token`.

**Exact next steps to resume (this is the ONLY remaining piece):**
1. Use the refresh token to auto-mint fresh access tokens — `POST https://api.tripleseat.com/oauth2/token` with `grant_type=refresh_token&refresh_token=TRIPLESEAT_REFRESH_TOKEN&client_id=...&client_secret=...`. Access tokens expire after 2 hours (7200s), so this needs to happen on each server-side fetch, not just once.
2. Call `GET https://api.tripleseat.com/api/v1/events/search.json?event_start_date=MM/DD/YYYY&event_end_date=MM/DD/YYYY` (note: confirm exact path — legacy docs show `/api/v1/`, newer OAuth2 examples show `/v1/`, double-check against a live authenticated test call)
3. Surface event name, account/contact, room, start/end time, guest count, status
4. Check `/v1/locations` first in case DSC's Tripleseat account has multiple locations/rooms — may need a `location_ids` filter param
5. Wire results into `square-proxy.js` alongside Ticketmaster/Masonic (or build as a small new function that square-proxy calls/merges) — surface on Events tab (owner dashboard) + staff portal today's-events view

**Side note worth following up:** DSC already has a webhook configured in their Tripleseat account pointing to `api.blazeloop.com/v2/webhooks/tripleseat/events/...` (triggers: Create/Update/Delete Event, Create Lead, Create Internal Lead). This means booking data may already be flowing to a third-party tool (Blazeloop — possibly an ops/scheduling platform DSC uses). Worth asking DSC's admin whether that feed could be tapped instead — still unresolved, hasn't been asked yet.

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
