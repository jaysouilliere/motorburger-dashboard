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
  const ALL_BURGER_KW = [...PROTEIN_MAP.beef, ...PROTEIN_MAP.chicken, ...PROTEIN_MAP.lamb, ...PROTEIN_MAP.veggie];
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
    const r = await fetch(BASE + "/orders/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Square-Version": "2024-01-18", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) { const err = await r.text(); throw new Error(`Square ${r.status}: ${err.substring(0, 200)}`); }
    return r.json();
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
      if (!byDate[date]) byDate[date] = { gross: 0, proteins: 0, drinks: 0, gokart: 0 };
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
      if (!dow[day]) dow[day] = { revenue: [], proteins: [] };
      dow[day].revenue.push(d.gross);
      dow[day].proteins.push(d.proteins);
    });

    const dowAvgs = {};
    Object.entries(dow).forEach(([day, d]) => {
      dowAvgs[day] = {
        avgRevenue: d.revenue.reduce((a,b)=>a+b,0)/d.revenue.length,
        avgProteins: d.proteins.reduce((a,b)=>a+b,0)/d.proteins.length,
        days: d.revenue.length
      };
    });

    const proteinItems = Object.entries(items)
      .filter(([n]) => getProteinType(n))
      .sort((a,b) => b[1].qty - a[1].qty)
      .slice(0, 10)
      .map(([name, d]) => ({ name, qty: d.qty, gross: Math.round(d.gross), type: getProteinType(name) }));

    const dailySummary = Object.entries(byDate)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([date, d]) => ({ date, gross: Math.round(d.gross), proteins: d.proteins, drinks: d.drinks, gokart: d.gokart }));

    return { rev: Math.round(rev), proteins, drinks, proteinsByType, byDate: dailySummary, dowAvgs, proteinItems, gkByDate, orderCount: orders.length };
  }

  try {
    const params = event.queryStringParameters || {};
    const days = parseInt(params.days || "7");
    const isYtd = params.ytd === "true";

    const end = new Date();
    const start = new Date();

    let startStr, endStr;
    if (isYtd) {
      startStr = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0] + "T00:00:00.000Z";
      endStr = end.toISOString().split("T")[0] + "T23:59:59.999Z";
    } else {
      start.setDate(start.getDate() - days);
      startStr = start.toISOString().split("T")[0] + "T00:00:00.000Z";
      endStr = end.toISOString().split("T")[0] + "T23:59:59.999Z";
    }

    const orders = await getAllOrders(startStr, endStr);
    const summary = processOrders(orders);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ summary }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
