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
index.html              owner dashboard — Events tab now color-coded/grouped-by-source collapsible accordions (green=Tripleseat/ShipCo, red=Ticketmaster, blue=Masonic), see roadmap item 16
staff-portal.html       staff portal (current) — ROOT LEVEL, not netlify/functions/ — today's-events view color-coded by source (same scheme as dashboard)
staff-portal(old).html  DELETE — cleanup pending
files.zip               DELETE — cleanup pending
netlify.toml
package.json            @netlify/blobs
netlify/functions/
  square-proxy.js       Square + Ticketmaster + Masonic scraper + Tripleseat (DSC private events, LIVE this session) + blob reader + ?tips=true (per-day Square tip pull) + ?events=true (merged events feed) + ?tsdebug=true / ?tsreset=true (Tripleseat diagnostics — see below)
  staff-submit.js        saves close-out to blob storage — ⚠️ CONFIRMED MISSING FROM REPO (see Active Bugs)
  tripleseat-auth.js     one-time OAuth2 setup helper for Tripleseat — DEPLOYED & WORKING as of this session
  shifts.js              server-side shift storage (motorburger-shifts blob). Actions: GET (list), POST save/update/delete/bulkUpsert/clearImported (clearImported removes rows tagged imported:true — see Historical Import Bugfixes below).
  tips-override.js       per-day manual tip-pool overrides (motorburger-tips blob) + `importedDates` tracking key. Actions: GET, POST {date,amount} (manager's own single-day entry — also unmarks that date from importedDates so it's protected from future clears), {action:'bulkSet', entries} (historical import — tags each date in importedDates), {action:'clearImported'} (removes only overrides tagged in importedDates), {action:'clearClosedDayOverrides', closedWeekdays:[1]} (removes overrides landing on a given weekday regardless of tag — safe one-time cleanup for pre-tagging-era data, since a closed day can never have a legitimate value).
```
**⚠️ Deploy gotcha (recurring — bit us four times now):** Files placed in the wrong spot, or never actually committed, deploy silently with no error — they just don't work, and nothing in the Netlify UI flags it.
- Session N-2: `staff-portal.html` accidentally uploaded into `netlify/functions/` instead of repo root — sat invisible while Jay redeployed and saw no changes.
- Session N-1: `tripleseat-auth.js` was committed with a trailing period in the filename (`tripleseat-auth.js.` — literal typo, extra dot). Netlify's bundler silently skipped it — no build error, it just never appeared in "Packaging Functions from netlify/functions directory" in the deploy log, and the URL 404'd. Fixed by renaming the file in GitHub to remove the trailing dot; redeployed clean and function bundled correctly (confirmed in deploy log + "2 functions deployed" summary).
- This session: `shifts.js` and `tips-override.js` were both handed to Jay but neither made it into `netlify/functions/` on the first pass — both 404'd (`Page not found`) until manually created via GitHub's "Add file → Create new file" *inside* the `netlify/functions` folder specifically (easy to instead drop them at repo root by mistake).
- **Session N (this one) — happened again, opposite direction.** `staff-portal.html` got uploaded *into* `netlify/functions/` (should be repo root) while fixing the historical-import date bug below. Netlify's function bundler choking on a stray `.html` in that folder is the suspected reason a deploy looked stuck. Fixed by deleting it from `netlify/functions/` and re-uploading at repo root. **This is now four separate times a misplaced/uncommitted file has caused a silent or stuck deploy** — always confirm file location in the GitHub folder breadcrumb before troubleshooting "why doesn't my fix work," not after.
- This session: after deploying the Events tab color-coded/collapsible-groups redesign, the Tripleseat group appeared to be missing entirely even though the live JSON data was confirmed correct (`tripleseatCount:10`, no errors) and the rendering code checked out on review. Root cause was browser-side caching of the old page — resolved by testing in an incognito window (confirms it's not a code bug) and, if needed, a "Clear cache and deploy site" (not just "Deploy site") in Netlify. **Lesson:** when live JSON data is confirmed correct but the UI doesn't reflect it, check incognito/hard-refresh before assuming a code bug — a "Deploy summary" saying "All files already uploaded by a previous deploy with the same commits" + all steps "Skipped" is healthy/normal, not a sign of a broken deploy.
- **Lesson reinforced across all three:** never assume a new function file is live just because it was shared/described. Always test its bare URL (`/.netlify/functions/<name>`) before building or testing UI that depends on it, and check the deploy log's "Functions bundling" section to see which files it actually packaged.

## Env Vars (Netlify)
SQUARE_TOKEN, SQUARE_LOCATION_ID, TICKETMASTER_KEY
TRIPLESEAT_CLIENT_ID, TRIPLESEAT_CLIENT_SECRET, TRIPLESEAT_REFRESH_TOKEN — ✅ ALL SET, integration LIVE as of this session
TRIPLESEAT_SITE_ID=5359, TRIPLESEAT_LOCATION_ID=8576 — ✅ SET this session, scopes events search to Detroit Shipping Company only (DSC's Tripleseat customer account also has a second site, "The Social Brews," site_id 15191 — without these, search returned 0 events)

## Owner Dashboard Tabs
Prep | Yesterday | Stats | Events (eye-blur button works)

## Staff Portal
PIN login → geofence clock-in (100m, lat 42.3441/lng -83.0615) → 4-step close-out (inventory, low stock, checklist, notes). Manager PIN 202020 → Timesheets/Pay Period/Manual Entry/Team.
**Geofence enforcement (fixed this session):** previously, denying location permission silently let staff clock in anyway (no block), and clock-out had **no geofence check at all** — staff could punch out from anywhere, which is what was bleeding hours when someone left the site and punched out later from home. Fixed: both clock-in and clock-out now run the same on-site check; a denied/failed location request or being outside the 100m radius blocks the action and requires a manager PIN override to proceed. Overrides are tagged in the manager Timesheets view (`⚠geo in` / `⚠geo out`) for accountability. Note: this is a browser check that runs when the button is tapped — it can't monitor location in the background or push a "you're leaving" alert once the page is closed (would require a native app with background location + push permissions, a much bigger build).
**Wage privacy:** staff-facing screens (home screen, role-selection for dual-role staff) show position name only — no $/hr rate, no tip-share badge. Rates only visible on manager-PIN-gated screens (Pay Period, Team roster, Timesheets). Rationale: staff shouldn't see each other's pay if a phone is glanced at.
**Today's events on staff home:** shows only TODAY's events (not tomorrow) with a persistent Masonic Temple link as fallback. If a big show is tomorrow (e.g. Ford Field), it intentionally won't show on staff portal yet — only appears on owner dashboard's "Tomorrow" section. Not yet decided whether staff view should also surface a "tomorrow" heads-up.

## Staff Roster
Brian Rockwood ('brian') $16, Mitchell Wayne ('mitch') $17, Victoria Martinez ('tory', dual role: Line Cook/Host) $15, Brandy Cook ('brandy') $15.
**Alberto and Dalia — former employees, no longer on STAFF array.** Jay wants their historical hours/tips kept on file (not deleted) — handled correctly by the historical importer, which keeps unmatched names as their own historical-only identity rather than merging or dropping them. New hire TBD.

## Protein Map
Beef: Classic Motor, Deux Chevaux, Flyin' Hawaiian, Go-Kart, FUNGuY
Chicken: Firebird | Lamb: Lamborghini | Veggie: Veg Engine

## Benchmarks (daily revenue)
Tue 368 / Wed 404 / Thu 581 / Fri 1238 / Sat 2568 / Sun 1796
2026 target: $352,725 — pacing ~$401K

## Active Bugs
- 🟢 **CONFIRMED LIVE this session — `staff-submit.js`, `square-proxy.js` net-revenue fix, and `staff-portal.html` error-visibility fix are all already committed and deployed on GitHub `main`.** (Last session's notes below said these were still staged in outputs, not committed — that was stale; this session fetched all three files directly from `raw.githubusercontent.com` and confirmed the `connectLambda(event)` fix, the net-sales calculation, and the error-visibility banner are all present in the live code.) **Still outstanding: the live functional test** — a real close-out submission confirmed to land on the Prep tab, and Prep tab counts confirmed matching Square's Net Sales report for a known day. Nobody has confirmed that end-to-end test happened.
- 🔴 **NEW — phone test found manager override doesn't work.** Jay tested the geofence fix live on a phone; clock-in/out correctly blocks when off-site or location denied, but the "Manager override" button + PIN prompt does not actually override — it should call `doClockIn(true)` or `doClockOut(true)` via `managerOverrideGeo(mode)` after PIN `202020` is entered correctly, but something isn't working end to end. **Not yet diagnosed — no root cause found.** Next session: check whether `prompt()` is even firing/returning correctly on the phone (iOS Safari can behave oddly with `prompt()` in PWA/home-screen-app mode — this is a likely suspect), whether the PIN comparison is failing, or whether `doClockIn(true)`/`doClockOut(true)` are being called but something downstream silently fails. Reproduce on the actual phone/browser Jay used, not just desktop, since this may be a mobile-Safari-specific `prompt()` issue.
- 🟡 **IN PROGRESS — Wednesday revenue was showing gross (tax-inclusive) sales, not net.** Root cause found in `square-proxy.js` `processOrders()`: daily revenue was summed from `o.total_money` (Square's order total, includes sales tax), while the per-item protein breakdown was already summed from `li.gross_sales_money` (pre-tax). Two numbers on the same dashboard were computed on inconsistent bases. **Fixed:** daily revenue now computed as `sum(line_item gross_sales_money) − order discounts`, matching the pre-tax basis already used for item-level numbers. Field is still internally named `gross` in the JSON payload/code (to avoid a wide rename touching every `.gross` reference in `index.html`) but now holds net-of-tax sales — flagged as a naming-cleanup item, not re-broken.
- 🟢 **RESOLVED this session (part 2) — protein undercount (19 vs 27) root cause found via Square CSV export.** Square menu item is spelled "Deux **Chavaux**" (a-v) but PROTEIN_MAP keyword was 'deux **chev**' (correct French spelling, per this file's Protein Map section) — one-vowel mismatch silently dropped all 8 Deux Chavaux sold on 2026-07-01. Verified against the export: matched 19 + missed 8 = 27 exactly. **Fixed:** keyword widened to `'deux ch'` (matches both spellings). Re-verified against Wednesday data → counts 27 (beef 21, chicken 1, lamb 4, veggie 1). ⚠️ Optional follow-up: fix the spelling to "Chevaux" in Square's item catalog itself; code now tolerates either. Also verified from same export: Wednesday net sales $535.53 (gross $563.53 − $28 discounts, +$32.47 tax) = **+32.5% vs $404 benchmark**; the old "+51%" figure came from `total_money` including tax and tips. The net-sales fix in square-proxy.js now matches Square's own "Net Sales" report definition.
- ℹ️ Diagnostic tool added to `square-proxy.js` (keep): `GET /.netlify/functions/square-proxy?debugDate=YYYY-MM-DD` returns every Square line item for that date + which ones failed protein matching (`unmatchedLines`). Use this whenever dashboard counts don't match Square reports — it's how future name-mismatch bugs get caught fast. Note: hardcodes EDT (`-04:00`) for the day boundary; adjust to `-05:00` if used in winter.
- 🟢 **ROOT CAUSE FOUND & FIXED this session (part 3) — blob storage never worked at all.** Jay's live test after deploying showed the (correctly-visible) failure banner. Reproduced locally against @netlify/blobs 8.1.0: in classic `exports.handler` (Lambda-compat) functions, `getStore()` throws `"The environment has not been configured to use Netlify Blobs"` unless `connectLambda(event)` is called first. Neither function ever called it. Consequences: (a) `staff-submit.js` 500'd on every submission — including back when the file existed in the repo; (b) `square-proxy.js`'s `getStaffInventory()` swallowed the same error in its try/catch and silently returned null — **staff inventory has NEVER reached the Prep tab. The old "needs confirmed working deploy" note was right: it was never working.** Fixed: `connectLambda(event)` added to both functions. Also fixed duplicate error banners stacking on retry in staff-portal.html, and the banner now shows the actual server error text ("Error detail (show Jay): ...") so future failures are diagnosable from a staff screenshot. **Needs: redeploy these three files, then a live close-out test → confirm success screen → confirm counts land on Prep tab.**

## Files changed this session
- `staff-portal.html` — historical import date-shift bug fixed, nickname matching fixed (buildNameMap now matches on staff id), Manual Entry no longer double-counts against real clock punches, Delete button added next to Edit in Timesheets, two new cleanup tools added to Team → Import Historical Data ("Clear previous import", "Clear stray tip totals on closed days"). Full 2-year historical import completed and verified.
- `netlify/functions/shifts.js` — added `delete` (single row) and `clearImported` (bulk, tag-scoped) actions.
- `netlify/functions/tips-override.js` — added `importedDates` tracking, `clearImported` (tag-scoped) and `clearClosedDayOverrides` (weekday-scoped, for pre-tagging-era stale data) actions.

## Pay Period Tab — Full Overhaul (this session)
Jay reported tips weren't pulling in / dividing by hours. Root cause: the whole tab was localStorage-only (shifts *and* the tip number), so a punch on one device was invisible on another, and "tip pool" was one flat manually-typed number for the whole date range with no per-day granularity and no connection to Square at all.

**What's live now:**
- **Shifts persist server-side** (Blob storage via `shifts.js`), so any device sees the same punches. In-memory `SHIFTS_CACHE` mirrors it; `loadShiftsFromServer()` refreshes on boot and when opening Timesheets/Pay Period/Manual Entry. Offline-safe: failed saves queue in `mb_pending_shift_ops` and retry on next load (same pattern as `staff-submit.js`'s pending-closeout retry).
- **Tips auto-pull from Square per day** via `square-proxy.js?tips=true`, with a manual override per day (stored in `tips-override.js`, tagged "(manual)" in the UI) for cash tips or corrections.
- **Tip-split math now matches Jay's original Google Apps Script tracker exactly** (source: Apps Script code Jay retrieved and pasted this session) — each day's pool is split ONLY among that day's tip-eligible hours, then summed per person across the period. **This fixed a real bug**: the first version of this rebuild blended the whole period into one average rate × hours, which is wrong (lets a slow day and a huge day distort each other regardless of who worked which). Do not regress to the blended-average approach.
- **Pay Period grouping is now dynamic** — built from whoever's actually in the shift records, not a hardcoded STAFF-array lookup. Matters for historical/former employees (e.g. people no longer on the roster) showing correctly in past-dated queries.
- **Per-employee day-by-day audit view**: tap a name in "By staff member" to expand every day they worked in range, hours editable inline. Grouped by **date + role** (not just date) — someone working two roles same day (e.g. Line Cook shift + Host shift) gets two separate editable rows; only an actual same-role double-punch same day falls back to read-only ("edit in Timesheets").
- **CSV export** button reproduces the old tracker's exact columns (Date, Total Gratuity, Employee Name, Role, Hours Worked, On Clock/Tip Eligible) for one shift-row per line — for pasting into an external running sheet if wanted.
- **Historical data import** (Team tab → "Import Historical Data"): paste old tracker CSV/TSV rows, Preview shows row count/date range/employee matches before writing anything, Import writes via `bulkUpsert` (id = date+staff+role, so re-pasting corrected data overwrites instead of duplicating) plus a `bulkSet` of daily gratuity totals as overrides. Employee names matched to current roster by first name, full name, **or staff id** (ids are usually the nickname, e.g. `mitch`/`tory` — see Historical Import Bugfixes below); unmatched names (e.g. former employees Alberto/Dalia) kept under their own slugified id so history isn't lost, exactly as intended. **Known limitation:** imported rows have `rate:0` (old sheet didn't track hourly rate) — hours/tips are accurate but wages will show $0 for historical dates; don't run wage totals across a range spanning old + new data.
- **Manual Entry tab** (bridge until staff use the in-app clock regularly): pick a date, type in Square's tip total + each person's hours (from Homebase), Save Day. Same `bulkUpsert`/id scheme as the import, so re-saving a date overwrites instead of duplicating. Also clears any real (non-manual) clock punches for that date+staff before saving, so a manual correction fully replaces a test/duplicate punch instead of summing with it (this was a real reported bug — clock in/out, then Manual Entry for the same day, was double-counting hours; fixed this session, see Historical Import Bugfixes below for the parallel tips-side version of the same class of bug).
- **✅ DONE this session — the ~2 years of historical CSV data is imported and verified.** 1409 shift rows across 547 days (2024-08-25 → 2026-06-27), tip totals saved for all 547 days. Spot-checked against known values and against Pay Period reports; Mondays (closed day) confirmed showing $0.
- Live-tested working end to end this session: Manual Entry save, per-day audit/edit expand-and-fix flow, full historical import.

## Historical Import Bugfixes (this session — significant, multi-round debugging)
Jay reported the historical import "adds the two amounts together" (a clocked test punch + a Manual Entry for the same day double-counting), then separately reported Pay Period showing $0 wages/tip-eligible-hours after importing, then Mondays (a closed day) showing nonzero tip totals after that was fixed. Three distinct root causes, found by testing the actual parser against Jay's real pasted data rather than reasoning about it in the abstract — worth doing that first next time something like this comes up:

1. **Manual Entry vs. real clock punch double-counting.** Manual Entry only checked for conflicting *other Manual Entry* rows before saving, with zero awareness of a real clocked shift on the same date — so a test clock-in/out followed by a Manual Entry correction added instead of replacing. **Fixed:** Manual Entry now deletes any real (non-manual) punches for that date+staff before saving. Added `delete` action to `shifts.js` and a Delete button next to Edit in Timesheets, for one-off manual cleanup as a fallback.
2. **Date-shift-by-one-day bug in the CSV importer.** `new Date(dateRaw)` on a bare `"YYYY-MM-DD"` string is parsed as **UTC midnight**; displaying it back via `.toLocaleDateString('en-CA')` in Detroit's negative UTC offset rolled it back to the previous local day — every imported date landed one day earlier than the sheet. Caught by comparing Pay Period's daily breakdown against the actual sheet (values were shifted, e.g. sheet's 6/27 value showing up under 6/26). **Fixed:** dates matching `^\d{4}-\d{2}-\d{2}$` are now used as-is with zero Date-object round-trip; only non-ISO formats fall back to Date parsing, and even then with a forced local-time suffix. Confirmed via a harness that ran the real parser against Jay's actual pasted data before and after the fix.
3. **Nickname mismatch in employee matching.** Roster stores full names (`Mitchell Wayne`, `Victoria Martinez`) but `buildNameMap()` only matched on first name or full name — never on the short nickname (`Mitch`, `Tory`) that the old tracker sheet actually uses, even though those are literally the staff `id` values. Caused Mitch/Tory to import as separate "not on current roster" historical-only identities instead of merging into their real profile. **Fixed:** `buildNameMap()` now also matches on `s.id.toLowerCase()`.
4. **Stale duplicate overrides after the date fix, requiring a scoped cleanup tool.** Once #2 was fixed, re-importing computed *different* ids for most dates (since the id includes the date) — so old wrongly-dated override entries didn't get overwritten, they sat alongside the new correct ones (visible as e.g. both 6/15 *and* 6/16 showing the same $54 tip total). Building a blind "clear everything" was rejected as unsafe — Jay had already manually entered real tips+hours for several dates (Jun 28–Jul 11) via Manual Entry, which would've been wiped by an indiscriminate clear. **Fixed with two scoped tools**, both in Team → Import Historical Data:
   - **"Clear previous import"** — removes only shift rows tagged `imported:true` (shifts.js) and only override dates tagged in a new `importedDates` tracker (tips-override.js). Safe for repeat use going forward.
   - **"Clear stray tip totals on closed days (Mondays)"** — a one-time-use cleanup for the *pre-tagging-era* stale overrides that predated the `importedDates` tracker (so the scoped clear above couldn't find them by tag). Removes any override landing on a given closed weekday (Monday, hardcoded via `closedWeekdays:[1]`) regardless of tag, since a legitimate value can never exist on a day the restaurant isn't open. This is why it was safe to use even with real manual entries on file — none of those could legitimately fall on a Monday. **This button did its job correctly (confirmed by reading the raw JSON from the live tips-override endpoint before/after) — cleared 92 stray Monday entries.** If pre-tagging-era stale data ever needs clearing again for a *different* closed weekday, pass a different `closedWeekdays` array.
5. **A stuck-feeling import was actually two of the above compounding**, not a hang — each retry without the right clear button first just re-created the same duplicate-date problem. Lesson: when "I did what you said and it's still wrong" — verify against the actual stored data (fetch the live endpoint's raw JSON) before proposing another fix. Guessing burned real deploy-credit money and trust this session; reading the raw data directly resolved it in one pass.

## Roadmap / Next Up (priority order)
1. ✅ DONE — Fix Events tab (Ticketmaster + Masonic/AXS)
2. ✅ DONE — Staff portal shows today's nearby events on staff_home screen
3. ✅ DONE — Fixed date/timezone bug in index.html (Detroit local time)
4. ✅ DONE — Removed wage/rate visibility from staff-facing screens
5. ✅ DONE — Tripleseat integration fully live: OAuth working with automatic token-rotation handling, scoped to DSC only (site_id 5359), real bookings confirmed flowing into Events tab + staff portal. See dedicated section below for full detail.
6. ✅ CODE CONFIRMED LIVE — staff-submit.js, square-proxy.js net-revenue fix, staff-portal.html error-visibility fix are all committed and deployed on `main`. ⚠️ Still needs the live functional test: real close-out submission → confirm it lands on Prep tab → confirm 27 proteins for Wed 07-01 and revenue matches Square's Net Sales report.
6b. 🟡 Geofence fix committed to GitHub `main` — still needs deploy log check + live phone test (deny location on clock-in, try clocking out off-site, manager PIN override on both).
7. ✅ DONE (confirmed this session) — Alberto no longer in STAFF array; Brandy Cook is on the current roster. (Dalia also not in STAFF — both correctly handled as former-employee historical-only identities by the importer, see Historical Import Bugfixes.)
8. On-site PIN/geofence test at DSC (now includes testing the manager-override flow for both clock-in and clock-out)
9. 🔴 911 urgent restock flag system (single system — see Prep List spec below, do not build twice)
10. ✅ DONE — Pay Period tab overhauled top to bottom. See dedicated section below for full detail.
10b. ✅ DONE this session — Full 2-year historical CSV import completed and verified (1409 rows, 547 days), plus three real bugs found and fixed along the way (Manual Entry double-counting, date-shift-by-one-day on import, nickname mismatch in employee matching) and two scoped cleanup tools added for stale data. See Historical Import Bugfixes section.
11. Build closing checklist out properly on-site
12. Masonic capacity buffer (main theatre 4900cap +35%, small rooms +15%)
13. Repo cleanup: delete staff-portal(old).html, files.zip
14. Consider: should staff portal also show a "tomorrow" events heads-up, not just today?
15. Tech debt: internal field named `gross` in square-proxy.js/index.html now actually holds net-of-tax sales — rename for clarity once other higher-priority items are clear (touches many references in index.html, do carefully)
16. ✅ DONE this session — Events tab (owner dashboard) and staff portal today's-events view now color-code by source and group by source instead of one long date-sectioned scroll. Dashboard: three collapsible accordions — 🟢 ShipCo Private Events (Tripleseat), 🔴 Ticketmaster, 🔵 Masonic Temple — each collapsed by default, header shows count, click to expand. Staff portal: same color coding (left border on each event row) but no collapsing since it's just today's events (short list already). **Not yet verified live with a real ShipCo event day** — confirmed working with Ticketmaster/Masonic data and Tripleseat's 7-day pull, but Jay hasn't yet seen it render on a day DSC actually has a private event happening (next natural test: Tuesday, per a Tripleseat event on the calendar — verify the ShipCo group shows correctly with real same-day data, not just the 7-day-ahead view).

## ✅ DONE this session: Tripleseat Integration (DSC booked events — private parties, pedal pubs, etc.)
**Goal:** pull DSC's Tripleseat bookings into the Events tab / staff portal alongside public shows (Ticketmaster/Masonic). **Live-tested working end to end** — confirmed via `?events=true` showing real DSC bookings (313 Comedy, Chess Club, Community Arcade Night, Open House w DJ Moppy, Konjo Me Networking Event, Dispo Event, etc.) correctly merged with Ticketmaster, correctly excluding PROSPECT-status leads.

**What it took to get here (for future reference, since this had several layered bugs):**
1. **Endpoint path** — confirmed `https://api.tripleseat.com/v1/events/search.json` (not `/api/v1/` — resolved the ambiguity from prior sessions).
2. **Refresh token rotation** — Tripleseat issues a **new** refresh token every time the old one is used (Doorkeeper-style OAuth2 rotation) and invalidates the previous one. A static env var alone breaks after one successful refresh. Fixed by persisting the token pair in blob storage (`motorburger-tripleseat`, key `tokens`: `{access_token, refresh_token, expires_at}`), refreshed automatically when expired. `TRIPLESEAT_REFRESH_TOKEN` env var now only matters as the bootstrap seed for the very first call after a deploy — after that, blob storage is authoritative.
   - If Tripleseat auth ever breaks again: hit `?tsreset=true` first (clears the blob) before re-running `tripleseat-auth.js` for a fresh token, so the new env var value actually gets used instead of a stale blob-cached one.
3. **Multi-site account** — DSC's Tripleseat customer account (customer_id 4958) has **two sites**: "Detroit Shipping Company" (site_id 5359, location_id 8576) and "The Social Brews" (site_id 15191, location_id 30797). Without scoping, search returned 0 events. Fixed with `TRIPLESEAT_SITE_ID=5359` + `TRIPLESEAT_LOCATION_ID=8576` env vars, both passed as query params.
4. **Response shape bug** — Tripleseat's actual response is `{"total_pages":N,"results":[...]}`, not `{"events":[...]}`. Code now checks `data.results` first (confirmed against live response), falls back to `data.events` or bare array defensively.
5. **Account name field path** — lives at `event.booking.account.name`, not a top-level field on the event object (confirmed against live data).
6. **PROSPECT filtering** — events with `status:"PROSPECT"` (unconfirmed leads, not real bookings) are filtered out; LOST/deleted are already excluded server-side by the `/search` endpoint. TENTATIVE/DEFINITE/CLOSED/WAITLIST all pass through.

**Diagnostic routes added to `square-proxy.js` (keep these — useful if this ever breaks again):**
- `?tsdebug=true` — returns sites, locations, current token state, the exact events URL used, and the *raw unfiltered* Tripleseat response. First stop for any future troubleshooting.
- `?tsreset=true` — clears the blob-stored token, forcing the next call to use the env var refresh token again.

**Event shape surfaced** (matches Ticketmaster/Masonic shape so no special-casing needed elsewhere): `name, date, time, venue (room name, prefixed "DSC —"), url (blank), category:"Private Event", source:"tripleseat", status, guestCount, account`.

**UI (index.html, owner dashboard):** Tripleseat events show a distinct "Private event" badge (`.tsbadge`, orange, matches `.msbadge` pattern) plus guest count + account name inline. Events tab header shows live Tripleseat status (`Tripleseat ✓ (N)` or a flag if it errors).

**Staff portal:** needed zero changes — it already filters the same merged `events` array by today's date, so Tripleseat bookings show up there automatically.

**Not yet done — user confirmed this is next:** source filtering (Tripleseat / Ticketmaster / Masonic / All), wanted on **both** owner dashboard Events tab and staff portal today's-events view. Explicitly deferred until live Tripleseat pull was verified — now that it is, this is the next build.

**Still unexplored (not urgent):** the Blazeloop webhook DSC already has configured in Tripleseat (`api.blazeloop.com/v2/webhooks/tripleseat/events/...`) — never asked whether that feed could be tapped instead. Doesn't matter now since the direct API integration works, but worth knowing it exists.

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
