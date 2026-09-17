/**
 * main.js — 入口：视图分发渲染、事件绑定与初始化（数据索引见 indexes.js）。
 *
 * 命名空间 window.CRM.monthly（即各模块共享的 M）即为公开 API：
 *   render, setView, setMetric, setRangeFrom, setRangeTo, setLine,
 *   setCustFrom, setCustTo, setCustRole, setCustPerson, toggleCustExpand,
 *   setSupMonth, setSupMetric, setWeekMonth,
 *   setWorkRole, setWorkFrom, setWorkTo, saveSettings,
 *   oppAdd, oppEdit, oppProceed, oppDelete, setOppStage, setOppType
 * （各函数由对应模块挂载到 CRM.monthly 上，HTML onclick 直接调用 CRM.monthly.xxx。）
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  /* 数据索引构建见 js/indexes.js（monthly.html 与 customer.html 共用） */

  M.closeModal = function () {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    delete root.dataset.editing;
    delete root.dataset.opp;
  };

  /** 右上角「起始 / 结束」月份下拉：选项为合并月份序列，选中值跟随全局时间窗口 */
  M.renderRangeSelects = function () {
    const from = document.getElementById('range-from');
    const to = document.getElementById('range-to');
    if (!from || !to) return;
    const opts = M.COMBINED_MONTHS.map((m) => '<option value="' + m + '">' + M.fmtMonthShort(m) + '</option>').join('');
    if (from.innerHTML !== opts) from.innerHTML = opts;
    if (to.innerHTML !== opts) to.innerHTML = opts;
    from.value = M.S.rangeFrom || (M.COMBINED_MONTHS[0] || '');
    to.value = M.S.rangeTo || (M.COMBINED_MONTHS[M.COMBINED_MONTHS.length - 1] || '');
  };

  M.syncNav = function () {
    document.querySelectorAll('#nav button').forEach((b) => {
      const line = b.dataset.line;
      b.style.display = (line && line !== M.LINE) ? 'none' : '';
      b.classList.toggle('active', b.dataset.view === M.S.view);
    });
    // 业务线切换器高亮 + 顶栏徽章（看板为合并视图，明细视图按当前业务线）
    document.querySelectorAll('#line-switch button').forEach((b) => b.classList.toggle('active', b.dataset.line === M.LINE));
    const badge = document.getElementById('line-badge');
    const onDashboard = M.S.view === 'dashboard';
    if (badge) {
      if (onDashboard) { badge.textContent = '传统 + 电商'; badge.className = 'badge muted'; }
      else { badge.textContent = M.prof().label; badge.className = 'badge ' + (M.LINE === 'ec' ? 'ec' : 'trad'); }
    }
    M.renderRangeSelects();
  };

  M.render = function () {
    const el = document.getElementById('view');
    if (!el) return;
    let html = '';
    switch (M.S.view) {
      case 'dashboard': html = M.renderDashboard(); break;
      case 'customers': html = M.renderCustomerRank(); break;
      case 'suppliers': html = M.renderSupplierRank(); break;
      case 'weeks': html = M.renderWeeks(); break;
      case 'opportunities': html = M.renderOpportunities(); break;
      case 'alerts': html = M.renderAlerts(); break;
      case 'workload': html = M.renderWorkload(); break;
      case 'settings': html = M.renderSettings(); break;
      default: html = '<div class="empty">未知视图</div>';
    }
    el.innerHTML = html;
    M.syncNav();
    M.saveState();
  };

  M.bindEvents = function () {
    const nav = document.getElementById('nav');
    if (nav) nav.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-view]');
      if (b) M.setView(b.dataset.view);
    });

    const lineSwitch = document.getElementById('line-switch');
    if (lineSwitch) lineSwitch.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-line]');
      if (b) M.setLine(b.dataset.line);
    });

    // 右上角时间范围（起始 / 结束）
    const rangeFrom = document.getElementById('range-from');
    if (rangeFrom) rangeFrom.addEventListener('change', (e) => M.setRangeFrom(e.target.value));
    const rangeTo = document.getElementById('range-to');
    if (rangeTo) rangeTo.addEventListener('change', (e) => M.setRangeTo(e.target.value));

    // 客户排行：点击客户名 → 跳客户详情页（公网版跳 customer-public.html，避免回内网 seed）
    const view = document.getElementById('view');
    if (view) view.addEventListener('click', (e) => {
      const a = e.target.closest('.cust-name');
      if (a) window.location.href = (M.isPublic() ? 'customer-public.html' : 'customer.html') + '?name=' + encodeURIComponent(a.dataset.name) + '&line=' + M.LINE;
    });

    // 弹窗：保存 / 取消 / 关闭按钮；点击遮罩空白关闭，点击弹窗内部不关闭
    const modalRoot = document.getElementById('modal-root');
    if (modalRoot) modalRoot.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const a = btn.dataset.action;
        if (a === 'close' || a === 'cancel') M.closeModal();
        else if (a === 'save') M.saveRoleEdit();
        else if (a === 'opp-save') M.saveOpportunityEdit();
        else if (a === 'add-change') {
          const name = modalRoot.dataset.editing;
          const roleKey = modalRoot.querySelector('#rc-role').value;
          const month = modalRoot.querySelector('#rc-month').value;
          const before = modalRoot.querySelector('#rc-before').value.trim();
          const after = modalRoot.querySelector('#rc-after').value.trim();
          if (!after) { alert('请填写「变更后」，即该月起由谁担任。'); return; }
          if (!before) { alert('请填写「变更前」，即换人之前由谁担任（否则换人前的月份无法归属到人）。'); return; }
          M.addRoleChange(name, roleKey, month, before, after);
          M.openRoleEditor(name);  // 重新渲染，刷新变更列表
        } else if (a === 'del-change') {
          const name = modalRoot.dataset.editing;
          M.removeRoleChange(name, btn.dataset.role, btn.dataset.month);
          M.openRoleEditor(name);
        }
        return;
      }
      if (e.target.classList && e.target.classList.contains('modal-overlay')) M.closeModal();
    });

    // Esc 关闭弹窗
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') M.closeModal();
    });
  };

  /* —— 初始化：按已存业务线构建索引并首渲 —— */
  M.normalizeAlertThresholds();
  M.buildIndexes();
  M.restoreState();
  if (!M.S.weekMonth && M.prof().hasWeeks && M.MONTHS.length) M.S.weekMonth = M.MONTHS[M.MONTHS.length - 1];
  M.bindEvents();
  M.render();
})();
