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
  // Items we track inventory for in Square
  const INVENTORY_ITEMS = ['firebird','lamborghini','veg engine'];

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

  async function squareGet(path) {
    const r = await fetch(BASE + path, {
      headers: { Authorization: `Bearer ${TOKEN}`, "Square-Version": "2024-01-18", "Content-Type": "application/json" },
    });
    if (!r.ok) { const err = await r.text(); throw new Error(`Square ${r.status} ${path}: ${err.substring(0, 200)}`); }
    return r.json();
  }

  // Get current inventory counts for tracked proteins
  async function getInventoryCounts() {
    try {
      // Step 1: Search catalog for our tracked items
      const catalogResult = await squarePost('/catalog/search', {
        object_types: ['ITEM'],
        query: { text_query: { keywords: INVENTORY_ITEMS } }
      });

      const items = catalogResult.objects || [];
      const variationIds = [];
      const itemNameMap = {}; // variationId -> item name

      items.forEach(item => {
        const itemName = (item.item_data?.name || '').toLowerCase();
        const isTracked = INVENTORY_ITEMS.some(k => itemName.includes(k));
        if (isTracked) {
          (item.item_data?.variations || []).forEach(v => {
            variationIds.push(v.id);
            itemNameMap[v.id] = item.item_data?.name;
          });
        }
      });

      if (variationIds.length === 0) return {};

      // Step 2: Get inventory counts
      const invResult = await squarePost('/inventory/counts/batch-retrieve', {
        catalog_object_ids: variationIds,
        location_ids: [LOCATION_ID],
      });

      const counts = {};
      (invResult.counts || []).forEach(c => {
        if (c.state === 'IN_STOCK') {
          const name = itemNameMap[c.catalog_object_id] || '';
          const qty = parseFloat(c.quantity || 0);
          const nameLower = name.toLowerCase();
          if (nameLower.includes('firebird')) counts.chicken = (counts.chicken || 0) + qty;
          else if (nameLower.includes('lamborghini')) counts.lamb = (counts.lamb || 0) + qty;
          else if (nameLower.includes('veg engine')) counts.veggie = (counts.veggie || 0) + qty;
        }
      });

      return counts;
    } catch (e) {
      console.error('Inventory fetch failed:', e.message);
      return {};
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

    const dow = {};
    Object.entries(byDate).forEach(([date, d]) => {
      const day = getDayName(date);
      if (!['Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(day)) return;
      if (!dow[day]) dow[day] = { revenue: [], proteins: [], byType: { beef:[], chicken:[], lamb:[], veggie:[] }, drinks: [] };
      dow[day].revenue.push(d.gross);
      dow[day].proteins.push(d.proteins);
      dow[day].drinks.push(d.drinks);
      Object.keys(d.byType).forEach(t => dow[day].byType[t].push(d.byType[t]));
    });

    const dowAvgs = {};
    Object.entries(dow).forEach(([day, d]) => {
      const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
      const recent3avg = arr => arr.length >= 3 ? avg(arr.slice(-3)) : avg(arr);
      dowAvgs[day] = {
        avgRevenue: avg(d.revenue),
        avgProteins: avg(d.proteins),
        avgDrinks: avg(d.drinks),
        avgByType: {
          beef: avg(d.byType.beef),
          chicken: avg(d.byType.chicken),
          lamb: avg(d.byType.lamb),
          veggie: avg(d.byType.veggie),
        },
        days: d.revenue.length,
        trend: d.revenue.length >= 3 ? recent3avg(d.revenue) / avg(d.revenue) : 1,
        recentRevenue: d.revenue.slice(-4), // last 4 for display
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
      const s = new Date(); s.setDate(s.getDate() - 90);
      startStr = s.toISOString().split("T")[0] + "T00:00:00.000Z";
    } else {
      const s = new Date(); s.setDate(s.getDate() - days);
      startStr = s.toISOString().split("T")[0] + "T00:00:00.000Z";
    }

    // For prep mode, also fetch inventory counts in parallel
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
