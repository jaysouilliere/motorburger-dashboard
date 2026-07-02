

exports.handler = async function (event) {
  const TOKEN = process.env.SQUARE_TOKEN;
  const LOCATION_ID = process.env.SQUARE_LOCATION_ID;
  const TM_KEY = process.env.TICKETMASTER_KEY;
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

  // Ticketmaster events
  async function getTicketmasterEvents() {
    if (!TM_KEY) return { events: [], error: 'TICKETMASTER_KEY not set in Netlify env vars' };
    try {
      const today = new Date();
      const end = new Date(today); end.setDate(end.getDate()+7);
      const startDT = today.toISOString().split('T')[0] + 'T00:00:00Z';
      const endDT = end.toISOString().split('T')[0] + 'T23:59:59Z';
      const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_KEY}&latlong=42.3554,-83.0521&radius=3&unit=miles&startDateTime=${startDT}&endDateTime=${endDT}&size=30&sort=date,asc&locale=*`;
      const r = await fetch(url);
      if (!r.ok) {
        const errText = await r.text();
        return { events: [], error: `Ticketmaster API ${r.status}: ${errText.substring(0,200)}` };
      }
      const data = await r.json();
      if (!data._embedded?.events) return { events: [], error: null };
      const events = data._embedded.events
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

  // Masonic scraper — AXS listing page (themasonic.com JSON-LD gets 403'd, AXS raw-HTML regex is the proven working method from the Apps Script digest)
  async function getMasonicEvents() {
    const AXS_URL = 'https://www.axs.com/venues/101490/masonic-temple-theatre-detroit-tickets';
    try {
      const r = await fetch(AXS_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const html = await r.text();
      const events = [];
      const seen = new Set();
      const eventPattern = /"name"\s*:\s*"([^"]+)"[^}]*?"startDate"\s*:\s*"([^"]+)"/g;
      let match;
      while ((match = eventPattern.exec(html)) !== null) {
        const name = match[1];
        const rawDate = match[2];
        if (seen.has(name)) continue;
        seen.add(name);
        const d = new Date(rawDate);
        events.push({
          name,
          date: toEasternDate(d.toISOString()),
          time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Detroit' }),
          venue: 'Masonic Temple Theatre',
          url: AXS_URL,
          category: 'Concert / Live Event',
          source: 'masonic',
        });
      }
      return { events, error: events.length === 0 ? 'AXS scrape returned 0 events (page structure may have changed)' : null };
    } catch(e) { return { events: [], error: e.message }; }
  }

  async function getEvents() {
    const [tm, masonic] = await Promise.all([getTicketmasterEvents(), getMasonicEvents()]);
    const seen = new Set(tm.events.map(e=>e.name.toLowerCase()));
    const merged = [...tm.events];
    masonic.events.forEach(e => { if (!seen.has(e.name.toLowerCase())) merged.push(e); });
    merged.sort((a,b) => (a.date||'').localeCompare(b.date||''));
    return {
      events: merged,
      masonicScraped: masonic.events.length > 0,
      masonicCount: masonic.events.length,
      ticketmasterCount: tm.events.length,
      errors: { ticketmaster: tm.error, masonic: masonic.error },
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
    const debugDate = params.debugDate; // e.g. ?debugDate=2026-07-01 — diagnostic: see exactly which line items matched/missed a protein type that day

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
