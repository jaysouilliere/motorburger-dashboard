// netlify/functions/tripleseat-auth.js
//
// ONE-TIME SETUP HELPER — not part of the ongoing app.
// Visit this URL once in a browser after deploying:
//   https://motorburger-dashboard.netlify.app/.netlify/functions/tripleseat-auth
//
// Flow:
//   1. No ?code param yet -> redirects you to Tripleseat's login/consent screen
//   2. Tripleseat redirects back here with ?code=...
//   3. This function exchanges that code for an access_token + refresh_token
//   4. Displays the refresh_token on screen so you can copy it into
//      Netlify env vars as TRIPLESEAT_REFRESH_TOKEN
//
// After that one-time run, this function is never needed again — the
// events-fetching logic (built later) will use TRIPLESEAT_REFRESH_TOKEN
// to auto-mint fresh access tokens indefinitely.

const AUTHORIZE_URL = "https://login.tripleseat.com/oauth2/authorize";
const TOKEN_URL = "https://api.tripleseat.com/oauth2/token";
const REDIRECT_URI = "https://motorburger-dashboard.netlify.app/.netlify/functions/tripleseat-auth";

exports.handler = async (event) => {
  const { CLIENT_ID, CLIENT_SECRET } = {
    CLIENT_ID: process.env.TRIPLESEAT_CLIENT_ID,
    CLIENT_SECRET: process.env.TRIPLESEAT_CLIENT_SECRET,
  };

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return {
      statusCode: 500,
      body: "Missing TRIPLESEAT_CLIENT_ID or TRIPLESEAT_CLIENT_SECRET env vars. Add them in Netlify, redeploy, then retry.",
    };
  }

  const code = event.queryStringParameters && event.queryStringParameters.code;

  // Step 1: no code yet -> kick off the authorize redirect
  if (!code) {
    const authUrl =
      `${AUTHORIZE_URL}?client_id=${encodeURIComponent(CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code&scope=read`;

    return {
      statusCode: 302,
      headers: { Location: authUrl },
      body: "",
    };
  }

  // Step 2: we have a code -> exchange it for tokens
  try {
    const resp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: 502,
        body: `Tripleseat token exchange failed: ${JSON.stringify(data)}`,
      };
    }

    const html = `
      <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: 40px auto;">
          <h2>✅ Tripleseat connected</h2>
          <p>Copy the refresh token below into Netlify as
            <code>TRIPLESEAT_REFRESH_TOKEN</code>, then redeploy.</p>
          <textarea readonly style="width:100%; height:80px; font-family: monospace;">${data.refresh_token}</textarea>
          <p style="color:#666; font-size:0.9em;">
            Access token (short-lived, expires in ${data.expires_in}s — not needed,
            shown for reference only):<br/>
            <code style="word-break:break-all;">${data.access_token}</code>
          </p>
          <p style="color:#c00;">Once you've copied the refresh token, this page and its
            contents are no longer needed — you can close it.</p>
        </body>
      </html>`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: html,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: `Error exchanging code for token: ${err.message}`,
    };
  }
};
