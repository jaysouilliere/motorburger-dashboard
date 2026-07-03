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
PIN login → geofence clock-in (100m, lat 42.3441/lng -83.0615) → 4-step close-out (inventory, low stock, checklist, notes). Manager PIN 202020 → Timesheets/Pay Period/Team.
**Geofence enforcement (fixed this session):** previously, denying location permission silently let staff clock in anyway (no block), and clock-out had **no geofence check at all** — staff could punch out from anywhere, which is what was bleeding hours when someone left the site and punched out later from home. Fixed: both clock-in and clock-out now run the same on-site check; a denied/failed location request or being outside the 100m radius blocks the action and requires a manager PIN override to proceed. Overrides are tagged in the manager Timesheets view (`⚠geo in` / `⚠geo out`) for accountability. Note: this is a browser check that runs when the button is tapped — it can't monitor location in the background or push a "you're leaving" alert once the page is closed (would require a native app with background location + push permissions, a much bigger build).
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
- 🟢 **CONFIRMED LIVE this session — `staff-submit.js`, `square-proxy.js` net-revenue fix, and `staff-portal.html` error-visibility fix are all already committed and deployed on GitHub `main`.** (Last session's notes below said these were still staged in outputs, not committed — that was stale; this session fetched all three files directly from `raw.githubusercontent.com` and confirmed the `connectLambda(event)` fix, the net-sales calculation, and the error-visibility banner are all present in the live code.) **Still outstanding: the live functional test** — a real close-out submission confirmed to land on the Prep tab, and Prep tab counts confirmed matching Square's Net Sales report for a known day. Nobody has confirmed that end-to-end test happened.
- 🟢 **RESOLVED this session — geofence bug in `staff-portal.html`.** Two issues: (1) denying location permission on clock-in silently let staff clock in anyway with no block — just an invisible `geoSkipped` flag; (2) clock-out had **zero** geofence check of any kind, meaning staff could punch out from anywhere, including from home after leaving the site — this was the root cause of hours bleeding. Fixed: both clock-in and clock-out now share one `runGeoCheck()` flow — denied location or being outside the 100m radius blocks the action and requires manager PIN override (`managerOverrideGeo`). Overrides show as `⚠geo in` / `⚠geo out` tags in the manager Timesheets view. **Not yet committed to GitHub — staged in `/mnt/user-data/outputs/staff-portal.html`, needs to be pasted in on top of the current live file (which already has the error-visibility fix from the item above, so this one commit carries both).**
- 🟡 **IN PROGRESS — Wednesday revenue was showing gross (tax-inclusive) sales, not net.** Root cause found in `square-proxy.js` `processOrders()`: daily revenue was summed from `o.total_money` (Square's order total, includes sales tax), while the per-item protein breakdown was already summed from `li.gross_sales_money` (pre-tax). Two numbers on the same dashboard were computed on inconsistent bases. **Fixed:** daily revenue now computed as `sum(line_item gross_sales_money) − order discounts`, matching the pre-tax basis already used for item-level numbers. Field is still internally named `gross` in the JSON payload/code (to avoid a wide rename touching every `.gross` reference in `index.html`) but now holds net-of-tax sales — flagged as a naming-cleanup item, not re-broken.
- 🟢 **RESOLVED this session (part 2) — protein undercount (19 vs 27) root cause found via Square CSV export.** Square menu item is spelled "Deux **Chavaux**" (a-v) but PROTEIN_MAP keyword was 'deux **chev**' (correct French spelling, per this file's Protein Map section) — one-vowel mismatch silently dropped all 8 Deux Chavaux sold on 2026-07-01. Verified against the export: matched 19 + missed 8 = 27 exactly. **Fixed:** keyword widened to `'deux ch'` (matches both spellings). Re-verified against Wednesday data → counts 27 (beef 21, chicken 1, lamb 4, veggie 1). ⚠️ Optional follow-up: fix the spelling to "Chevaux" in Square's item catalog itself; code now tolerates either. Also verified from same export: Wednesday net sales $535.53 (gross $563.53 − $28 discounts, +$32.47 tax) = **+32.5% vs $404 benchmark**; the old "+51%" figure came from `total_money` including tax and tips. The net-sales fix in square-proxy.js now matches Square's own "Net Sales" report definition.
- ℹ️ Diagnostic tool added to `square-proxy.js` (keep): `GET /.netlify/functions/square-proxy?debugDate=YYYY-MM-DD` returns every Square line item for that date + which ones failed protein matching (`unmatchedLines`). Use this whenever dashboard counts don't match Square reports — it's how future name-mismatch bugs get caught fast. Note: hardcodes EDT (`-04:00`) for the day boundary; adjust to `-05:00` if used in winter.
- 🟢 **ROOT CAUSE FOUND & FIXED this session (part 3) — blob storage never worked at all.** Jay's live test after deploying showed the (correctly-visible) failure banner. Reproduced locally against @netlify/blobs 8.1.0: in classic `exports.handler` (Lambda-compat) functions, `getStore()` throws `"The environment has not been configured to use Netlify Blobs"` unless `connectLambda(event)` is called first. Neither function ever called it. Consequences: (a) `staff-submit.js` 500'd on every submission — including back when the file existed in the repo; (b) `square-proxy.js`'s `getStaffInventory()` swallowed the same error in its try/catch and silently returned null — **staff inventory has NEVER reached the Prep tab. The old "needs confirmed working deploy" note was right: it was never working.** Fixed: `connectLambda(event)` added to both functions. Also fixed duplicate error banners stacking on retry in staff-portal.html, and the banner now shows the actual server error text ("Error detail (show Jay): ...") so future failures are diagnosable from a staff screenshot. **Needs: redeploy these three files, then a live close-out test → confirm success screen → confirm counts land on Prep tab.**

## Files changed this session (staged in /mnt/user-data/outputs, not yet committed to GitHub)
- `staff-portal.html` — geofence fix: clock-in now blocks (not silently allows) when location is denied; clock-out now enforces the same on-site geofence check for the first time (it had none before); manager PIN override available for both, tagged in Timesheets view.
**Note:** last session's three files (`staff-submit.js`, `square-proxy.js`, and the earlier `staff-portal.html` error-visibility fix) turned out to already be live on GitHub `main` — confirmed this session, see Active Bugs. Only the geofence fix above is still pending a commit.
**To deploy:** open `staff-portal.html` in GitHub, edit in place (do not delete/re-add — that's how the file ended up in the wrong folder once before), paste in the new version, commit to `main`, then check the deploy log to confirm it bundled correctly.


## Roadmap / Next Up (priority order)
1. ✅ DONE — Fix Events tab (Ticketmaster + Masonic/AXS)
2. ✅ DONE — Staff portal shows today's nearby events on staff_home screen
3. ✅ DONE — Fixed date/timezone bug in index.html (Detroit local time)
4. ✅ DONE — Removed wage/rate visibility from staff-facing screens
5. ✅ DONE — Tripleseat OAuth 2.0 app created, credentials obtained, all three env vars set, one-time auth flow completed, refresh token captured and saved. Integration is authenticated and ready — events-fetching logic is the only piece left (see dedicated section below).
6. ✅ CODE CONFIRMED LIVE — staff-submit.js, square-proxy.js net-revenue fix, staff-portal.html error-visibility fix are all committed and deployed on `main`. ⚠️ Still needs the live functional test: real close-out submission → confirm it lands on Prep tab → confirm 27 proteins for Wed 07-01 and revenue matches Square's Net Sales report.
6b. 🔴 **NEW — Deploy geofence fix.** `staff-portal.html` staged in outputs this session (see Files Changed above) needs to be pasted into GitHub in place and committed, then tested on a phone: deny location on clock-in (should block), try clocking out off-site (should block).
7. Remove Alberto, add new hire (dual role)
8. On-site PIN/geofence test at DSC (now includes testing the manager-override flow for both clock-in and clock-out)
9. 🔴 911 urgent restock flag system (single system — see Prep List spec below, do not build twice)
10. Auto pull tip pool from Square (currently manual entry in Pay Period tab)
11. Build closing checklist out properly on-site
12. Masonic capacity buffer (main theatre 4900cap +35%, small rooms +15%)
13. Repo cleanup: delete staff-portal(old).html, files.zip
14. Consider: should staff portal also show a "tomorrow" events heads-up, not just today?
15. Tech debt: internal field named `gross` in square-proxy.js/index.html now actually holds net-of-tax sales — rename for clarity once other higher-priority items are clear (touches many references in index.html, do carefully)

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

## Next-Up Spec: Ongoing Prep List (additive only — DO NOT replace index.html)
**Decisions locked in (Jay, 2026-07-01):** duty log retains **90 days** (was 7 — Jay wants a real audit trail of who does tasks, e.g. for reviews); on the owner dashboard the task list **replaces the current "Prep add-ons" section** inside the Prep tab (they overlap in purpose); **build only after** the current session's four-file fix is deployed and verified live (staff-submit round trip confirmed working — prep list depends on the same blob storage path).
- New section inside existing Prep tab (dashboard, replacing "Prep add-ons") + Prep view after clock-in (staff portal), not a new page
- Build on branch + Netlify deploy preview, test, then publish
- Shared blob storage between both surfaces (confirm key: new key, e.g. motorburger-prep-list — do NOT silently reuse motorburger-closeouts)
- Item fields: id, dayOfWeek, name, target, count, done, addedBy, doneBy, completedAt, carriedDays, flag911, recurring
- Standing templates editable per-weekday (not hardcoded)
- Duty log: name, day, count, doneBy, completedAt — **90-day auto-purge** (audit trail for owner; visible on a manager-PIN-gated or owner-dashboard view, not staff-facing)
- recurring:true regenerates each service; recurring:false carries forward (carriedDays++) until done
- Close-out: completed→duty log, open one-offs→next day (Sun→Tue, skip Mon, confirm Monday has no data row), standing list resets
- flag911 feeds the urgent restock list — this IS the 🔴911 roadmap item, one system not two
- Auto-carry + purge run server-side (scheduled function in netlify.toml, not on page load)
- Geofence/PIN unchanged

## Workflow Rule
End of every session: update this file with what changed. Don't re-summarize conversation in chat — edit this file directly and commit.
