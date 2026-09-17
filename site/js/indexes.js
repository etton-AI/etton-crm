/**
 * indexes.js — 数据索引构建（monthly.html 与 customer.html 共用）
 * 按当前业务线 M.LINE / M.SEED 构建：monthMap / MONTHS / weeksByMonth /
 * supplierMonths / custMonths / custSeries，并加载角色、商机、健康分。
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  M.buildIndexes = function () {
    M.monthMap = new Map();
    for (const m of (M.SEED.months || [])) M.monthMap.set(m.month, m);
    M.MONTHS = Array.from(M.monthMap.keys()).sort();

    M.weeksByMonth = new Map();
    for (const w of (M.SEED.weeks || [])) {
      if (!M.weeksByMonth.has(w.month)) M.weeksByMonth.set(w.month, []);
      M.weeksByMonth.get(w.month).push(w);
    }

    M.supplierMonths = Array.from(new Set((M.SEED.suppliers || []).map((s) => s.month))).sort();

    // 客户名 → 有出货的月份（升序）；客户名 → Map<month, {cbm, tickets, profit, main}>
    M.custMonths = new Map();
    M.custSeries = new Map();
    for (const c of (M.SEED.customers || [])) {
      if (!M.custMonths.has(c.name)) { M.custMonths.set(c.name, []); M.custSeries.set(c.name, new Map()); }
      M.custMonths.get(c.name).push(c.month);
      M.custSeries.get(c.name).set(c.month, { cbm: c.cbm, tickets: c.tickets, profit: c.profit, main: c.main });
    }
    for (const arr of M.custMonths.values()) arr.sort();

    M.roleMap = M.loadRoles();
    M.roleChanges = M.loadRoleChanges();
    M.opportunities = M.loadOpportunities();
    M.healthScores = M.computeHealthScores(M.settings.healthWeights);
  };
})();
