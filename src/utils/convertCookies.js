/**
 * convertCookies.js
 *
 * Converts a browser cookie string (key=value; key=value; ...)
 * into the Netscape cookie file format used by yt-dlp / curl.
 *
 * Usage:
 *   const { cookieStringToNetscape } = require('./convertCookies');
 *   const netscapeContent = cookieStringToNetscape(cookieString, '.youtube.com');
 */

/**
 * Convert a raw browser cookie string to Netscape HTTP Cookie File format.
 *
 * @param {string} cookieString  - Raw cookie string ("key=value; key2=value2")
 * @param {string} [domain]      - Cookie domain (default: ".youtube.com")
 * @param {number} [maxAge]      - Expiry seconds from now (default: 1 year)
 * @returns {string}             - Full Netscape cookie file content
 */
function cookieStringToNetscape(cookieString, domain = '.youtube.com', maxAge = 365 * 24 * 3600) {
  const expiration = Math.trunc(Date.now() / 1000) + maxAge;

  const lines = ['# Netscape HTTP Cookie File'];

  const pairs = cookieString.split(';');

  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;

    const name  = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();

    if (!name) continue;

    // Netscape format columns (tab-separated):
    //   domain  includeSubdomains  path  secure  expiry  name  value
    const secure = name.startsWith('__Secure') || name.startsWith('__Host') ? 'TRUE' : 'FALSE';
    lines.push([domain, 'TRUE', '/', secure, expiration, name, value].join('\t'));
  }

  return lines.join('\n') + '\n';
}

module.exports = { cookieStringToNetscape };
