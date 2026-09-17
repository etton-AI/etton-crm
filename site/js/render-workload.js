/**
 * render-workload.js — 视图 7：人效（按四角色维度聚合）
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  M.workloadByStaff = function (roleKey, from, to) {
    const rows = new Map();
    const ensure = (name) => {
      if (!rows.has(name)) rows.set(name, { name, customerCount: 0, vol: 0, profit: 0, customers: new Set() });
      return rows.get(name);
    };
    for (const name of M.custSeries.keys()) {
      const map = M.custSeries.get(name);
      for (const [month, rec] of map) {
        if (from && month < from) continue;
        if (to && month > to) continue;
        // 按该月生效的角色取数（支持角色中途变更，如项目助理 8 月起换人）
        const who = M.roleAt(name, roleKey, month);
        if (!who) continue;
        // 角色去重（同样按该月生效值判断）
        if (roleKey === 'sales2' && M.roleAt(name, 'main', month) === who) continue;
        if (roleKey === 'assistant' && M.roleAt(name, 'sales2', month) === who) continue;
        const r = ensure(who);
        const v = M.volOf(rec);
        if (v != null) r.vol += v;
        if (rec.profit != null) r.profit += rec.profit;
        r.customers.add(name);
      }
    }
    return Array.from(rows.values())
      .map((r) => ({ name: r.name, customerCount: r.customers.size, vol: r.vol, profit: r.profit }))
      .sort((a, b) => b.profit - a.profit || b.vol - a.vol);
  };

  function renderWorkload() {
    const roleKey = M.S.workRole, from = M.S.workFrom, to = M.S.workTo;
    const volLabel = M.prof().volumeLabel;
    const meta = M.ROLE_OPTIONS.find((r) => r.key === roleKey) || M.ROLE_OPTIONS[0];
    const rows = M.workloadByStaff(roleKey, from, to);
    const hint = roleKey === 'sales2' ? '主销售与销售2同一人的月份不计入本维度'
      : roleKey === 'assistant' ? '销售2与项目助理同一人的月份不计入本维度'
      : '按所选时间范围内各月生效角色取数';
    let html = '<div class="toolbar"><div class="seg">'
      + M.ROLE_OPTIONS.map((r) => '<button class="' + (r.key === roleKey ? 'active' : '') + '" onclick="CRM.monthly.setWorkRole(\'' + r.key + '\')">' + r.label + '</button>').join('')
      + '</div></div>';
    html += '<div class="toolbar">'
      + '<select onchange="CRM.monthly.setWorkFrom(this.value)">'
      + '<option value=""' + (from === '' ? ' selected' : '') + '>起始：最早</option>'
      + M.MONTHS.map((m) => '<option value="' + m + '"' + (m === from ? ' selected' : '') + '>' + m + '</option>').join('')
      + '</select>'
      + '<select onchange="CRM.monthly.setWorkTo(this.value)">'
      + '<option value=""' + (to === '' ? ' selected' : '') + '>结束：最新</option>'
      + M.MONTHS.map((m) => '<option value="' + m + '"' + (m === to ? ' selected' : '') + '>' + m + '</option>').join('')
      + '</select>'
      + '<span class="muted">共 ' + rows.length + ' 人</span></div>';
    html += '<div class="panel" style="background:#e0f3fb"><div style="font-size:13px">按「' + meta.label + '」维度统计 · ' + hint + '</div></div>';
    html += '<div class="panel" style="padding:0"><table>'
      + '<thead><tr><th>#</th><th>人员</th><th class="num">客户数</th><th class="num">累计' + volLabel + '</th><th class="num">累计利润</th></tr></thead><tbody>';
    html += rows.map((r, i) => '<tr><td class="muted">' + (i + 1) + '</td><td>' + M.esc(r.name) + '</td>'
      + '<td class="num">' + M.fmtNum(r.customerCount) + '</td>'
      + '<td class="num">' + M.fmtNum(r.vol, 1) + '</td>'
      + '<td class="num">' + M.fmtMoney(r.profit) + '</td></tr>').join('');
    html += '</tbody></table></div>';
    return html;
  }
  M.renderWorkload = renderWorkload;
})();
