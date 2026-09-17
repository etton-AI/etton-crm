/**
 * render-dashboard.js — 视图 1：月度经营看板（合并双折线 + KPI + 利润同比）
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  M.yearSum = function (year, metric, maxMonths) {
    let s = 0;
    for (const m of M.MONTHS) {
      if (m.slice(0, 4) !== year) continue;
      if (maxMonths && parseInt(m.slice(5, 7), 10) > maxMonths) continue;
      const v = M.monthMap.get(m)[metric];
      if (v != null) s += v;
    }
    return s;
  };

  M.momHtml = function (month, metric) {
    const i = M.MONTHS.indexOf(month);
    if (i <= 0) return M.pctHtml(null);
    const cur = M.monthMap.get(month)[metric];
    const pre = M.monthMap.get(M.MONTHS[i - 1])[metric];
    return M.pctHtml(M.pctChange(cur, pre));
  };

  M.yoyYtdHtml = function (metric) {
    return M.pctHtml(M.pctChange(M.yearSum('2026', metric, 9), M.yearSum('2025', metric, 9)));
  };

  function renderDashboard() {
    // 经营看板：传统 + 电商 合并展示（参考原始 CRM 看板「全部」口径，双折线对比）
    const range = M.filteredCombinedMonths();
    if (!range.length) return '<div class="empty">所选时间区间无数据</div>';

    const endMonth = range[range.length - 1];
    const prevMonth = M.prevGlobalMonth(endMonth);
    const ecEnd = M.LINE_MONTH_MAPS.ec.get(endMonth);
    const trEnd = M.LINE_MONTH_MAPS.trad.get(endMonth);

    let cumProfit = 0, cumTickets = 0;
    for (const m of range) {
      cumProfit += M.combinedVal(m, 'profit');
      cumTickets += M.combinedVal(m, 'tickets');
    }
    const rangeLabel = M.fmtMonthShort(range[0]) + ' → ' + M.fmtMonthShort(endMonth);

    const kpi = [
      { label: '本月利润（合计）', value: M.fmtMoney(M.combinedVal(endMonth, 'profit')), sub: '环比 ' + M.pctHtml(M.pctChange(M.combinedVal(endMonth, 'profit'), prevMonth ? M.combinedVal(prevMonth, 'profit') : null)) },
      { label: '本月票数（合计）', value: M.fmtNum(M.combinedVal(endMonth, 'tickets')), sub: '环比 ' + M.pctHtml(M.pctChange(M.combinedVal(endMonth, 'tickets'), prevMonth ? M.combinedVal(prevMonth, 'tickets') : null)) },
      { label: '区间累计利润（合计）', value: M.fmtMoney(cumProfit), sub: '区间 ' + rangeLabel },
      { label: '区间累计票数（合计）', value: M.fmtNum(cumTickets), sub: '区间 ' + rangeLabel },
      { label: '电商 · 本月利润', value: M.fmtMoney(ecEnd && ecEnd.profit), sub: 'CBM ' + M.fmtNum(ecEnd && ecEnd.cbm, 1) + ' · 箱数 ' + M.fmtNum(ecEnd && ecEnd.boxes) + ' · 票数 ' + M.fmtNum(ecEnd && ecEnd.tickets) },
      { label: '传统 · 本月利润', value: M.fmtMoney(trEnd && trEnd.profit), sub: '票数 ' + M.fmtNum(trEnd && trEnd.tickets) },
    ];

    let html = '<div class="kpi-grid">' + kpi.map((k) =>
      '<div class="kpi"><div class="label">' + k.label + '</div><div class="value">' + k.value + '</div><div class="sub">' + k.sub + '</div></div>'
    ).join('') + '</div>';

    const metric = (M.S.metric === 'tickets') ? 'tickets' : 'profit';
    const rangeSet = new Set(range);
    const series = M.ALL_LINES.map((l) => {
      const s = M.lineSeries(l, metric);
      const values = new Map();
      for (const [m, v] of s.values) if (rangeSet.has(m)) values.set(m, v);
      return { name: s.name, color: s.color, values };
    });
    html += '<div class="panel"><h3>月度' + M.METRIC_LABELS[metric] + '趋势（传统 + 电商）<span class="hint">' + range.length + ' 个月</span></h3>'
      + '<div class="seg" style="margin-bottom:12px">'
      + '<button class="' + (metric === 'profit' ? 'active' : '') + '" onclick="CRM.monthly.setMetric(\'profit\')">利润</button>'
      + '<button class="' + (metric === 'tickets' ? 'active' : '') + '" onclick="CRM.monthly.setMetric(\'tickets\')">票数</button>'
      + '</div>'
      + M.lineChart(series, range, 240) + '</div>';

    html += M.renderYoyPanel();
    return html;
  }
  M.renderDashboard = renderDashboard;

  function renderYoyPanel() {
    // 利润同比（2025 vs 2026），传统与电商分列对比，顶部合计
    const tables = M.ALL_LINES.map((line) => {
      const mm = M.LINE_MONTH_MAPS[line];
      let rows = '', t25 = 0, t26 = 0;
      for (let mmo = 1; mmo <= 9; mmo++) {
        const k = String(mmo).padStart(2, '0');
        const m25 = mm.get('2025-' + k);
        const m26 = mm.get('2026-' + k);
        const p25 = m25 ? m25.profit : null;
        const p26 = m26 ? m26.profit : null;
        if (p25 != null) t25 += p25;
        if (p26 != null) t26 += p26;
        rows += '<tr><td>' + mmo + '月</td><td class="num">' + M.fmtMoney(p25) + '</td><td class="num">' + M.fmtMoney(p26) + '</td><td class="num">' + M.pctHtml(M.pctChange(p26, p25)) + '</td></tr>';
      }
      rows += '<tr style="border-top:2px solid var(--border);font-weight:600"><td>累计(1-9月)</td><td class="num">' + M.fmtMoney(t25) + '</td><td class="num">' + M.fmtMoney(t26) + '</td><td class="num">' + M.pctHtml(M.pctChange(t26, t25)) + '</td></tr>';
      return '<div class="panel" style="margin-bottom:0"><h3><span style="color:' + M.LINE_COLORS[line] + '">●</span> ' + M.LINE_PROFILE[line].label + '</h3>'
        + '<table><thead><tr><th>月份</th><th class="num">2025</th><th class="num">2026</th><th class="num">同比</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }).join('');

    const t25 = M.combinedYearSum('2025', 'profit', 9);
    const t26 = M.combinedYearSum('2026', 'profit', 9);
    return '<div class="panel"><h3>利润同比（2025 vs 2026）<span class="hint">合计 ' + M.fmtMoney(t25) + ' → ' + M.fmtMoney(t26) + ' ' + M.pctHtml(M.pctChange(t26, t25)) + '</span></h3>'
      + '<div class="grid-2">' + tables + '</div></div>';
  }
  M.renderYoyPanel = renderYoyPanel;
})();
