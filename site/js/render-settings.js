/**
 * render-settings.js — 视图 8：设置（健康分权重 + 预警规则）
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  function renderSettings() {
    const w = M.settings.healthWeights, a = M.settings.alerts;
    const volLabel = M.prof().volumeLabel;
    let html = '<div class="panel"><h3>健康分权重 <span class="hint">三维合计建议 100（月度无回款维度）</span></h3>'
      + '<div class="grid-2">'
      + '<div><label class="muted">活跃度</label><br><input id="set_hw_activity" type="number" value="' + w.activity + '"></div>'
      + '<div><label class="muted">趋势</label><br><input id="set_hw_trend" type="number" value="' + w.trend + '"></div>'
      + '<div><label class="muted">贡献</label><br><input id="set_hw_contribution" type="number" value="' + w.contribution + '"></div>'
      + '</div></div>';

    html += '<div class="panel"><h3>预警规则</h3><table><thead><tr><th>启用</th><th>规则</th><th>关键参数</th></tr></thead><tbody>'
      + '<tr><td><input type="checkbox" id="set_dormant_enabled"' + (a.dormant.enabled ? ' checked' : '') + '></td>'
      + '<td>沉睡预警</td><td>最近出货距最新月 ≥ <input id="set_dormant_gap" type="number" value="' + a.dormant.gapMonths + '"> 月 · 累计 ≥ <input id="set_dormant_mincbm" type="number" value="' + a.dormant.minCbm + '"> ' + volLabel + '</td></tr>'
      + '<tr><td><input type="checkbox" id="set_yoydrop_enabled"' + (a.yoyDrop.enabled ? ' checked' : '') + '></td>'
      + '<td>同比下滑</td><td>下滑 ≥ <input id="set_yoydrop_pct" type="number" value="' + a.yoyDrop.dropPct + '"> % · 2025 基数 ≥ <input id="set_yoydrop_base" type="number" value="' + a.yoyDrop.minBaseCbm + '"> ' + volLabel + '</td></tr>'
      + '</tbody></table></div>';

    html += '<div class="panel"><div class="toolbar"><button class="btn primary" onclick="CRM.monthly.saveSettings()">保存设置</button>'
      + '<span class="muted">设置保存在本机浏览器（localStorage）</span></div></div>';
    return html;
  }
  M.renderSettings = renderSettings;

  function saveSettings() {
    const g = (id) => document.getElementById(id);
    const n = (id, d) => { const el = g(id); const v = el ? parseFloat(el.value) : NaN; return isFinite(v) ? v : d; };
    M.settings.healthWeights.activity = n('set_hw_activity', 40);
    M.settings.healthWeights.trend = n('set_hw_trend', 30);
    M.settings.healthWeights.contribution = n('set_hw_contribution', 30);
    M.settings.alerts.dormant.enabled = g('set_dormant_enabled') ? g('set_dormant_enabled').checked : true;
    M.settings.alerts.dormant.gapMonths = Math.max(1, Math.round(n('set_dormant_gap', 3)));
    M.settings.alerts.dormant.minCbm = Math.max(0, n('set_dormant_mincbm', 10));
    M.settings.alerts.yoyDrop.enabled = g('set_yoydrop_enabled') ? g('set_yoydrop_enabled').checked : true;
    M.settings.alerts.yoyDrop.dropPct = Math.max(0, n('set_yoydrop_pct', 30));
    M.settings.alerts.yoyDrop.minBaseCbm = Math.max(0, n('set_yoydrop_base', 20));
    M.persistSettings();
    M.healthScores = M.computeHealthScores(M.settings.healthWeights);
    M.render();
  }
  M.saveSettings = saveSettings;
})();
