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

  try {
    const params = event.queryStringParameters || {};
    const days = parseInt(params.days || "7");
    const type = params.type || "orders";

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    const startStr = start.toISOString().split("T")[0] + "T00:00:00.000Z";
    const endStr = end.toISOString().split("T")[0] + "T23:59:59.999Z";

    // For YTD we always fetch from Jan 1
    const ytdStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0] + "T00:00:00.000Z";

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
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Square-Version": "2024-01-18",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Square ${r.status}: ${err.substring(0, 300)}`);
      }
      return r.json();
    }

    async function getAllOrders(fromDate, toDate) {
      let all = [], cursor = null, page = 0;
      do {
        const data = await fetchOrders(fromDate, toDate, cursor);
        if (data.orders) all = all.concat(data.orders);
        cursor = data.cursor;
        page++;
        if (page > 20) break;
      } while (cursor);
      return all;
    }

    const [orders, ytdOrders] = await Promise.all([
      getAllOrders(startStr, endStr),
      getAllOrders(ytdStart, endStr),
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        orders,
        ytdOrders,
        locationId: LOCATION_ID,
        dateRange: { start: startStr, end: endStr },
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
