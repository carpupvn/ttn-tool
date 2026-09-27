/* =========================================================================
   admin.js — panel tạo mã + quản lý effective-codes.json
   ========================================================================= */

const ADMIN_SALT = 'ttn-admin-2026-9k2x';
const ADMIN_HASH = '12764ea68785dc986f4b892c29448b706c17ede1bb6e3c78def8701ab039dd8c';

const $ = id => document.getElementById(id);

async function sha256Hex(str) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkPw(input) {
  const h = await sha256Hex(ADMIN_SALT + '|' + input);
  return h === ADMIN_HASH;
}

/* ===== LOGIN ===== */
$('pwBtn').onclick = async () => {
  const pw = $('pwInput').value;
  const msg = $('pwMsg');
  if (!pw) { msg.className='warn'; msg.textContent='Nhập mật khẩu'; return; }
  msg.className=''; msg.textContent='Đang kiểm tra...';
  const ok = await checkPw(pw);
  if (ok) {
    msg.className='ok'; msg.textContent='✓ Đúng';
    $('loginPanel').classList.add('hidden');
    $('mainPanel').classList.remove('hidden');
    sessionStorage.setItem('adm','1');
    await onAdminReady();
  } else {
    msg.className='warn'; msg.textContent='❌ Sai mật khẩu';
  }
};
$('pwInput').addEventListener('keydown', e => { if (e.key==='Enter') $('pwBtn').click(); });

if (sessionStorage.getItem('adm')==='1') {
  $('loginPanel').classList.add('hidden');
  $('mainPanel').classList.remove('hidden');
  onAdminReady();
}

/* ===== DATA ===== */
let codesData    = { version: 1, updated: 0, codes: {} };   // hash -> entry
let localData    = { version: 1, updated: 0, codes: {} };   // mã mới tạo, chưa push
let codeStore    = {};                                       // hash -> mã gốc (HTTN1-...)
let serverLoaded = false;

const CODES_KEY = 'ttnl.codes';
const STORE_KEY = 'ttnl.codeStore';

async function onAdminReady() {
  await loadFromServer();
  loadFromLocalStorage();
  mergeAll();
  renderEntries();
  updateSourceBadge();
}

async function loadFromServer() {
  const msg = $('fileMsg');
  msg.className = 'info';
  msg.textContent = '⏳ Đang tải effective-codes.json từ server...';
  try {
    const r = await fetch('effective-codes.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data.codes || typeof data.codes !== 'object') throw new Error('File thiếu trường "codes"');
    codesData = data;
    serverLoaded = true;
    msg.className = 'ok';
    msg.textContent = '✓ Đã tải từ server: ' + Object.keys(data.codes).length + ' entry.';
  } catch (err) {
    serverLoaded = false;
    msg.className = 'warn';
    msg.textContent = '⚠️ Không tải được từ server (' + err.message + '). Dùng danh sách tạm.';
  }
}

function loadFromLocalStorage() {
  try {
    const s = localStorage.getItem(CODES_KEY);
    if (s) localData = JSON.parse(s);
    const st = localStorage.getItem(STORE_KEY);
    if (st) codeStore = JSON.parse(st);
  } catch {}
}

function saveLocal() {
  try { localStorage.setItem(CODES_KEY, JSON.stringify(localData)); } catch {}
  try { localStorage.setItem(STORE_KEY, JSON.stringify(codeStore)); } catch {}
}

function mergeAll() {
  const merged = { ...codesData.codes };
  Object.keys(localData.codes || {}).forEach(h => {
    merged[h] = localData.codes[h];
  });
  codesData.codes = merged;
}

function saveNewToLocal(hash, entry, userCode) {
  localData.codes = localData.codes || {};
  localData.codes[hash] = entry;
  localData.updated = Date.now();
  if (userCode) codeStore[hash] = userCode;
  saveLocal();
}

function removeFromLocal(hash) {
  if (localData.codes && localData.codes[hash]) {
    delete localData.codes[hash];
    localData.updated = Date.now();
  }
  if (codeStore[hash]) delete codeStore[hash];
  saveLocal();
}

/* ===== IMPORT / EXPORT ===== */
$('fileImport').onchange = e => {
  const f = e.target.files?.[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(String(r.result));
      if (!data.codes || typeof data.codes !== 'object') throw new Error('File thiếu trường "codes"');
      codesData = data;
      saveLocal();
      renderEntries();
      $('fileMsg').className = 'ok';
      $('fileMsg').textContent = '✓ Đã import file: ' + Object.keys(data.codes).length + ' entry.';
    } catch (err) {
      $('fileMsg').className = 'warn';
      $('fileMsg').textContent = '❌ Lỗi: ' + err.message;
    }
  };
  r.readAsText(f, 'utf-8');
  e.target.value = '';
};

$('btnExport').onclick = () => {
  codesData.updated = Date.now();
  const blob = new Blob([JSON.stringify(codesData, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'effective-codes.json';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

$('btnExportWithCodes').onclick = () => {
  const bundle = {
    version: 1,
    updated: Date.now(),
    codes: codesData.codes,
    codeStore: codeStore
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'admin-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

$('btnImportBackup').onclick = () => $('fileBackupImport').click();
$('fileBackupImport').onchange = e => {
  const f = e.target.files?.[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(String(r.result));
      if (!data.codes) throw new Error('File thiếu trường "codes"');
      codesData = { version: 1, updated: Date.now(), codes: data.codes };
      if (data.codeStore) {
        codeStore = { ...codeStore, ...data.codeStore };
      }
      saveLocal();
      renderEntries();
      $('fileMsg').className = 'ok';
      $('fileMsg').textContent = '✓ Đã import backup: ' + Object.keys(data.codes).length + ' entry, '
        + Object.keys(data.codeStore || {}).length + ' mã gốc.';
    } catch (err) {
      $('fileMsg').className = 'warn';
      $('fileMsg').textContent = '❌ Lỗi: ' + err.message;
    }
  };
  r.readAsText(f, 'utf-8');
  e.target.value = '';
};

/* ===== LOG MÃ ĐÃ PHÁT (TXT) ===== */
function buildCodeLogText() {
  const lines = [];
  lines.push('========================================');
  lines.push('  DANH SÁCH MÃ ĐÃ PHÁT — TTN Save Tool');
  lines.push('  Xuất lúc: ' + new Date().toLocaleString('vi-VN'));
  lines.push('========================================');
  lines.push('');

  const entries = [];
  Object.keys(codesData.codes || {}).forEach(h => {
    const e = codesData.codes[h];
    const code = codeStore[h];
    if (!code) return;
    entries.push({
      code,
      hash: h,
      exp: e.exp,
      note: e.note || '',
      iat: e.iat || 0,
      dead: Date.now() > e.exp
    });
  });

  entries.sort((a, b) => b.iat - a.iat);

  if (!entries.length) {
    lines.push('(Chưa có mã nào có lưu mã gốc.)');
    lines.push('');
    lines.push('Lưu ý: nếu bạn đã tạo mã trước khi bật tính năng lưu mã gốc,');
    lines.push('những mã đó không thể phục hồi. Hãy tạo mã mới.');
  } else {
    entries.forEach((x, i) => {
      lines.push('--- #' + (i + 1) + (x.dead ? ' [HẾT HẠN]' : '') + ' ---');
      lines.push('MÃ GỬI USER : ' + x.code);
      lines.push('Hết hạn     : ' + new Date(x.exp).toLocaleString('vi-VN'));
      lines.push('Tạo lúc     : ' + (x.iat ? new Date(x.iat).toLocaleString('vi-VN') : '?'));
      if (x.note) lines.push('Ghi chú     : ' + x.note);
      lines.push('Hash        : ' + x.hash);
      lines.push('');
    });
    lines.push('========================================');
    lines.push('Tổng: ' + entries.length + ' mã');
    lines.push('========================================');
  }

  return lines.join('\n');
}

$('btnExportLog').onclick = () => {
  const txt = buildCodeLogText();
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ma-da-phat-' + new Date().toISOString().slice(0,10) + '.txt';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

/* ===== RELOAD / RESET / XOÁ ===== */
$('btnReload').onclick = async () => { await onAdminReady(); };

$('btnReset').onclick = () => {
  if (!confirm('Xoá toàn bộ entry khỏi danh sách tạm?\n(file trên server vẫn giữ nguyên cho đến khi bạn export rồi push)')) return;
  codesData = { version: 1, updated: Date.now(), codes: {} };
  localData = { version: 1, updated: 0, codes: {} };
  codeStore = {};
  try { localStorage.removeItem(CODES_KEY); } catch {}
  try { localStorage.removeItem(STORE_KEY); } catch {}
  renderEntries();
  updateSourceBadge();
};

function removeEntry(hash) {
  if (!confirm('Xoá entry ' + hash + '?\nNhớ export file rồi push để cập nhật server.')) return;
  delete codesData.codes[hash];
  removeFromLocal(hash);
  renderEntries();
}

/* ===== RENDER ===== */
function renderEntries() {
  const box = $('entryList');
  const keys = Object.keys(codesData.codes || {});
  const countEl = $('entryCount');
  if (countEl) countEl.textContent = keys.length;

  if (!keys.length) {
    box.innerHTML = '<div style="padding:10px;color:var(--soft);text-align:center;font-size:.85rem">Chưa có entry nào.</div>';
    return;
  }
  box.innerHTML = '';
  keys.sort((a,b) => codesData.codes[a].exp - codesData.codes[b].exp);

  keys.forEach(h => {
    const e = codesData.codes[h];
    const dead = Date.now() > e.exp;
    const isLocal = localData.codes && localData.codes[h];
    const userCode = codeStore[h] || null;

    const div = document.createElement('div');
    div.className = 'entry';

    const info = document.createElement('div');
    info.innerHTML =
      '<div class="hash">' + h + (isLocal ? ' <span class="badge local">Mới tạo</span>' : '') + '</div>'
      + '<div class="exp' + (dead ? ' dead' : '') + '">'
        + new Date(e.exp).toLocaleString('vi-VN')
        + ' <span class="badge ' + (dead ? 'dead' : 'live') + '">' + (dead ? 'Hết hạn' : 'Hoạt động') + '</span>'
      + '</div>'
      + (e.note ? '<div class="entry-note">' + e.note + '</div>' : '');

    const codeBox = document.createElement('div');
    codeBox.className = 'code-box';
    if (userCode) {
      codeBox.innerHTML =
        '<div class="user-code" title="' + userCode + '">' + userCode + '</div>'
        + '<button class="ghost btn-sm" data-copy="' + userCode + '">Copy</button>';
    } else {
      codeBox.innerHTML = '<div class="no-code" title="Không có mã gốc trong localStorage. Import file backup hoặc xem lại lịch sử chat.">— không có mã —</div>';
    }

    const delBox = document.createElement('div');
    delBox.innerHTML = '<button class="ghost warnb btn-sm" data-remove="' + h + '">Xoá</button>';

    div.appendChild(info);
    div.appendChild(codeBox);
    div.appendChild(delBox);
    box.appendChild(div);
  });

  box.querySelectorAll('[data-remove]').forEach(b => {
    b.onclick = () => removeEntry(b.dataset.remove);
  });
  box.querySelectorAll('[data-copy]').forEach(b => {
    b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = '✓'; }
      catch { b.textContent = '❌'; }
      setTimeout(() => { b.textContent = 'Copy'; }, 1200);
    };
  });
}

function updateSourceBadge() {
  const el = $('sourceBadge');
  if (!el) return;
  if (serverLoaded) {
    el.className = 'badge live';
    el.textContent = 'Đã đồng bộ server';
  } else {
    el.className = 'badge dead';
    el.textContent = 'Chưa đồng bộ server';
  }
}

/* ===== TẠO MÃ ===== */
$('btnGen').onclick = async () => {
  const name = $('fName').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if (!name) { $('genMsg').className='warn'; $('genMsg').textContent='Tên rỗng'; return; }

  let exp;
  const expInput = $('fExp').value;
  if (expInput) exp = new Date(expInput).getTime();
  else {
    const d = parseInt($('fDays').value, 10);
    if (!d || d<1) { $('genMsg').className='warn'; $('genMsg').textContent='Số ngày sai'; return; }
    exp = Date.now() + d * 86400000;
  }

  const raw = License.makeRaw(name, exp);
  const userCode = License.encodeCode(raw);
  const norm = License.normalizeInput(userCode);
  const hash = (await License.sha256Hex(License.CFG.LICENSE_SALT + norm))
                 .slice(0, License.CFG.HASH_HEX_LEN);

  const entry = { exp, note: $('fNote').value.trim(), iat: Date.now() };
  codesData.codes[hash] = entry;
  saveNewToLocal(hash, entry, userCode);
  renderEntries();

  $('outCode').textContent = userCode;
  $('outHash').textContent = hash;

  $('btnCopyCode').onclick = () => navigator.clipboard.writeText(userCode);
  $('btnCopyHash').onclick = () => navigator.clipboard.writeText(hash);

  $('resultPanel').classList.remove('hidden');
  $('genMsg').className = 'ok';
  $('genMsg').textContent = '✓ Hết hạn: ' + new Date(exp).toLocaleString('vi-VN')
    + ' — nhớ export file để cập nhật server.';
};

$('btnClear').onclick = () => {
  $('fName').value=''; $('fNote').value=''; $('fExp').value='';
  $('resultPanel').classList.add('hidden'); $('genMsg').textContent='';
};

/* ===== ĐỔI MẬT KHẨU ===== */
$('btnHashPw').onclick = async () => {
  const pw = $('pwNew').value;
  if (!pw) { $('pwHashOut').textContent='Nhập mật khẩu trước.'; return; }
  $('pwHashOut').textContent = 'Đang tính...';
  const h = await sha256Hex(ADMIN_SALT + '|' + pw);
  $('pwHashOut').textContent =
    "ADMIN_HASH = '" + h + "'\n" +
    "(giữ nguyên ADMIN_SALT = '" + ADMIN_SALT + "')";
};