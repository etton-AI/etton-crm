/**
 * roles.js — 四角色：角色取数（含中途变更/传统线默认）、人员去重、
 * 变更历史渲染与客户详情（四角色维护）弹窗。
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  /** 某客户某角色在 month 月生效的人（month 为空则取当前值）
   *  传统线：未配置时，机会导入者/销售2/项目助理 默认 = 主销售（不沿用电商的角色） */
  M.roleAt = function (name, roleKey, month) {
    const base = (M.roleMap[name] || {})[roleKey] || '';
    const changes = (M.roleChanges[name] && M.roleChanges[name][roleKey]) || [];
    let v = base;
    if (month && changes.length) {
      const applied = changes.filter((c) => c.month <= month).sort((a, b) => a.month.localeCompare(b.month));
      if (applied.length) v = applied[applied.length - 1].after;
      else {
        const earliest = changes.slice().sort((a, b) => a.month.localeCompare(b.month))[0];
        v = earliest.before;  // before 为空 = 此前归属未知（不回退到当前值，避免误计入换人后的人）
      }
    }
    if (!v && M.LINE === 'trad' && roleKey !== 'main') {
      v = M.roleAt(name, 'main', month) || (M.roleMap[name] || {}).main || '';
    }
    return v;
  };

  /** 主销售去重列表（匹配表中 main 字段） */
  M.mainSalesList = function () {
    const set = new Set();
    for (const r of Object.values(M.roleMap)) if (r.main) set.add(r.main);
    return Array.from(set).sort();
  };

  /** 全部人员（四个角色值去重），用于弹窗下拉建议 */
  M.allPeople = function () {
    const set = new Set();
    for (const r of Object.values(M.roleMap)) {
      for (const [k] of M.ROLE_FIELDS) if (r[k]) set.add(r[k]);
    }
    return Array.from(set).sort();
  };

  /** 某角色在 month 月生效的全部人名（去重排序），用于客户排行按角色筛人名下拉 */
  M.rolePeople = function (roleKey, month) {
    const set = new Set();
    for (const name of M.custSeries.keys()) {
      const v = M.roleAt(name, roleKey, month);
      if (v) set.add(v);
    }
    return Array.from(set).sort();
  };

  /** 客户详情弹窗右侧：角色变更历史（按生效月取数） */
  M.roleChangeHistoryHtml = function (name) {
    const changes = M.roleChanges[name] || {};
    const lastMonth = M.MONTHS.length ? M.MONTHS[M.MONTHS.length - 1] : '';
    let rowsHtml = '';
    let count = 0;
    for (const [k, label] of M.ROLE_FIELDS) {
      const list = changes[k] || [];
      for (const c of list) {
        count++;
        rowsHtml += '<div class="rc-row">'
          + '<span class="badge muted">' + label + '</span>'
          + '<span class="rc-month">' + M.esc(c.month) + ' 月</span>'
          + '<span class="rc-move">' + (c.before ? M.esc(c.before) : '—') + ' → ' + (c.after ? M.esc(c.after) : '—') + '</span>'
          + '<button class="btn rc-del" data-action="del-change" data-role="' + k + '" data-month="' + M.esc(c.month) + '">删除</button>'
          + '</div>';
      }
    }
    if (!rowsHtml) rowsHtml = '<div class="muted" style="padding:6px 0">暂无变更记录。人效将按当前角色值取数。</div>';

    const roleOpts = M.ROLE_FIELDS.map(([k, label]) => '<option value="' + k + '">' + label + '</option>').join('');
    const monthOpts = M.MONTHS.map((m) => '<option value="' + m + '"' + (m === lastMonth ? ' selected' : '') + '>' + m + '</option>').join('');

    return '<div class="detail-roles-title">角色变更历史（按生效月取数）</div>'
      + '<div class="rc-list">' + rowsHtml + '</div>'
      + '<div class="rc-add">'
      + '<select id="rc-role">' + roleOpts + '</select>'
      + '<select id="rc-month">' + monthOpts + '</select>'
      + '<input id="rc-before" list="role-people" placeholder="变更前（此前负责人）" autocomplete="off">'
      + '<input id="rc-after" list="role-people" placeholder="变更后（从此月起担任）" autocomplete="off">'
      + '<button class="btn primary" data-action="add-change">添加变更</button>'
      + '</div>'
      + '<div class="muted" style="font-size:11px;margin-top:6px">例：项目助理 2026-08 变更前 Jayce → 变更后 TINA，表示 2026-08 起 TINA 接手、之前仍算 Jayce。变更前、变更后都需填写，否则换人前的月份无法归属到人。</div>';
  };

  function openRoleEditor(name) {
    const people = M.allPeople();
    const health = M.healthScores.get(name);
    const trend = M.customerTrend(name);
    const LEVEL_COLORS = { good: '#16a34a', info: '#0090D8', watch: '#F07800', risk: '#dc2626' };

    let healthHtml = '';
    if (health) {
      healthHtml = '<div class="detail-health">'
        + '<div class="dh-score"><span class="dh-num" style="color:' + (LEVEL_COLORS[health.level.key] || '#6b7280') + '">' + health.total + '</span><span class="dh-level">' + health.level.label + '</span></div>'
        + '<div class="dh-parts">' + health.parts.map((p) => '<span>' + p.label + ' <b>' + p.score + '</b></span>').join('') + '</div>'
        + '</div>';
    }

    const trendHtml = '<div class="detail-trend">'
      + '<div class="trend-cell"><div class="trend-label">过去 13 个月 ' + M.prof().volumeLabel + '</div>'
      + M.lineChart([trend.volSeries], trend.months, 150, true) + '</div>'
      + '<div class="trend-cell"><div class="trend-label">过去 13 个月 利润（元）</div>'
      + M.lineChart([trend.profitSeries], trend.months, 150, true) + '</div>'
      + '</div>';

    const fields = M.ROLE_FIELDS.map(([k, label]) => {
      let h = '<div class="field"><label>' + label + '</label>'
        + '<input id="role-f-' + k + '" list="role-people" value="' + M.esc(M.roleAt(name, k) || '') + '" placeholder="—" autocomplete="off">';
      if (M.TIME_ROLE_KEYS.includes(k)) {
        h += '<div class="role-start"><label class="muted">起算时间</label>'
          + '<select id="role-start-' + k + '">'
          + '<option value="">—（不改历史）</option>'
          + M.MONTHS.map((m) => '<option value="' + m + '">' + m + '</option>').join('')
          + '</select></div>';
      }
      return h + '</div>';
    }).join('');

    const html = '<div class="modal-overlay">'
      + '<div class="modal modal-xwide">'
      + '<div class="modal-head"><span>' + M.esc(name) + '</span><button class="modal-close" data-action="close" title="关闭">&times;</button></div>'
      + '<div class="modal-body">'
      + healthHtml
      + '<div class="detail-grid">'
      + '<div class="detail-col">'
      + '<div class="detail-roles-title">四角色维护</div>'
      + '<div class="detail-roles">' + fields + '</div>'
      + '</div>'
      + '<div class="detail-col">'
      + M.roleChangeHistoryHtml(name)
      + '</div>'
      + '</div>'
      + trendHtml
      + '<datalist id="role-people">' + people.map((p) => '<option value="' + M.esc(p) + '"></option>').join('') + '</datalist>'
      + '</div>'
      + '<div class="modal-foot"><button class="btn" data-action="cancel">取消</button><button class="btn" style="background:var(--navy);color:#fff;border-color:var(--navy)" data-action="save">保存</button></div>'
      + '</div></div>';
    const root = document.getElementById('modal-root');
    root.innerHTML = html;
    root.dataset.editing = name;
  }
  M.openRoleEditor = openRoleEditor;

  function saveRoleEdit() {
    const root = document.getElementById('modal-root');
    const name = root.dataset.editing;
    if (!name) return;
    const role = {};
    for (const [k] of M.ROLE_FIELDS) {
      const inp = root.querySelector('#role-f-' + k);
      role[k] = inp ? inp.value.trim() : '';
    }
    // 起算时间：销售2/项目助理 值发生变化且指定了起算时间 → 自动写入变更历史（变更前=旧值）
    for (const k of M.TIME_ROLE_KEYS) {
      const oldVal = (M.roleMap[name] || {})[k] || '';
      const sel = root.querySelector('#role-start-' + k);
      const start = sel ? sel.value : '';
      if (start && role[k] && role[k] !== oldVal) {
        M.addRoleChange(name, k, start, oldVal, role[k]);
      }
    }
    M.saveRole(name, role);
    M.closeModal();
    M.render();
  }
  M.saveRoleEdit = saveRoleEdit;
})();
