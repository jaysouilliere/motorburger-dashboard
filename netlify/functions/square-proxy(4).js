exports.handler = async function (event) {
  const TOKEN = process.env.SQUARE_TOKEN;
  const LOCATION_ID = process.env.SQUARE_LOCATION_ID;
  const TM_KEY = process.env.TICKETMASTER_KEY;
  const TS_CLIENT_ID = process.env.TRIPLESEAT_CLIENT_ID;
  const TS_CLIENT_SECRET = process.env.TRIPLESEAT_CLIENT_SECRET;
  const TS_REFRESH_TOKEN = process.env.TRIPLESEAT_REFRESH_TOKEN;
  // Optional — only needed if DSC's Tripleseat account turns out to have multiple
  // locations/rooms and events need filtering to just DSC. Not set yet (unverified).
  const TS_LOCATION_ID = process.env.TRIPLESEAT_LOCATION_ID;
  // CONFIRMED via ?tsdebug=true this session: the Tripleseat customer account has
  // multiple sites (Detroit Shipping Company site_id 5359, plus at least one other
  // — "The Social Brews"). Without a site filter, search results are ambiguous/empty.
  // Set TRIPLESEAT_SITE_ID=5359 in Netlify to scope strictly to DSC.
  const TS_SITE_ID = process.env.TRIPLESEAT_SITE_ID;
  const BASE = "https://connect.squareup.com/v2";

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  const PROTEIN_MAP = {
    // 'deux ch' covers both the correct French "Chevaux" and the actual Square menu
    // spelling "Chavaux" — the one-vowel mismatch dropped 8 burgers from the count on 2026-07-01
    beef: ['classic motor','deux ch',"flyin'",'flyin hawaiian','go-kart','go kart','fungu'],
    chicken: ['firebird'], lamb: ['lamborghini'], veggie: ['veg engine'],
  };
  const DRINK_KW = ['coca-cola','jarritos','voss'];

  function toEasternDate(utcStr) {
    const d = new Date(utcStr);
    const eastern = new Date(d.toLocaleString('en-US', { timeZone: 'America/Detroit' }));
    return `${eastern.getFullYear()}-${String(eastern.getMonth()+1).padStart(2,'0')}-${String(eastern.getDate()).padStart(2,'0')}`;
  }

  function getDayName(dateStr) {
    const [y,m,d] = dateStr.split('-').map(Number);
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(y,m-1,d).getDay()];
  }

  function getProteinType(name) {
    const n = name.toLowerCase();
    for (const [type,kws] of Object.entries(PROTEIN_MAP)) {
      if (kws.some(k => n.includes(k))) return type;
    }
    return null;
  }

  async function squarePost(path, body) {
    const r = await fetch(BASE + path, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Square-Version": "2024-01-18", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) { const err = await r.text(); throw new Error(`Square ${r.status} ${path}: ${err.substring(0,200)}`); }
    return r.json();
  }

  // Read staff closeout inventory from Blob storage
  async function getStaffInventory() {
    try {
      const { getStore, connectLambda } = require('@netlify/blobs');
      connectLambda(event); // required in exports.handler-style functions — without it getStore() throws and this silently returned null forever
      const store = getStore("motorburger-closeouts");
      const latest = await store.get("latest", { type: "json" });
      if (!latest?.inventory) return null;
      // Only use if submitted within last 20 hours
      const savedAt = new Date(latest.savedAt);
      const hoursAgo = (Date.now() - savedAt) / 3600000;
      if (hoursAgo > 20) return null;
      return {
        counts: latest.inventory,
        submittedAt: latest.savedAt,
        lowStock: latest.allLowStock || [],
        notes: latest.notes || '',
        fromStaff: true,
        hoursAgo: Math.round(hoursAgo),
      };
    } catch(e) { return null; }
  }

  // ---- Event look-ahead window (FIXED 2026-10-02) ----
  // Was hardcoded to 7 days, and Ticketmaster was capped at size=30 results — with
  // ~30+ events inside 3 miles of DSC that cap filled up by Sat/Sun, so the end of
  // every week (incl. Sun 10/4 Red Wings game + Sunday shows) silently went missing.
  // Default is now 21 days; override per request with ?events=true&eventDays=N (max 60).
  const EVENT_DAYS = Math.min(Math.max(parseInt((event.queryStringParameters||{}).eventDays || '21') || 21, 1), 60);

  // Today's date in Detroit time as a Date at local midnight. The old code used
  // toISOString() (UTC), which after 8pm Detroit time already reads as tomorrow
  // and skipped that evening's events.
  function detroitToday() {
    const [y,m,d] = toEasternDate(new Date().toISOString()).split('-').map(Number);
    return new Date(y, m-1, d);
  }
  function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // Ticketmaster events
  async function getTicketmasterEvents() {
    if (!TM_KEY) return { events: [], error: 'TICKETMASTER_KEY not set in Netlify env vars' };
    try {
      const today = detroitToday();
      const end = new Date(today); end.setDate(end.getDate()+EVENT_DAYS);
      // Times sent with a Z are UTC; padding the window by a few hours on each side
      // keeps Detroit-evening events on the first and last day inside the range.
      const startDT = ymd(today) + 'T04:00:00Z';
      const endDT = ymd(end) + 'T23:59:59Z';
      // Page through ALL results (Ticketmaster max size is 200/page, and it refuses
      // deep paging past ~1000 results — 5 pages x 200 is plenty for 3 miles).
      let raw = [];
      for (let page = 0; page < 5; page++) {
        const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_KEY}&latlong=42.3554,-83.0521&radius=3&unit=miles&startDateTime=${startDT}&endDateTime=${endDT}&size=200&page=${page}&sort=date,asc&locale=*`;
        const r = await fetch(url);
        if (!r.ok) {
          const errText = await r.text();
          if (raw.length) break; // keep what we already have rather than failing the whole pull
          return { events: [], error: `Ticketmaster API ${r.status}: ${errText.substring(0,200)}` };
        }
        const data = await r.json();
        raw = raw.concat(data._embedded?.events || []);
        const totalPages = data.page?.totalPages || 1;
        if (page + 1 >= totalPages) break;
      }
      if (!raw.length) return { events: [], error: null };
      const events = raw
        .filter(e => {
          const venue = e._embedded?.venues?.[0] || {};
          const city = (venue.city?.name || '').toLowerCase();
          const state = venue.state?.stateCode;
          return city !== 'windsor' && state !== 'ON' && state !== 'QC' && state !== 'BC';
        })
        .map(e => ({
          name: e.name,
          date: e.dates?.start?.localDate || '',
          time: e.dates?.start?.localTime?.substring(0,5) || 'TBA',
          venue: e._embedded?.venues?.[0]?.name || '',
          url: e.url || '',
          category: e.classifications?.[0]?.segment?.name || '',
          source: 'ticketmaster',
        }));
      return { events, error: null };
    } catch(e) { return { events: [], error: e.message }; }
  }

  // Masonic scraper — AXS listing pages (themasonic.com JSON-LD gets 403'd).
  // FIXED 2026-10-02: the old code pointed at a stale AXS venue id (101490) and
  // returned 0 events every time. AXS also lists each Masonic ROOM on its own page,
  // so both rooms are scraped and labelled with their exact names (staff use the
  // exact room name to know capacity: main theatre ~4,400 vs Jack White ~1,700).
  const MASONIC_ROOMS = [
    { venue: 'Masonic Temple Theatre',     url: 'https://www.axs.com/venues/126098/masonic-temple-theatre-detroit-tickets' },
    { venue: 'Masonic Jack White Theatre', url: 'https://www.axs.com/venues/101070/masonic-jack-white-theatre-detroit-tickets' },
  ];
  async function getMasonicEvents() {
    const events = [];
    const errors = [];
    await Promise.all(MASONIC_ROOMS.map(async room => {
      try {
        const r = await fetch(room.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!r.ok) { errors.push(`${room.venue}: AXS ${r.status}`); return; }
        const html = await r.text();
        const seen = new Set();
        const eventPattern = /"name"\s*:\s*"([^"]+)"[^}]*?"startDate"\s*:\s*"([^"]+)"/g;
        let match, found = 0;
        while ((match = eventPattern.exec(html)) !== null) {
          const name = match[1];
          const d = new Date(match[2]);
          if (isNaN(d)) continue;
          const date = toEasternDate(d.toISOString());
          const key = name.toLowerCase() + '|' + date;
          if (seen.has(key)) continue;
          seen.add(key); found++;
          events.push({
            name,
            date,
            time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Detroit' }),
            venue: room.venue,
            url: room.url,
            category: 'Concert / Live Event',
            source: 'masonic',
          });
        }
        if (!found) errors.push(`${room.venue}: AXS scrape returned 0 events (page may be blocked or changed)`);
      } catch(e) { errors.push(`${room.venue}: ${e.message}`); }
    }));
    return { events, error: errors.length ? errors.join('; ') : null };
  }

  // Tripleseat — DSC's own booked private events (parties, pedal pubs, etc.)
  // Auth: TRIPLESEAT_CLIENT_ID/SECRET + TRIPLESEAT_REFRESH_TOKEN are already live
  // in Netlify (one-time OAuth flow completed via tripleseat-auth.js). Access
  // tokens expire after 2hrs, so mint a fresh one on every call — no caching.
  const TS_TOKEN_URL = "https://api.tripleseat.com/oauth2/token";
  const TS_EVENTS_URL = "https://api.tripleseat.com/v1/events/search.json";

  async function getTripleseatAccessToken() {
    // Tripleseat's OAuth2 issues a NEW refresh_token on every use and invalidates
    // the old one (rotation) — a static env var alone breaks after one successful
    // refresh. So: persist whatever token pair comes back in blob storage, and
    // treat the env var only as the seed for the very first call after deploy.
    const { getStore, connectLambda } = require('@netlify/blobs');
    connectLambda(event);
    const store = getStore('motorburger-tripleseat');

    let saved = null;
    try { saved = await store.get('tokens', { type: 'json' }); } catch(e) { saved = null; }

    const now = Date.now();
    if (saved && saved.access_token && saved.expires_at && now < saved.expires_at - 60000) {
      return saved.access_token; // still valid — skip the refresh call entirely
    }

    const refreshTokenToUse = (saved && saved.refresh_token) || TS_REFRESH_TOKEN;
    const usingBlobToken = !!(saved && saved.refresh_token);

    const r = await fetch(TS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshTokenToUse,
        client_id: TS_CLIENT_ID,
        client_secret: TS_CLIENT_SECRET,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      const hint = usingBlobToken
        ? ' (this was a blob-stored, previously-rotated token — if this keeps failing, re-run tripleseat-auth.js to get a fresh one)'
        : ' (this was the Netlify env var token — if it keeps failing right after a fresh tripleseat-auth.js run, check for copy/paste issues)';
      throw new Error(`Tripleseat token refresh ${r.status}: ${JSON.stringify(data).substring(0,200)}${hint}`);
    }

    // Always persist whatever comes back — if Tripleseat didn't rotate the
    // refresh token this time, data.refresh_token may be absent, so fall back
    // to keeping the one we just used.
    const newTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshTokenToUse,
      expires_at: Date.now() + (data.expires_in || 7200) * 1000,
    };
    try { await store.setJSON('tokens', newTokens); } catch(e) { /* non-fatal — worst case, we just refresh again next call */ }

    return data.access_token;
  }

  function mmddyyyy(d) {
    return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
  }

  async function getTripleseatEvents() {
    if (!TS_CLIENT_ID || !TS_CLIENT_SECRET || !TS_REFRESH_TOKEN) {
      return { events: [], error: 'TRIPLESEAT env vars not set' };
    }
    try {
      const token = await getTripleseatAccessToken();
      // FIXED 2026-10-02: window was hardcoded to 7 days, so bookings further out
      // never reached the dashboard, staff portal, or the Tuesday events email.
      const today = detroitToday();
      const end = new Date(today); end.setDate(end.getDate()+EVENT_DAYS);
      let baseUrl = `${TS_EVENTS_URL}?event_start_date=${mmddyyyy(today)}&event_end_date=${mmddyyyy(end)}`;
      if (TS_SITE_ID) baseUrl += `&site_id=${TS_SITE_ID}`;
      if (TS_LOCATION_ID) baseUrl += `&location_ids=${TS_LOCATION_ID}`;

      // Confirmed via live ?tsdebug=true response: Tripleseat's actual shape is
      // {"total_pages":N,"results":[...]}. A longer window can span several pages,
      // and the old code only ever read page 1 — so walk every page (capped at 10).
      let list = [];
      let totalPages = 1;
      for (let page = 1; page <= Math.min(totalPages, 10); page++) {
        const r = await fetch(`${baseUrl}&page=${page}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) {
          const errText = await r.text();
          if (list.length) break; // keep earlier pages rather than failing the whole pull
          return { events: [], error: `Tripleseat API ${r.status} at ${TS_EVENTS_URL}: ${errText.substring(0,200)}` };
        }
        const data = await r.json();
        // Also handle {events:[...]} or a bare array defensively in case this differs by account/API version.
        list = list.concat(Array.isArray(data) ? data : (data.results || data.events || []));
        totalPages = (data && data.total_pages) || 1;
      }

      // Whitelist only DEFINITE and TENTATIVE bookings. Earlier assumption that
      // Tripleseat's /search endpoint already excludes LOST was wrong — a LOST
      // "Team dinner" (Beer Garden, 60 guests) showed up live on the staff app
      // and threw off kitchen planning. PROSPECT (unconfirmed leads), LOST,
      // CLOSED, and WAITLIST are now all excluded; only real, still-active
      // bookings reach the dashboard/staff portal.
      const TS_ALLOWED_STATUSES = ['DEFINITE', 'TENTATIVE'];
      const events = list
        .filter(e => TS_ALLOWED_STATUSES.includes((e.status||'').toUpperCase()))
        .map(e => {
          // Tripleseat's docs describe "rooms" as an array but show a single
          // object in the example response — handle both shapes defensively.
          const roomsField = e.rooms;
          const room = Array.isArray(roomsField) ? (roomsField[0] && roomsField[0].name) : (roomsField && roomsField.name);
          // Confirmed via live response: account name lives at booking.account.name,
          // not on the event object directly.
          const accountName = (e.booking && e.booking.account && e.booking.account.name) || '';
          return {
            name: e.name || 'Private Event',
            date: e.event_date_iso8601 || e.start_date || '',
            time: e.event_start_time || 'TBA',
            venue: room ? `DSC — ${room.trim()}` : 'Detroit Shipping Company',
            url: '',
            category: 'Private Event',
            source: 'tripleseat',
            status: e.status || null,
            guestCount: e.guest_count ?? e.guaranteed_guest_count ?? null,
            account: accountName,
          };
        });
      return { events, error: null };
    } catch(e) { return { events: [], error: e.message }; }
  }

  async function getTripleseatDiag() {
    if (!TS_CLIENT_ID || !TS_CLIENT_SECRET || !TS_REFRESH_TOKEN) {
      return { error: 'TRIPLESEAT env vars not set' };
    }
    try {
      const token = await getTripleseatAccessToken();
      const authHeader = { Authorization: `Bearer ${token}` };

      const [sitesR, locR] = await Promise.all([
        fetch('https://api.tripleseat.com/v1/sites.json', { headers: authHeader }),
        fetch('https://api.tripleseat.com/v1/locations.json', { headers: authHeader }),
      ]);
      const sites = sitesR.ok ? await sitesR.json() : { httpStatus: sitesR.status, body: (await sitesR.text()).substring(0,300) };
      const locations = locR.ok ? await locR.json() : { httpStatus: locR.status, body: (await locR.text()).substring(0,300) };

      const today = detroitToday();
      const end = new Date(today); end.setDate(end.getDate()+EVENT_DAYS);
      let eventsUrl = `${TS_EVENTS_URL}?event_start_date=${mmddyyyy(today)}&event_end_date=${mmddyyyy(end)}`;
      if (TS_SITE_ID) eventsUrl += `&site_id=${TS_SITE_ID}`;
      if (TS_LOCATION_ID) eventsUrl += `&location_ids=${TS_LOCATION_ID}`;
      const evR = await fetch(eventsUrl, { headers: authHeader });
      const rawEvents = evR.ok ? await evR.json() : { httpStatus: evR.status, body: (await evR.text()).substring(0,300) };

      return { tokenObtained: true, sites, locations, eventsUrlUsed: eventsUrl, rawEventsResponse: rawEvents };
    } catch(e) { return { error: e.message }; }
  }

  async function getEvents() {
    const [tm, masonic, tripleseat] = await Promise.all([getTicketmasterEvents(), getMasonicEvents(), getTripleseatEvents()]);
    // Dedupe Masonic (AXS) vs Ticketmaster on name + date, so the same show listed
    // on both isn't printed twice — but a same-named show on another date still shows.
    const seen = new Set(tm.events.map(e=>e.name.toLowerCase()+'|'+e.date));
    const merged = [...tm.events];
    masonic.events.forEach(e => { if (!seen.has(e.name.toLowerCase()+'|'+e.date)) merged.push(e); });
    merged.push(...tripleseat.events); // private events — no dedupe needed against public shows
    merged.sort((a,b) => (a.date||'').localeCompare(b.date||''));
    return {
      eventDays: EVENT_DAYS,
      events: merged,
      masonicScraped: masonic.events.length > 0,
      masonicCount: masonic.events.length,
      ticketmasterCount: tm.events.length,
      tripleseatCount: tripleseat.events.length,
      errors: { ticketmaster: tm.error, masonic: masonic.error, tripleseat: tripleseat.error },
    };
  }

  async function fetchOrders(fromDate, toDate, cursor=null) {
    const body = {
      location_ids: [LOCATION_ID],
      query: { filter: { date_time_filter: { created_at: { start_at: fromDate, end_at: toDate } }, state_filter: { states: ["COMPLETED"] } }, sort: { sort_field: "CREATED_AT", sort_order: "ASC" } },
      limit: 500,
    };
    if (cursor) body.cursor = cursor;
    return squarePost('/orders/search', body);
  }

  async function getAllOrders(fromDate, toDate) {
    let all=[], cursor=null, page=0;
    do {
      const data = await fetchOrders(fromDate, toDate, cursor);
      if (data.orders) all = all.concat(data.orders);
      cursor = data.cursor; page++;
      if (page > 20) break;
    } while (cursor);
    return all;
  }

  function processOrders(orders) {
    const byDate={}, items={};
    let rev=0, proteins=0, drinks=0;
    const gkByDate={}, proteinsByType={beef:0,chicken:0,lamb:0,veggie:0};

    (orders||[]).forEach(o => {
      const date = toEasternDate(o.created_at);
      if (!byDate[date]) byDate[date] = { gross:0, proteins:0, drinks:0, gokart:0, byType:{beef:0,chicken:0,lamb:0,veggie:0} };
      // NOTE: use NET sales (line-item gross_sales_money minus discounts), not
      // o.total_money, which includes sales tax. total_money was inflating every
      // revenue figure on the dashboard by the tax rate. Field name "gross" is kept
      // below for now to avoid a wider rename across index.html — it now holds net-of-tax sales.
      const itemsGross = (o.line_items||[]).reduce((s,li)=>s+(li.gross_sales_money?.amount||0),0)/100;
      const discounts = (o.total_discount_money?.amount||0)/100;
      const netSales = itemsGross - discounts;
      byDate[date].gross += netSales; rev += netSales;

      (o.line_items||[]).forEach(li => {
        const name = (li.name||'').toLowerCase();
        const qty = parseInt(li.quantity||1);
        const g = (li.gross_sales_money?.amount||0)/100;
        const dn = li.name||'Unknown';
        if (!items[dn]) items[dn] = {qty:0, gross:0};
        items[dn].qty += qty; items[dn].gross += g;
        const ptype = getProteinType(dn);
        if (ptype) { byDate[date].proteins+=qty; byDate[date].byType[ptype]+=qty; proteins+=qty; proteinsByType[ptype]+=qty; }
        if (DRINK_KW.some(k=>name.includes(k))) { byDate[date].drinks+=qty; drinks+=qty; }
        if (name.includes('go-kart')||name.includes('go kart')) {
          byDate[date].gokart+=qty; gkByDate[date]=(gkByDate[date]||0)+qty;
        }
      });
    });

    const dowDates={};
    Object.entries(byDate).forEach(([date,d]) => {
      const day=getDayName(date);
      if (!['Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(day)) return;
      if (!dowDates[day]) dowDates[day]=[];
      dowDates[day].push({date,...d});
    });

    const dowAvgs={};
    Object.entries(dowDates).forEach(([day,dayEntries]) => {
      dayEntries.sort((a,b)=>a.date.localeCompare(b.date));
      const last6 = dayEntries.slice(-6);
      const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
      const last3avg = arr => arr.length>=3 ? avg(arr.slice(-3)) : avg(arr);
      const rev6 = last6.map(d=>d.gross);
      dowAvgs[day] = {
        avgRevenue: avg(rev6), avgProteins: avg(last6.map(d=>d.proteins)),
        avgDrinks: avg(last6.map(d=>d.drinks)),
        avgByType: { beef:avg(last6.map(d=>d.byType.beef)), chicken:avg(last6.map(d=>d.byType.chicken)), lamb:avg(last6.map(d=>d.byType.lamb)), veggie:avg(last6.map(d=>d.byType.veggie)) },
        days: last6.length, trend: last6.length>=3 ? last3avg(rev6)/avg(rev6) : 1,
        recentDates: last6.map(d=>d.date),
      };
    });

    const proteinItems = Object.entries(items)
      .filter(([n])=>getProteinType(n)).sort((a,b)=>b[1].qty-a[1].qty).slice(0,10)
      .map(([name,d])=>({name, qty:d.qty, gross:Math.round(d.gross), type:getProteinType(name)}));

    const dailySummary = Object.entries(byDate)
      .sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([date,d])=>({date, gross:Math.round(d.gross), proteins:d.proteins, drinks:d.drinks, gokart:d.gokart, byType:d.byType}));

    return {rev:Math.round(rev), proteins, drinks, proteinsByType, byDate:dailySummary, dowAvgs, proteinItems, gkByDate, orderCount:orders.length};
  }

  try {
    const params = event.queryStringParameters||{};
    const days = parseInt(params.days||"7");
    const isYtd = params.ytd==="true";
    const isPrep = params.prep==="true";
    const isEvents = params.events==="true";
    const isTsDebug = params.tsdebug==="true"; // one-off diagnostic: raw Tripleseat sites/locations/events response, to find why events search returns 0
    const debugDate = params.debugDate; // e.g. ?debugDate=2026-07-01 — diagnostic: see exactly which line items matched/missed a protein type that day

    const isTsReset = params.tsreset==="true"; // clears the blob-stored Tripleseat token so a freshly-pasted env var refresh token takes effect again

    if (isTsReset) {
      try {
        const { getStore, connectLambda } = require('@netlify/blobs');
        connectLambda(event);
        const store = getStore('motorburger-tripleseat');
        await store.delete('tokens');
        return { statusCode:200, headers, body:JSON.stringify({ cleared: true, note: 'Next call will use TRIPLESEAT_REFRESH_TOKEN from env vars again.' }) };
      } catch(e) {
        return { statusCode:500, headers, body:JSON.stringify({ error: e.message }) };
      }
    }

    if (isTsDebug) {
      const diag = await getTripleseatDiag();
      // Surface current blob-stored token state (never the raw secrets) so we can see
      // whether it's using env var or a rotated blob token, and when it expires.
      try {
        const { getStore, connectLambda } = require('@netlify/blobs');
        connectLambda(event);
        const store = getStore('motorburger-tripleseat');
        const saved = await store.get('tokens', { type: 'json' });
        diag.tokenState = saved ? {
          hasStoredRefreshToken: !!saved.refresh_token,
          expiresAt: new Date(saved.expires_at).toISOString(),
          expired: Date.now() > saved.expires_at,
        } : { hasStoredRefreshToken: false, note: 'no blob-stored token yet — using env var' };
      } catch(e) { diag.tokenState = { error: e.message }; }
      return { statusCode:200, headers, body:JSON.stringify(diag) };
    }

    if (isEvents) {
      const result = await getEvents();
      return { statusCode:200, headers, body:JSON.stringify(result) };
    }

    if (debugDate) {
      const s = new Date(debugDate+'T00:00:00-04:00');
      const e = new Date(debugDate+'T23:59:59-04:00');
      const orders = await getAllOrders(s.toISOString(), e.toISOString());
      const lines = [];
      (orders||[]).forEach(o => {
        (o.line_items||[]).forEach(li => {
          lines.push({
            order_id: o.id,
            order_state: o.state,
            created_at: o.created_at,
            easternDate: toEasternDate(o.created_at),
            name: li.name,
            quantity: li.quantity,
            matchedProteinType: getProteinType(li.name||''),
          });
        });
      });
      return { statusCode:200, headers, body:JSON.stringify({
        requestedDate: debugDate,
        orderCount: orders.length,
        totalLineItems: lines.length,
        unmatchedLines: lines.filter(l=>!l.matchedProteinType),
        allLines: lines,
      }) };
    }

    const end = new Date();
    let startStr, endStr;
    endStr = end.toISOString().split('T')[0]+'T23:59:59.999Z';

    if (isYtd) {
      startStr = new Date(end.getFullYear(),0,1).toISOString().split('T')[0]+'T00:00:00.000Z';
    } else if (isPrep) {
      const s=new Date(); s.setDate(s.getDate()-91);
      startStr = s.toISOString().split('T')[0]+'T00:00:00.000Z';
    } else {
      const s=new Date(); s.setDate(s.getDate()-days-1);
      startStr = s.toISOString().split('T')[0]+'T00:00:00.000Z';
    }

    const promises = [getAllOrders(startStr, endStr)];
    if (isPrep) promises.push(getStaffInventory());

    const results = await Promise.all(promises);
    const summary = processOrders(results[0]);
    
    // For prep: use staff blob inventory if available, otherwise empty
    let inventory = {};
    let staffCloseout = null;
    if (isPrep && results[1]) {
      staffCloseout = results[1];
      inventory = staffCloseout.counts || {};
    }

    return { 
      statusCode:200, 
      headers, 
      body:JSON.stringify({summary, inventory, staffCloseout}) 
    };
  } catch(err) {
    return { statusCode:500, headers, body:JSON.stringify({error:err.message}) };
  }
};
