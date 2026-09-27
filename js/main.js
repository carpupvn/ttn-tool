/* ============ UI HELPERS ============ */
const $ = id => document.getElementById(id);
let _licState = null;
let _licTimer = null;

/* Ripple effect cho button */
document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const rect = b.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  b.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

/* ============ NAME MAPPINGS ============ */
const ITEM_NAMES = {
  // Trà / sữa
  tra:      'Trà sữa',
  matcha:   'Matcha',
  hong:     'Hồng trà',
  luc:      'Lục trà',
  olong:    'Trà Oolong',
  thai:     'Trà Thái',

  // Trà trái cây
  f_vai:    'Trà vải',
  f_dao:    'Trà đào',
  f_dau:    'Trà dâu',
  f_nho:    'Trà nho',
  f_oi:     'Trà ổi',
  f_xoai:   'Trà xoài',
  f_mang:   'Trà mãng cầu',
  f_tao:    'Trà táo',
  f_chanh:  'Trà chanh',
  f_me:     'Trà me',
  f_dua:    'Trà dừa',
  f_choco:  'Trà chocolate',

  // Trân châu
  tcden:    'Trân châu đen',
  tcvang:   'Trân châu vàng',
  tcsoi:    'Trân châu sợi',

  // Topping
  popping:  'Popping',
  thach:    'Thạch',
  cunang:   'Củ năng',
  thachtc:  'Thạch trân châu',
  suongsao: 'Sương sáo',
  thachcf:  'Thạch cà phê',
  cheese:   'Phô mai',
  fmatcha:  'Foam matcha',
  fsalt:    'Foam muối',
  fube:     'Foam béo',
  pmvien:   'Pudding viên',
  pmtuoi:   'Pudding tươi',
  thachpm:  'Thạch pudding',

  // Khác
  cup:      'Ly nhựa',

  // Nhân viên
  staff1:   'Nhân viên 1',
  staff2:   'Nhân viên 2',
  staff3:   'Nhân viên 3',
  staff4:   'Nhân viên 4',

  // Nâng cấp
  upbulb:   'Đèn sáng',
  upchair:  'Ghế ngồi',
  upcups:   'Thêm ly',
  upmega:   'Loa mega',
  upsnow:   'Đá tuyết',
  brandKit: 'Bộ nhận diện',
  tablet:   'Tablet',
};

const ITEM_GROUPS = [
  { title: 'Trà & Sữa',    keys: ['tra','matcha','hong','luc','olong','thai'] },
  { title: 'Trà trái cây', keys: ['f_vai','f_dao','f_dau','f_nho','f_oi','f_xoai','f_mang','f_tao','f_chanh','f_me','f_dua','f_choco'] },
  { title: 'Trân châu',    keys: ['tcden','tcvang','tcsoi'] },
  { title: 'Topping',      keys: ['popping','thach','cunang','thachtc','suongsao','thachcf','cheese','fmatcha','fsalt','fube','pmvien','pmtuoi','thachpm'] },
  { title: 'Khác',         keys: ['cup'] },
];

function getName(id) {
  return ITEM_NAMES[id] || id;
}

/* ============ GATE ============ */
function showGate(msg) {
  $('gate').classList.remove('hidden');
  $('app').classList.add('hidden');
  if (msg) {
    $('gateMsg').className = 'warn';
    $('gateMsg').textContent = msg;
  } else {
    $('gateMsg').textContent = '';
  }
  setTimeout(() => $('gateInput').focus(), 200);
}
function showApp(state) {
  _licState = state;
  $('gate').classList.add('hidden');
  $('app').classList.remove('hidden');
  renderBanner();
  if (_licTimer) clearInterval(_licTimer);
  _licTimer = setInterval(() => {
    const remain = state.exp - Date.now();
    if (remain <= 0) {
      License.clearLicense();
      _licState = null;
      showGate('Mã đã hết hạn. Nhập mã mới để tiếp tục.');
    } else renderBanner();
  }, 60000);
}
function renderBanner() {
  const remain = _licState.exp - Date.now();
  const b = $('licBanner');
  if (remain <= 0) { b.className = 'banner warn'; b.textContent = '⚠️ Mã đã hết hạn'; return; }
  const cls = remain < 6 * 3600 * 1000 ? 'banner info' : 'banner ok';
  b.className = cls;
  b.textContent = '✓ Đã kích hoạt (' + _licState.name + ') — còn ' + License.humanRemain(remain);
}

async function activate(input) {
  const btn = $('gateBtn');
  $('gateMsg').className = '';
  $('gateMsg').innerHTML = '<span class="spinner"></span>Đang kiểm tra...';
  btn.disabled = true;
  const r = await License.verifyCode(input);
  btn.disabled = false;
  if (r.ok) {
    const state = { ok: true, exp: r.exp, name: r.name };
    License.saveLicense(state);
    $('gateMsg').className = 'ok';
    $('gateMsg').textContent = '✓ Thành công. Còn ' + License.humanRemain(r.exp - Date.now());
    setTimeout(() => showApp(state), 500);
  } else {
    $('gateMsg').className = 'warn';
    $('gateMsg').textContent = '❌ ' + r.reason;
  }
}
$('gateBtn').onclick = () => activate($('gateInput').value);
$('gateInput').addEventListener('keydown', e => { if (e.key === 'Enter') activate(e.target.value); });

(function boot() {
  const st = License.loadLicense();
  if (st && st.exp > Date.now()) { showApp(st); return; }
  if (st) License.clearLicense();
  showGate();
})();

/* ============ BACKUP LOGIC ============ */
const SALT = 'ttn-bak-7f3a';
const START_MONEY = 500, CAP_PER_DAY = 15000000, THIEF_DAY = 30, THIEF_MONEY = 100000000;

function bakHash(t) {
  let h = 0x811c9dc5 >>> 0;
  const x = SALT + t;
  for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
function b64e(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64d(t) {
  t = t.replace(/-/g,'+').replace(/_/g,'/');
  while (t.length % 4) t += '=';
  const s = atob(t), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
async function gzipBytes(u8) {
  if (!window.CompressionStream) return null;
  const st = new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
async function gunzipBytes(u8) {
  const st = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
async function decodeBackup(code) {
  code = String(code || '').replace(/\s+/g,'');
  const m = code.match(/^TTN1\.([zp][A-Za-z0-9_-]+)\.([0-9a-z]+)$/);
  if (!m) throw new Error('Sai định dạng TTN1');
  if (bakHash(m[1]) !== m[2]) throw new Error('Checksum không khớp');
  let u = b64d(m[1].slice(1));
  if (m[1][0] === 'z') u = await gunzipBytes(u);
  return JSON.parse(new TextDecoder().decode(u));
}
async function encodeBackup(obj, preferGzip = true) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  let body;
  if (preferGzip) {
    const gz = await gzipBytes(raw);
    body = gz ? ('z' + b64e(gz)) : ('p' + b64e(raw));
  } else body = 'p' + b64e(raw);
  return 'TTN1.' + body + '.' + bakHash(body);
}

/* ============ AUDIT ============ */
function computeAudit(save) {
  const day = Number(save.day) || 0;
  const cap = START_MONEY + day * CAP_PER_DAY;
  const thief = day < THIEF_DAY ? THIEF_MONEY : Infinity;
  const money = Number(save.money) || 0;
  return {
    day, cap, thief, safeMax: Math.min(cap, thief), money,
    overCap: money > cap,
    overThief: day < THIEF_DAY && money > THIEF_MONEY,
    bad: !isFinite(money) || money < 0,
  };
}

/* ============ STATE ============ */
let currentSave = null;
const SCALAR_FIELDS = [
  { key:'money', label:'Tiền' }, { key:'day', label:'Ngày' },
  { key:'bakDay', label:'bakDay' }, { key:'evDay', label:'evDay' },
  { key:'totalRev', label:'Tổng doanh thu' }, { key:'totalProfit', label:'Tổng lợi nhuận' },
  { key:'yearRev', label:'Doanh thu năm' }, { key:'taxYear', label:'Thuế năm' },
  { key:'served', label:'Đã phục vụ' }, { key:'best', label:'Kỷ lục' },
  { key:'revTotal', label:'Số review' }, { key:'seenLv', label:'seenLv' },
  { key:'bungN', label:'bungN' },
];
function fmt(n) { return isFinite(n) ? Number(n).toLocaleString('vi-VN') : '—'; }
function showMsg(t, c='warn') { const e = $('msg'); e.className = c; e.textContent = t; e.classList.remove('hidden'); }
function hideMsg() { $('msg').classList.add('hidden'); }

/* ============ LOAD SAVE ============ */
function loadSave(save) {
  currentSave = save;
  $('editPane').classList.remove('hidden');
  $('editPane').style.animation = 'none';
  void $('editPane').offsetHeight;
  $('editPane').style.animation = 'fadeInUp .6s cubic-bezier(.16,1,.3,1)';

  const sg = $('scalarGrid'); sg.innerHTML = '';
  SCALAR_FIELDS.forEach(f => {
    if (!(f.key in save)) return;
    const div = document.createElement('div');
    div.className = 'field';
    div.innerHTML = '<label>' + f.label + '</label><input type="text" data-scalar="' + f.key + '" value="' + (save[f.key] ?? '') + '">';
    sg.appendChild(div);
  });
  $('fShopName').value = save.shopName || '';

  renderUnlockChips(save.unlocked || {});
  renderUpgChips(save.upg || {});
  renderStock(save.stock || {});

  $('rawJson').value = JSON.stringify(save, null, 2);
  renderAudit();
  updateScalarAlerts();
  $('outCode').value = '';
  $('btnCopy').disabled = true;
  $('btnDownload').disabled = true;

  setTimeout(() => {
    $('editPane').scrollIntoView({ behavior:'smooth', block:'start' });
  }, 100);
}

/* ============ RENDER UNLOCK CHIPS ============ */
function renderUnlockChips(unlocked) {
  const uc = $('unlockChips');
  uc.innerHTML = '';
  uc.classList.add('grouped');

  const rendered = new Set();

  ITEM_GROUPS.forEach(grp => {
    const validKeys = grp.keys.filter(k => k in unlocked);
    if (!validKeys.length) return;

    const groupEl = document.createElement('div');
    groupEl.className = 'chip-group';

    const titleEl = document.createElement('div');
    titleEl.className = 'chip-group-title';
    titleEl.textContent = grp.title;
    groupEl.appendChild(titleEl);

    const listEl = document.createElement('div');
    listEl.className = 'chips';
    validKeys.forEach(k => {
      rendered.add(k);
      const c = document.createElement('span');
      c.className = 'chip' + (unlocked[k] ? ' on' : '');
      c.dataset.unlock = k;
      c.innerHTML = '<span class="chip-name">' + getName(k) + '</span>'
                  + '<span class="chip-id">' + k + '</span>';
      listEl.appendChild(c);
    });
    groupEl.appendChild(listEl);
    uc.appendChild(groupEl);
  });

  // Các key còn lại
  const others = Object.keys(unlocked).filter(k => !rendered.has(k));
  if (others.length) {
    const groupEl = document.createElement('div');
    groupEl.className = 'chip-group';
    const titleEl = document.createElement('div');
    titleEl.className = 'chip-group-title';
    titleEl.textContent = 'Khác';
    groupEl.appendChild(titleEl);
    const listEl = document.createElement('div');
    listEl.className = 'chips';
    others.forEach(k => {
      const c = document.createElement('span');
      c.className = 'chip' + (unlocked[k] ? ' on' : '');
      c.dataset.unlock = k;
      c.innerHTML = '<span class="chip-name">' + getName(k) + '</span>'
                  + '<span class="chip-id">' + k + '</span>';
      listEl.appendChild(c);
    });
    groupEl.appendChild(listEl);
    uc.appendChild(groupEl);
  }
}

/* ============ RENDER UPG CHIPS ============ */
function renderUpgChips(upg) {
  const gc = $('upgChips');
  gc.innerHTML = '';
  Object.keys(upg).forEach(k => {
    const c = document.createElement('span');
    c.className = 'chip' + (upg[k] ? ' on' : '');
    c.dataset.upg = k;
    c.innerHTML = '<span class="chip-name">' + getName(k) + '</span>'
                + '<span class="chip-id">' + k + '</span>';
    gc.appendChild(c);
  });
}

/* ============ RENDER STOCK ============ */
function renderStock(stock) {
  const sl = $('stockList');
  sl.innerHTML = '';

  const rendered = new Set();

  ITEM_GROUPS.forEach(grp => {
    const validKeys = grp.keys.filter(k => k in stock);
    if (!validKeys.length) return;
    validKeys.forEach(k => rendered.add(k));

    const sec = document.createElement('div');
    sec.className = 'stock-section';

    const title = document.createElement('div');
    title.className = 'stock-title';
    title.textContent = grp.title;
    sec.appendChild(title);

    validKeys.forEach(k => {
      sec.appendChild(makeStockRow(k, stock[k]));
    });
    sl.appendChild(sec);
  });

  // Các key còn lại
  const others = Object.keys(stock).filter(k => !rendered.has(k));
  if (others.length) {
    const sec = document.createElement('div');
    sec.className = 'stock-section';
    const title = document.createElement('div');
    title.className = 'stock-title';
    title.textContent = 'Khác';
    sec.appendChild(title);
    others.forEach(k => {
      sec.appendChild(makeStockRow(k, stock[k]));
    });
    sl.appendChild(sec);
  }
}

function makeStockRow(k, arr) {
  const a = arr || [];
  const q = a[0]?.q ?? 0, exp = a[0]?.exp ?? 0;
  const row = document.createElement('div');
  row.className = 'stockrow';
  row.innerHTML = '<div class="nm" title="' + k + '">' + getName(k) + '</div>'
    + '<input type="text" data-stock-q="' + k + '" value="' + q + '" placeholder="SL">'
    + '<input type="text" data-stock-exp="' + k + '" value="' + exp + '" placeholder="HSD">';
  return row;
}

/* ============ RENDER AUDIT ============ */
function renderAudit() {
  if (!currentSave) return;
  const a = computeAudit(currentSave);
  let cls='ok', txt;
  if (a.bad) { cls='warn'; txt='⚠️ money âm hoặc không hợp lệ.'; }
  else if (a.overCap) { cls='warn'; txt='⚠️ money vượt cap → sẽ bị tịch thu.'; }
  else if (a.overThief) { cls='warn'; txt='⚠️ day < 30 và money > 100tr → sẽ bị tịch thu.'; }
  else { cls='ok'; txt='✅ An toàn với audit hiện tại.'; }
  $('auditBox').innerHTML =
    '<div class="' + cls + '">' + txt + '</div>'
    + '<div class="kpi">'
    + '<div>Ngày<b>' + a.day + '</b></div>'
    + '<div>Cap<b>' + fmt(a.cap) + 'đ</b></div>'
    + '<div>Ngưỡng trộm<b>' + (a.thief === Infinity ? '∞' : fmt(a.thief) + 'đ') + '</b></div>'
    + '<div>Max an toàn<b>' + fmt(a.safeMax) + 'đ</b></div>'
    + '<div>Money<b>' + fmt(a.money) + 'đ</b></div>'
    + '</div>';
}

function updateScalarAlerts() {
  if (!currentSave) return;
  const money = Number(currentSave.money) || 0;
  const day = Number(currentSave.day) || 0;
  const cap = START_MONEY + day * CAP_PER_DAY;
  const thief = day < THIEF_DAY ? THIEF_MONEY : Infinity;
  const over = money > cap || money > thief || money < 0;
  document.querySelectorAll('[data-scalar="money"]').forEach(inp => {
    inp.closest('.field').classList.toggle('alert', over);
    const s = inp.closest('.field').querySelector('small');
    if (s) s.remove();
    if (over) {
      const sm = document.createElement('small');
      sm.textContent = money < 0 ? 'Số âm → sẽ bị phạt' : 'Vượt ngưỡng → sẽ bị tịch thu';
      inp.closest('.field').appendChild(sm);
    }
  });
}

/* ============ EVENT LISTENERS ============ */
document.addEventListener('input', e => {
  if (!currentSave) return;
  const t = e.target;
  if (t.dataset.scalar) {
    const k = t.dataset.scalar;
    const v = Number(String(t.value).replace(/[^\d.-]/g,''));
    currentSave[k] = isFinite(v) ? v : t.value;
    renderAudit(); updateScalarAlerts(); return;
  }
  if (t.id === 'fShopName') { currentSave.shopName = t.value; return; }
  if (t.dataset.stockQ !== undefined) {
    const k = t.dataset.stockQ, v = Math.max(0, Math.floor(Number(t.value)||0));
    const exp = currentSave.stock[k]?.[0]?.exp ?? 0;
    currentSave.stock[k] = [{ q: v, exp }]; return;
  }
  if (t.dataset.stockExp !== undefined) {
    const k = t.dataset.stockExp, v = Math.max(0, Math.floor(Number(t.value)||0));
    const q = currentSave.stock[k]?.[0]?.q ?? 0;
    currentSave.stock[k] = [{ q, exp: v }]; return;
  }
});

document.addEventListener('click', e => {
  if (!currentSave) return;
  const c = e.target.closest('.chip'); if (!c) return;
  if (c.dataset.unlock) {
    const k = c.dataset.unlock;
    currentSave.unlocked[k] = !currentSave.unlocked[k];
    c.classList.toggle('on', currentSave.unlocked[k]);
  } else if (c.dataset.upg) {
    const k = c.dataset.upg;
    currentSave.upg[k] = !currentSave.upg[k];
    c.classList.toggle('on', currentSave.upg[k]);
  }
});

/* ============ BUTTONS ============ */
$('btnLoad').onclick = async () => {
  hideMsg();
  const btn = $('btnLoad');
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Đang giải...';
  try {
    const code = $('inCode').value.trim();
    if (!code) throw new Error('Chưa có mã.');
    const save = await decodeBackup(code);
    loadSave(save);
    showMsg('✓ Giải mã thành công.', 'ok');
  } catch (err) {
    showMsg('Lỗi: ' + err.message, 'warn');
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
};

$('inFile').onchange = e => {
  const f = e.target.files?.[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { $('inCode').value = String(r.result || '').trim(); };
  r.readAsText(f, 'utf-8');
};

$('btnClear').onclick = () => {
  $('inCode').value = '';
  $('editPane').classList.add('hidden');
  currentSave = null;
  hideMsg();
};

$('btnUnlockAll').onclick = () => {
  if (!currentSave) return;
  Object.keys(currentSave.unlocked).forEach(k => currentSave.unlocked[k] = true);
  document.querySelectorAll('[data-unlock]').forEach(c => c.classList.add('on'));
};

$('btnUnlockNone').onclick = () => {
  if (!currentSave) return;
  Object.keys(currentSave.unlocked).forEach(k => currentSave.unlocked[k] = false);
  document.querySelectorAll('[data-unlock]').forEach(c => c.classList.remove('on'));
};

$('btnUpgAll').onclick = () => {
  if (!currentSave) return;
  Object.keys(currentSave.upg).forEach(k => currentSave.upg[k] = true);
  document.querySelectorAll('[data-upg]').forEach(c => c.classList.add('on'));
};

$('btnUpgNone').onclick = () => {
  if (!currentSave) return;
  Object.keys(currentSave.upg).forEach(k => currentSave.upg[k] = false);
  document.querySelectorAll('[data-upg]').forEach(c => c.classList.remove('on'));
};

$('btnStockMax').onclick = () => {
  if (!currentSave) return;
  Object.keys(currentSave.stock).forEach(k => currentSave.stock[k] = [{ q: 999, exp: 9999 }]);
  renderStock(currentSave.stock);
};

$('btnApplyRaw').onclick = () => {
  try {
    loadSave(JSON.parse($('rawJson').value));
    showMsg('✓ Đã áp dụng.', 'ok');
  } catch (err) { showMsg('JSON lỗi: ' + err.message, 'warn'); }
};

$('btnRefreshRaw').onclick = () => {
  if (currentSave) $('rawJson').value = JSON.stringify(currentSave, null, 2);
};

$('btnEncode').onclick = async () => {
  if (!currentSave) return;
  const btn = $('btnEncode');
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Đang tạo...';
  try {
    const code = await encodeBackup(currentSave);
    $('outCode').value = code;
    $('btnCopy').disabled = false;
    $('btnDownload').disabled = false;
    showMsg('✓ Đã tạo mã mới.', 'ok');
    setTimeout(() => $('outCode').scrollIntoView({ behavior:'smooth', block:'center' }), 100);
  } catch (err) {
    showMsg('Lỗi: ' + err.message, 'warn');
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
};

$('btnCopy').onclick = async () => {
  const c = $('outCode').value; if (!c) return;
  const btn = $('btnCopy');
  try {
    await navigator.clipboard.writeText(c);
    btn.textContent = '✓ Đã copy';
    showMsg('✓ Đã copy vào clipboard.', 'ok');
  } catch {
    $('outCode').select();
    document.execCommand('copy');
    btn.textContent = '✓ Đã copy';
    showMsg('✓ Đã copy.', 'ok');
  }
  setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
};

$('btnDownload').onclick = () => {
  const c = $('outCode').value; if (!c) return;
  const blob = new Blob([c], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ttn-backup-' + new Date().toISOString().slice(0,10) + '.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};