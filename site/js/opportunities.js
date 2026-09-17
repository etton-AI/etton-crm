/**
 * opportunities.js — 商机（新业务机会）数据模型、四角色考核计算与 CRUD，
 * 以及商机录入/编辑弹窗。存储走 storage.js，渲染走 render-opportunities.js。
 */
(function () {
  'use strict';

  const M = window.CRM.monthly;

  M.oppTypeLabel = function (t) { const x = M.OPP_TYPES.find(([k]) => k === t); return x ? x[1] : (t || '—'); };
  M.oppStageLabel = function (s) { const x = M.OPP_STAGES.find(([k]) => k === s); return x ? x[1] : (s || '—'); };
  M.oppTypeBadge = function (t) { return { new_cust: 'info', old_cust_new: 'ec', old_cust_repeat: 'trad', referral: 'good' }[t] || 'muted'; };
  M.oppStageBadge = function (s) { return { import: 'info', intent: 'ec', quote: 'trad', won: 'good', delivered: 'good', closed: 'muted' }[s] || 'muted'; };

  /** 四角色考核看板（按人综合）：一人兼多角分别计分 */
  M.kpiBoard = function () {
    const summary = { total: M.opportunities.length, valid: 0, quoted: 0, won: 0, wonProfit: 0, delivered: 0 };
    const people = new Map();
    const ensure = (n) => { if (!people.has(n)) people.set(n, { name: n, importer: [], main: [], sales2: [], assistant: [] }); return people.get(n); };
    for (const n of M.allPeople()) ensure(n);
    for (const o of M.opportunities) {
      if (o.valid) summary.valid++;
      if (M.OPP_QUOTED.has(o.stage)) summary.quoted++;
      if (M.OPP_WON.has(o.stage)) { summary.won++; summary.wonProfit += (Number(o.estProfit) || 0); }
      if (M.OPP_DONE.has(o.stage)) summary.delivered++;
      if (o.importer) ensure(o.importer).importer.push(o);
      if (o.main) ensure(o.main).main.push(o);
      if (o.sales2) ensure(o.sales2).sales2.push(o);
      if (o.assistant) ensure(o.assistant).assistant.push(o);
    }
    const rows = Array.from(people.values()).map((p) => ({
      name: p.name,
      importerValid: p.importer.filter((o) => o.valid).length,
      importerTotal: p.importer.length,
      mainIntentRate: p.main.length ? p.main.filter((o) => M.OPP_QUOTED.has(o.stage)).length / p.main.length : null,
      mainTotal: p.main.length,
      sales2ConvRate: p.sales2.some((o) => M.OPP_QUOTED.has(o.stage)) ? p.sales2.filter((o) => M.OPP_WON.has(o.stage)).length / p.sales2.filter((o) => M.OPP_QUOTED.has(o.stage)).length : null,
      sales2WonProfit: p.sales2.reduce((s, o) => s + (M.OPP_WON.has(o.stage) ? (Number(o.estProfit) || 0) : 0), 0),
      sales2Total: p.sales2.length,
      assistantDoneRate: p.assistant.some((o) => M.OPP_WON.has(o.stage)) ? p.assistant.filter((o) => M.OPP_DONE.has(o.stage)).length / p.assistant.filter((o) => M.OPP_WON.has(o.stage)).length : null,
      assistantTotal: p.assistant.length,
      total: p.importer.length + p.main.length + p.sales2.length + p.assistant.length,
    })).sort((a, b) => b.total - a.total);
    return { summary, rows };
  };

  /** 阶段徽章 + 当前责任角色提示 */
  M.oppStageCell = function (s) {
    const entry = M.OPP_STAGES.find(([k]) => k === s);
    const rf = entry && entry[2] ? M.ROLE_FIELDS.find(([k]) => k === entry[2]) : null;
    const hint = entry && entry[2] ? ' · 当前：' + (rf ? rf[1] : entry[2]) : ' · 已闭环';
    return '<span class="badge ' + M.oppStageBadge(s) + '">' + M.oppStageLabel(s) + '</span><span class="muted" style="font-size:11px">' + hint + '</span>';
  };

  /* ============================================================
   * 商机 CRUD 动作
   * ========================================================== */
  M.oppAdd = function () { M.openOpportunityEditor(); };
  M.oppEdit = function (id) { M.openOpportunityEditor(id); };

  M.oppProceed = function (id) {
    const o = M.opportunities.find((x) => x.id === id);
    if (!o) return;
    const idx = M.OPP_STAGES.findIndex(([k]) => k === o.stage);
    if (idx >= 0 && idx < M.OPP_STAGES.length - 1) {
      o.stage = M.OPP_STAGES[idx + 1][0];
      o.updatedAt = M.MONTHS.length ? M.MONTHS[M.MONTHS.length - 1] : '';
      M.saveOpportunities();
      M.render();
    }
  };

  M.oppDelete = function (id) {
    if (!confirm('确认删除该商机？')) return;
    M.deleteOpportunity(id);
    M.closeModal();
    M.render();
  };

  /* ============================================================
   * 商机录入 / 编辑弹窗
   * ========================================================== */
  function openOpportunityEditor(id) {
    const existing = id ? M.opportunities.find((x) => x.id === id) : null;
    const o = existing || { type: 'new_cust', customer: '', importer: '', main: '', sales2: '', assistant: '', stage: 'import', valid: true, estAmount: '', estProfit: '', note: '' };
    const people = M.allPeople();
    const custNames = Array.from(M.custSeries.keys()).sort();

    const typeOpts = M.OPP_TYPES.map(([k, label]) => '<option value="' + k + '"' + (o.type === k ? ' selected' : '') + '>' + label + '</option>').join('');
    const stageOpts = M.OPP_STAGES.map(([k, label]) => '<option value="' + k + '"' + (o.stage === k ? ' selected' : '') + '>' + label + '</option>').join('');
    const roleInputs = M.ROLE_FIELDS.map(([k, label]) => '<div class="field"><label>' + label + '</label>'
      + '<input id="opp-f-' + k + '" list="opp-people" value="' + M.esc(o[k] || '') + '" placeholder="—" autocomplete="off"></div>').join('');

    const html = '<div class="modal-overlay">'
      + '<div class="modal modal-wide">'
      + '<div class="modal-head"><span>' + (existing ? '编辑商机 · ' + M.esc(o.customer) : '新增商机') + '</span><button class="modal-close" data-action="close" title="关闭">&times;</button></div>'
      + '<div class="modal-body">'
      + '<div class="field"><label>客户名</label><input id="opp-customer" list="opp-cust" value="' + M.esc(o.customer) + '" placeholder="新客户可输入任意名称" autocomplete="off"></div>'
      + '<div class="grid-2">'
      + '<div class="field"><label>商机类型</label><select id="opp-type">' + typeOpts + '</select></div>'
      + '<div class="field"><label>阶段</label><select id="opp-stage">' + stageOpts + '</select></div>'
      + '</div>'
      + '<div class="detail-roles">' + roleInputs + '</div>'
      + '<div class="grid-2">'
      + '<div class="field"><label>预估金额（元，可选）</label><input id="opp-amount" type="number" value="' + (o.estAmount || '') + '" placeholder="0"></div>'
      + '<div class="field"><label>预估毛利（元，可选）</label><input id="opp-profit" type="number" value="' + (o.estProfit || '') + '" placeholder="0"></div>'
      + '</div>'
      + '<div class="field"><label>备注</label><input id="opp-note" value="' + M.esc(o.note || '') + '" placeholder="可选"></div>'
      + '<div class="field"><label><input type="checkbox" id="opp-valid"' + (o.valid ? ' checked' : '') + '> 有效商机（经主销售确认）</label></div>'
      + '<datalist id="opp-cust">' + custNames.map((c) => '<option value="' + M.esc(c) + '"></option>').join('') + '</datalist>'
      + '<datalist id="opp-people">' + people.map((pp) => '<option value="' + M.esc(pp) + '"></option>').join('') + '</datalist>'
      + '</div>'
      + '<div class="modal-foot">'
      + (existing ? '<button class="btn" style="color:var(--risk);border-color:#fecaca" onclick="CRM.monthly.oppDelete(\'' + existing.id + '\')">删除</button>' : '')
      + '<button class="btn" data-action="cancel">取消</button>'
      + '<button class="btn" style="background:var(--navy);color:#fff;border-color:var(--navy)" data-action="opp-save">保存</button>'
      + '</div></div></div>';

    const root = document.getElementById('modal-root');
    root.innerHTML = html;
    root.dataset.opp = existing ? existing.id : 'new';
  }
  M.openOpportunityEditor = openOpportunityEditor;

  function saveOpportunityEdit() {
    const root = document.getElementById('modal-root');
    const id = root.dataset.opp;
    if (!id) return;
    const q = (sel) => root.querySelector(sel);
    const val = (sel) => { const el = q(sel); return el ? el.value.trim() : ''; };
    const num = (sel) => { const el = q(sel); const n = (el && el.value !== '') ? parseFloat(el.value) : 0; return isFinite(n) ? n : 0; };
    const customer = val('#opp-customer');
    if (!customer) { alert('请填写客户名'); return; }
    const existing = id !== 'new' ? M.opportunities.find((x) => x.id === id) : null;
    const now = M.MONTHS.length ? M.MONTHS[M.MONTHS.length - 1] : '';
    const rec = {
      id: existing ? existing.id : ('op_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)),
      type: q('#opp-type') ? q('#opp-type').value : 'new_cust',
      customer,
      importer: val('#opp-f-importer'), main: val('#opp-f-main'), sales2: val('#opp-f-sales2'), assistant: val('#opp-f-assistant'),
      stage: q('#opp-stage') ? q('#opp-stage').value : 'import',
      valid: q('#opp-valid') ? q('#opp-valid').checked : true,
      estAmount: num('#opp-amount'),
      estProfit: num('#opp-profit'),
      note: val('#opp-note'),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };
    if (existing) M.updateOpportunity(rec); else M.addOpportunity(rec);
    M.closeModal();
    M.render();
  }
  M.saveOpportunityEdit = saveOpportunityEdit;
})();
