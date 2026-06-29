const { getStore } = require('@netlify/blobs');

exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const payload = JSON.parse(event.body);
    const store = getStore("motorburger-closeouts");

    await store.setJSON("latest", {
      ...payload,
      savedAt: new Date().toISOString(),
    });

    const dateKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Detroit' });
    await store.setJSON(`history-${dateKey}`, {
      ...payload,
      savedAt: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, savedAt: new Date().toISOString() }),
    };
  } catch(err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
