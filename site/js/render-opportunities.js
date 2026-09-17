/**
 * render-opportunities.js — 视图 5：商机（新业务机会管理 + 四角色跟进 + 考核）
 *
 * 依据《业务开发销售流程说明_修订版》：
 *   ①机会导入者 → ②主销售 → ③销售2 → ④项目助理 →（复购/转介绍）闭环。
 * 支持录入新客户新业务 / 老客户新业务 / 老客户复购 / 转介绍，每条商机分配四角色跟进，
 * 并按角色考核（有效商机数 / 意向达成率 / 成交转化率+毛利 / 交付完成率）。
 * 数据持久化在本机 localStorage（按业务线隔离）；自动信号保留为底部「商机雷达」。
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  function renderOpportunities() {
    const p = M.prof();
    const board = M.kpiBoard();
    const opps = M.opportunities.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    let filtered = opps;
    if (M.S.oppStage !== 'all') filtered = filtered.filter((o) => o.stage === M.S.oppStage);
    if (M.S.oppType !== 'all') filtered = filtered.filter((o) => o.type === M.S.oppType);

    const person = (v) => v ? M.esc(v) : '<span class="muted">—</span>';
    const rate = (f) => (f == null || isNaN(f)) ? '<span class="muted">—</span>' : (f * 100).toFixed(0) + '%';
    const kpiCard = (label, val) => '<div class="kpi"><div class="label">' + label + '</div><div class="value">' + val + '</div></div>';

    let html = '<div class="toolbar"><button class="btn primary" onclick="CRM.monthly.oppAdd()">＋ 新增商机</button>'
      + '<span class="muted">商机按当前业务线（' + M.esc(p.label) + '）管理，保存在本机</span></div>';

    html += '<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">'
      + kpiCard('商机总数', board.summary.total)
      + kpiCard('有效商机', board.summary.valid)
      + kpiCard('已成交', board.summary.won)
      + kpiCard('成交预估毛利', M.fmtMoney(board.summary.wonProfit))
      + '</div>';

    // 按人综合考核
    html += '<div class="panel"><h3>四角色考核（按人综合）<span class="hint">一人兼多角分别计分 · 成交毛利为预估口径</span></h3>';
    if (!board.rows.length) html += '<div class="empty">暂无人员</div>';
    else {
      html += '<table><thead><tr>'
        + '<th>人员</th>'
        + '<th class="num">机会导入·有效商机</th>'
        + '<th class="num">主销售·意向达成率</th>'
        + '<th class="num">销售2·成交转化率</th>'
        + '<th class="num">销售2·成交毛利</th>'
        + '<th class="num">项目助理·交付完成率</th>'
        + '<th class="num">参与商机</th>'
        + '</tr></thead><tbody>'
        + board.rows.map((r) => '<tr>'
          + '<td>' + M.esc(r.name) + '</td>'
          + '<td class="num">' + (r.importerTotal ? r.importerValid + ' / ' + r.importerTotal : '—') + '</td>'
          + '<td class="num">' + rate(r.mainIntentRate) + '</td>'
          + '<td class="num">' + rate(r.sales2ConvRate) + '</td>'
          + '<td class="num">' + (r.sales2WonProfit ? M.fmtMoney(r.sales2WonProfit) : '—') + '</td>'
          + '<td class="num">' + rate(r.assistantDoneRate) + '</td>'
          + '<td class="num">' + r.total + '</td>'
          + '</tr>').join('')
        + '</tbody></table>';
    }
    html += '</div>';

    // 商机列表 + 阶段/类型过滤
    html += '<div class="panel"><h3>商机列表 <span class="hint">' + filtered.length + ' 条</span></h3>';
    html += '<div class="toolbar">'
      + '<span class="seg"><button class="' + (M.S.oppStage === 'all' ? 'active' : '') + '" onclick="CRM.monthly.setOppStage(\'all\')">全部</button>'
      + M.OPP_STAGES.map(([k, label]) => '<button class="' + (M.S.oppStage === k ? 'active' : '') + '" onclick="CRM.monthly.setOppStage(\'' + k + '\')">' + label + '</button>').join('')
      + '</span>'
      + '<select onchange="CRM.monthly.setOppType(this.value)">'
      + '<option value="all"' + (M.S.oppType === 'all' ? ' selected' : '') + '>全部类型</option>'
      + M.OPP_TYPES.map(([k, label]) => '<option value="' + k + '"' + (M.S.oppType === k ? ' selected' : '') + '>' + label + '</option>').join('')
      + '</select></div>';
    if (!filtered.length) html += '<div class="empty">暂无商机，点击右上「新增商机」录入</div>';
    else {
      html += '<table><thead><tr>'
        + '<th>客户</th><th>类型</th><th>机会导入者</th><th>主销售</th><th>销售2</th><th>项目助理</th>'
        + '<th>阶段</th><th class="num">预估毛利</th><th>有效</th><th>备注</th><th>操作</th>'
        + '</tr></thead><tbody>'
        + filtered.map((o) => '<tr>'
          + '<td>' + M.esc(o.customer) + '</td>'
          + '<td><span class="badge ' + M.oppTypeBadge(o.type) + '">' + M.oppTypeLabel(o.type) + '</span></td>'
          + '<td>' + person(o.importer) + '</td>'
          + '<td>' + person(o.main) + '</td>'
          + '<td>' + person(o.sales2) + '</td>'
          + '<td>' + person(o.assistant) + '</td>'
          + '<td>' + M.oppStageCell(o.stage) + '</td>'
          + '<td class="num">' + (o.estProfit ? M.fmtMoney(o.estProfit) : '—') + '</td>'
          + '<td>' + (o.valid ? '<span class="badge good">有效</span>' : '<span class="badge muted">待确认</span>') + '</td>'
          + '<td class="muted">' + M.esc(o.note || '') + '</td>'
          + '<td><button class="btn" onclick="CRM.monthly.oppProceed(\'' + o.id + '\')">推进</button> '
          + '<button class="btn" onclick="CRM.monthly.oppEdit(\'' + o.id + '\')">编辑</button> '
          + '<button class="btn" onclick="CRM.monthly.oppDelete(\'' + o.id + '\')">删除</button></td>'
          + '</tr>').join('')
        + '</tbody></table>';
    }
    html += '</div>';

    html += opportunityRadar();
    return html;
  }
  M.renderOpportunities = renderOpportunities;

  /** 商机雷达：从月度数据自动推导的潜在机会信号（折叠区） */
  function opportunityRadar() {
    const last3 = M.MONTHS.slice(-3);
    const prev3 = M.MONTHS.slice(-6, -3);
    const last3Set = new Set(last3);
    const prev3Set = new Set(prev3);
    const volLabel = M.prof().volumeLabel;
    const p = M.prof();

    const items = [];
    for (const name of M.custSeries.keys()) {
      const map = M.custSeries.get(name);
      let cumVol = 0, cumProfit = 0, volLast3 = 0, volPrev3 = 0;
      for (const [m, rec] of map) {
        const v = M.volOf(rec);
        if (v != null) {
          cumVol += v;
          if (last3Set.has(m)) volLast3 += v;
          if (prev3Set.has(m)) volPrev3 += v;
        }
        if (rec.profit != null) cumProfit += rec.profit;
      }
      const st = M.followStatus(name);
      items.push({
        name, cumVol, cumProfit, volLast3, volPrev3,
        firstMonth: M.custMonths.get(name)[0],
        gap: st ? st.gap : 999, last: st ? st.last : '—',
        ro: M.roleMap[name] || null,
      });
    }
    const newCusts = items.filter((x) => last3Set.has(x.firstMonth)).sort((a, b) => b.cumVol - a.cumVol);
    const growth = items.filter((x) => x.volPrev3 > 0 && x.volLast3 >= p.growthFloor && x.volLast3 > x.volPrev3 * 1.2)
      .sort((a, b) => (b.volLast3 - b.volPrev3) - (a.volLast3 - a.volPrev3));
    const dormant = items.filter((x) => x.gap >= 3 && x.cumVol >= p.dormantMinVol).sort((a, b) => b.cumVol - a.cumVol);
    const keyAccts = items.slice().sort((a, b) => b.cumProfit - a.cumProfit).slice(0, 20);

    const mainOf = (ro) => ro && ro.main ? M.esc(ro.main) : '<span class="muted">—</span>';
    const num = (v, d) => '<td class="num">' + M.fmtNum(v, d) + '</td>';
    const money = (v) => '<td class="num">' + M.fmtMoney(v) + '</td>';
    const link = (r) => '<td><a class="cust-name" data-name="' + M.esc(r.name) + '" href="javascript:void(0)">' + M.esc(r.name) + '</a></td>';
    function table(title, hint, rows, cols) {
      let h = '<div class="panel"><h3>' + title + ' <span class="hint">' + hint + '</span></h3>';
      if (!rows.length) return h + '<div class="empty">暂无</div></div>';
      h += '<table><thead><tr>' + cols.map((c) => c.th).join('') + '</tr></thead><tbody>'
        + rows.map((r, i) => '<tr>' + cols.map((c) => c.td(r, i)).join('') + '</tr>').join('')
        + '</tbody></table></div>';
      return h;
    }

    let h = '<details class="radar" open><summary>商机雷达 · 自动发现的潜在商机（新客户 / 增长 / 沉睡唤醒 / 深耕大客户）</summary>';
    h += '<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">'
      + '<div class="kpi"><div class="label">新增客户（近3月首单）</div><div class="value">' + newCusts.length + '</div></div>'
      + '<div class="kpi"><div class="label">增长客户（近3月↑20%）</div><div class="value">' + growth.length + '</div></div>'
      + '<div class="kpi"><div class="label">沉睡唤醒（可挽回）</div><div class="value">' + dormant.length + '</div></div>'
      + '<div class="kpi"><div class="label">深耕大客户（Top 20）</div><div class="value">' + keyAccts.length + '</div></div>'
      + '</div>';
    h += table('新增客户（新商机）', '近3月首次出货，按累计' + volLabel + '排序', newCusts, [
      { th: '<th>#</th>', td: (r, i) => '<td class="muted">' + (i + 1) + '</td>' },
      { th: '<th>客户</th>', td: link },
      { th: '<th>首次出货</th>', td: (r) => '<td>' + r.firstMonth + '</td>' },
      { th: '<th class="num">累计' + volLabel + '</th>', td: (r) => num(r.cumVol, 1) },
      { th: '<th class="num">累计利润</th>', td: (r) => money(r.cumProfit) },
      { th: '<th>主销售</th>', td: (r) => '<td>' + mainOf(r.ro) + '</td>' },
    ]);
    h += table('增长客户（扩展商机）', '近3月' + volLabel + '较前3月上升≥20%', growth, [
      { th: '<th>#</th>', td: (r, i) => '<td class="muted">' + (i + 1) + '</td>' },
      { th: '<th>客户</th>', td: link },
      { th: '<th class="num">前3月' + volLabel + '</th>', td: (r) => num(r.volPrev3, 1) },
      { th: '<th class="num">近3月' + volLabel + '</th>', td: (r) => num(r.volLast3, 1) },
      { th: '<th class="num">增幅</th>', td: (r) => '<td class="num">' + M.pctHtml(r.volPrev3 > 0 ? (r.volLast3 - r.volPrev3) / r.volPrev3 : null) + '</td>' },
      { th: '<th class="num">累计利润</th>', td: (r) => money(r.cumProfit) },
      { th: '<th>主销售</th>', td: (r) => '<td>' + mainOf(r.ro) + '</td>' },
    ]);
    h += table('沉睡唤醒（可挽回）', '沉睡≥3月且累计' + volLabel + '≥' + p.dormantMinVol + '，优先回访', dormant, [
      { th: '<th>#</th>', td: (r, i) => '<td class="muted">' + (i + 1) + '</td>' },
      { th: '<th>客户</th>', td: link },
      { th: '<th>最近出货</th>', td: (r) => '<td>' + r.last + '</td>' },
      { th: '<th class="num">沉睡月数</th>', td: (r) => num(r.gap, 0) },
      { th: '<th class="num">累计' + volLabel + '</th>', td: (r) => num(r.cumVol, 1) },
      { th: '<th>主销售</th>', td: (r) => '<td>' + mainOf(r.ro) + '</td>' },
    ]);
    h += table('深耕大客户（Top 20）', '按累计利润排序，重点维护', keyAccts, [
      { th: '<th>#</th>', td: (r, i) => '<td class="muted">' + (i + 1) + '</td>' },
      { th: '<th>客户</th>', td: link },
      { th: '<th class="num">累计' + volLabel + '</th>', td: (r) => num(r.cumVol, 1) },
      { th: '<th class="num">累计利润</th>', td: (r) => money(r.cumProfit) },
      { th: '<th>主销售</th>', td: (r) => '<td>' + mainOf(r.ro) + '</td>' },
    ]);
    h += '</details>';
    return h;
  }
  M.opportunityRadar = opportunityRadar;
})();
