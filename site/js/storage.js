/**
 * storage.js — 所有 localStorage 读写（设置 / 四角色 / 角色变更历史 / 商机）
 *
 * 覆盖层模式：SEED 只读为基准，页面内编辑写 localStorage；
 * 读时用 localStorage 覆盖 SEED 默认值；损坏的 JSON 静默忽略并回退。
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  /* ============================================================
   * 设置（localStorage 覆盖层）
   * ========================================================== */
  M.loadSettings = function () {
    try {
      const s = JSON.parse(localStorage.getItem(M.SETTINGS_KEY) || 'null');
      if (s && typeof s === 'object') {
        return {
          healthWeights: Object.assign({}, M.DEFAULT_SETTINGS.healthWeights, s.healthWeights),
          alerts: {
            dormant: Object.assign({}, M.DEFAULT_SETTINGS.alerts.dormant, s.alerts && s.alerts.dormant),
            yoyDrop: Object.assign({}, M.DEFAULT_SETTINGS.alerts.yoyDrop, s.alerts && s.alerts.yoyDrop),
          },
        };
      }
    } catch (e) { /* 忽略损坏的本地设置 */ }
    return JSON.parse(JSON.stringify(M.DEFAULT_SETTINGS));
  };

  M.persistSettings = function () {
    try { localStorage.setItem(M.SETTINGS_KEY, JSON.stringify(M.settings)); } catch (e) {}
  };

  /** 切换业务线后：把体积阈值重置为新线默认（仅当当前值仍是另一线默认值时，避免覆盖用户自定义值） */
  M.normalizeAlertThresholds = function () {
    const p = M.prof();
    const other = M.LINE_PROFILE[M.LINE === 'ec' ? 'trad' : 'ec'];
    if (M.settings.alerts.dormant.minCbm === other.dormantMinVol) M.settings.alerts.dormant.minCbm = p.dormantMinVol;
    if (M.settings.alerts.yoyDrop.minBaseCbm === other.yoyMinBase) M.settings.alerts.yoyDrop.minBaseCbm = p.yoyMinBase;
  };

  /* ============================================================
   * 四角色存储层（角色覆盖层按业务线隔离）
   * ========================================================== */
  M.roleStoreKey = function () { return 'crm-monthly-roles-' + M.LINE; };

  M.loadRoles = function () {
    const base = M.SEED.roles || {};
    try {
      const saved = JSON.parse(localStorage.getItem(M.roleStoreKey()) || '{}');
      if (saved && typeof saved === 'object') return Object.assign({}, base, saved);
    } catch (e) { /* 忽略损坏的本地数据 */ }
    return Object.assign({}, base);
  };

  M.saveRole = function (name, role) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(M.roleStoreKey()) || '{}') || {}; } catch (e) {}
    saved[name] = role;
    try { localStorage.setItem(M.roleStoreKey(), JSON.stringify(saved)); } catch (e) {}
    M.roleMap[name] = role;
    // 基准角色变了 → 重新合并默认变更（丢弃与现状矛盾的默认，如「TINA 接手」）
    M.roleChanges = M.loadRoleChanges();
  };

  /* ============================================================
   * 角色变更历史（按生效月取数）
   * roleChanges[客户名][角色] = [{ month, before, after }]
   * ========================================================== */
  M.roleChangesKey = function () { return 'crm-monthly-role-changes-' + M.LINE; };

  M.loadRoleChanges = function () {
    let overlay = {};
    try {
      const s = localStorage.getItem(M.roleChangesKey());
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === 'object') overlay = parsed;
      }
    } catch (e) { /* 忽略 */ }
    // seed 默认变更 + localStorage 覆盖（按 客户名.角色 覆盖，用户手录优先）
    const def = M.SEED.defaultRoleChanges || {};
    const out = {};
    for (const n of new Set([...Object.keys(def), ...Object.keys(overlay)])) {
      const d = def[n] || {}, o = overlay[n] || {};
      out[n] = {};
      for (const k of new Set([...Object.keys(d), ...Object.keys(o)])) {
        if (o[k] !== undefined) { out[n][k] = o[k]; continue; }
        // 默认变更（如「项目助理 2026-08 起由 TINA 接手」）只在当前基准角色仍等于其 after 时生效；
        // 用户已改过该角色基准值（如把 TINA 改成 JAYCE）时，默认变更与现状矛盾，丢弃，避免覆盖用户修改。
        const dc = d[k];
        if (dc && dc.length) {
          const sorted = dc.slice().sort((a, b) => a.month.localeCompare(b.month));
          const baseVal = ((M.roleMap || {})[n] || {})[k] || '';
          out[n][k] = (baseVal === sorted[sorted.length - 1].after) ? dc : [];
        }
      }
    }
    return out;
  };

  M.saveRoleChanges = function () {
    try { localStorage.setItem(M.roleChangesKey(), JSON.stringify(M.roleChanges)); } catch (e) {}
  };

  M.addRoleChange = function (name, roleKey, month, before, after) {
    if (!name || !roleKey || !month) return;
    M.roleChanges[name] = M.roleChanges[name] || {};
    M.roleChanges[name][roleKey] = M.roleChanges[name][roleKey] || [];
    const list = M.roleChanges[name][roleKey].filter((c) => c.month !== month);
    list.push({ month, before: before || '', after: after || '' });
    list.sort((a, b) => a.month.localeCompare(b.month));
    M.roleChanges[name][roleKey] = list;
    M.saveRoleChanges();
  };

  M.removeRoleChange = function (name, roleKey, month) {
    if (!M.roleChanges[name] || !M.roleChanges[name][roleKey]) return;
    M.roleChanges[name][roleKey] = M.roleChanges[name][roleKey].filter((c) => c.month !== month);
    if (!M.roleChanges[name][roleKey].length) delete M.roleChanges[name][roleKey];
    if (M.roleChanges[name] && !Object.keys(M.roleChanges[name]).length) delete M.roleChanges[name];
    M.saveRoleChanges();
  };

  /* ============================================================
   * 商机存储层（按业务线隔离）
   * ========================================================== */
  M.oppStoreKey = function () { return 'crm-monthly-opportunities-' + M.LINE; };

  M.loadOpportunities = function () {
    try {
      const arr = JSON.parse(localStorage.getItem(M.oppStoreKey()) || '[]');
      if (Array.isArray(arr)) return arr;
    } catch (e) { /* 忽略损坏的本地数据 */ }
    return [];
  };

  M.saveOpportunities = function () {
    try { localStorage.setItem(M.oppStoreKey(), JSON.stringify(M.opportunities)); } catch (e) {}
  };

  M.addOpportunity = function (rec) { M.opportunities.push(rec); M.saveOpportunities(); };

  M.updateOpportunity = function (rec) {
    const i = M.opportunities.findIndex((x) => x.id === rec.id);
    if (i >= 0) M.opportunities[i] = rec; else M.opportunities.push(rec);
    M.saveOpportunities();
  };

  M.deleteOpportunity = function (id) {
    M.opportunities = M.opportunities.filter((x) => x.id !== id);
    M.saveOpportunities();
  };

  /* ============================================================
   * 跟进记录（活动记录，按 业务线 + 客户 隔离）
   * key = 'crm-monthly-activities-' + LINE + '-' + encodeURIComponent(name)
   * 结构：[{ id, date, user, type, content, createdAt }]
   * ========================================================== */
  M.ACT_TYPES = ['电话', '拜访', '邮件', '其他'];

  M.actStoreKey = function (name) {
    return 'crm-monthly-activities-' + M.LINE + '-' + encodeURIComponent(name);
  };

  M.loadActivities = function (name) {
    try {
      const arr = JSON.parse(localStorage.getItem(M.actStoreKey(name)) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) { /* 忽略损坏的本地数据 */ }
    return [];
  };

  M.saveActivities = function (name, arr) {
    try { localStorage.setItem(M.actStoreKey(name), JSON.stringify(arr)); } catch (e) {}
  };

  M.addActivity = function (name, rec) {
    const arr = M.loadActivities(name);
    arr.push(rec);
    arr.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    M.saveActivities(name, arr);
    return arr;
  };

  M.deleteActivity = function (name, id) {
    const arr = M.loadActivities(name).filter((x) => x.id !== id);
    M.saveActivities(name, arr);
    return arr;
  };

  /** 某客户最近一条跟进记录日期（YYYY-MM-DD），无记录返回 '' */
  M.latestActivityDate = function (name) {
    const arr = M.loadActivities(name);
    let latest = '';
    for (const a of arr) if (a.date && a.date > latest) latest = a.date;
    return latest;
  };

  /* —— 初始化 settings —— */
  M.settings = M.loadSettings();
})();
