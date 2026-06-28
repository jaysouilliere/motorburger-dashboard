exports.handler = async function (event) {
  const TOKEN = process.env.SQUARE_TOKEN;
  const LOCATION_ID = process.env.SQUARE_LOCATION_ID;
  const BASE = "https://connect.squareup.com/v2";

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const PROTEIN_MAP = {
    beef: ['classic motor','deux chev',"flyin'",'flyin hawaiian','go-kart','go kart','fungu'],
    chicken: ['firebird'],
    lamb: ['lamborghini'],
    veggie: ['veg engine'],
  };
  const DRINK_KW = ['coca-cola','jarritos','voss'];

  // Convert UTC timestamp to Eastern local date string (handles EST -5 and EDT -4)
  function toEasternDate(utcStr) {
    const d = new Date(utcStr);
    // Eastern time: UTC-5 in winter (EST), UTC-4 in summer (EDT)
    // Use Intl to get correct offset automatically
    const eastern = new Date(d.toLocaleString('en-US', { timeZone: 'America/Detroit' }));
    const y = eastern.getFullYear();
    const m = String(eastern.getMonth() + 1).padStart(2, '0');
    const day = String(eastern.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getDayName(dateStr) {
    // dateStr is already Eastern local date YYYY-MM-DD
    const [y, m, d] = dateStr.split('-').map(Number);
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(y, m-1, d).getDay()];
  }

  function getProteinType(name) {
    const n = name.toLowerCase();
    for (const [type, kws] of Object.entries(PROTEIN_MAP)) {
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
    if (!r.ok) { const err = await r.text(); throw new Error(`Square ${r.status} ${path}: ${err.substring(0, 200)}`); }
    return r.json();
  }

  async function getInventoryCounts() {
    try {
      let allItems = [], cursor = null;
      do {
        const body = { object_types: ['ITEM'], limit: 100 };
        if (cursor) body.cursor = cursor;
        const result = await squarePost('/catalog/search', body);
        if (result.objects) allItems = allItems.concat(result.objects);
        cursor = result.cursor;
      } while (cursor);

      const TRACKED = {
        chicken: ['firebird'],
        lamb: ['lamborghini'],
        veggie: ['veg engine'],
      };

      const variationIds = [];
      const idToType = {};

      allItems.forEach(item => {
        const itemName = (item.item_data?.name || '').toLowerCase();
        for (const [type, keywords] of Object.entries(TRACKED)) {
          if (keywords.some(k => itemName.includes(k))) {
            (item.item_data?.variations || []).forEach(v => {
              variationIds.push(v.id);
              idToType[v.id] = type;
            });
          }
        }
      });

      if (variationIds.length === 0) return {};

      const invResult = await squarePost('/inventory/counts/batch-retrieve', {
        catalog_object_ids: variationIds,
        location_ids: [LOCATION_ID],
        states: ['IN_STOCK'],
      });

      const counts = {};
      (invResult.counts || []).forEach(c => {
        const type = idToType[c.catalog_object_id];
        if (type && c.state === 'IN_STOCK') {
          counts[type] = (counts[type] || 0) + parseFloat(c.quantity || 0);
        }
      });

      return counts;
    } catch (e) {
      return { _error: e.message };
    }
  }

  async function fetchOrders(fromDate, toDate, cursor = null) {
    const body = {
      location_ids: [LOCATION_ID],
      query: {
        filter: {
          date_time_filter: { created_at: { start_at: fromDate, end_at: toDate } },
          state_filter: { states: ["COMPLETED"] },
        },
        sort: { sort_field: "CREATED_AT", sort_order: "ASC" },
      },
      limit: 500,
    };
    if (cursor) body.cursor = cursor;
    return squarePost('/orders/search', body);
  }

  async function getAllOrders(fromDate, toDate) {
    let all = [], cursor = null, page = 0;
    do {
      const data = await fetchOrders(fromDate, toDate, cursor);
      if (data.orders) all = all.concat(data.orders);
      cursor = data.cursor; page++;
      if (page > 20) break;
    } while (cursor);
    return all;
  }

  function processOrders(orders) {
    const byDate = {}, items = {};
    let rev = 0, proteins = 0, drinks = 0;
    const gkByDate = {};
    const proteinsByType = { beef: 0, chicken: 0, lamb: 0, veggie: 0 };

    (orders || []).forEach(o => {
      // Use Eastern local date, not UTC date
      const date = toEasternDate(o.created_at);
      if (!byDate[date]) byDate[date] = { gross: 0, proteins: 0, drinks: 0, gokart: 0, byType: { beef:0, chicken:0, lamb:0, veggie:0 } };
      const gross = (o.total_money?.amount || 0) / 100;
      byDate[date].gross += gross;
      rev += gross;

      (o.line_items || []).forEach(li => {
        const name = (li.name || '').toLowerCase();
        const qty = parseInt(li.quantity || 1);
        const g = (li.gross_sales_money?.amount || 0) / 100;
        const dn = li.name || 'Unknown';
        if (!items[dn]) items[dn] = { qty: 0, gross: 0 };
        items[dn].qty += qty; items[dn].gross += g;

        const ptype = getProteinType(dn);
        if (ptype) {
          byDate[date].proteins += qty;
          byDate[date].byType[ptype] += qty;
          proteins += qty;
          proteinsByType[ptype] += qty;
        }
        if (DRINK_KW.some(k => name.includes(k))) { byDate[date].drinks += qty; drinks += qty; }
        if (name.includes('go-kart') || name.includes('go kart')) {
          byDate[date].gokart += qty;
          gkByDate[date] = (gkByDate[date] || 0) + qty;
        }
      });
    });

    // DOW averages using last 6 occurrences
    const dowDates = {};
    Object.entries(byDate).forEach(([date, d]) => {
      const day = getDayName(date);
      if (!['Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(day)) return;
      if (!dowDates[day]) dowDates[day] = [];
      dowDates[day].push({ date, ...d });
    });

    const dowAvgs = {};
    Object.entries(dowDates).forEach(([day, dayEntries]) => {
      dayEntries.sort((a,b) => a.date.localeCompare(b.date));
      const last6 = dayEntries.slice(-6);
      const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
      const last3avg = arr => arr.length >= 3 ? avg(arr.slice(-3)) : avg(arr);
      const rev6 = last6.map(d => d.gross);
      dowAvgs[day] = {
        avgRevenue: avg(rev6),
        avgProteins: avg(last6.map(d => d.proteins)),
        avgDrinks: avg(last6.map(d => d.drinks)),
        avgByType: {
          beef:    avg(last6.map(d => d.byType.beef)),
          chicken: avg(last6.map(d => d.byType.chicken)),
          lamb:    avg(last6.map(d => d.byType.lamb)),
          veggie:  avg(last6.map(d => d.byType.veggie)),
        },
        days: last6.length,
        trend: last6.length >= 3 ? last3avg(rev6) / avg(rev6) : 1,
        drinkTrend: last6.length >= 3 ? last3avg(last6.map(d=>d.drinks)) / avg(last6.map(d=>d.drinks)) : 1,
        recentDates: last6.map(d => d.date),
      };
    });

    const proteinItems = Object.entries(items)
      .filter(([n]) => getProteinType(n))
      .sort((a,b) => b[1].qty - a[1].qty)
      .slice(0, 10)
      .map(([name, d]) => ({ name, qty: d.qty, gross: Math.round(d.gross), type: getProteinType(name) }));

    const dailySummary = Object.entries(byDate)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([date, d]) => ({ date, gross: Math.round(d.gross), proteins: d.proteins, drinks: d.drinks, gokart: d.gokart, byType: d.byType }));

    return { rev: Math.round(rev), proteins, drinks, proteinsByType, byDate: dailySummary, dowAvgs, proteinItems, gkByDate, orderCount: orders.length };
  }

  // Get Eastern "today" date string for use in date range queries
  function easternToday() {
    return new Date().toLocaleString('en-US', { timeZone: 'America/Detroit' }).split(',')[0];
  }

  // Convert Eastern local date to UTC range for Square API query
  function easternDateToUTCRange(daysBack) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - daysBack);
    // Add a day buffer on each end to capture all Eastern-time orders regardless of UTC offset
    start.setDate(start.getDate() - 1);
    return {
      start: start.toISOString().split('T')[0] + 'T00:00:00.000Z',
      end: end.toISOString().split('T')[0] + 'T23:59:59.999Z',
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const days = parseInt(params.days || "7");
    const isYtd = params.ytd === "true";
    const isPrep = params.prep === "true";

    let startStr, endStr;
    const now = new Date();
    endStr = now.toISOString().split('T')[0] + 'T23:59:59.999Z';

    if (isYtd) {
      startStr = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0] + 'T00:00:00.000Z';
    } else if (isPrep) {
      const s = new Date(); s.setDate(s.getDate() - 91); // extra day buffer
      startStr = s.toISOString().split('T')[0] + 'T00:00:00.000Z';
    } else {
      const s = new Date(); s.setDate(s.getDate() - days - 1); // extra day buffer for timezone
      startStr = s.toISOString().split('T')[0] + 'T00:00:00.000Z';
    }

    const promises = [getAllOrders(startStr, endStr)];
    if (isPrep) promises.push(getInventoryCounts());

    const results = await Promise.all(promises);
    const orders = results[0];
    const inventory = isPrep ? (results[1] || {}) : {};
    const summary = processOrders(orders);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ summary, inventory }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
