/**
 * state.js — 共享可变状态（索引 + 视图状态）的声明，以及视图状态 get/set 方法
 *
 * 可变索引/状态由 buildIndexes()（main.js）与 storage.js 初始化填充；
 * 此处仅声明容器与初始值，所有读写均通过 M.xxx 动态访问。
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  /* ============================================================
   * 可变索引/状态（按当前业务线构建，切换业务线时重建）
   * ========================================================== */
  M.monthMap = new Map();
  M.MONTHS = [];
  M.weeksByMonth = new Map();
  M.supplierMonths = [];
  M.custMonths = new Map();
  M.custSeries = new Map();
  M.healthScores = new Map();
  M.roleMap = {};
  M.roleChanges = {};
  M.opportunities = [];
  M.settings = null; // storage.js 里初始化为 loadSettings()

  /* ============================================================
   * 视图状态 get/set 方法
   * ========================================================== */
  M.setView = function (view) { M.S.view = view; M.render(); window.scrollTo(0, 0); };
  M.setMetric = function (m) { M.S.metric = m; M.render(); };
  M.setRangeFrom = function (m) {
    M.S.rangeFrom = m;
    const to = M.S.rangeTo || (M.COMBINED_MONTHS[M.COMBINED_MONTHS.length - 1] || '');
    if (m && to && m > to) M.S.rangeTo = m; // 起始晚于结束 → 结束跟随，避免空区间
    M.render();
  };
  M.setRangeTo = function (m) {
    M.S.rangeTo = m;
    const from = M.S.rangeFrom || (M.COMBINED_MONTHS[0] || '');
    if (m && from && m < from) M.S.rangeFrom = m; // 结束早于起始 → 起始跟随
    M.render();
  };
  M.setCustFrom = function (m) { M.S.custFrom = m; M.S.custExpand = false; M.render(); };
  M.setCustTo = function (m) { M.S.custTo = m; M.S.custExpand = false; M.render(); };
  M.setCustRole = function (r) { M.S.custRole = r; M.S.custPerson = 'all'; M.S.custExpand = false; M.render(); };
  M.setCustPerson = function (p) { M.S.custPerson = p; M.S.custExpand = false; M.render(); };
  M.toggleCustExpand = function () { M.S.custExpand = !M.S.custExpand; M.render(); };
  M.setSupMonth = function (m) { M.S.supMonth = m; M.render(); };
  M.setSupMetric = function (m) { M.S.supMetric = m; M.render(); };
  M.setWeekMonth = function (m) { M.S.weekMonth = m; M.render(); };
  M.setWorkRole = function (k) { M.S.workRole = k; M.render(); };
  M.setWorkFrom = function (m) { M.S.workFrom = m; M.render(); };
  M.setWorkTo = function (m) { M.S.workTo = m; M.render(); };
  M.setOppStage = function (v) { M.S.oppStage = v; M.render(); };
  M.setOppType = function (v) { M.S.oppType = v; M.render(); };

  /** 切换业务线（电商 ec / 传统 trad），重建索引并重渲染 */
  M.setLine = function (line) {
    if (!M.SEEDS[line]) line = 'ec';
    M.LINE = line;
    M.SEED = M.SEEDS[line];
    try { localStorage.setItem(M.LINE_KEY, line); } catch (e) {}
    M.normalizeAlertThresholds();
    M.buildIndexes();
    // 重置受业务线影响的筛选状态
    if (!M.prof().trendMetrics.includes(M.S.metric)) M.S.metric = 'profit';
    M.S.supMonth = 'all';
    M.S.supMetric = M.prof().hasCbm ? 'cbm' : 'tickets';
    M.S.custPerson = 'all'; // 人名按业务线隔离，切线后清除人名筛选
    M.S.weekMonth = M.prof().hasWeeks && M.MONTHS.length ? M.MONTHS[M.MONTHS.length - 1] : '';
    if (!M.prof().hasWeeks && (M.S.view === 'suppliers' || M.S.view === 'weeks')) M.S.view = 'dashboard';
    M.render();
  };

  /* ============================================================
   * 视图状态持久化：进出客户详情页 / 刷新后保持视图与筛选选择
   * ========================================================== */
  M.saveState = function () {
    try { localStorage.setItem(M.STATE_KEY, JSON.stringify(M.S)); } catch (e) { /* 忽略 */ }
  };

  M.restoreState = function () {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(M.STATE_KEY) || 'null'); } catch (e) { /* 忽略 */ }
    if (!s || typeof s !== 'object') return;
    const p = M.prof();
    const str = (v, d) => (typeof v === 'string' ? v : d);
    M.S.view = ['dashboard', 'customers', 'suppliers', 'weeks', 'opportunities', 'alerts', 'workload', 'settings'].includes(s.view) ? s.view : 'dashboard';
    if (!p.hasSuppliers && M.S.view === 'suppliers') M.S.view = 'dashboard';
    if (!p.hasWeeks && M.S.view === 'weeks') M.S.view = 'dashboard';
    M.S.metric = p.trendMetrics.includes(s.metric) ? s.metric : 'profit';
    M.S.rangeFrom = str(s.rangeFrom, '');
    M.S.rangeTo = str(s.rangeTo, '');
    M.S.custFrom = str(s.custFrom, '');
    M.S.custTo = str(s.custTo, '');
    M.S.custRole = ['main', 'sales2', 'assistant', 'importer'].includes(s.custRole) ? s.custRole : 'main';
    M.S.custPerson = str(s.custPerson, 'all');
    M.S.custExpand = !!s.custExpand;
    M.S.supMonth = str(s.supMonth, 'all');
    const supValid = p.hasCbm ? ['cbm', 'tickets'] : ['tickets'];
    M.S.supMetric = supValid.includes(s.supMetric) ? s.supMetric : supValid[0];
    M.S.weekMonth = str(s.weekMonth, '');
    M.S.workRole = ['main', 'sales2', 'assistant', 'importer'].includes(s.workRole) ? s.workRole : 'main';
    M.S.workFrom = str(s.workFrom, '');
    M.S.workTo = str(s.workTo, '');
    M.S.oppStage = str(s.oppStage, 'all');
    M.S.oppType = str(s.oppType, 'all');
  };
})();
