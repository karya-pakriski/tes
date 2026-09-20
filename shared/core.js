/**
 * ============================================================
 * SHARED CORE JS — Sistem Gudang Puskesmas v5.4
 * ============================================================
 * Termasuk: config, utilities, store, toast, modal, btn,
 *           form error, API client, CustomSelect, QR scanner,
 *           LoginForm, AuthGuard, LibLoader, BatchSelector.
 *
 * Changelog v5.4:
 *   - Fix LoginForm._submitting (user tidak terkunci saat login gagal)
 *   - LibLoader overhaul: per-CDN timeout 8s, cleanup script tag,
 *     strict global check, no hang on retry
 *   - LoginForm: ganti Loading overlay -> .busy class
 *   - Loading object deprecated (no-op + dbgWarn)
 *   - Api.getPesananDetail() + Api.getLaporan() (backend v5.4)
 *   - Api.call skip retry untuk PARTIAL_WRITE
 *   - MASTER_TIMEOUT_MS 12s -> 20s
 *   - APP_VERSION 5.4
 *   - LoginForm: guard digit input saat submitting
 * ============================================================
 */
'use strict';

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = Object.freeze({
  API_URL: 'https://script.google.com/macros/s/AKfycbxX6oAam5bFHR4ngUEWwZ7TXXzuo9mGxBrXtnj1e6y8BT9Fm3rw7JWDKsxYpZwTb45pSw/exec',
  API_KEY: 'PKM_SANDEN_26',
  APP_VERSION: '5.4',

  // Timeouts per endpoint (ms)
  REQUEST_TIMEOUT_MS: 15000,
  LOGIN_TIMEOUT_MS: 12000,
  MASTER_TIMEOUT_MS: 20000,       // v5.4: master payload besar, network kadang lambat
  WHOAMI_TIMEOUT_MS: 6000,
  RETRY_ATTEMPTS: 2,

  // Cache TTL
  MASTER_CACHE_TTL_MS: 3600000,   // 1 jam

  // localStorage keys
  LOGO_KEY: 'PKM_LOGO_DATAURL',
  SESSION_KEY: 'pkm_session',
  MASTER_KEY: 'pkm_master_data',

  MAX_TOAST: 3,
  DEBUG: true
});

function dbg(...args) { if (CONFIG.DEBUG) console.log('[CORE]', ...args); }
function dbgWarn(...args) { if (CONFIG.DEBUG) console.warn('[CORE]', ...args); }
function dbgErr(...args) { if (CONFIG.DEBUG) console.error('[CORE]', ...args); }

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

  _iconCache: {},
  icon(name, size) {
    const s = size || 20;
    const key = name + ':' + s;
    if (this._iconCache[key]) return this._iconCache[key];

    const paths = {
      dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
      menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
      arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
      arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
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
      chevronDown: '<polyline points="6 9 12 15 18 9"/>',
      camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
      keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="10"/><line x1="10" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="14" y2="10"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/>',
      zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
      wifiOff: '<line x1="2" y1="2" x2="22" y2="22"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 12.55a11 11 0 0 1 5.17-2.39"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
      qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
      home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
      calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
      filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'
    };
    const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="' + s + '" height="' + s + '">' + (paths[name] || '') + '</svg>';
    this._iconCache[key] = svg;
    return svg;
  }
};

// ============================================================
// STORE — localStorage wrapper
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
    } catch (e) { dbgWarn('getSession error', e); return null; }
  },
  setSession(s) {
    try { localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(s)); return true; }
    catch (e) { dbgErr('setSession error', e); return false; }
  },
  clearSession() {
    try { localStorage.removeItem(CONFIG.SESSION_KEY); } catch (e) {}
  },
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
        data: data,
        expires: Date.now() + CONFIG.MASTER_CACHE_TTL_MS
      }));
    } catch (e) { dbgWarn('setMaster error', e); }
  },
  clearMaster() {
    try { localStorage.removeItem(CONFIG.MASTER_KEY); } catch (e) {}
  },
  getLogo() {
    try { return localStorage.getItem(CONFIG.LOGO_KEY) || ''; } catch (e) { return ''; }
  },
  setLogo(dataUrl) {
    try { localStorage.setItem(CONFIG.LOGO_KEY, dataUrl); } catch (e) {}
  }
};

// ============================================================
// TOAST
// ============================================================
const Toast = {
  show(message, type, duration) {
    const container = U.$('#toast-container');
    if (!container) { dbg('[Toast]', type, message); return; }
    while (container.children.length >= CONFIG.MAX_TOAST) {
      container.removeChild(container.firstChild);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    const iconName = type === 'success' ? 'check' :
                    type === 'error' ? 'alertCircle' :
                    type === 'warning' ? 'alert' : 'info';
    const dur = duration || (type === 'error' ? 5000 : 3000);
    el.innerHTML =
      U.icon(iconName, 18) +
      '<span>' + U.escapeHtml(message) + '</span>' +
      '<div class="toast-progress" style="animation-duration:' + dur + 'ms"></div>';
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      el.style.transition = 'opacity 0.25s, transform 0.25s';
      setTimeout(() => el.remove(), 300);
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
    const overlay = U.$('#modal-overlay');
    const modal = U.$('#modal');
    if (!overlay || !modal) return;

    let headerHTML = '';
    if (opts.icon) {
      const iconName = opts.icon === 'danger' || opts.icon === 'warning' ? 'alert' :
                       opts.icon === 'success' ? 'check' :
                       opts.icon === 'primary' ? 'info' : 'info';
      headerHTML = '<div class="modal-header-icon ' + opts.icon + '">' + U.icon(iconName, 22) + '</div>';
    }
    headerHTML += '<div class="modal-header-text">' +
      '<div class="modal-title">' + U.escapeHtml(opts.title || '') + '</div>' +
      (opts.subtitle ? '<div class="modal-subtitle">' + U.escapeHtml(opts.subtitle) + '</div>' : '') +
    '</div>';

    modal.innerHTML = '' +
      '<div class="modal-header">' +
        headerHTML +
        '<button class="modal-close" id="modal-close" aria-label="Tutup">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="modal-body" id="modal-body"></div>' +
      '<div class="modal-footer" id="modal-footer"></div>';

    const body = U.$('#modal-body');
    const footer = U.$('#modal-footer');

    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body instanceof Node) body.appendChild(opts.body);

    (opts.actions || []).forEach(act => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (act.class || 'btn-secondary');
      btn.innerHTML = act.icon
        ? U.icon(act.icon, 16) + ' ' + U.escapeHtml(act.label)
        : U.escapeHtml(act.label);
      btn.addEventListener('click', () => {
        if (act.onClick) act.onClick(btn);
        if (act.close !== false) Modal.close();
      });
      footer.appendChild(btn);
    });

    U.$('#modal-close', modal).addEventListener('click', () => Modal.close());

    this._currentOnClose = opts.onClose || null;
    overlay.classList.add('active');
  },

  close() {
    const overlay = U.$('#modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    const cb = this._currentOnClose;
    this._currentOnClose = null;
    if (cb) { try { cb(); } catch (e) { dbgErr(e); } }
  },

  confirm(title, message, onConfirm, confirmText, danger, opts) {
    opts = opts || {};
    this.open({
      title: title,
      subtitle: opts.subtitle || '',
      icon: opts.icon || (danger ? 'danger' : 'warning'),
      body: '<p style="font-size:var(--fs-md);line-height:1.6;color:var(--text);white-space:pre-line">' +
              U.escapeHtml(message) + '</p>',
      actions: [
        { label: opts.cancelText || 'Batal', class: 'btn-secondary' },
        { label: confirmText || 'Ya, Lanjutkan',
          class: danger ? 'btn-danger' : 'btn-primary',
          close: opts.keepOpen ? false : true,
          onClick: onConfirm }
      ]
    });
  }
};

// ============================================================
// LOADING — [DEPRECATED v5.4]
// ============================================================
/**
 * Overlay loading sudah TIDAK DIPAKAI lagi sejak v5.4.
 *
 * Pengganti (pilih sesuai konteks):
 *   1. Button loading state:
 *        Btn.setLoading(btn, 'Menyimpan...');
 *
 *   2. Container busy overlay:
 *        containerEl.classList.add('busy');
 *        // ... async work ...
 *        containerEl.classList.remove('busy');
 *
 *   3. Inline placeholder:
 *        el.innerHTML = Helper.loader('Memuat...');
 *
 * Objek ini tetap ada untuk backward-compat — kalau ada kode
 * lama yang masih mereferensikan Loading.show/hide, tidak error.
 */
const Loading = {
  _count: 0,

  show() {
    dbgWarn('[DEPRECATED] Loading.show() — pakai Btn.setLoading() atau class .busy');
  },
  hide() {
    dbgWarn('[DEPRECATED] Loading.hide() — pakai Btn.setLoading() atau class .busy');
  },
  forceHide() {}
};

window.__forceHideLoading = () => {};

// ============================================================
// BUTTON HELPERS
// ============================================================
const Btn = {
  setLoading(btn, label) {
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add('loading');
    if (label !== undefined) {
      btn.innerHTML = '<span class="btn-label">' + U.escapeHtml(label || '') + '</span>';
    }
  },
  stopLoading(btn, label, iconName) {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.innerHTML = (iconName ? U.icon(iconName, 16) + ' ' : '') + U.escapeHtml(label || '');
  }
};

// ============================================================
// FORM ERROR
// ============================================================
const FormError = {
  set(inputEl, message) {
    if (!inputEl) return;
    inputEl.classList.add('error');
    const field = inputEl.closest('.field') || inputEl.parentElement;
    if (!field) return;
    let errEl = field.querySelector('.field-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'field-error';
      field.appendChild(errEl);
    }
    errEl.innerHTML = U.icon('alertCircle', 13) + '<span>' + U.escapeHtml(message) + '</span>';
    errEl.classList.add('visible');
    const clearFn = () => FormError.clear(inputEl);
    inputEl.addEventListener('input', clearFn, { once: true });
    inputEl.addEventListener('change', clearFn, { once: true });
  },

  clear(inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove('error');
    const field = inputEl.closest('.field') || inputEl.parentElement;
    if (!field) return;
    const errEl = field.querySelector('.field-error');
    if (errEl) errEl.classList.remove('visible');
  },

  clearAll(container) {
    U.$$('.input.error, .textarea.error, .cs-trigger.error', container).forEach(el => {
      this.clear(el);
    });
  }
};

// ============================================================
// CUSTOM SELECT — auto-replace semua <select>
// ============================================================
const CS = {
  _observer: null,

  init() {
    this.enhanceAll(document);

    if (this._observer) return;

    this._observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.tagName === 'SELECT') this.enhance(node);
          else if (node.querySelectorAll) {
            node.querySelectorAll('select').forEach(s => this.enhance(s));
          }
        });
      });
    });

    if (document.body) {
      this._observer.observe(document.body, { childList: true, subtree: true });
      dbg('CS observer aktif');
    }
  },

  enhanceAll(root) {
    if (!root) root = document;
    U.$$('select', root).forEach(sel => {
      if (sel.dataset.csEnhanced === '1') return;
      this.enhance(sel);
    });
  },

  enhance(selectEl) {
    if (!selectEl || selectEl.dataset.csEnhanced === '1') return;
    selectEl.dataset.csEnhanced = '1';

    const wrapper = document.createElement('div');
    wrapper.className = 'cs';
    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);
    selectEl.style.display = 'none';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cs-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    wrapper.appendChild(trigger);

    const dropdown = document.createElement('div');
    dropdown.className = 'cs-dropdown';
    dropdown.style.display = 'none';
    dropdown.setAttribute('role', 'listbox');
    wrapper.appendChild(dropdown);

    const render = () => {
      const opts = Array.from(selectEl.options).map(o => ({
        value: o.value,
        label: o.textContent.trim(),
        disabled: o.disabled
      }));

      const cur = opts.find(o => o.value === selectEl.value) ||
                  (opts[0] && opts[0].value === '' ? opts[0] : null);

      trigger.disabled = !!selectEl.disabled;
      trigger.classList.toggle('error', selectEl.classList.contains('error'));

      trigger.innerHTML =
        '<span class="cs-trigger-text' + (cur && cur.value ? '' : ' placeholder') + '">' +
          U.escapeHtml(cur ? cur.label : (opts[0] ? opts[0].label : '—')) +
        '</span>' +
        '<span class="cs-trigger-icon">' + U.icon('chevronDown', 18) + '</span>';

      if (opts.length === 0) {
        dropdown.innerHTML = '<div class="cs-empty">Tidak ada pilihan</div>';
        return;
      }

      dropdown.innerHTML = opts.map(o =>
        '<button type="button" class="cs-option' +
          (o.value === selectEl.value ? ' selected' : '') + '"' +
          ' data-value="' + U.escapeHtml(o.value) + '"' +
          (o.disabled ? ' data-disabled="1"' : '') + '>' +
          '<span class="cs-option-label">' + U.escapeHtml(o.label) + '</span>' +
          '<span class="cs-option-check">' + U.icon('check', 16) + '</span>' +
        '</button>'
      ).join('');
    };

    const close = () => {
      dropdown.style.display = 'none';
      trigger.classList.remove('open');
    };

    const open = () => {
      U.$$('.cs-trigger.open').forEach(t => {
        if (t !== trigger) {
          t.classList.remove('open');
          const d = t.parentElement.querySelector('.cs-dropdown');
          if (d) d.style.display = 'none';
        }
      });
      dropdown.style.display = 'block';
      trigger.classList.add('open');
    };

    const selectValue = (val) => {
      selectEl.value = val;
      try {
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {
        const evt = document.createEvent('HTMLEvents');
        evt.initEvent('change', true, true);
        selectEl.dispatchEvent(evt);
      }
      render();
      close();
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (trigger.disabled) return;
      if (dropdown.style.display === 'block') close();
      else open();
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (dropdown.style.display === 'block') close();
        else open();
      }
    });

    dropdown.addEventListener('click', (e) => {
      const optEl = e.target.closest('[data-value]');
      if (!optEl || optEl.dataset.disabled === '1') return;
      selectValue(optEl.dataset.value);
    });

    this._bindGlobalClose();

    const attrObserver = new MutationObserver(() => render());
    attrObserver.observe(selectEl, {
      attributes: true,
      attributeFilter: ['disabled', 'class'],
      childList: true,
      subtree: true
    });

    wrapper.addEventListener('click', (e) => e.stopPropagation());

    selectEl._csRender = render;
    selectEl._csClose = close;

    render();
  },

  _bindGlobalClose() {
    if (this._globalBound) return;
    this._globalBound = true;
    document.addEventListener('click', () => {
      U.$$('.cs-trigger.open').forEach(t => {
        t.classList.remove('open');
        const d = t.parentElement.querySelector('.cs-dropdown');
        if (d) d.style.display = 'none';
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        U.$$('.cs-trigger.open').forEach(t => {
          t.classList.remove('open');
          const d = t.parentElement.querySelector('.cs-dropdown');
          if (d) d.style.display = 'none';
        });
      }
    });
  },

  setValue(selectEl, val) {
    if (!selectEl) return;
    selectEl.value = val;
    if (selectEl._csRender) selectEl._csRender();
  }
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
  _warmedUp: false,

  /**
   * Warmup — 1 request health ke backend.
   * Gunakan GET supaya tidak masuk hitungan doPost.
   * Skip kalau baru warmup <30s lalu (cegah spam).
   */
  warmup() {
    if (this._warmedUp) return;
    this._warmedUp = true;
    try {
      const url = CONFIG.API_URL + '?action=health';
      const t0 = performance.now();
      fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store' })
        .then(() => dbg('Warmup OK (' + Math.round(performance.now() - t0) + 'ms)'))
        .catch(err => dbgWarn('Warmup failed:', err.message));
    } catch (e) { /* silent */ }
  },

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
    const t0 = performance.now();
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
      const elapsed = Math.round(performance.now() - t0);
      dbg('API ' + body.action + ' -> ' + res.status + ' (' + elapsed + 'ms)');
      let json;
      try { json = JSON.parse(text); }
      catch (e) {
        dbgErr('API ' + body.action + ' non-JSON:', text.substring(0, 200));
        throw new ApiError('SERVER_ERROR', 'Respons server tidak valid.');
      }
      return json;
    } catch (err) {
      clearTimeout(tid);
      const elapsed = Math.round(performance.now() - t0);
      if (err.name === 'AbortError') {
        dbgWarn('API ' + body.action + ' TIMEOUT ' + elapsed + 'ms');
        throw new ApiError('TIMEOUT', 'Server tidak merespons (' + elapsed + 'ms).');
      }
      if (err instanceof ApiError) throw err;
      dbgErr('API ' + body.action + ' NETWORK:', err.message);
      throw new ApiError('NETWORK', 'Koneksi gagal: ' + (err.message || err));
    }
  },

  async call(action, payload, opts) {
    opts = opts || {};
    const body = this._buildRequest(action, payload, opts);

    // Endpoint dengan timeout khusus
    if (action === 'login' || action === 'loginRuang') {
      return await this._fetch(body, CONFIG.LOGIN_TIMEOUT_MS);
    }
    if (action === 'getMasterData') {
      return await this._fetch(body, CONFIG.MASTER_TIMEOUT_MS);
    }
    if (action === 'whoAmI') {
      return await this._fetch(body, CONFIG.WHOAMI_TIMEOUT_MS);
    }
    if (action === 'getRuangList') {
      return await this._fetch(body, CONFIG.MASTER_TIMEOUT_MS);
    }

    let lastError = null;
    for (let attempt = 0; attempt < CONFIG.RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(800 * Math.pow(2, attempt - 1), 3000);
        dbg('Retry ' + action + ' #' + (attempt + 1) + ' after ' + delay + 'ms');
        await U.sleep(delay);
      }
      try {
        const res = await this._fetch(body);
        if (res.code === 200) return res;
        if (res.code === 401) {
          Store.clearSession();
          throw new ApiError(res.error_code || 'UNAUTHORIZED', res.message || 'Tidak berwenang');
        }
        if (res.code === 429) {
          lastError = new ApiError('RATE_LIMITED', res.message || 'Terlalu banyak permintaan');
          await U.sleep(3000);
          continue;
        }
        // v5.4: PARTIAL_WRITE tidak boleh diretry.
        // Kalau diretry, idempotency UUID akan return "duplikat diabaikan"
        // (code 200) dan menutupi kegagalan awal. Frontend butuh info asli.
        if (res.code >= 500 && res.error_code !== 'PARTIAL_WRITE'
            && attempt < CONFIG.RETRY_ATTEMPTS - 1) {
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

  // ---------- Endpoints ----------
  login(username, pin) {
    return this.call('login', { username: username, pin_plaintext: pin }, { public: true });
  },
  loginRuang(kode, pin) {
    return this.call('loginRuang',
      { kode_ruang: kode, pin_plaintext: pin },
      { public: true });
  },
  getRuangList() {
    return this.call('getRuangList', {}, { public: true });
  },
  logout() { return this.call('logout', {}); },
  whoAmI() { return this.call('whoAmI', {}); },
  getMasterData() { return this.call('getMasterData', {}); },
  getDashboardSummary() { return this.call('getDashboardSummary', {}); },
  getKartuStokBulanan(idBarang, bulan, tahun) {
    return this.call('getKartuStokBulanan', { id_barang: idBarang, bulan: bulan, tahun: tahun });
  },
  getAvailableBatches(idBarang) {
    return this.call('getAvailableBatches', { id_barang: idBarang });
  },
  getAvailableMonths(idBarang) {
    return this.call('getAvailableMonths', { id_barang: idBarang });
  },
  getExpiringItems(bulan) {
    return this.call('getExpiringItems', { bulan: bulan || 3 });
  },
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
  getMyScanHistory(limit) {
    return this.call('getMyScanHistory', { limit: limit || 50 });
  },

  // Pesanan Ruang
  getBarangUntukPesan() { return this.call('getBarangUntukPesan', {}); },
  kirimPesanan(payload) { return this.call('kirimPesanan', payload); },
  getPesananSaya(limit) {
    return this.call('getPesananSaya', { limit: limit || 20 });
  },
  getPesananMasuk(payload) {
    return this.call('getPesananMasuk', payload || {});
  },
  getPesananDetail(idPesanan) {
    return this.call('getPesananDetail', { id_pesanan: idPesanan });
  },
  updateStatusPesanan(idPesanan, status) {
    return this.call('updateStatusPesanan', { id_pesanan: idPesanan, status: status });
  },

  // Laporan (v5.4)
  getLaporan(payload) {
    return this.call('getLaporan', payload || {});
  },
  getLaporanStokTerkini(payload) {
    return this.call('getLaporan',
      Object.assign({ tipe: 'stok_terkini' }, payload || {}));
  },
  getLaporanMutasiBulanan(payload) {
    return this.call('getLaporan',
      Object.assign({ tipe: 'mutasi_bulanan' }, payload || {}));
  },
  getLaporanNilaiAset(payload) {
    return this.call('getLaporan',
      Object.assign({ tipe: 'nilai_aset' }, payload || {}));
  }
};

// ============================================================
// LIB LOADER — multi-CDN fallback (v5.4: hang-proof)
// ============================================================
const LibLoader = {
  _cache: {},
  _sources: {
    qrcode: [
      'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
      'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js'
    ],
    sheetjs: [
      'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js',
      'https://cdn.jsdelivr.net/npm/xlsx@0.20.0/dist/xlsx.full.min.js',
      'https://unpkg.com/xlsx@0.20.0/dist/xlsx.full.min.js'
    ],
    jsqr: [
      'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
      'https://unpkg.com/jsqr@1.4.0/dist/jsQR.min.js'
    ]
  },
  _globals: { qrcode: 'QRCode', sheetjs: 'XLSX', jsqr: 'jsQR' },
  _cdnTimeoutMs: 8000,

  load(name) {
    if (this._cache[name]) return this._cache[name];
    const urls = this._sources[name];
    const globalName = this._globals[name];
    if (!urls || !globalName) {
      return Promise.reject(new Error('Unknown lib: ' + name));
    }

    // v5.4: bersihkan script tag lama yang mungkin stale
    // dari retry sebelumnya — supaya tidak bocor di DOM.
    this._cleanupOldScripts(name);

    this._cache[name] = this._trySequential(urls, name, globalName, 0);
    return this._cache[name];
  },

  // v5.4: strict check supaya global "stale" (mis. window.XLSX = {})
  // dari script lain tidak dianggap valid.
  _isValidGlobal(name, globalName) {
    const g = window[globalName];
    if (!g) return false;
    if (name === 'qrcode' && typeof g.toDataURL !== 'function') return false;
    if (name === 'sheetjs' && (!g.utils || typeof g.utils.book_new !== 'function')) return false;
    if (name === 'jsqr' && typeof g !== 'function') return false;
    return true;
  },

  _cleanupOldScripts(name) {
    const stale = document.querySelectorAll('script[data-lib^="' + name + '-"]');
    stale.forEach(s => { try { s.remove(); } catch (e) {} });
  },

  /**
   * v5.4: SELALU buat script baru per attempt.
   * JANGAN reuse tag lama — event load/error sudah fired,
   * listener baru tidak akan trigger -> promise hang selamanya.
   * Timeout per-CDN 8s supaya tidak hang kalau script diam-diam fail.
   */
  _trySequential(urls, name, globalName, idx) {
    if (idx >= urls.length) {
      delete LibLoader._cache[name];
      return Promise.reject(new Error('Semua CDN gagal untuk ' + name));
    }
    return new Promise((resolve, reject) => {
      // Cek global dulu — kalau sudah valid, selesai
      if (this._isValidGlobal(name, globalName)) {
        resolve(window[globalName]);
        return;
      }

      const script = document.createElement('script');
      script.src = urls[idx];
      script.async = true;
      script.setAttribute('data-lib', name + '-' + idx);

      let settled = false;
      const tid = setTimeout(() => {
        if (settled) return;
        settled = true;
        dbgWarn('CDN #' + (idx + 1) + ' TIMEOUT (' +
          Math.round(this._cdnTimeoutMs / 1000) + 's): ' + urls[idx]);
        try { script.remove(); } catch (e) {}
        this._trySequential(urls, name, globalName, idx + 1).then(resolve, reject);
      }, this._cdnTimeoutMs);

      script.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(tid);
        if (this._isValidGlobal(name, globalName)) {
          dbg('Lib ' + name + ' loaded dari CDN #' + (idx + 1));
          resolve(window[globalName]);
        } else {
          dbgWarn('CDN #' + (idx + 1) + ' tidak expose global valid, coba berikutnya');
          this._trySequential(urls, name, globalName, idx + 1).then(resolve, reject);
        }
      };

      script.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(tid);
        dbgWarn('CDN #' + (idx + 1) + ' gagal: ' + urls[idx]);
        this._trySequential(urls, name, globalName, idx + 1).then(resolve, reject);
      };

      document.head.appendChild(script);
    });
  }
};

// ============================================================
// QR SCANNER — native BarcodeDetector + jsQR fallback
// ============================================================
const QRScanner = {
  _stream: null,
  _videoEl: null,
  _rafId: null,
  _detector: null,
  _jsQR: null,
  _canvas: null,
  _ctx: null,
  _mode: null,
  _running: false,
  _lastText: '',
  _lastTime: 0,
  _onDetected: null,
  _lastDetectTime: 0,
  _detectIntervalMs: 100,

  async start(videoEl, onDetected, onError) {
    this.stop();
    this._videoEl = videoEl;
    this._onDetected = onDetected;
    this._running = true;
    this._lastDetectTime = 0;

    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 960 },
          height: { ideal: 540 }
        }
      };
      this._stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoEl.srcObject = this._stream;
      videoEl.setAttribute('playsinline', '');
      videoEl.muted = true;
      await videoEl.play();
    } catch (err) {
      this._running = false;
      if (onError) onError(new Error('Kamera tidak dapat diakses: ' + err.message));
      return;
    }

    if ('BarcodeDetector' in window) {
      try {
        this._detector = new BarcodeDetector({ formats: ['qr_code'] });
        this._mode = 'native';
        dbg('Scanner: pakai BarcodeDetector native');
      } catch (e) {
        dbgWarn('BarcodeDetector init gagal:', e.message);
        this._detector = null;
      }
    }

    if (!this._detector) {
      try {
        this._jsQR = await LibLoader.load('jsqr');
        this._canvas = document.createElement('canvas');
        this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
        this._mode = 'jsqr';
        dbg('Scanner: pakai jsQR fallback');
      } catch (err) {
        this._running = false;
        if (this._stream) {
          this._stream.getTracks().forEach(t => t.stop());
          this._stream = null;
        }
        if (onError) onError(new Error(
          'Browser ini tidak mendukung pemindaian QR otomatis. ' +
          'Gunakan tombol "Manual" untuk input kode barang.'
        ));
        return;
      }
    }

    this._loop();
  },

  _loop() {
    if (!this._running) return;

    const now = performance.now();
    if (now - this._lastDetectTime >= this._detectIntervalMs) {
      this._lastDetectTime = now;
      if (this._mode === 'native') this._detectNative();
      else if (this._mode === 'jsqr') this._detectJsQR();
    }

    this._rafId = requestAnimationFrame(() => this._loop());
  },

  async _detectNative() {
    const video = this._videoEl;
    if (!video || video.readyState !== 4 || !this._detector) return;
    try {
      const codes = await this._detector.detect(video);
      if (codes && codes.length > 0) this._handle(codes[0].rawValue);
    } catch (e) { /* ignore per-frame */ }
  },

  _detectJsQR() {
    const video = this._videoEl;
    if (!video || video.readyState !== 4 || !this._jsQR) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    const maxDim = 640;
    let cw = w, ch = h;
    if (w > maxDim || h > maxDim) {
      if (w > h) { ch = Math.round(h * maxDim / w); cw = maxDim; }
      else { cw = Math.round(w * maxDim / h); ch = maxDim; }
    }

    if (this._canvas.width !== cw) this._canvas.width = cw;
    if (this._canvas.height !== ch) this._canvas.height = ch;

    try {
      this._ctx.drawImage(video, 0, 0, cw, ch);
      const imgData = this._ctx.getImageData(0, 0, cw, ch);
      const code = this._jsQR(imgData.data, cw, ch, { inversionAttempts: 'dontInvert' });
      if (code && code.data) this._handle(code.data);
    } catch (e) { /* ignore */ }
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
    this._jsQR = null;
    this._canvas = null;
    this._ctx = null;
    this._mode = null;
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
// BATCH SELECTOR (FEFO)
// ============================================================
const BatchSelector = {
  _batches: [],
  _value: '',
  _onChange: null,
  _satuan: '',

  mount(container, batches, onChange, satuan) {
    this._batches = batches || [];
    this._value = '';
    this._onChange = onChange;
    this._satuan = satuan || '';

    container.innerHTML = '' +
      '<div class="select-custom">' +
        '<button type="button" class="select-trigger" id="batch-trigger">' +
          '<div class="select-trigger-content">' +
            '<div class="select-trigger-placeholder">— Pilih batch —</div>' +
          '</div>' +
          '<div class="select-trigger-icon">' + U.icon('chevronDown', 18) + '</div>' +
        '</button>' +
      '</div>';

    U.$('#batch-trigger', container).addEventListener('click', () => this.openPicker());
  },

  openPicker() {
    const batches = this._batches;
    const currentValue = this._value;

    let listHTML = '';
    if (batches.length === 0) {
      listHTML = '<div class="empty-state" style="padding:24px">' +
        U.icon('package', 42) +
        '<h3>Tidak ada batch</h3>' +
        '<p>Belum ada batch dengan stok untuk item ini.</p>' +
      '</div>';
    } else {
      listHTML = '<div class="batch-list">' +
        batches.map((b, idx) => {
          const isFEFO = idx === 0;
          const isNear = b.status_ed === 'near_expired';
          const isExp = b.status_ed === 'expired';
          const isSelected = b.no_batch === currentValue;

          let badges = '';
          if (isFEFO) badges += '<span class="batch-card-badge fefo">⭐ FEFO</span>';
          if (isExp) badges += '<span class="batch-card-badge expired">KEDALUWARSA</span>';
          else if (isNear) badges += '<span class="batch-card-badge near-ed">ED DEKAT</span>';

          let edInfo = '';
          if (b.exp_date) {
            edInfo = U.formatDate(b.exp_date);
            if (b.days_to_ed !== null && b.days_to_ed >= 0) {
              edInfo += ' · ' + b.days_to_ed + ' hari lagi';
            } else if (b.days_to_ed !== null && b.days_to_ed < 0) {
              edInfo = U.formatDate(b.exp_date) + ' · sudah lewat';
            }
          } else {
            edInfo = 'tidak ada';
          }

          const selClass = isSelected ? ' selected' : '';
          const expClass = isExp ? ' expired' : '';
          const fefoClass = isFEFO ? ' fefo' : '';
          const dis = isExp ? ' disabled' : '';

          return '' +
            '<button type="button" class="batch-card' + fefoClass + selClass + expClass + '"' +
              ' data-batch="' + U.escapeHtml(b.no_batch) + '"' + dis + '>' +
              '<div class="batch-card-body">' +
                '<div class="batch-card-header">' +
                  '<div class="batch-card-id">' + U.escapeHtml(b.no_batch) + '</div>' +
                  badges +
                '</div>' +
                '<div class="batch-card-meta">' +
                  '<div class="batch-card-meta-item">' +
                    U.icon('calendar', 14) + '<span>ED: <strong>' + U.escapeHtml(edInfo) + '</strong></span>' +
                  '</div>' +
                '</div>' +
                '<div class="batch-card-sisa">' +
                  '<span class="batch-card-sisa-value">' + U.formatNumber(b.sisa_stok) + '</span>' +
                  '<span class="batch-card-sisa-unit">' + U.escapeHtml(this._satuan) + '</span>' +
                  '<span class="batch-card-sisa-label">Sisa</span>' +
                '</div>' +
              '</div>' +
              '<div class="batch-card-check">' + U.icon('check', 14) + '</div>' +
            '</button>';
        }).join('') +
      '</div>';
    }

    Modal.open({
      title: 'Pilih Batch',
      subtitle: 'Batch teratas disarankan (FEFO — ED terdekat)',
      icon: 'primary',
      body: listHTML,
      actions: [{ label: 'Batal', class: 'btn-secondary' }]
    });

    const self = this;
    U.$$('.batch-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.disabled) return;
        const batchId = card.dataset.batch;
        const batchObj = self._batches.find(b => b.no_batch === batchId);
        if (!batchObj) return;
        self._selectBatch(batchObj);
        Modal.close();
      });
    });
  },

  _selectBatch(batch) {
    this._value = batch.no_batch;
    const trigger = U.$('#batch-trigger');
    if (trigger) {
      let sub = 'Sisa ' + U.formatNumber(batch.sisa_stok);
      if (this._satuan) sub += ' ' + this._satuan;
      if (batch.exp_date) sub += ' · ED ' + U.formatDate(batch.exp_date);

      trigger.querySelector('.select-trigger-content').innerHTML =
        '<div class="select-trigger-main">' + U.escapeHtml(batch.no_batch) + '</div>' +
        '<div class="select-trigger-sub">' + U.escapeHtml(sub) + '</div>';
      trigger.classList.remove('error');
      FormError.clear(trigger);
    }
    if (this._onChange) this._onChange(batch);
  },

  getValue() { return this._value; },

  reset() {
    this._value = '';
    this._batches = [];
    const trigger = U.$('#batch-trigger');
    if (trigger) {
      trigger.querySelector('.select-trigger-content').innerHTML =
        '<div class="select-trigger-placeholder">— Pilih batch —</div>';
      trigger.classList.remove('open');
    }
  }
};

// ============================================================
// LOGIN FORM
// ============================================================
const LoginForm = {
  _pin: '',
  _maxPinLen: 8,
  _onSuccess: null,
  _container: null,
  _variant: 'compact',
  _submitting: false,
  _mounted: false,

  mount(containerOrSelector, onSuccess, opts) {
    const container = typeof containerOrSelector === 'string'
      ? U.$(containerOrSelector) : containerOrSelector;
    if (!container) return;

    this._container = container;
    this._onSuccess = onSuccess;
    this._variant = (opts && opts.variant) || 'compact';
    this._pin = '';
    this._submitting = false;
    this._mounted = true;

    container.innerHTML = this._renderHTML();
    this._attachListeners();
    this._render();

    Api.warmup();
    dbg('LoginForm mounted (' + this._variant + ')');
  },

  _renderHTML() {
    const formHTML = '' +
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
      '</div>';

    if (this._variant === 'split') {
      return '' +
        '<div class="login-screen split">' +
          '<div class="split-container">' +
            '<div class="split-left">' +
              '<div class="split-brand">' +
                '<div class="split-brand-logo">PKM</div>' +
                '<div class="split-brand-title">Sistem Gudang Terpadu</div>' +
                '<div class="split-brand-subtitle">' +
                  'Manajemen logistik obat, BMHP, dan ATK Puskesmas Sanden. ' +
                  'Terintegrasi, cepat, dan akurat.' +
                '</div>' +
                '<div class="split-brand-features">' +
                  '<div class="split-feature">' + U.icon('check', 18) + '<span>Batch &amp; ED obat otomatis</span></div>' +
                  '<div class="split-feature">' + U.icon('check', 18) + '<span>FEFO — First Expired First Out</span></div>' +
                  '<div class="split-feature">' + U.icon('check', 18) + '<span>Kartu stok, opname, dan LPLPO</span></div>' +
                  '<div class="split-feature">' + U.icon('check', 18) + '<span>Pesanan ruang &amp; notifikasi Telegram</span></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="split-right">' +
              formHTML +
            '</div>' +
          '</div>' +
        '</div>';
    }

    return '<div class="login-screen compact">' + formHTML + '</div>';
  },

  _attachListeners() {
    const ctx = this._container;

    U.$$('#login-keypad .key-btn', ctx).forEach(btn => {
      btn.addEventListener('click', () => {
        if (this._submitting) return;
        const key = btn.dataset.key;
        if (key === 'back') this._backspace();
        else if (key === 'enter') this._submit();
        else this._append(key);
      });
    });

    this._keydownHandler = (e) => {
      if (!this._mounted || !this._container) return;
      if (this._submitting) return;
      if (!this._container.querySelector('.login-screen')) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key >= '0' && e.key <= '9') this._append(e.key);
      else if (e.key === 'Backspace') { e.preventDefault(); this._backspace(); }
      else if (e.key === 'Enter') { e.preventDefault(); this._submit(); }
    };
    document.addEventListener('keydown', this._keydownHandler);

    const userEl = U.$('#login-username', ctx);
    if (userEl) {
      userEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); U.vibrate(15); e.target.blur(); }
      });
    }

    const formEl = U.$('#login-form', ctx);
    if (formEl) {
      formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        this._submit();
      });
    }

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
    if (this._submitting) return;
    if (this._pin.length >= this._maxPinLen) return;
    this._pin += digit;
    U.vibrate(15);
    this._render();
  },

  _backspace() {
    if (this._submitting) return;
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
    this._mounted = false;
    this._submitting = false;
  },

  async _submit() {
    if (this._submitting) { dbgWarn('Submit diabaikan (sedang proses)'); return; }
    this._submitting = true;

    const ctx = this._container;
    const formEl = U.$('#login-form', ctx);
    const usernameEl = U.$('#login-username', ctx);
    const username = usernameEl.value.trim().toLowerCase();

    FormError.clear(usernameEl);

    // Validasi input — reset _submitting di setiap early return
    if (!username) {
      FormError.set(usernameEl, 'Username wajib diisi');
      this._submitting = false;
      return;
    }
    if (username.length < 4) {
      FormError.set(usernameEl, 'Username minimal 4 karakter');
      this._submitting = false;
      return;
    }
    if (this._pin.length < 4) {
      Toast.error('PIN minimal 4 digit');
      this._submitting = false;
      return;
    }

    const submitBtn = U.$('#login-submit', ctx);
    if (submitBtn) submitBtn.disabled = true;
    if (formEl) formEl.classList.add('busy');
    dbg('Login: ' + username);

    try {
      const res = await Api.login(username, this._pin);
      dbg('Login OK code=' + res.code);

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

      if (formEl) formEl.classList.remove('busy');
      if (submitBtn) submitBtn.disabled = false;
      Toast.success('Selamat datang, ' + res.nama);

      if (this._onSuccess) {
        try {
          const ret = this._onSuccess(session);
          if (ret && typeof ret.then === 'function') {
            ret.catch(e => dbgErr('onSuccess async:', e));
          }
        } catch (e) { dbgErr('onSuccess throw:', e); }
      }
      return;

    } catch (err) {
      dbgWarn('Login gagal: ' + err.code + ' — ' + err.message);
      U.vibrate([100, 50, 100]);
      U.beepError();
      Toast.error(err.message || 'Login gagal');
      this._pin = '';
      this._render();
      if (formEl) formEl.classList.remove('busy');
      if (submitBtn) submitBtn.disabled = false;
    } finally {
      // v5.4 FIX: SELALU reset — sebelumnya hanya direset kalau _onSuccess kosong,
      // sehingga user terkunci permanen kalau login gagal.
      this._submitting = false;
    }
  }
};

// ============================================================
// AUTH GUARD
// ============================================================
const AuthGuard = {
  checkPage(currentPage) {
    const session = Store.getSession();
    if (!session) return null;
    if (session.role === 'Scanner' && currentPage === 'index') {
      Toast.warning('Role Scanner hanya bisa mengakses halaman Scanner.');
      setTimeout(() => location.replace('scan.html'), 500);
      return null;
    }
    if (session.role === 'Ruang' && currentPage === 'index') {
      Toast.warning('Role Ruang hanya bisa mengakses halaman Pesan Barang.');
      setTimeout(() => location.replace('pesan.html'), 500);
      return null;
    }
    return session;
  }
};

// ============================================================
// GLOBAL LISTENERS + BOOT
// ============================================================
function setupCoreListeners() {
  const overlay = U.$('#modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) Modal.close();
    });
  }
  window.addEventListener('error', (e) => dbgErr('GLOBAL_ERROR:', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => dbgErr('UNHANDLED_PROMISE:', e.reason));
}

function bootCore() {
  setupCoreListeners();

  if (typeof CS !== 'undefined' && CS.init) {
    CS.init();
  }

  dbg('[CORE] v' + CONFIG.APP_VERSION + ' booted');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootCore);
} else {
  bootCore();
}
