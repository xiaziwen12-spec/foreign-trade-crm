// ============================================
// utils.js - 工具函数
// ============================================

const Utils = {
  // 生成唯一ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  // 格式化日期 YYYY-MM-DD
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().split('T')[0];
  },

  // 格式化日期时间
  formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('zh-CN');
  },

  // 获取今天的日期字符串
  today() {
    return new Date().toISOString().split('T')[0];
  },

  // 本月第一天
  monthFirstDay() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  },

  // 本月最后一天
  monthLastDay() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  },

  // 格式化货币
  formatCurrency(amount, currency = 'CNY') {
    if (amount === null || amount === undefined) return '-';
    const num = parseFloat(amount);
    const symbols = { CNY: '¥', USD: '$', MXN: 'MX$', EUR: '€' };
    const sym = symbols[currency] || currency + ' ';
    return sym + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  // 价格换算 CNY → USD (用户公式: ÷0.6÷6.7)
  cnyToUsd(cnyPrice) {
    if (!cnyPrice || cnyPrice === 0) return 0;
    return cnyPrice / 0.6 / 6.7;
  },

  // USD → CNY
  usdToCny(usdPrice) {
    if (!usdPrice || usdPrice === 0) return 0;
    return usdPrice * 6.7 * 0.6;
  },

  // 防抖函数
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // Toast 提示
  showToast(message, type = 'info', duration = 2500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || ''}</span>${message}`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-hiding');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // 打开模态框
  openModal(title, bodyHtml, footerHtml = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    document.getElementById('modal-overlay').style.display = 'flex';
  },

  // 关闭模态框
  closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
  },

  // 确认对话框
  confirm(message) {
    return confirm(message);
  }
};

// Toast 样式注入（通过JS确保存在）
(function injectToastStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .toast-container { position: fixed; top: 16px; right: 16px; z-index: 10000; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
    .toast { padding: 12px 20px; border-radius: 8px; color: #fff; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); pointer-events: auto; animation: toastIn 0.3s ease; max-width: 360px; display: flex; align-items: center; gap: 8px;}
    .toast-success { background: #10b981; } .toast-error { background: #ef4444; } .toast-warning { background: #f59e0b; } .toast-info { background: #3b82f6; }
    .toast-icon { font-size: 16px; flex-shrink: 0; }
    .toast-hiding { animation: toastOut 0.3s ease forwards; }
    @keyframes toastIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes toastOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(40px); } }
  `;
  document.head.appendChild(style);
})();
