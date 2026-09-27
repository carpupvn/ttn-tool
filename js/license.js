/* =========================================================================
   license.js — module quản lý license cho TTN Save Tool
   Public API: window.License
   ========================================================================= */
(function () {
  'use strict';

  const CFG = {
    LICENSE_SALT: 'ttnl-h-2026',
    XOR_KEY_STR:  'ttn-lic-do-not-share-9k2x',
    CODES_URL:    'effective-codes.json',
    HASH_HEX_LEN: 12,
    STORAGE_KEY:  'ttnl.lic',
    CODE_PREFIX:  'HTTN1-',
  };

  const XOR_KEY = new TextEncoder().encode(CFG.XOR_KEY_STR);
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  async function sha256Hex(str, keepBytes) {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    const arr = [...new Uint8Array(h)];
    const slice = keepBytes ? arr.slice(0, keepBytes) : arr;
    return slice.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function base32Encode(bytes) {
    let bits = 0, value = 0, out = '';
    for (const b of bytes) {
      value = (value << 8) | b; bits += 8;
      while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    return out;
  }

  function base32Decode(str) {
    str = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0, value = 0;
    const out = [];
    for (const c of str) {
      const idx = B32.indexOf(c);
      if (idx < 0) throw new Error('Ký tự không hợp lệ');
      value = (value << 5) | idx; bits += 5;
      if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
    }
    return new Uint8Array(out);
  }

  function xorBytes(bytes, key) {
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % key.length];
    return out;
  }

  function normalizeInput(s) {
    return String(s || '').trim().toUpperCase().replace(/[\s-]+/g, '');
  }

  function encodeCode(raw) {
    const bytes = new TextEncoder().encode(raw);
    const x = xorBytes(bytes, XOR_KEY);
    const b32 = base32Encode(x).match(/.{1,4}/g).join('-');
    return CFG.CODE_PREFIX + b32;
  }

  function decodeCode(userInput) {
    let s = normalizeInput(userInput);
    if (!s.startsWith('HTTN1')) throw new Error('Mã thiếu tiền tố HTTN1');
    s = s.slice(5);
    const bytes = base32Decode(s);
    const x = xorBytes(bytes, XOR_KEY);
    return new TextDecoder().decode(x);
  }

  function makeRaw(name, exp) {
    name = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!name) throw new Error('Tên mã rỗng');
    const d = new Date(exp);
    if (isNaN(d.getTime())) throw new Error('Ngày không hợp lệ');
    const p = n => String(n).padStart(2, '0');
    const tail = p(d.getDate()) + p(d.getMonth() + 1) + p(d.getFullYear() % 100)
               + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    return name + '|' + tail;
  }

  function parseRaw(raw) {
    const idx = String(raw || '').lastIndexOf('|');
    if (idx < 0) return null;
    const name = raw.slice(0, idx);
    const s = raw.slice(idx + 1);
    if (!/^\d{12}$/.test(s)) return null;
    const dd = +s.slice(0,2), mm = +s.slice(2,4), yy = +s.slice(4,6);
    const HH = +s.slice(6,8), MM = +s.slice(8,10), SS = +s.slice(10,12);
    if (dd<1||dd>31||mm<1||mm>12||HH>23||MM>59||SS>59) return null;
    const d = new Date(2000 + yy, mm - 1, dd, HH, MM, SS);
    if (isNaN(d.getTime())) return null;
    return { name, exp: d.getTime() };
  }

  let _cache = null;
  async function fetchCodes() {
    if (_cache && Date.now() - _cache.at < 60000) return _cache.data;
    const r = await fetch(CFG.CODES_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    _cache = { at: Date.now(), data };
    return data;
  }

  async function verifyCode(userInput) {
    const norm = normalizeInput(userInput);
    if (!norm) return { ok: false, reason: 'Chưa nhập mã' };

    let raw;
    try { raw = decodeCode(norm); }
    catch (e) { return { ok: false, reason: 'Mã sai định dạng' }; }

    const parsed = parseRaw(raw);
    if (!parsed) return { ok: false, reason: 'Nội dung mã không hợp lệ' };

    let data;
    try { data = await fetchCodes(); }
    catch { return { ok: false, reason: 'Không tải được danh sách mã' }; }

    const hash = (await sha256Hex(CFG.LICENSE_SALT + norm)).slice(0, CFG.HASH_HEX_LEN);
    const entry = data.codes?.[hash];
    if (!entry) return { ok: false, reason: 'Mã không tồn tại hoặc đã bị thu hồi' };

    const exp = Math.min(parsed.exp, entry.exp);
    if (Date.now() > exp) {
      return { ok: false, reason: 'Mã đã hết hạn từ ' + new Date(exp).toLocaleString('vi-VN'), exp };
    }
    return { ok: true, name: parsed.name, exp, note: entry.note || '' };
  }

  function saveLicense(state) {
    try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(state)); } catch {}
  }
  function loadLicense() {
    try {
      const s = localStorage.getItem(CFG.STORAGE_KEY);
      if (!s) return null;
      const o = JSON.parse(s);
      if (!o || typeof o.exp !== 'number') return null;
      return o;
    } catch { return null; }
  }
  function clearLicense() {
    try { localStorage.removeItem(CFG.STORAGE_KEY); } catch {}
  }

  function humanRemain(ms) {
    if (ms <= 0) return 'đã hết hạn';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return d + ' ngày ' + h + ' giờ';
    if (h > 0) return h + ' giờ ' + m + ' phút';
    return m + ' phút';
  }

  window.License = {
    CFG,
    encodeCode, decodeCode,
    makeRaw, parseRaw,
    verifyCode, fetchCodes,
    saveLicense, loadLicense, clearLicense,
    humanRemain, sha256Hex, normalizeInput,
  };
})();