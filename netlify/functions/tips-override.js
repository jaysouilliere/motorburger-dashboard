// Manual per-day overrides for the tip pool shown in the Pay Period tab.
// The default source of truth is Square's own tip_money data (pulled live
// by square-proxy.js's ?tips=true action). This store only holds the days
// where a manager typed in a different number — e.g. cash tips Square never
// saw, or a correction. Deleting an override (amount: null) reverts that
// day back to whatever Square reports.

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {
    const { getStore, connectLambda } = require('@netlify/blobs');
    connectLambda(event);
    const store = getStore("motorburger-tips");

    if (event.httpMethod === "GET") {
      const overrides = (await store.get("overrides", { type: "json" })) || {};
      return { statusCode: 200, headers, body: JSON.stringify({ overrides }) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");

      if (body.action === "bulkSet" && body.entries && typeof body.entries === "object") {
        // Historical import: entries is { 'YYYY-MM-DD': amount, ... }. These
        // are treated as overrides so old dates use the CSV's own recorded
        // total rather than whatever (if anything) Square has for that date.
        const overrides = (await store.get("overrides", { type: "json" })) || {};
        Object.entries(body.entries).forEach(([date, amount]) => {
          if (amount !== null && amount !== undefined && !isNaN(amount)) overrides[date] = Number(amount);
        });
        await store.set("overrides", JSON.stringify(overrides));
        return { statusCode: 200, headers, body: JSON.stringify({ overrides }) };
      }

      if (body.action === "clearAll") {
        // One-time escape hatch to pair with shifts.js's clearImported —
        // wipes every stored override. Safe as a full wipe only because,
        // at this stage, every override on file came from the historical
        // importer, not from a manager's own single-day corrections.
        await store.set("overrides", JSON.stringify({}));
        return { statusCode: 200, headers, body: JSON.stringify({ cleared: true }) };
      }

      // { date: 'YYYY-MM-DD', amount: number|null }
      if (!body.date) return { statusCode: 400, headers, body: JSON.stringify({ error: "date required" }) };

      const overrides = (await store.get("overrides", { type: "json" })) || {};
      if (body.amount === null || body.amount === undefined || isNaN(body.amount)) {
        delete overrides[body.date];
      } else {
        overrides[body.date] = Number(body.amount);
      }
      await store.set("overrides", JSON.stringify(overrides));
      return { statusCode: 200, headers, body: JSON.stringify({ overrides }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
