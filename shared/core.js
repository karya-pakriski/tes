/**
 * ============================================================
 * SHARED CORE JS — Sistem Gudang Puskesmas
 * Utilities, API client, Store, Auth, LoginForm, QRScanner
 * Dipakai oleh index.html dan scan.html
 * ============================================================
 */
'use strict';

// ============================================================
// CONFIG
// ============================================================
const CONFIG = Object.freeze({
  API_URL: 'https://script.google.com/macros/s/AKfycbxX6oAam5bFHR4ngUEWwZ7TXXzuo9mGxBrXtnj1e6y8BT9Fm3rw7JWDKsxYpZwTb45pSw/exec',
  API_KEY: 'PKM_SANDEN_26',
  APP_VERSION: '4.0',
  REQUEST_TIMEOUT_MS: 30000,
  RETRY_ATTEMPTS: 3,
  MASTER_CACHE_TTL_MS: 3600000, // 1 jam
  LOGO_KEY: 'PKM_LOGO_DATAURL',
  SESSION_KEY: 'pkm_session',
  MASTER_KEY: 'pkm_master_data',
  MAX_TOAST: 3
});

// ============================================================
// UTILITIES
// ============================================================
const U = {
  $(sel, ctx) { return (ctx || document).querySelector(sel); },
  $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  },

  formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatDateTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  formatNumber(n) { return (Number(n) || 0).toLocaleString('id-ID'); },
  formatRupiah(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); },

  formatMonthName(bulan) {
    const names = ['Januari','Februari','Maret','April','Mei','Juni',
                   'Juli','Agustus','September','Oktober','November','Desember'];
    return names[Number(bulan) - 1] || '';
  },

  nowISO() {
    const d = new Date();
    const offset = 7 * 60;
    const local = new Date(d.getTime() + (d.getTimezoneOffset() + offset) * 60000);
    const pad = n => String(n).padStart(2, '0');
    return local.getFullYear() + '-' + pad(local.getMonth() + 1) + '-' + pad(local.getDate()) +
           'T' + pad(local.getHours()) + ':' + pad(local.getMinutes()) + ':' + pad(local.getSeconds()) + '+07:00';
  },

  uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  debounce(fn, ms) {
    let t;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

  vibrate(pattern) {
    if (navigator.vibrate) try { navigator.vibrate(pattern); } catch (e) {}
  },

  beep(freq, duration) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq || 1200;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (duration || 0.1) / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (duration || 0.1) / 1000);
      setTimeout(() => ctx.close(), (duration || 100) + 100);
    } catch (e) {}
  },
  beepSuccess() { this.beep(1200, 80); },
  beepError() { this.beep(400, 200); },

  icon(name, size) {
    const s = size || 20;
    const paths = {
      dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
      menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
      arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
      arrowDown: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
      arrowUp: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      check: '<polyline points="20 6 9 17 4 12"/>',
      x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      alertCircle: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
      info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
      package: '<path d="M16.5 9.4L7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
      trending: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
      clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
      users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      pills: '<path d="M10.5 20.5a7.5 7.5 0 0 1-10.6-10.6l10.6 10.6z"/><path d="M13.5 3.5a7.5 7.5 0 0 1 10.6 10.6L13.5 3.5z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>',
      box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
      truck: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
      building: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/>',
      mapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
      printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
      search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
      plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
      trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
      refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
      chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
      chevronRight: '<polyline points="9 18 15 12 9 6"/>',
      camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
      keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="10"/><line x1="10" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="14" y2="10"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/>',
      zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
      wifiOff: '<line x1="2" y1="2" x2="22" y2="22"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 12.55a11 11 0 0 1 5.17-2.39"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
      qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
      home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="' + s + '" height="' + s + '">' + (paths[name] || '') + '</svg>';
  }
};

// ============================================================
// TOAST
// ============================================================
const Toast = {
  show(message, type, duration) {
    const container = U.$('#toast-container');
    if (!container) { console.log('[Toast]', type, message); return; }
    while (container.children.length >= CONFIG.MAX_TOAST) {
      container.removeChild(container.firstChild);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    const iconName = type === 'success' ? 'check' :
                    type === 'error' ? 'alertCircle' :
                    type === 'warning' ? 'alert' : 'info';
    el.innerHTML = U.icon(iconName, 16) + '<span>' + U.escapeHtml(message) + '</span>';
    container.appendChild(el);
    const dur = duration || (type === 'error' ? 5000 : 3000);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      el.style.transition = 'opacity 0.2s, transform 0.2s';
      setTimeout(() => el.remove(), 250);
    }, dur);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error', 6000); },
  warning(msg) { this.show(msg, 'warning', 4000); },
  info(msg) { this.show(msg, 'info'); }
};

// ============================================================
// MODAL
// ============================================================
const Modal = {
  _currentOnClose: null,
  open(opts) {
    U.$('#modal-title').textContent = opts.title || '';
    const body = U.$('#modal-body');
    const footer = U.$('#modal-footer');
    body.innerHTML = '';
    footer.innerHTML = '';

    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body instanceof Node) body.appendChild(opts.body);

    (opts.actions || []).forEach(act => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (act.class || 'btn-secondary');
      btn.textContent = act.label;
      btn.addEventListener('click', () => {
        if (act.onClick) act.onClick();
        if (act.close !== false) Modal.close();
      });
      footer.appendChild(btn);
    });

    this._currentOnClose = opts.onClose || null;
    U.$('#modal-overlay').classList.add('active');
  },
  close() {
    U.$('#modal-overlay').classList.remove('active');
    const cb = this._currentOnClose;
    this._currentOnClose = null;
    if (cb) { try { cb(); } catch (e) { console.error(e); } }
  },
  confirm(title, message, onConfirm, confirmText, danger) {
    this.open({
      title,
      body: '<p>' + U.escapeHtml(message) + '</p>',
      actions: [
        { label: 'Batal', class: 'btn-secondary' },
        { label: confirmText || 'Ya, Lanjutkan',
          class: danger ? 'btn-danger' : 'btn-primary',
          onClick: onConfirm }
      ]
    });
  }
};

// ============================================================
// LOADING
// ============================================================
const Loading = {
  _count: 0,
  show() { this._count++; U.$('#loading-overlay').classList.add('active'); },
  hide() {
    this._count = Math.max(0, this._count - 1);
    if (this._count === 0) U.$('#loading-overlay').classList.remove('active');
  }
};

// ============================================================
// STORE — session + master cache (localStorage)
// ============================================================
const Store = {
  getSession() {
    try {
      const raw = localStorage.getItem(CONFIG.SESSION_KEY);
      if (!raw) return null;
      const sess = JSON.parse(raw);
      if (sess.expiry && Date.now() > sess.expiry) {
        localStorage.removeItem(CONFIG.SESSION_KEY);
        return null;
      }
      return sess;
    } catch (e) { return null; }
  },
  setSession(s) { localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(s)); },
  clearSession() { localStorage.removeItem(CONFIG.SESSION_KEY); },

  getMaster() {
    try {
      const raw = localStorage.getItem(CONFIG.MASTER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.expires && Date.now() > parsed.expires) {
        localStorage.removeItem(CONFIG.MASTER_KEY);
        return null;
      }
      return parsed.data;
    } catch (e) { return null; }
  },
  setMaster(data) {
    try {
      localStorage.setItem(CONFIG.MASTER_KEY, JSON.stringify({
        data, expires: Date.now() + CONFIG.MASTER_CACHE_TTL_MS
      }));
    } catch (e) {}
  },
  clearMaster() { localStorage.removeItem(CONFIG.MASTER_KEY); },

  getLogo() { return localStorage.getItem(CONFIG.LOGO_KEY) || ''; },
  setLogo(dataUrl) { localStorage.setItem(CONFIG.LOGO_KEY, dataUrl); }
};

// ============================================================
// API CLIENT
// ============================================================
class ApiError extends Error {
  constructor(code, message, raw) {
    super(message);
    this.code = code;
    this.raw = raw;
  }
}

const Api = {
  _buildRequest(action, payload, opts) {
    const session = Store.getSession();
    return {
      auth_token: CONFIG.API_KEY,
      session_token: (opts && opts.public) ? undefined : (session ? session.token : undefined),
      action: action,
      uuid: (opts && opts.noUuid) ? undefined : U.uuid(),
      timestamp_client: U.nowISO(),
      payload: payload || {}
    };
  },

  async _fetch(body, timeoutMs) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs || CONFIG.REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: 'follow'
      });
      clearTimeout(tid);
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); }
      catch (e) {
        throw new ApiError('SERVER_ERROR', 'Respons server tidak valid: ' + text.substring(0, 120));
      }
      return json;
    } catch (err) {
      clearTimeout(tid);
      if (err.name === 'AbortError') throw new ApiError('TIMEOUT', 'Request timeout. Coba lagi.');
      if (err instanceof ApiError) throw err;
      throw new ApiError('NETWORK', 'Koneksi gagal: ' + (err.message || err));
    }
  },

  async call(action, payload, opts) {
    opts = opts || {};
    const body = this._buildRequest(action, payload, opts);
    let lastError = null;

    for (let attempt = 0; attempt < CONFIG.RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(3, attempt - 1), 8000);
        await U.sleep(delay);
      }
      try {
        const res = await this._fetch(body);
        if (res.code === 200) return res;
        if (res.code === 401) {
          // Session expired — clear & redirect ke login
          Store.clearSession();
          AuthGuard.onSessionExpired();
          throw new ApiError(res.error_code || 'UNAUTHORIZED', res.message || 'Tidak berwenang');
        }
        if (res.code === 429) {
          lastError = new ApiError('RATE_LIMITED', res.message || 'Terlalu banyak permintaan');
          await U.sleep(5000);
          continue;
        }
        if (res.code >= 500 && attempt < CONFIG.RETRY_ATTEMPTS - 1) {
          lastError = new ApiError(res.error_code || 'SERVER_ERROR', res.message || 'Server error');
          continue;
        }
        throw new ApiError(res.error_code || 'ERROR', res.message || 'Terjadi kesalahan', res);
      } catch (err) {
        lastError = err;
        if (err.code === 'NETWORK' || err.code === 'TIMEOUT') {
          if (attempt < CONFIG.RETRY_ATTEMPTS - 1) continue;
        } else if (err.code !== 'RATE_LIMITED') {
          throw err;
        }
      }
    }
    throw lastError || new ApiError('UNKNOWN', 'Gagal setelah beberapa kali percobaan');
  },

  // Endpoints
  login(username, pin) { return this.call('login', { username, pin_plaintext: pin }, { public: true }); },
  logout() { return this.call('logout', {}); },
  whoAmI() { return this.call('whoAmI', {}); },
  getMasterData() { return this.call('getMasterData', {}); },
  getDashboardSummary() { return this.call('getDashboardSummary', {}); },
  getKartuStokBulanan(idBarang, bulan, tahun) {
    return this.call('getKartuStokBulanan', { id_barang: idBarang, bulan, tahun });
  },
  getAvailableBatches(idBarang) { return this.call('getAvailableBatches', { id_barang: idBarang }); },
  getExpiringItems(bulan) { return this.call('getExpiringItems', { bulan: bulan || 3 }); },
  simpanTransaksi(payload) { return this.call('simpanTransaksi', payload); },
  simpanOpnameBulk(payload) { return this.call('simpanOpnameBulk', payload); },
  editMasterData(payload) { return this.call('editMasterData', payload); },
  tambahMaster(payload) { return this.call('tambahMaster', payload); },
  hapusMaster(payload) { return this.call('hapusMaster', payload); },
  getAuditLog(payload) { return this.call('getAuditLog', payload); },
  ubahPin(payload) { return this.call('ubahPin', payload); },
  resetPin(idPetugas) { return this.call('resetPin', { id_petugas: idPetugas }); },
  getPendingApprovals() { return this.call('getPendingApprovals', {}); },
  approveTransaksi(idTrx, keputusan) {
    return this.call('approveTransaksi', { id_transaksi: idTrx, keputusan: keputusan });
  },
  getMyScanHistory(limit) { return this.call('getMyScanHistory', { limit: limit || 50 }); }
};

// ============================================================
// QR SCANNER
// ============================================================
const QRScanner = {
  _stream: null, _videoEl: null, _rafId: null, _detector: null,
  _running: false, _lastText: '', _lastTime: 0, _onDetected: null,

  async start(videoEl, onDetected, onError) {
    this.stop();
    this._videoEl = videoEl;
    this._onDetected = onDetected;
    this._running = true;

    try {
      const constraints = {
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      };
      this._stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoEl.srcObject = this._stream;
      videoEl.setAttribute('playsinline', '');
      videoEl.muted = true;
      await videoEl.play();

      if ('BarcodeDetector' in window) {
        try {
          this._detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
        } catch (e) { this._detector = null; }
      }
      this._loop();
    } catch (err) {
      if (onError) onError(err);
    }
  },

  async _loop() {
    if (!this._running) return;
    if (this._detector && this._videoEl && this._videoEl.readyState === 4) {
      try {
        const codes = await this._detector.detect(this._videoEl);
        if (codes && codes.length > 0) this._handle(codes[0].rawValue);
      } catch (e) { /* ignore */ }
    }
    this._rafId = requestAnimationFrame(() => this._loop());
  },

  _handle(text) {
    if (!text) return;
    const now = Date.now();
    if (text === this._lastText && (now - this._lastTime) < 2000) return;
    this._lastText = text;
    this._lastTime = now;
    if (this._onDetected) this._onDetected(text);
  },

  stop() {
    this._running = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    if (this._videoEl) {
      try { this._videoEl.srcObject = null; } catch (e) {}
    }
    this._detector = null;
  },

  async toggleFlash() {
    if (!this._stream) return false;
    const track = this._stream.getVideoTracks()[0];
    if (!track) return false;
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (!caps.torch) return false;
    const newTorch = !track.getSettings().torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: newTorch }] });
      return newTorch;
    } catch (e) { return false; }
  }
};

// ============================================================
// LOGIN FORM COMPONENT (shared)
// ============================================================
const LoginForm = {
  _pin: '',
  _maxPinLen: 8,
  _onSuccess: null,
  _container: null,

  /**
   * Render login screen into a container and set onSuccess callback.
   * @param {string|HTMLElement} containerOrSelector
   * @param {function} onSuccess - called after successful login, receives session object
   */
  mount(containerOrSelector, onSuccess) {
    const container = typeof containerOrSelector === 'string'
      ? U.$(containerOrSelector)
      : containerOrSelector;
    if (!container) return;

    this._container = container;
    this._onSuccess = onSuccess;
    this._pin = '';

    container.innerHTML = this._renderHTML();
    this._attachListeners();
    this._render();
  },

  _renderHTML() {
    return '' +
      '<div class="login-screen">' +
        '<div class="login-card">' +
          '<div class="login-brand">' +
            '<div class="login-logo">PKM</div>' +
            '<div class="login-title">Sistem Gudang</div>' +
            '<div class="login-subtitle">Puskesmas Sanden, Bantul</div>' +
          '</div>' +
          '<form class="login-form" id="login-form" autocomplete="off">' +
            '<div class="field">' +
              '<label class="field-label" for="login-username">Username</label>' +
              '<input type="text" class="input" id="login-username" ' +
                'autocapitalize="none" autocorrect="off" spellcheck="false" ' +
                'autocomplete="username" placeholder="contoh: apoteker_pj" ' +
                'maxlength="20" required>' +
            '</div>' +
            '<div class="field">' +
              '<label class="field-label">PIN</label>' +
              '<div class="login-pin-display empty" id="login-pin">Masukkan PIN</div>' +
            '</div>' +
            '<div class="login-keypad" id="login-keypad">' +
              '<button type="button" class="key-btn" data-key="1">1</button>' +
              '<button type="button" class="key-btn" data-key="2">2</button>' +
              '<button type="button" class="key-btn" data-key="3">3</button>' +
              '<button type="button" class="key-btn" data-key="4">4</button>' +
              '<button type="button" class="key-btn" data-key="5">5</button>' +
              '<button type="button" class="key-btn" data-key="6">6</button>' +
              '<button type="button" class="key-btn" data-key="7">7</button>' +
              '<button type="button" class="key-btn" data-key="8">8</button>' +
              '<button type="button" class="key-btn" data-key="9">9</button>' +
              '<button type="button" class="key-btn" data-key="back" aria-label="Hapus">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>' +
                  '<line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>' +
                '</svg>' +
              '</button>' +
              '<button type="button" class="key-btn" data-key="0">0</button>' +
              '<button type="button" class="key-btn primary" data-key="enter" id="login-submit" aria-label="Masuk">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                  '<polyline points="20 6 9 17 4 12"/>' +
                '</svg>' +
              '</button>' +
            '</div>' +
            '<div class="login-help mt-3">Lupa PIN? Hubungi <strong>Admin</strong></div>' +
          '</form>' +
          '<div class="login-footer">' +
            '<span class="status-dot" id="conn-dot"></span>' +
            '<span id="conn-text">Terhubung</span>' +
            '<span>·</span>' +
            '<span>v' + CONFIG.APP_VERSION + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  },

  _attachListeners() {
    const ctx = this._container;

    U.$$('#login-keypad .key-btn', ctx).forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (key === 'back') this._backspace();
        else if (key === 'enter') this._submit();
        else this._append(key);
      });
    });

    // Physical keyboard — hanya aktif saat fokus tidak di input
    this._keydownHandler = (e) => {
      if (!this._container || !this._container.querySelector('.login-screen')) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key >= '0' && e.key <= '9') this._append(e.key);
      else if (e.key === 'Backspace') { e.preventDefault(); this._backspace(); }
      else if (e.key === 'Enter') { e.preventDefault(); this._submit(); }
    };
    document.addEventListener('keydown', this._keydownHandler);

    U.$('#login-username', ctx).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); U.vibrate(15); e.target.blur(); }
    });

    U.$('#login-form', ctx).addEventListener('submit', (e) => {
      e.preventDefault();
      this._submit();
    });

    // Online indicator
    this._updateOnline();
    this._onlineHandler = () => this._updateOnline();
    window.addEventListener('online', this._onlineHandler);
    window.addEventListener('offline', this._onlineHandler);
  },

  _updateOnline() {
    const ctx = this._container;
    if (!ctx) return;
    const dot = U.$('#conn-dot', ctx);
    const txt = U.$('#conn-text', ctx);
    const online = navigator.onLine;
    if (dot) dot.classList.toggle('offline', !online);
    if (txt) txt.textContent = online ? 'Terhubung' : 'Offline';
  },

  _append(digit) {
    if (this._pin.length >= this._maxPinLen) return;
    this._pin += digit;
    U.vibrate(15);
    this._render();
  },

  _backspace() {
    this._pin = this._pin.slice(0, -1);
    this._render();
  },

  _render() {
    const ctx = this._container;
    if (!ctx) return;
    const el = U.$('#login-pin', ctx);
    if (!el) return;
    if (this._pin.length === 0) {
      el.textContent = 'Masukkan PIN';
      el.classList.add('empty');
    } else {
      el.textContent = '●'.repeat(this._pin.length);
      el.classList.remove('empty');
    }
  },

  unmount() {
    if (this._keydownHandler) document.removeEventListener('keydown', this._keydownHandler);
    if (this._onlineHandler) {
      window.removeEventListener('online', this._onlineHandler);
      window.removeEventListener('offline', this._onlineHandler);
    }
    this._keydownHandler = null;
    this._onlineHandler = null;
    if (this._container) this._container.innerHTML = '';
    this._container = null;
    this._onSuccess = null;
    this._pin = '';
  },

  async _submit() {
    const ctx = this._container;
    const username = U.$('#login-username', ctx).value.trim().toLowerCase();
    if (!username) { Toast.error('Username wajib diisi'); U.$('#login-username', ctx).focus(); return; }
    if (username.length < 4) { Toast.error('Username minimal 4 karakter'); return; }
    if (this._pin.length < 4) { Toast.error('PIN minimal 4 digit'); return; }

    const submitBtn = U.$('#login-submit', ctx);
    submitBtn.disabled = true;
    Loading.show();

    try {
      const res = await Api.login(username, this._pin);
      const session = {
        token: res.session_token,
        id_petugas: res.id_petugas,
        username: res.username,
        nama: res.nama,
        role: res.role,
        wilayah_binaan: res.wilayah_binaan || '',
        expiry: Date.now() + (res.expiry_sec || 21500) * 1000
      };
      Store.setSession(session);
      this._pin = '';
      this._render();

      Toast.success('Selamat datang, ' + res.nama);
      if (this._onSuccess) this._onSuccess(session);
    } catch (err) {
      U.vibrate([100, 50, 100]);
      U.beepError();
      Toast.error(err.message || 'Login gagal');
      this._pin = '';
      this._render();
    } finally {
      submitBtn.disabled = false;
      Loading.hide();
    }
  }
};

// ============================================================
// AUTH GUARD
// ============================================================
const AuthGuard = {
  // Redirect ke halaman lain kalau role tidak sesuai
  /**
   * @param {string} currentPage - 'index' | 'scan'
   * @returns {object|null} session jika valid, null jika redirect dilakukan
   */
  checkPage(currentPage) {
    const session = Store.getSession();
    if (!session) {
      // Belum login — biarkan halaman handle (show login form)
      return null;
    }

    // Role Scanner hanya boleh di scan page
    if (session.role === 'Scanner' && currentPage === 'index') {
      Toast.warning('Role Scanner hanya bisa mengakses halaman Scanner.');
      location.replace('scan.html');
      return null;
    }

    return session;
  },

  onSessionExpired() {
    // Dipanggil oleh Api.call saat 401
    // Biarkan halaman yang handle (akan re-render login form)
    Store.clearSession();
  }
};

// ============================================================
// GLOBAL LISTENERS — modal close, dll
// ============================================================
function setupCoreListeners() {
  const closeBtn = U.$('#modal-close');
  if (closeBtn) closeBtn.addEventListener('click', () => Modal.close());
  const overlay = U.$('#modal-overlay');
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) Modal.close();
  });
  window.addEventListener('error', (e) => console.error('[GLOBAL_ERROR]', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => console.error('[UNHANDLED_PROMISE]', e.reason));
}

// Auto-setup saat DOM ready
document.addEventListener('DOMContentLoaded', setupCoreListeners);
