/**
 * render-customers.js — 视图 2：客户出货量排行（含四角色、健康分、跟进状态）
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  M.barCell = function (pct, color) {
    return '<td class="num"><div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">'
      + '<div style="flex:1;max-width:80px;height:6px;background:#eef2f6;border-radius:3px;overflow:hidden">'
      + '<div style="height:100%;width:' + pct.toFixed(1) + '%;background:' + color + '"></div></div>'
      + '<span style="width:46px;text-align:right">' + pct.toFixed(1) + '%</span></div></td>';
  };

  /** 距今天数（dateStr 为 YYYY-MM-DD），无法解析返回 null */
  function daysSince(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((now.getTime() - d.getTime()) / 86400000);
  }

  /** 「最后跟进」<td>：读 localStorage['crm-monthly-activities-'+LINE+'-'+encodeURIComponent(name)]，取 date 最大一条 */
  function lastActivityTd(name) {
    const last = M.latestActivityDate(name);
    if (!last) return '<td class="muted">从未跟进</td>';
    const d = daysSince(last);
    return '<td' + (d != null && d > 30 ? ' class="text-warn" title="已 ' + d + ' 天未跟进"' : '') + '>' + last + '</td>';
  }

  /** 客户排行（from/to 为起止月，''=不限；roleKey/person 非空则只留该角色=该人名的客户，角色按生效月取数）。
   *  排序按业务线：电商=CBM，传统=利润。 */
  M.customerRank = function (from, to, roleKey, person, effectiveMonth) {
    let entries = (M.SEED.customers || []);
    if (from || to) {
      entries = entries.filter((c) => (!from || c.month >= from) && (!to || c.month <= to));
    }
    const sortKey = M.prof().sortBy; // 'vol'（电商体积=CBM）| 'profit'（传统按利润）
    const agg = new Map();
    for (const c of entries) {
      if (person && person !== 'all' && M.roleAt(c.name, roleKey, effectiveMonth) !== person) continue;
      const a = agg.get(c.name) || { vol: 0, profit: null };
      const v = M.volOf(c);
      if (v != null) a.vol += v;
      if (c.profit != null) a.profit = (a.profit || 0) + c.profit;
      agg.set(c.name, a);
    }
    const rows = Array.from(agg.entries()).map(([name, a]) => ({ name, vol: a.vol, profit: a.profit, roles: M.roleMap[name] || null }));
    rows.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
    return rows;
  };

  function renderCustomerRank() {
    const from = M.S.custFrom, to = M.S.custTo, roleKey = M.S.custRole, person = M.S.custPerson;
    const volLabel = M.prof().volumeLabel;
    // 销售2/项目助理按「结束月」生效角色取数（中途换人时，选到换人月之前不再显示后来的人）
    const effectiveMonth = to || (M.MONTHS.length ? M.MONTHS[M.MONTHS.length - 1] : '');
    const rows = M.customerRank(from, to, roleKey, person, effectiveMonth);
    const total = rows.reduce((s, r) => s + r.vol, 0);
    const totalProfit = rows.reduce((s, r) => s + (r.profit || 0), 0);
    const roleLabel = (M.ROLE_FIELDS.find((x) => x[0] === roleKey) || [])[1] || '';
    const people = M.rolePeople(roleKey, effectiveMonth);

    let html = '<div class="toolbar">'
      + '<select onchange="CRM.monthly.setCustFrom(this.value)">'
      + '<option value=""' + (from === '' ? ' selected' : '') + '>起始：最早</option>'
      + M.MONTHS.map((m) => '<option value="' + m + '"' + (m === from ? ' selected' : '') + '>' + m + '</option>').join('')
      + '</select>'
      + '<select onchange="CRM.monthly.setCustTo(this.value)">'
      + '<option value=""' + (to === '' ? ' selected' : '') + '>结束：最新</option>'
      + M.MONTHS.map((m) => '<option value="' + m + '"' + (m === to ? ' selected' : '') + '>' + m + '</option>').join('')
      + '</select>'
      + '<select onchange="CRM.monthly.setCustRole(this.value)">'
      + M.ROLE_OPTIONS.map((r) => '<option value="' + r.key + '"' + (r.key === roleKey ? ' selected' : '') + '>' + r.label + '</option>').join('')
      + '</select>'
      + '<select onchange="CRM.monthly.setCustPerson(this.value)">'
      + '<option value="all"' + (person === 'all' ? ' selected' : '') + '>全部' + roleLabel + '</option>'
      + people.map((p) => '<option value="' + M.esc(p) + '"' + (p === person ? ' selected' : '') + '>' + M.esc(p) + '</option>').join('')
      + '</select>'
      + '<span class="muted">共 ' + rows.length + ' 家 · ' + volLabel + ' 合计 ' + M.fmtNum(total, 1) + ' · 利润合计 ' + M.fmtMoney(totalProfit) + '</span></div>';

    if (person !== 'all') {
      html += '<div class="panel" style="background:#e0f3fb"><div style="font-size:13px"><strong>' + M.esc(person) + '</strong>（' + roleLabel + '）名下 ' + rows.length + ' 家客户 · 出货 ' + volLabel + ' 合计 <strong>' + M.fmtNum(total, 1) + '</strong></div></div>';
    }

    const show = (M.S.custExpand || rows.length <= 50) ? rows : rows.slice(0, 50);

    html += '<div class="panel" style="padding:0"><table>'
      + '<thead><tr><th>#</th><th>客户</th><th class="num">' + volLabel + '</th><th class="num">利润</th><th class="num" style="min-width:150px">占比</th><th>健康分</th><th>最近出货</th><th>跟进</th><th>最后跟进</th><th title="按所选结束月生效角色取数">销售2</th><th title="按所选结束月生效角色取数">项目助理</th></tr></thead><tbody>';
    html += show.map((r, i) => {
      const pct = total > 0 ? (r.vol / total) * 100 : 0;
      const st = M.followStatus(r.name);
      return '<tr><td class="muted">' + (i + 1) + '</td><td><a class="cust-name" data-name="' + M.esc(r.name) + '" href="javascript:void(0)" title="查看客户详情 · 趋势 / 跟进 / 商机">' + M.esc(r.name) + '</a></td>'
        + '<td class="num">' + M.fmtNum(r.vol, 1) + '</td>'
        + '<td class="num">' + M.fmtMoney(r.profit) + '</td>' + M.barCell(pct, '#0090D8')
        + '<td>' + M.healthBadge(M.healthScores.get(r.name)) + '</td>'
        + '<td>' + (st ? M.esc(st.last) : '—') + '</td><td>' + M.followBadge(st) + '</td>'
        + lastActivityTd(r.name)
        + '<td>' + M.esc(M.roleAt(r.name, 'sales2', effectiveMonth) || '—') + '</td><td>' + M.esc(M.roleAt(r.name, 'assistant', effectiveMonth) || '—') + '</td></tr>';
    }).join('');
    html += '</tbody></table></div>';

    if (rows.length > 50) {
      html += '<div style="text-align:center;margin-top:12px"><button class="btn" onclick="CRM.monthly.toggleCustExpand()">'
        + (M.S.custExpand ? '收起' : '展开全部（' + rows.length + ' 家）') + '</button></div>';
    }
    return html;
  }
  M.renderCustomerRank = renderCustomerRank;
})();
