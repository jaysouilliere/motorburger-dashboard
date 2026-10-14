// masonic-events.js
// Stores the weekly Masonic Temple event list so it shows up in the events feed
// (square-proxy.js ?events=true) and therefore on the staff portal's "today's events"
// card at punch-in. AXS blocks Netlify's server (403), so the weekly run that visits
// the Masonic site pushes its results here instead.
//
//   GET  /.netlify/functions/masonic-events        -> current saved list (public, read-only)
//   POST /.netlify/functions/masonic-events        -> REPLACES the saved list
//        header:  x-masonic-key: <MASONIC_INGEST_KEY env var>
//        body:    {"events":[{"name":"Mike D 5D","date":"2026-10-17","time":"19:00",
//                             "venue":"Masonic Temple Theatre","url":"https://..."}]}
//                 (a bare array also works). date must be YYYY-MM-DD (Detroit date).
//                 time may be "19:00", "7:00 PM", or omitted (shows as TBA).
const { getStore, connectLambda } = require('@netlify/blobs');

exports.handler = async function (event) {
  connectLambda(event); // required for classic exports.handler functions

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-masonic-key',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const store = getStore('motorburger-masonic');

  try {
    if (event.httpMethod === 'GET') {
      const saved = await store.get('events', { type: 'json' });
      return {
        statusCode: 200, headers,
        body: JSON.stringify(saved || { events: [], updatedAt: null }),
      };
    }

    if (event.httpMethod === 'POST') {
      const KEY = process.env.MASONIC_INGEST_KEY;
      if (!KEY) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'MASONIC_INGEST_KEY is not set in Netlify env vars' }) };
      }
      const sent = (event.headers || {})['x-masonic-key'];
      if (sent !== KEY) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Bad or missing x-masonic-key' }) };
      }

      let payload;
      try { payload = JSON.parse(event.body || '{}'); }
      catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body is not valid JSON' }) }; }

      const list = Array.isArray(payload) ? payload : payload.events;
      if (!Array.isArray(list)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Expected {"events":[...]} or a bare array' }) };
      }

      const accepted = [];
      const rejected = [];
      const seen = new Set();
      list.slice(0, 500).forEach((e, i) => {
        const name = String((e && e.name) || '').trim();
        const date = String((e && e.date) || '').trim();
        if (!name) { rejected.push(`#${i}: missing name`); return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { rejected.push(`#${i} (${name}): date must be YYYY-MM-DD, got "${date}"`); return; }
        const key = name.toLowerCase() + '|' + date;
        if (seen.has(key)) return; // same show listed twice
        seen.add(key);

        const rawTime = String((e && e.time) || '').trim();
        const time = (/^\d{1,2}:\d{2}$/.test(rawTime) || /^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(rawTime)) ? rawTime : 'TBA';
        // Exact room names matter to staff (main theatre ~4,400 vs Jack White ~1,700).
        const venue = /jack\s*white/i.test(String((e && e.venue) || '')) ? 'Masonic Jack White Theatre' : 'Masonic Temple Theatre';

        accepted.push({
          name, date, time, venue,
          url: String((e && e.url) || ''),
          category: 'Concert / Live Event',
          source: 'masonic',
        });
      });

      accepted.sort((a, b) => a.date.localeCompare(b.date));
      const updatedAt = new Date().toISOString();
      await store.setJSON('events', { events: accepted, updatedAt });
      return { statusCode: 200, headers, body: JSON.stringify({ saved: accepted.length, rejected, updatedAt }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
