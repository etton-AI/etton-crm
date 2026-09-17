/**
 * health.js — 客户健康分（月度口径，权重可配）、活跃度/跟进状态、
 * 客户趋势序列，以及商机预警（沉睡 / 同比下滑）。
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  M.healthLevel = function (score) {
    if (score >= 80) return { key: 'good', label: '优' };
    if (score >= 60) return { key: 'info', label: '良' };
    if (score >= 40) return { key: 'watch', label: '关注' };
    return { key: 'risk', label: '危险' };
  };

  M.healthBadge = function (h) {
    if (!h) return '<span class="muted">—</span>';
    const tip = h.parts.map((p) => p.label + ' ' + p.score).join(' · ');
    return '<span class="badge ' + h.level.key + '" title="' + tip + '">' + h.total + ' ' + h.level.label + '</span>';
  };

  M.followStatus = function (name) {
    const arr = M.custMonths.get(name);
    if (!arr || !arr.length) return null;
    const latest = M.MONTHS[M.MONTHS.length - 1];
    return { last: arr[arr.length - 1], months: arr.length, gap: M.monthGap(arr[arr.length - 1], latest) };
  };

  M.followBadge = function (st) {
    if (!st) return '<span class="muted">—</span>';
    let cls, label;
    if (st.gap === 0) { cls = 'good'; label = '正常'; }
    else if (st.gap === 1) { cls = 'watch'; label = '关注'; }
    else if (st.gap <= 3) { cls = 'risk'; label = '需跟进'; }
    else { cls = 'risk'; label = '沉睡'; }
    return '<span class="badge ' + cls + '" title="最近出货 ' + st.last + ' · 累计 ' + st.months + ' 个月有出货">' + label + '</span>';
  };

  M.computeHealthScores = function (w) {
    const map = new Map();
    const windowMonths = M.MONTHS.slice(-13);
    const half = Math.floor(windowMonths.length / 2);

    // 全体客户 13 个月窗口累计「体积」指标（电商=CBM，传统=票数），用于贡献百分位
    const contribs = [];
    for (const name of M.custSeries.keys()) {
      let s = 0;
      for (const m of windowMonths) {
        const v = M.volOf(M.custSeries.get(name).get(m));
        if (v != null) s += v;
      }
      contribs.push({ name, vol: s });
    }
    contribs.sort((a, b) => a.vol - b.vol);
    const n = contribs.length, maxVol = n ? contribs[n - 1].vol : 0;

    for (const { name, vol } of contribs) {
      // 贡献：13 个月累计体积百分位（0~1）
      let le = 0;
      for (const x of contribs) if (x.vol <= vol) le++;
      const contribRatio = maxVol > 0 ? le / n : 0;

      // 活跃度：最近出货距最新月 gap（0~1）
      const st = M.followStatus(name);
      const gap = st ? st.gap : 999;
      const activeRatio = gap === 0 ? 1 : gap === 1 ? 0.6 : gap === 2 ? 0.35 : gap === 3 ? 0.2 : 0;

      // 趋势：13 个月窗口后半 vs 前半体积增幅（0~1）
      let h1 = 0, h2 = 0;
      windowMonths.forEach((m, i) => {
        const v = M.volOf(M.custSeries.get(name).get(m)) || 0;
        if (i < half) h1 += v; else h2 += v;
      });
      let trendRatio;
      if (h1 <= 0) trendRatio = h2 > 0 ? 1 : 0.5;
      else {
        const g = (h2 - h1) / h1;
        if (g >= 0.3) trendRatio = 1;
        else if (g <= -0.3) trendRatio = 0;
        else trendRatio = 0.5 + g / 0.6;
      }

      const total = Math.round((activeRatio * w.activity + trendRatio * w.trend + contribRatio * w.contribution) * 10) / 10;
      map.set(name, {
        total, level: M.healthLevel(total),
        parts: [
          { key: 'active', label: '活跃度', score: Math.round(activeRatio * w.activity) },
          { key: 'trend', label: '趋势', score: Math.round(trendRatio * w.trend) },
          { key: 'contrib', label: '贡献', score: Math.round(contribRatio * w.contribution) },
        ],
      });
    }
    return map;
  };

  /** 客户过去 13 个月「体积」(CBM/票数) / 利润 序列（缺月补 0），用于弹窗趋势图 */
  M.customerTrend = function (name) {
    const months = M.MONTHS.slice(-13);
    const map = M.custSeries.get(name) || new Map();
    const volSeries = { name: M.prof().volumeLabel, color: '#0090D8', values: new Map() };
    const profitSeries = { name: '利润', color: '#F07800', values: new Map() };
    for (const m of months) {
      const rec = map.get(m);
      volSeries.values.set(m, M.volOf(rec) || 0);
      profitSeries.values.set(m, rec && rec.profit != null ? rec.profit : 0);
    }
    return { months, volSeries, profitSeries };
  };

  /** 客户某年 1-9 月同期累计体积（同比下滑预警用） */
  M.sumCustYtd = function (name, year) {
    let s = 0;
    const map = M.custSeries.get(name);
    if (!map) return 0;
    for (const [m, rec] of map) {
      if (!m.startsWith(year)) continue;
      if (parseInt(m.slice(5, 7), 10) > 9) continue; // 只比 1-9 月同期
      const v = M.volOf(rec);
      if (v != null) s += v;
    }
    return s;
  };

  /** 商机预警（月度口径） */
  M.runAlerts = function () {
    const cfg = M.settings.alerts;
    const volLabel = M.prof().volumeLabel;
    const alerts = [];
    for (const name of M.custSeries.keys()) {
      const map = M.custSeries.get(name);
      let totalVol = 0;
      for (const rec of map.values()) {
        const v = M.volOf(rec);
        if (v != null) totalVol += v;
      }
      const st = M.followStatus(name);
      if (!st) continue;

      // 沉睡预警：gap >= 阈值 且累计体积达到降噪线
      if (cfg.dormant.enabled && st.gap >= cfg.dormant.gapMonths && totalVol >= cfg.dormant.minCbm) {
        alerts.push({
          level: st.gap >= 6 ? 'high' : 'medium', rule: 'dormant', label: '沉睡预警', name,
          detail: '已 ' + st.gap + ' 个月未出货（最近 ' + st.last + '）· 累计 ' + M.fmtNum(totalVol, 1) + ' ' + volLabel,
        });
      }

      // 同比下滑：2026 YTD < 2025 同期 × (1 - dropPct)
      if (cfg.yoyDrop.enabled) {
        const y25 = M.sumCustYtd(name, '2025');
        const y26 = M.sumCustYtd(name, '2026');
        if (y25 >= cfg.yoyDrop.minBaseCbm && y26 < y25 * (1 - cfg.yoyDrop.dropPct / 100)) {
          alerts.push({
            level: 'high', rule: 'yoyDrop', label: '同比下滑', name,
            detail: '2026 累计 ' + M.fmtNum(y26, 1) + ' vs 2025 同期 ' + M.fmtNum(y25, 1) + ' ' + volLabel + '（下滑 ' + Math.round((1 - y26 / y25) * 100) + '%）',
          });
        }
      }
    }
    alerts.sort((a, b) => ((a.level === 'high' ? 0 : 1) - (b.level === 'high' ? 0 : 1)) || a.name.localeCompare(b.name));
    return alerts;
  };
})();
