import dns from 'node:dns';
import net from 'node:net';

/**
 * SSRF guard for outgoing webhook URLs.
 *  - https only, no credentials in the URL
 *  - the host must not be localhost / an internal name / a private, loopback, link-local or reserved address
 *  - hostnames are resolved and EVERY address is checked, both when the URL is saved and again at connect time
 *    (the connect-time check, via `guardedLookup`, defeats DNS-rebinding between save and send)
 * `allowPrivate` exists for tests/dev only (config forces it off in production).
 */
const blocked = new net.BlockList();
for (const [addr, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
]) blocked.addSubnet(addr, bits, 'ipv4');
for (const [addr, bits] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32], ['64:ff9b::', 96], ['100::', 64]]) blocked.addSubnet(addr, bits, 'ipv6');

const INTERNAL_NAME = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/i;

/** True when an IP literal must not be contacted. */
export function isBlockedAddress(ip) {
  const kind = net.isIP(ip);
  if (!kind) return true; // not an IP at all: refuse rather than guess
  return blocked.check(ip, kind === 4 ? 'ipv4' : 'ipv6');
}

const stripBrackets = (h) => (h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h);

/** Cheap syntactic checks, no network. Returns { ok:true, url } or { ok:false, reason }. */
export function checkUrlShape(input, { allowPrivate = false } = {}) {
  let url;
  try {
    url = new URL(String(input).trim());
  } catch {
    return { ok: false, reason: 'That does not look like a URL.' };
  }
  if (String(input).length > 2000) return { ok: false, reason: 'That URL is too long.' };
  if (url.username || url.password) return { ok: false, reason: 'Remove the username/password from the URL.' };
  if (url.protocol !== 'https:' && !(allowPrivate && url.protocol === 'http:')) return { ok: false, reason: 'The URL must start with https://' };
  const host = stripBrackets(url.hostname);
  if (!allowPrivate) {
    if (net.isIP(host)) {
      if (isBlockedAddress(host)) return { ok: false, reason: 'Private, loopback and reserved addresses are not allowed.' };
    } else if (INTERNAL_NAME.test(host) || !host.includes('.')) {
      return { ok: false, reason: 'Internal host names are not allowed.' };
    }
  }
  return { ok: true, url };
}

const resolveAll = (host) => dns.promises.lookup(host, { all: true });

/** Full validation for saving: shape + DNS. `resolve` is injectable for tests. */
export async function validateWebhookUrl(input, { allowPrivate = false, resolve = resolveAll } = {}) {
  const shape = checkUrlShape(input, { allowPrivate });
  if (!shape.ok) return shape;
  const host = stripBrackets(shape.url.hostname);
  if (allowPrivate || net.isIP(host)) return shape;
  let addrs;
  try {
    addrs = await resolve(host);
  } catch {
    return { ok: false, reason: 'That host name could not be found.' };
  }
  if (!addrs.length) return { ok: false, reason: 'That host name could not be found.' };
  if (addrs.some((a) => isBlockedAddress(a.address))) return { ok: false, reason: 'That host name points to a private or reserved address.' };
  return shape;
}

/** `lookup` option for http(s).request: resolves and re-checks every address at connect time. */
export const guardedLookup = (resolve = resolveAll) => (hostname, opts, cb) => {
  resolve(hostname).then(
    (addrs) => {
      const bad = addrs.find((a) => isBlockedAddress(a.address));
      if (bad || !addrs.length) return cb(Object.assign(new Error('blocked address'), { code: 'EBLOCKED' }));
      if (opts?.all) cb(null, addrs);
      else cb(null, addrs[0].address, addrs[0].family);
    },
    (err) => cb(err),
  );
};
