/**
 * customer.js — 客户详情页入口（customer.html）
 * 读取 URL 参数 ?name=客户名&line=ec|trad，构建索引后渲染：
 * 核心信息栏（健康度 / 主销售 / 沉睡状态 / 客户缩写）+ 三 Tab（趋势 / 跟进记录 / 商机），
 * 并提供「维护四角色」弹窗（复用 roles.js 的 openRoleEditor / saveRoleEdit）。
 * 依赖加载顺序：seed → config → storage → roles → health → opportunities → indexes → 本文件。
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;
  const params = new URLSearchParams(window.location.search);
  const NAME = params.get('name') || '';
  const LINE = params.get('line') === 'trad' ? 'trad' : 'ec';

  // 与 URL 一致化业务线（首屏前已由内联脚本把 line 写入 localStorage，config.js 读到；此处兜底）
  if (M.LINE !== LINE) {
    M.LINE = LINE;
    M.SEED = M.SEEDS[LINE];
    M.normalizeAlertThresholds();
  }

  M.buildIndexes();

  const latestMonth = M.MONTHS.length ? M.MONTHS[M.MONTHS.length - 1] : '';
  let activeTab = 'trend';

  function $(id) { return document.getElementById(id); }

  /* —— 供 roles.js 的 saveRoleEdit 复用：关闭弹窗 + 保存后刷新本页 —— */
  M.closeModal = function () {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    delete root.dataset.editing;
    delete root.dataset.opp;
  };

  /* ============================================================
   * 头部 + 核心信息栏
   * ========================================================== */
  function renderHeader() {
    const title = $('cust-title');
    if (title) title.textContent = NAME || '客户详情';
    const badge = $('line-badge');
    if (badge) {
      badge.textContent = M.prof().label;
      badge.className = 'badge ' + (M.LINE === 'ec' ? 'ec' : 'trad');
    }
  }

  function renderInfoBar() {
    const el = $('info-bar');
    if (!el) return;
    const health = M.healthScores.get(NAME);
    const mainSales = M.roleAt(NAME, 'main', latestMonth);
    const st = M.followStatus(NAME);
    const abbr = (M.LINE === 'trad' && M.SEED.nameAbbr) ? (M.SEED.nameAbbr[NAME] || '') : '';
    const LEVEL_COLORS = { good: '#16a34a', info: '#0090D8', watch: '#F07800', risk: '#dc2626' };

    let html = '';

    // 健康度分 + 等级
    if (health) {
      html += '<div class="info-item"><div class="info-label">健康度</div>'
        + '<div class="info-value"><span class="info-num" style="color:' + (LEVEL_COLORS[health.level.key] || '#6b7280') + '">' + health.total + '</span>'
        + '<span class="badge ' + health.level.key + '">' + health.level.label + '</span></div>'
        + '<div class="info-sub">' + health.parts.map(function (p) { return p.label + ' ' + p.score; }).join(' · ') + '</div></div>';
    } else {
      html += '<div class="info-item"><div class="info-label">健康度</div><div class="info-value"><span class="muted">—</span></div></div>';
    }

    // 主销售（最新月生效）
    html += '<div class="info-item"><div class="info-label">主销售</div>'
      + '<div class="info-value">' + (mainSales ? M.esc(mainSales) : '<span class="muted">—</span>') + '</div></div>';

    // 沉睡 gap（调用 followStatus）
    if (st) {
      html += '<div class="info-item"><div class="info-label">沉睡状态</div>'
        + '<div class="info-value">' + st.gap + ' 个月</div>'
        + '<div class="info-sub">' + M.followBadge(st) + ' · 最近出货 ' + M.esc(st.last) + '</div></div>';
    } else {
      html += '<div class="info-item"><div class="info-label">沉睡状态</div><div class="info-value"><span class="muted">—</span></div></div>';
    }

    // 客户缩写（仅传统线）
    if (M.LINE === 'trad') {
      html += '<div class="info-item"><div class="info-label">客户缩写</div>'
        + '<div class="info-value">' + (abbr ? M.esc(abbr) : '<span class="muted">—</span>') + '</div></div>';
    }

    // 维护四角色按钮
    if (NAME) {
      html += '<div class="info-item" style="flex:0 0 auto;display:flex;align-items:center">'
        + '<button class="btn primary" id="role-edit-btn">维护四角色</button></div>';
    }

    el.innerHTML = html;
  }

  /* ============================================================
   * Tab 1：趋势（复用 openRoleEditor 里的 13 个月双折线图）
   * ========================================================== */
  function renderTrend() {
    const el = $('tab-trend');
    if (!el) return;
    const trend = M.customerTrend(NAME);
    el.innerHTML = '<div class="detail-trend">'
      + '<div class="trend-cell"><div class="trend-label">过去 13 个月 ' + M.prof().volumeLabel + '</div>'
      + M.lineChart([trend.volSeries], trend.months, 150, true) + '</div>'
      + '<div class="trend-cell"><div class="trend-label">过去 13 个月 利润（元）</div>'
      + M.lineChart([trend.profitSeries], trend.months, 150, true) + '</div>'
      + '</div>';
  }

  /* ============================================================
   * Tab 2：跟进记录（活动记录）
   * ========================================================== */
  function todayStr() {
    const d = new Date();
    const p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function renderActivities() {
    const el = $('tab-activities');
    if (!el) return;
    const arr = M.loadActivities(NAME).slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    const people = M.allPeople();

    let html = '<div class="toolbar">'
      + '<button class="btn primary" id="act-add-btn">＋ 添加跟进</button>'
      + '<span class="muted">共 ' + arr.length + ' 条</span></div>';

    // 添加跟进表单（默认收起）
    html += '<div class="panel" id="act-form" style="display:none">'
      + '<div class="grid-2">'
      + '<div class="field"><label>日期</label><input id="act-date" type="date" value="' + todayStr() + '"></div>'
      + '<div class="field"><label>跟进人</label><input id="act-user" list="role-people" placeholder="—" autocomplete="off"></div>'
      + '</div>'
      + '<div class="field"><label>类型</label><select id="act-type">'
      + M.ACT_TYPES.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="field"><label>内容</label><textarea id="act-content" rows="3" placeholder="本次跟进要点"></textarea></div>'
      + '<div class="toolbar" style="margin-bottom:0"><button class="btn primary" id="act-save">保存</button><button class="btn" id="act-cancel">取消</button></div>'
      + '</div>';

    // 记录列表（按日期倒序）
    html += '<div class="panel" style="padding:0"><table><thead><tr><th>日期</th><th>跟进人</th><th>类型</th><th>内容</th><th style="width:70px"></th></tr></thead><tbody>';
    if (!arr.length) {
      html += '<tr><td colspan="5" class="empty">暂无跟进记录，点击「添加跟进」录入</td></tr>';
    } else {
      html += arr.map(function (a) {
        return '<tr><td style="white-space:nowrap">' + M.esc(a.date || '') + '</td>'
          + '<td>' + M.esc(a.user || '') + '</td>'
          + '<td><span class="badge info">' + M.esc(a.type || '') + '</span></td>'
          + '<td>' + M.esc(a.content || '') + '</td>'
          + '<td><button class="btn" style="color:var(--risk);border-color:#fecaca;padding:3px 10px;font-size:12px" data-act-id="' + M.esc(a.id) + '">删除</button></td></tr>';
      }).join('');
    }
    html += '</tbody></table></div>';
    html += '<datalist id="role-people">' + people.map(function (p) { return '<option value="' + M.esc(p) + '"></option>'; }).join('') + '</datalist>';
    el.innerHTML = html;
  }

  function saveActivity() {
    const date = $('act-date') ? $('act-date').value : '';
    const user = $('act-user') ? $('act-user').value.trim() : '';
    const type = $('act-type') ? $('act-type').value : M.ACT_TYPES[0];
    const content = $('act-content') ? $('act-content').value.trim() : '';
    if (!date) { alert('请选择日期'); return; }
    if (!content) { alert('请填写内容'); return; }
    M.addActivity(NAME, {
      id: 'act_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      date: date, user: user, type: type, content: content,
      createdAt: new Date().toISOString(),
    });
    renderAll();
  }

  /* ============================================================
   * Tab 3：商机（该客户的所有商机，filter 匹配 customer）
   * ========================================================== */
  function renderOpp() {
    const el = $('tab-opp');
    if (!el) return;
    const opps = M.opportunities.filter(function (o) { return o.customer === NAME; })
      .sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
    const person = function (v) { return v ? M.esc(v) : '<span class="muted">—</span>'; };

    let html = '<div class="panel"><h3>商机 <span class="hint">' + opps.length + ' 条</span></h3>';
    if (!opps.length) {
      html += '<div class="empty">该客户暂无商机记录，可在月度报表的「商机」视图录入</div>';
    } else {
      html += '<table><thead><tr><th>类型</th><th>机会导入者</th><th>主销售</th><th>销售2</th><th>项目助理</th><th>阶段</th><th class="num">预估毛利</th><th>有效</th><th>备注</th></tr></thead><tbody>'
        + opps.map(function (o) {
          return '<tr>'
            + '<td><span class="badge ' + M.oppTypeBadge(o.type) + '">' + M.oppTypeLabel(o.type) + '</span></td>'
            + '<td>' + person(o.importer) + '</td>'
            + '<td>' + person(o.main) + '</td>'
            + '<td>' + person(o.sales2) + '</td>'
            + '<td>' + person(o.assistant) + '</td>'
            + '<td>' + M.oppStageCell(o.stage) + '</td>'
            + '<td class="num">' + (o.estProfit ? M.fmtMoney(o.estProfit) : '—') + '</td>'
            + '<td>' + (o.valid ? '<span class="badge good">有效</span>' : '<span class="badge muted">待确认</span>') + '</td>'
            + '<td class="muted">' + M.esc(o.note || '') + '</td>'
            + '</tr>';
        }).join('') + '</tbody></table>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  /* ============================================================
   * Tab 切换 / 全量渲染 / 一次性事件绑定
   * ========================================================== */
  function switchTab(tab) {
    activeTab = tab;
    ['trend', 'activities', 'opp'].forEach(function (t) {
      const btn = $('tab-' + t + '-btn');
      const panel = $('tab-' + t);
      if (btn) btn.classList.toggle('active', t === tab);
      if (panel) panel.style.display = (t === tab ? '' : 'none');
    });
  }

  function renderAll() {
    renderHeader();
    renderInfoBar();
    renderTrend();
    renderActivities();
    renderOpp();
    switchTab(activeTab);
  }

  // saveRoleEdit（roles.js）保存后调用 M.render() → 刷新本页（主销售 / 商机角色更新）
  M.render = renderAll;

  function bindOnce() {
    // 返回 monthly.html（公网版回 monthly-public.html）
    const back = $('back-btn');
    if (back) back.addEventListener('click', function () { window.location.href = (M.isPublic() ? 'monthly-public.html' : 'monthly.html'); });

    // Tab 切换
    ['trend', 'activities', 'opp'].forEach(function (t) {
      const btn = $('tab-' + t + '-btn');
      if (btn) btn.addEventListener('click', function () { switchTab(t); });
    });

    // 核心信息栏：维护四角色按钮（事件委托在 info-bar 容器，重渲染后依然有效）
    const infoBar = $('info-bar');
    if (infoBar) infoBar.addEventListener('click', function (e) {
      if (e.target.closest('#role-edit-btn')) M.openRoleEditor(NAME);
    });

    // 跟进记录：添加 / 取消 / 保存 / 删除（事件委托在 tab-activities 容器）
    const actCont = $('tab-activities');
    if (actCont) actCont.addEventListener('click', function (e) {
      const t = e.target;
      if (t.closest('#act-add-btn')) {
        const form = $('act-form');
        if (form) form.style.display = (form.style.display === 'none' ? 'block' : 'none');
      } else if (t.closest('#act-cancel')) {
        const form = $('act-form');
        if (form) form.style.display = 'none';
      } else if (t.closest('#act-save')) {
        saveActivity();
      } else if (t.closest('[data-act-id]')) {
        const btn = t.closest('[data-act-id]');
        if (!confirm('确认删除该跟进记录？')) return;
        M.deleteActivity(NAME, btn.dataset.actId);
        renderAll();
      }
    });

    // 弹窗（四角色维护）：关闭 / 取消 / 保存 / 添加变更 / 删除变更 + 点遮罩关闭
    const modalRoot = $('modal-root');
    if (modalRoot) modalRoot.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const a = btn.dataset.action;
        if (a === 'close' || a === 'cancel') M.closeModal();
        else if (a === 'save') M.saveRoleEdit();
        else if (a === 'add-change') {
          const name = modalRoot.dataset.editing;
          const roleKey = modalRoot.querySelector('#rc-role').value;
          const month = modalRoot.querySelector('#rc-month').value;
          const before = modalRoot.querySelector('#rc-before').value.trim();
          const after = modalRoot.querySelector('#rc-after').value.trim();
          if (!after) { alert('请填写「变更后」，即该月起由谁担任。'); return; }
          if (!before) { alert('请填写「变更前」，即换人之前由谁担任（否则换人前的月份无法归属到人）。'); return; }
          M.addRoleChange(name, roleKey, month, before, after);
          M.openRoleEditor(name);
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
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') M.closeModal(); });
  }

  function init() {
    bindOnce();
    renderAll();
  }

  init();
})();
