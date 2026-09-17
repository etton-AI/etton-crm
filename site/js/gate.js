/**
 * gate.js — 公网版访问口令遮罩（仅挡「随手点开 / 好奇的人」，非真正保密：
 * 数据仍在静态 JS 文件里，懂技术的人抓包/看源码仍能拿到，只是拿到的是脱敏数据）。
 *
 * 改口令：改下面 PASS_HASH 常量。生成新哈希：
 *   python -c "import hashlib;print(hashlib.sha256('你的口令'.encode('utf-8')).hexdigest())"
 *
 * 解锁状态存 sessionStorage：同一标签页内 monthly-public ↔ customer-public 只问一次；
 * 新开标签页 / 新会话会重新要求输入。
 */
(function () {
  'use strict';

  // ★ 占位口令 = etton2026（请改成你自己的）
  var PASS_HASH = '6a859c2c949bdd71325446122210a134a316de83e0024f385f45f7a17a339c48';

  try {
    if (sessionStorage.getItem('crm-public-unlocked') === '1') return;
  } catch (e) {}

  var style = document.createElement('style');
  style.textContent =
    '#crm-pw-overlay{position:fixed;inset:0;z-index:99999;background:#10212f;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}'
    + '#crm-pw-overlay .pw-card{background:#fff;border-radius:12px;padding:32px 36px;width:340px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,.4);text-align:center}'
    + '#crm-pw-overlay .pw-brand{font-size:17px;font-weight:700;color:#1f2937;margin-bottom:4px}'
    + '#crm-pw-overlay .pw-brand .accent{color:#0090D8}'
    + '#crm-pw-overlay .pw-sub{font-size:13px;color:#6b7280;margin-bottom:18px}'
    + '#crm-pw-overlay .pw-input{width:100%;padding:9px 12px;border:1px solid #e5e9f0;border-radius:6px;font-size:14px;text-align:center;margin-bottom:8px;color:#1f2937;box-sizing:border-box}'
    + '#crm-pw-overlay .pw-input:focus{outline:none;border-color:#0090D8}'
    + '#crm-pw-overlay .pw-msg{font-size:12px;color:#dc2626;min-height:18px;margin-bottom:6px}'
    + '#crm-pw-overlay .pw-btn{width:100%;padding:9px;border:none;border-radius:6px;background:#004890;color:#fff;font-size:14px;cursor:pointer}'
    + '#crm-pw-overlay .pw-btn:hover{background:#003a70}';
  document.head.appendChild(style);

  var overlay = document.createElement('div');
  overlay.id = 'crm-pw-overlay';
  overlay.innerHTML =
    '<div class="pw-card">'
    + '<div class="pw-brand">ETTON<span class="accent">CRM</span> · 公网版</div>'
    + '<div class="pw-sub">请输入访问口令</div>'
    + '<input class="pw-input" type="password" placeholder="口令" autocomplete="off">'
    + '<div class="pw-msg"></div>'
    + '<button class="pw-btn" type="button">进入</button>'
    + '</div>';
  document.body.appendChild(overlay);

  var input = overlay.querySelector('.pw-input');
  var msg = overlay.querySelector('.pw-msg');
  var btn = overlay.querySelector('.pw-btn');

  function hashPassword(pw) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw)).then(function (buf) {
      var arr = Array.from(new Uint8Array(buf));
      return arr.map(function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    });
  }

  function fail() {
    msg.textContent = '口令不正确，请重试';
    input.value = '';
    input.focus();
  }

  function submit() {
    var pw = input.value;
    if (!pw) { msg.textContent = '请输入口令'; return; }
    hashPassword(pw).then(function (h) {
      if (h === PASS_HASH) {
        try { sessionStorage.setItem('crm-public-unlocked', '1'); } catch (e) {}
        overlay.parentNode.removeChild(overlay);
      } else {
        fail();
      }
    }).catch(fail);
  }

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  input.focus();
})();
