/**
 * config.js — 常量与工具（月度经营报表，命名空间 window.CRM.monthly，简称 M）
 *
 * 承载：业务线配置、合并口径、LINE/SEED 初始化、状态对象 S、
 * 工具函数（esc / fmtMoney / fmtNum / lineChart 等）、四角色/商机/设置常量。
 */
(function () {
  'use strict';

  const M = ((window.CRM = window.CRM || {}).monthly = window.CRM.monthly || {});

  /* ============================================================
   * 业务线（ec 电商 / trad 传统）
   * ========================================================== */
  M.LINE_KEY = 'crm-monthly-line';
  M.SEEDS = {
    ec: window.CRM_MONTHLY_SEED || {},
    trad: window.CRM_MONTHLY_SEED_TRAD || {},
  };
  // 各业务线的指标配置；传统线把「CBM」等体积口径换成「票数」口径
  M.LINE_PROFILE = {
    ec: {
      label: '跨境电商', hasCbm: true, hasBoxes: true, hasSuppliers: true, hasWeeks: true,
      volumeKey: 'cbm', volumeLabel: 'CBM', sortBy: 'vol',
      trendMetrics: ['profit', 'cbm', 'tickets', 'boxes'],
      dormantMinVol: 10, growthFloor: 5, yoyMinBase: 20,
    },
    trad: {
      label: '传统', hasCbm: false, hasBoxes: false, hasSuppliers: false, hasWeeks: false,
      volumeKey: 'tickets', volumeLabel: '票数', sortBy: 'profit',
      trendMetrics: ['profit', 'tickets'],
      dormantMinVol: 3, growthFloor: 2, yoyMinBase: 5,
    },
  };

  /* ============================================================
   * 合并口径（经营看板：传统 + 电商一起展示，参考原始 CRM 看板「全部」）
   * ========================================================== */
  M.LINE_COLORS = { ec: '#0090D8', trad: '#004890', all: '#64748b' };
  M.ALL_LINES = ['trad', 'ec']; // 传统在前，与原始 CRM 看板双折线顺序一致

  function seedMonthMap(line) {
    const m = new Map();
    for (const x of (M.SEEDS[line].months || [])) m.set(x.month, x);
    return m;
  }
  M.LINE_MONTH_MAPS = { ec: seedMonthMap('ec'), trad: seedMonthMap('trad') };
  M.COMBINED_MONTHS = Array.from(new Set([
    ...Array.from(M.LINE_MONTH_MAPS.trad.keys()),
    ...Array.from(M.LINE_MONTH_MAPS.ec.keys()),
  ])).sort();

  /** 某月两条线的合计值（profit / tickets） */
  M.combinedVal = function (month, metric) {
    let s = 0;
    for (const line of M.ALL_LINES) {
      const rec = M.LINE_MONTH_MAPS[line].get(month);
      if (rec && rec[metric] != null) s += rec[metric];
    }
    return s;
  };

  /** 合计口径年度求和（同比用 maxMonths 限制到某月） */
  M.combinedYearSum = function (year, metric, maxMonths) {
    let s = 0;
    for (const m of M.COMBINED_MONTHS) {
      if (m.slice(0, 4) !== year) continue;
      if (maxMonths && parseInt(m.slice(5, 7), 10) > maxMonths) continue;
      s += M.combinedVal(m, metric);
    }
    return s;
  };

  /** 单线折线序列（仅取该线有数据的月份，缺月不连线） */
  M.lineSeries = function (line, metric) {
    const values = new Map();
    for (const [m, rec] of M.LINE_MONTH_MAPS[line]) {
      if (rec[metric] != null) values.set(m, rec[metric]);
    }
    return { name: M.LINE_PROFILE[line].label, color: M.LINE_COLORS[line], values };
  };

  /** 看板时间窗口内的合并月份（受右上角起始/结束筛选） */
  M.filteredCombinedMonths = function () {
    const from = M.S.rangeFrom || (M.COMBINED_MONTHS[0] || '');
    const to = M.S.rangeTo || (M.COMBINED_MONTHS[M.COMBINED_MONTHS.length - 1] || '');
    const a = from <= to ? from : to;
    const b = from <= to ? to : from;
    return M.COMBINED_MONTHS.filter((m) => m >= a && m <= b);
  };

  /** 某月在整个合并月份序列里的上一月（环比用，可跨出筛选窗口） */
  M.prevGlobalMonth = function (month) {
    const i = M.COMBINED_MONTHS.indexOf(month);
    return i > 0 ? M.COMBINED_MONTHS[i - 1] : null;
  };

  M.LINE = (localStorage.getItem(M.LINE_KEY) === 'trad') ? 'trad' : 'ec';
  M.SEED = M.SEEDS[M.LINE];
  M.prof = function () { return M.LINE_PROFILE[M.LINE]; };

  /** 当前页面是否为公网版（文件名含 -public），决定客户详情页/返回链接的目标，避免公网版跳回内网 seed */
  M.isPublic = function () { return /-public\.html$/i.test(window.location.pathname); };

  /* ============================================================
   * 状态
   * ========================================================== */
  M.S = {
    view: 'dashboard',   // dashboard | customers | suppliers | weeks | opportunities | alerts | workload | settings
    metric: 'profit',    // 看板趋势指标
    rangeFrom: '',       // 看板时间窗口起始月（''=最早）
    rangeTo: '',         // 看板时间窗口结束月（''=最新）
    custFrom: '',        // 客户排行起始月（''=最早）
    custTo: '',          // 客户排行结束月（''=最新）
    custRole: 'main',    // 客户排行角色筛选 main | sales2 | assistant | importer
    custPerson: 'all',   // 客户排行该角色下的人名筛选（'all'=全部）
    custExpand: false,   // 客户排行展开全部
    supMonth: 'all',     // 供应商排行月份
    supMetric: 'cbm',    // 供应商排行指标 cbm | tickets
    weekMonth: '',       // 周明细月份（默认最新）
    workRole: 'main',    // 人效角色维度 main | sales2 | assistant | importer
    workFrom: '',        // 人效起始月（''=最早）
    workTo: '',          // 人效结束月（''=最新）
    oppStage: 'all',     // 商机列表阶段过滤
    oppType: 'all',      // 商机列表类型过滤
  };

  /* ============================================================
   * 工具函数
   * ========================================================== */
  M.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  M.fmtMoney = function (v) {
    if (v == null || isNaN(v)) return '—';
    const n = Number(v), abs = Math.abs(n);
    if (abs >= 10000) return (n / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 }) + '万';
    return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  };

  M.fmtNum = function (v, digits) {
    if (v == null || isNaN(v)) return '—';
    return Number(v).toLocaleString('zh-CN', { maximumFractionDigits: digits == null ? 0 : digits });
  };

  M.fmtMonthShort = function (m) { return m.slice(0, 4) + '.' + parseInt(m.slice(5, 7), 10); };

  /** 涨跌百分比（frac 为小数，正=涨） */
  M.pctChange = function (cur, prev) {
    if (cur == null || prev == null || isNaN(cur) || isNaN(prev)) return null;
    if (prev === 0) return null;
    return (cur - prev) / prev;
  };

  M.pctHtml = function (frac) {
    if (frac == null || isNaN(frac)) return '<span class="flat">—</span>';
    const p = (frac * 100).toFixed(1);
    if (frac > 0.001) return '<span class="up">↑' + p + '%</span>';
    if (frac < -0.001) return '<span class="down">↓' + p + '%</span>';
    return '<span class="flat">0%</span>';
  };

  /** 内联 SVG 折线图（seriesList: [{name, color, values: Map<month, number>}]，支持负值） */
  M.lineChart = function (seriesList, months, height, showValues) {
    if (!months.length) return '<div class="empty">暂无数据</div>';
    const W = 820, H = height || 240, padL = 52, padR = 12, padT = 14, padB = 26;
    let maxVal = -Infinity, minVal = Infinity;
    for (const s of seriesList) for (const v of s.values.values()) {
      if (v > maxVal) maxVal = v;
      if (v < minVal) minVal = v;
    }
    if (!isFinite(maxVal)) { maxVal = 1; minVal = 0; }
    if (minVal > 0) minVal = 0;
    if (maxVal <= minVal) maxVal = minVal + 1;
    const span = maxVal - minVal;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const x = (i) => padL + (months.length === 1 ? innerW / 2 : (i * innerW) / (months.length - 1));
    const y = (v) => padT + innerH - ((v - minVal) / span) * innerH;

    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
    for (let g = 0; g <= 4; g++) {
      const gy = (padT + (innerH * g) / 4).toFixed(1);
      svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="#eef2f6"/>';
    }
    if (minVal < 0) {
      const y0 = y(0).toFixed(1);
      svg += '<line x1="' + padL + '" y1="' + y0 + '" x2="' + (W - padR) + '" y2="' + y0 + '" stroke="#d1d5db" stroke-dasharray="4,4"/>';
    }
    const step = Math.max(1, Math.ceil(months.length / 12));
    months.forEach((m, i) => {
      if (i % step === 0) {
        svg += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" font-size="10" fill="#9ca3af" text-anchor="middle">' + m.slice(2) + '</text>';
      }
    });
    for (const s of seriesList) {
      let path = '';
      s.values.forEach((v, m) => {
        const i = months.indexOf(m);
        if (i < 0) return;
        path += (path ? ' L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1);
      });
      if (path) svg += '<path d="' + path + '" fill="none" stroke="' + s.color + '" stroke-width="2.2" vector-effect="non-scaling-stroke"/>';
      if (showValues) {
        s.values.forEach((v, m) => {
          const i = months.indexOf(m);
          if (i < 0) return;
          const label = Math.abs(v) >= 10000 ? (v / 10000).toFixed(1) + '万' : String(Math.round(v * 10) / 10);
          svg += '<text x="' + x(i).toFixed(1) + '" y="' + (y(v) - 6).toFixed(1) + '" font-size="9" fill="' + s.color + '" text-anchor="middle">' + label + '</text>';
        });
      }
    }
    svg += '</svg>';
    const legend = seriesList.map((s) => '<span style="color:' + s.color + '">● ' + M.esc(s.name) + '</span>').join(' &nbsp; &nbsp; ');
    return '<div class="chart">' + svg + '</div><div style="font-size:12px;color:#6b7280;margin-top:4px">' + legend + '</div>';
  };

  M.monthGap = function (a, b) { // a、b 形如 '2025-12'，返回 b 比 a 晚多少个月
    const p = (s) => { const [y, m] = s.split('-').map(Number); return y * 12 + m; };
    return p(b) - p(a);
  };

  /** 当前业务线的「体积」指标（电商=CBM，传统=票数） */
  M.volOf = function (rec) {
    return rec == null ? undefined : rec[M.prof().volumeKey];
  };

  M.METRIC_LABELS = { profit: '利润', cbm: 'CBM', tickets: '票数', boxes: '箱数' };

  /* ============================================================
   * 四角色 / 商机 / 设置 常量
   * ========================================================== */
  M.ROLE_OPTIONS = [
    { key: 'main', label: '主销售' },
    { key: 'sales2', label: '销售2/项目经理' },
    { key: 'assistant', label: '项目助理' },
    { key: 'importer', label: '机会导入者' },
  ];
  M.ROLE_FIELDS = [
    ['importer', '机会导入者'],
    ['main', '主销售'],
    ['sales2', '销售2/项目经理'],
    ['assistant', '项目助理'],
  ];
  // 需要维护「起算时间」的角色（中途会换人；机会导入者/主销售不换人，无起算时间）
  M.TIME_ROLE_KEYS = ['sales2', 'assistant'];

  M.OPP_TYPES = [
    ['new_cust', '新客户新业务'],
    ['old_cust_new', '老客户新业务'],
    ['old_cust_repeat', '老客户复购'],
    ['referral', '转介绍'],
  ];
  // [key, 中文阶段, 当前责任角色 key]；closed 表示已完成闭环（反哺机会导入）
  M.OPP_STAGES = [
    ['import', '①机会导入', 'importer'],
    ['intent', '②意向确认', 'main'],
    ['quote', '③方案报价', 'sales2'],
    ['won', '④成交交付', 'assistant'],
    ['delivered', '⑤已交付', 'assistant'],
    ['closed', '⑥闭环', ''],
  ];
  M.OPP_WON = new Set(['won', 'delivered', 'closed']);           // 已成交及以后
  M.OPP_QUOTED = new Set(['quote', 'won', 'delivered', 'closed']); // 进入报价及以后
  M.OPP_DONE = new Set(['delivered', 'closed']);                 // 已交付/闭环

  M.SETTINGS_KEY = 'crm-monthly-settings';
  M.STATE_KEY = 'crm-monthly-state';
  M.DEFAULT_SETTINGS = {
    healthWeights: { activity: 40, trend: 30, contribution: 30 },
    alerts: {
      dormant: { enabled: true, gapMonths: 3, minCbm: M.LINE_PROFILE[M.LINE].dormantMinVol },
      yoyDrop: { enabled: true, dropPct: 30, minBaseCbm: M.LINE_PROFILE[M.LINE].yoyMinBase },
    },
  };
})();
