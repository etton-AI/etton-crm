/**
 * render-weeks.js — 视图 4：周维度细看（仅电商线）
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  M.weekKey = function (range) {
    const m = (range || '').match(/^(\d+)\.(\d+)/);
    if (!m) return 0;
    return parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
  };

  M.weeksOf = function (month) {
    return (M.weeksByMonth.get(month) || []).slice().sort((a, b) => M.weekKey(a.range) - M.weekKey(b.range));
  };

  M.replenishBadge = function (v) {
    if (v === '√') return '<span class="badge watch">有补单</span>';
    if (v === '×') return '<span class="badge muted">无</span>';
    return '<span class="muted">—</span>';
  };

  function renderWeeks() {
    const month = M.S.weekMonth || M.MONTHS[M.MONTHS.length - 1];
    const kpi = M.monthMap.get(month);
    const weeks = M.weeksOf(month);

    let html = '<div class="toolbar"><select onchange="CRM.monthly.setWeekMonth(this.value)">'
      + M.MONTHS.map((m) => '<option value="' + m + '"' + (m === month ? ' selected' : '') + '>' + m + '</option>').join('')
      + '</select></div>';

    if (kpi) {
      html += '<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">'
        + '<div class="kpi"><div class="label">' + month + ' 总票数</div><div class="value">' + M.fmtNum(kpi.tickets) + '</div></div>'
        + '<div class="kpi"><div class="label">总箱数</div><div class="value">' + M.fmtNum(kpi.boxes) + '</div></div>'
        + '<div class="kpi"><div class="label">总CBM</div><div class="value">' + M.fmtNum(kpi.cbm, 1) + '</div></div>'
        + '<div class="kpi"><div class="label">总利润</div><div class="value">' + M.fmtMoney(kpi.profit) + '</div></div>'
        + '</div>';
    }

    html += '<div class="panel" style="padding:0"><table>'
      + '<thead><tr><th>日期段</th><th class="num">票数</th><th class="num">箱数</th><th class="num">CBM</th><th class="num">利润</th><th>补单</th></tr></thead><tbody>';
    html += weeks.map((w) => '<tr><td>' + M.esc(w.range) + '</td>'
      + '<td class="num">' + (w.tickets != null ? M.fmtNum(w.tickets) : '—') + '</td>'
      + '<td class="num">' + (w.boxes != null ? M.fmtNum(w.boxes) : '—') + '</td>'
      + '<td class="num">' + (w.cbm != null ? M.fmtNum(w.cbm, 1) : '—') + '</td>'
      + '<td class="num">' + (w.profit != null ? M.fmtMoney(w.profit) : '—') + '</td>'
      + '<td>' + M.replenishBadge(w.replenish) + '</td></tr>').join('');
    html += '</tbody></table></div>';
    return html;
  }
  M.renderWeeks = renderWeeks;
})();
