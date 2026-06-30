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
```

## Env Vars (Netlify)
SQUARE_TOKEN, SQUARE_LOCATION_ID, TICKETMASTER_KEY

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
- Ticketmaster Events tab empty — check TICKETMASTER_KEY in Netlify, redeploy no-cache
- Masonic scraper 403 — switching to scrape AXS Masonic listings instead
- Blob storage (@netlify/blobs) — needs confirmed working deploy

## Roadmap / Next Up (priority order)
1. Fix Events tab (Ticketmaster + Masonic/AXS)
2. Remove Alberto, add new hire (dual role)
3. On-site PIN/geofence test at DSC
4. 🔴911 urgent restock flag system (single system — see Prep List spec below, do not build twice)
5. Auto pull tip pool from Square (currently manual entry in Pay Period tab)
6. Build closing checklist out properly on-site
7. Masonic capacity buffer (main theatre 4900cap +35%, small rooms +15%)
8. Repo cleanup: delete staff-portal(old).html, files.zip

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
