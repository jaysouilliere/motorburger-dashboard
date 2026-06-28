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

  function getDayName(dateStr) {
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(dateStr + 'T12:00:00').getDay()];
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

  // Get inventory by listing ALL catalog items and matching by name
  async function getInventoryCounts() {
    try {
      // Pull all catalog items (no text search — avoids matching issues)
      let allItems = [], cursor = null;
      do {
        const body = { object_types: ['ITEM'], limit: 100 };
        if (cursor) body.cursor = cursor;
        const result = await squarePost('/catalog/search', body);
        if (result.objects) allItems = allItems.concat(result.objects);
        cursor = result.cursor;
      } while (cursor);

      // Find our tracked items by name
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

      if (variationIds.length === 0) {
        console.log('No tracked item variations found in catalog');
        return {};
      }

      // Batch retrieve inventory counts
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
      console.error('Inventory fetch error:', e.message);
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
      const date = o.created_at.substring(0, 10);
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

    // Build DOW averages using LAST 6 occurrences of each day only
    const dow = {};
    const dowDates = {}; // track dates per day for sorting

    Object.entries(byDate).forEach(([date, d]) => {
      const day = getDayName(date);
      if (!['Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(day)) return;
      if (!dowDates[day]) dowDates[day] = [];
      dowDates[day].push({ date, ...d });
    });

    // Sort each day's dates and take last 6
    Object.entries(dowDates).forEach(([day, dayEntries]) => {
      dayEntries.sort((a,b) => a.date.localeCompare(b.date));
      const last6 = dayEntries.slice(-6); // last 6 occurrences only
      dow[day] = {
        revenue: last6.map(d => d.gross),
        proteins: last6.map(d => d.proteins),
        drinks: last6.map(d => d.drinks),
        byType: {
          beef:    last6.map(d => d.byType.beef),
          chicken: last6.map(d => d.byType.chicken),
          lamb:    last6.map(d => d.byType.lamb),
          veggie:  last6.map(d => d.byType.veggie),
        },
        dates: last6.map(d => d.date),
      };
    });

    const dowAvgs = {};
    Object.entries(dow).forEach(([day, d]) => {
      const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
      // Trend: last 3 vs last 6 avg
      const last3avg = arr => arr.length >= 3 ? avg(arr.slice(-3)) : avg(arr);
      dowAvgs[day] = {
        avgRevenue: avg(d.revenue),
        avgProteins: avg(d.proteins),
        avgDrinks: avg(d.drinks),
        avgByType: {
          beef:    avg(d.byType.beef),
          chicken: avg(d.byType.chicken),
          lamb:    avg(d.byType.lamb),
          veggie:  avg(d.byType.veggie),
        },
        days: d.revenue.length,
        trend: d.revenue.length >= 3 ? last3avg(d.revenue) / avg(d.revenue) : 1,
        drinkTrend: d.drinks.length >= 3 ? last3avg(d.drinks) / avg(d.drinks) : 1,
        recentDates: d.dates,
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

  try {
    const params = event.queryStringParameters || {};
    const days = parseInt(params.days || "7");
    const isYtd = params.ytd === "true";
    const isPrep = params.prep === "true";

    const end = new Date();
    let startStr, endStr;
    endStr = end.toISOString().split("T")[0] + "T23:59:59.999Z";

    if (isYtd) {
      startStr = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0] + "T00:00:00.000Z";
    } else if (isPrep) {
      // 90 days gives us ~13 of each day of week — more than enough for last 6
      const s = new Date(); s.setDate(s.getDate() - 90);
      startStr = s.toISOString().split("T")[0] + "T00:00:00.000Z";
    } else {
      const s = new Date(); s.setDate(s.getDate() - days);
      startStr = s.toISOString().split("T")[0] + "T00:00:00.000Z";
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
