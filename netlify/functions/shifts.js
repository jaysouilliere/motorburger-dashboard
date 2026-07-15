// Persists staff clock in/out shifts to Netlify Blob storage so the data is
// shared across every device (tablet at DSC, manager's phone, laptop, etc.)
// instead of living only in the browser localStorage of whichever device
// punched the clock. This is what the Pay Period tab reads hours from.
//
// Storage shape: one JSON array under key "all" in the "motorburger-shifts"
// store. Small team, low shift volume — a single blob is simplest and keeps
// this consistent with the existing staff-submit.js pattern.

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {
    const { getStore, connectLambda } = require('@netlify/blobs');
    connectLambda(event); // required in exports.handler-style functions — see square-proxy.js note
    const store = getStore("motorburger-shifts");

    if (event.httpMethod === "GET") {
      const shifts = (await store.get("all", { type: "json" })) || [];
      return { statusCode: 200, headers, body: JSON.stringify({ shifts }) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const shifts = (await store.get("all", { type: "json" })) || [];

      if (body.action === "save" && body.shift) {
        shifts.push(body.shift);
      } else if (body.action === "update" && body.id) {
        const i = shifts.findIndex(s => s.id === body.id);
        if (i >= 0) shifts[i] = { ...shifts[i], ...body.updates };
      } else if (body.action === "delete" && body.id) {
        const i = shifts.findIndex(s => s.id === body.id);
        if (i >= 0) shifts.splice(i, 1);
      } else if (body.action === "clearImported") {
        // One-time escape hatch: removes every row saved by the historical
        // CSV importer (imported:true), so a corrected re-import doesn't sit
        // alongside stale rows saved under the old (wrongly-dated) ids.
        const keep = shifts.filter(s => !s.imported);
        const removed = shifts.length - keep.length;
        await store.set("all", JSON.stringify(keep));
        return { statusCode: 200, headers, body: JSON.stringify({ removed, remaining: keep.length }) };
      } else if (body.action === "bulkUpsert" && Array.isArray(body.shifts)) {
        // Used by both the historical CSV import and the biweekly manual-entry
        // form. Ids are deterministic (date+staff+role, built by the client),
        // so re-submitting the same day just overwrites that day's numbers
        // instead of creating duplicates — important since managers correct
        // biweekly entries after the fact.
        const byId = new Map(shifts.map(s => [s.id, s]));
        let added = 0, updated = 0;
        body.shifts.forEach(s => {
          if (byId.has(s.id)) updated++; else added++;
          byId.set(s.id, s);
        });
        const merged = [...byId.values()];
        await store.set("all", JSON.stringify(merged));
        return { statusCode: 200, headers, body: JSON.stringify({ added, updated, total: merged.length }) };
      } else {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "unknown action or missing fields" }) };
      }

      await store.set("all", JSON.stringify(shifts));
      return { statusCode: 200, headers, body: JSON.stringify({ shifts }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
