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
        // Each touched date is also recorded in "importedDates" so a later
        // re-import can clear ONLY these, never a manager's own single-day
        // corrections entered directly in Pay Period.
        const overrides = (await store.get("overrides", { type: "json" })) || {};
        const importedDates = (await store.get("importedDates", { type: "json" })) || {};
        Object.entries(body.entries).forEach(([date, amount]) => {
          if (amount !== null && amount !== undefined && !isNaN(amount)) {
            overrides[date] = Number(amount);
            importedDates[date] = true;
          }
        });
        await store.set("overrides", JSON.stringify(overrides));
        await store.set("importedDates", JSON.stringify(importedDates));
        return { statusCode: 200, headers, body: JSON.stringify({ overrides }) };
      }

      if (body.action === "clearImported") {
        // Pairs with shifts.js's clearImported. Only removes overrides for
        // dates that were themselves set by a historical bulkSet import —
        // any date a manager typed into Pay Period directly is left alone.
        const overrides = (await store.get("overrides", { type: "json" })) || {};
        const importedDates = (await store.get("importedDates", { type: "json" })) || {};
        let removed = 0;
        Object.keys(importedDates).forEach(date => {
          if (Object.prototype.hasOwnProperty.call(overrides, date)) { delete overrides[date]; removed++; }
        });
        await store.set("overrides", JSON.stringify(overrides));
        await store.set("importedDates", JSON.stringify({}));
        return { statusCode: 200, headers, body: JSON.stringify({ removed }) };
      }

      if (body.action === "clearClosedDayOverrides") {
        // Targeted cleanup for stale overrides left by an import that ran
        // BEFORE importedDates tracking existed (so the scoped clearImported
        // above can't find them by tag). Instead of wiping everything —
        // which would also erase any tip totals a manager typed in directly
        // for real dates — this only removes overrides that fall on a day
        // the restaurant is never open. Any such value can only be stale,
        // regardless of source, so this can't touch legitimate manual entries.
        // closedWeekdays: 0=Sun, 1=Mon, ... 6=Sat (defaults to Monday).
        const closedWeekdays = Array.isArray(body.closedWeekdays) && body.closedWeekdays.length
          ? body.closedWeekdays : [1];
        const overrides = (await store.get("overrides", { type: "json" })) || {};
        const importedDates = (await store.get("importedDates", { type: "json" })) || {};
        let removed = 0;
        Object.keys(overrides).forEach(date => {
          const day = new Date(date + "T00:00:00").getDay();
          if (closedWeekdays.includes(day)) { delete overrides[date]; delete importedDates[date]; removed++; }
        });
        await store.set("overrides", JSON.stringify(overrides));
        await store.set("importedDates", JSON.stringify(importedDates));
        return { statusCode: 200, headers, body: JSON.stringify({ removed }) };
      }

      // { date: 'YYYY-MM-DD', amount: number|null } — a manager typing a
      // correction directly into Pay Period for one day.
      if (!body.date) return { statusCode: 400, headers, body: JSON.stringify({ error: "date required" }) };

      const overrides = (await store.get("overrides", { type: "json" })) || {};
      const importedDates = (await store.get("importedDates", { type: "json" })) || {};
      if (body.amount === null || body.amount === undefined || isNaN(body.amount)) {
        delete overrides[body.date];
      } else {
        overrides[body.date] = Number(body.amount);
      }
      // This date now reflects a manager's own entry, not the historical
      // import — protect it from a future "clear previous import".
      delete importedDates[body.date];
      await store.set("overrides", JSON.stringify(overrides));
      await store.set("importedDates", JSON.stringify(importedDates));
      return { statusCode: 200, headers, body: JSON.stringify({ overrides }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
