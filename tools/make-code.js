#!/usr/bin/env node
/* =========================================================================
   make-code.js — tạo mã user (HTTN1-...) và hash
   Cách dùng:
     node tools/make-code.js HACKHACK 2
     node tools/make-code.js HACKHACK 2 "user A"
     node tools/make-code.js HACKHACK --until "2026-10-05T15:30"
   ========================================================================= */
const crypto = require('crypto');

const LICENSE_SALT = 'ttnl-h-2026';
const XOR_KEY_STR  = 'ttn-lic-do-not-share-9k2x';
const HASH_HEX_LEN = 12;
const PREFIX       = 'HTTN1-';
const B32          = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/* ---------- Code logic ---------- */
function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function xorBytes(bytes, key) {
  const out = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % key.length];
  return out;
}
function makeRaw(name, exp) {
  name = String(name).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const d = new Date(exp);
  const p = n => String(n).padStart(2, '0');
  const tail = p(d.getDate()) + p(d.getMonth() + 1) + p(d.getFullYear() % 100)
             + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  return name + '|' + tail;
}
function encodeCode(raw) {
  const bytes = Buffer.from(raw, 'utf8');
  const x = xorBytes(bytes, Buffer.from(XOR_KEY_STR));
  const b32 = base32Encode(x).match(/.{1,4}/g).join('-');
  return PREFIX + b32;
}
function normalizeInput(s) {
  return String(s).trim().toUpperCase().replace(/[\s-]+/g, '');
}
function hashCode(normalized) {
  return crypto.createHash('sha256')
    .update(LICENSE_SALT + normalized)
    .digest('hex')
    .slice(0, HASH_HEX_LEN);
}

/* ---------- CLI ---------- */
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Cách dùng:');
  console.log('  node tools/make-code.js <TÊN> <số-ngày> ["ghi chú"]');
  console.log('  node tools/make-code.js <TÊN> --until "<ngày ISO>" ["ghi chú"]');
  console.log('');
  console.log('Ví dụ:');
  console.log('  node tools/make-code.js HACKHACK 2 "user A"');
  console.log('  node tools/make-code.js TRASUA2026OK --until "2026-10-05T15:30" "user B"');
  process.exit(1);
}

const name = args[0];
let exp, note = '';
if (args[1] === '--until') {
  exp = new Date(args[2]).getTime();
  note = args[3] || '';
} else {
  const days = parseInt(args[1], 10);
  if (!days || days < 1) { console.error('Số ngày không hợp lệ'); process.exit(1); }
  exp = Date.now() + days * 86400000;
  note = args[2] || '';
}

if (!isFinite(exp)) { console.error('Ngày không hợp lệ'); process.exit(1); }

const raw = makeRaw(name, exp);
const code = encodeCode(raw);
const norm = normalizeInput(code);
const hash = hashCode(norm);

console.log('');
console.log('  Tên        :', name);
console.log('  Hết hạn    :', new Date(exp).toLocaleString('vi-VN'));
console.log('  Ghi chú    :', note || '(không)');
console.log('');
console.log('  ─── MÃ GỬI USER ───');
console.log('  ' + code);
console.log('');
console.log('  ─── ENTRY JSON (dán vào effective-codes.json) ───');
console.log('  ' + JSON.stringify({ [hash]: { exp, note, iat: Date.now() } }));
console.log('');
console.log('  Hash       :', hash);
console.log('');