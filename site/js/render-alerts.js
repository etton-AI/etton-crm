/**
 * render-alerts.js — 视图 6：预警（风险侧：沉睡 / 同比下滑）
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  function renderAlerts() {
    const alerts = M.runAlerts();
    let html = '<div class="toolbar"><span class="muted">共 ' + alerts.length + ' 条预警</span></div>';
    if (!alerts.length) return html + '<div class="panel"><div class="empty">暂无预警 🎉</div></div>';
    html += '<div class="panel" style="padding:0">';
    html += alerts.map((al) =>
      '<div style="display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);align-items:flex-start">'
      + '<span class="badge ' + (al.level === 'high' ? 'risk' : 'watch') + '">' + (al.level === 'high' ? '高危' : '中危') + '</span>'
      + '<div style="flex:1"><strong><a class="cust-name" data-name="' + M.esc(al.name) + '" href="javascript:void(0)">' + M.esc(al.name) + '</a></strong>'
      + ' <span class="badge muted">' + M.esc(al.label) + '</span>'
      + '<div class="muted" style="font-size:12px">' + M.esc(al.detail) + '</div></div></div>'
    ).join('');
    html += '</div>';
    return html;
  }
  M.renderAlerts = renderAlerts;
})();
