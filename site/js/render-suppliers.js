/**
 * render-suppliers.js — 视图 3：供应商出货量排行（仅电商线）
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  /** 供应商排行（metric: cbm | tickets） */
  M.supplierRank = function (month, metric) {
    const entries = month === 'all'
      ? (M.SEED.suppliers || [])
      : (M.SEED.suppliers || []).filter((s) => s.month === month);
    const agg = new Map();
    for (const s of entries) {
      let a = agg.get(s.name);
      if (!a) { a = { name: s.name, cbm: 0, tickets: 0, hasTickets: false }; agg.set(s.name, a); }
      if (s.cbm != null) a.cbm += s.cbm;
      if (s.tickets != null) { a.tickets += s.tickets; a.hasTickets = true; }
    }
    const rows = Array.from(agg.values()).map((a) => ({
      name: a.name, cbm: a.cbm, tickets: a.hasTickets ? a.tickets : null,
    }));
    rows.sort((x, y) => {
      const a = metric === 'tickets' ? (x.tickets == null ? -1 : x.tickets) : x.cbm;
      const b = metric === 'tickets' ? (y.tickets == null ? -1 : y.tickets) : y.cbm;
      return b - a;
    });
    return rows;
  };

  function renderSupplierRank() {
    const month = M.S.supMonth, metric = M.S.supMetric;
    const rows = M.supplierRank(month, metric);
    const total = rows.reduce((s, r) => s + (metric === 'tickets' ? (r.tickets || 0) : r.cbm), 0);

    let html = '<div class="toolbar">'
      + '<select onchange="CRM.monthly.setSupMonth(this.value)">'
      + '<option value="all"' + (month === 'all' ? ' selected' : '') + '>累计（全部月份）</option>'
      + M.supplierMonths.map((m) => '<option value="' + m + '"' + (m === month ? ' selected' : '') + '>' + m + '</option>').join('')
      + '</select>'
      + '<div class="seg">'
      + '<button class="' + (metric === 'cbm' ? 'active' : '') + '" onclick="CRM.monthly.setSupMetric(\'cbm\')">CBM</button>'
      + '<button class="' + (metric === 'tickets' ? 'active' : '') + '" onclick="CRM.monthly.setSupMetric(\'tickets\')">票数</button>'
      + '</div>'
      + '<span class="muted">共 ' + rows.length + ' 家</span></div>';

    html += '<div class="panel" style="padding:0"><table>'
      + '<thead><tr><th>#</th><th>供应商</th><th class="num">CBM</th><th class="num">票数</th><th class="num" style="min-width:150px">占比</th></tr></thead><tbody>';
    html += rows.map((r, i) => {
      const val = metric === 'tickets' ? (r.tickets || 0) : r.cbm;
      const pct = total > 0 ? (val / total) * 100 : 0;
      return '<tr><td class="muted">' + (i + 1) + '</td><td>' + M.esc(r.name) + '</td>'
        + '<td class="num">' + (r.cbm != null ? M.fmtNum(r.cbm, 1) : '—') + '</td>'
        + '<td class="num">' + (r.tickets != null ? M.fmtNum(r.tickets) : '—') + '</td>'
        + M.barCell(pct, '#004890') + '</tr>';
    }).join('');
    html += '</tbody></table></div>';
    return html;
  }
  M.renderSupplierRank = renderSupplierRank;
})();
