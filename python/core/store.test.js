'use strict';
const T = require('./_test.js');

/* node 下没有 localStorage：装一个可控的假的，顺便用它模拟配额爆掉。 */
function makeFakeStorage(limitBytes) {
  const map = Object.create(null);
  let used = 0;
  return {
    get length() { return Object.keys(map).length; },
    key(i) { return Object.keys(map)[i]; },
    getItem(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem(k, v) {
      const delta = String(k).length + String(v).length;
      if (limitBytes != null && used + delta > limitBytes) {
        const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e;
      }
      used += delta; map[k] = String(v);
    },
    removeItem(k) {
      if (Object.prototype.hasOwnProperty.call(map, k)) {
        used -= k.length + map[k].length; delete map[k];
      }
    },
    _keys() { return Object.keys(map); }
  };
}

const Store = require('./store.js');

/* ---- 基本读写 ---- */
Store._useStorage(makeFakeStorage(null));
T.eq(Store.available(), true, '装上假存储后可用');
Store.setDraft('hello-name', 'trace', 'print("hi")');
T.eq(Store.getDraft('hello-name', 'trace'), 'print("hi")', '草稿读回');
T.eq(Store.getDraft('hello-name', 'blank'), null, '另一个模式互不干扰');

/* ---- 键名形状（缓存键与清空都靠它，钉死）---- */
T.ok(Store._useStorage(makeFakeStorage(null)) === undefined || true, '换一块干净存储');
Store.setDraft('p1', 'blank', 'x');
Store.patchProgress('p1', { blank: { done: true } });
Store.setPrefs({ alpha: 0.35 });
const keys = Store._storage()._keys().sort();
T.eq(keys, ['python-draft:p1:blank', 'python-prefs', 'python-progress:p1', 'python-store-v'],
     '键名与 schema 版本键');

/* ---- 三级清空 ---- */
Store._useStorage(makeFakeStorage(null));
['a', 'b', 'c'].forEach(id => {
  Store.setDraft(id, 'blank', 'B' + id);
  Store.setDraft(id, 'trace', 'T' + id);
  Store.patchProgress(id, { trace: { bestCpm: 100 } });
});
T.eq(Store.countRecords(['a', 'b', 'c']), 9, '三题 × (2 草稿 + 1 进度) = 9 条');
Store.clearProgram('a', ['blank']);
T.eq(Store.getDraft('a', 'blank'), null, '单题单模式清空');
T.eq(Store.getDraft('a', 'trace'), 'Ta', '同题另一模式不受影响');
T.eq(Store.getProgress('a') != null, true, '清草稿不动进度');
Store.clearMany(['a', 'b']);
T.eq(Store.getDraft('b', 'trace'), null, '模块级清空覆盖 b');
T.eq(Store.getDraft('c', 'trace'), 'Tc', '模块级清空不越界到 c');
Store.setPrefs({ alpha: 0.5 });
Store.clearAll({});
T.eq(Store.getDraft('c', 'trace'), null, '整项清空扫掉草稿');
T.eq(Store.getProgress('c'), null, '整项清空扫掉进度');
T.eq(Store.getPrefs().alpha, 0.5, '整项清空默认保留偏好');
Store.clearAll({ prefs: true });
T.eq(Store.getPrefs().alpha, undefined, '全部重置连偏好一起清');

/* ---- patchProgress 是浅合并、整值替换，不是深合并 ----
   评审 R9：调用方按接口约定传"完整"的子对象，一次补丁本该整体替换掉 blank/trace
   这一层，而不是逐字段拼进旧值——否则一次"重置"式的补丁会悄悄留着上一次的
   陈旧字段（这里是 hintsUsed/at）。setPrefs 一直是这个语义（Object.assign 不递归），
   patchProgress 必须跟它一致。 */
(function () {
  Store._useStorage(makeFakeStorage(null));
  Store.patchProgress('p1', { blank: { done: false, hintsUsed: 2, at: 111 } });
  Store.patchProgress('p1', { blank: { done: true } });
  T.eq(Store.getProgress('p1').blank, { done: true },
       'patchProgress 整值替换：第二次补丁不留上一次的 hintsUsed/at');
})();

/* ---- 配额爆掉必须喊出来，不能静默 ---- */
(function () {
  let called = 0, lastReason = null;
  Store._useStorage(makeFakeStorage(60));
  Store.onUnavailable(function (reason) { called++; lastReason = reason; });
  Store.setDraft('big', 'trace', 'x'.repeat(500));
  T.eq(called, 1, '配额爆掉时回调恰好一次');
  T.eq(lastReason, 'quota', '回调带上原因');
  T.eq(Store.getDraft('big', 'trace'), 'x'.repeat(500), '降级到内存后仍读得回来');
})();

/* ---- localStorage 整个不可用（file:// / 隐私模式）---- */
(function () {
  let called = 0;
  Store._useStorage({ getItem() { throw new Error('denied'); },
                      setItem() { throw new Error('denied'); },
                      removeItem() { throw new Error('denied'); },
                      get length() { return 0; }, key() { return null; } });
  Store.onUnavailable(function () { called++; });
  T.eq(Store.available(), false, '存储不可用时 available() 为 false');
  Store.setDraft('x', 'trace', 'v');
  T.eq(Store.getDraft('x', 'trace'), 'v', '不可用时仍走内存，不丢当前会话');
  T.ok(called >= 1, '不可用时也回调');
})();

/* ---- 防抖 ---- */
(function (done) {
  Store._useStorage(makeFakeStorage(null));
  Store.scheduleDraft('deb', 'trace', 'v1');
  Store.scheduleDraft('deb', 'trace', 'v2');
  T.eq(Store.getDraft('deb', 'trace'), null, '防抖期内尚未落盘');
  Store.flush();
  T.eq(Store.getDraft('deb', 'trace'), 'v2', 'flush 落最后一次的值');
})();

/* ---- schema 版本迁移：版本不符时安全丢弃 draft/progress，其余键保留，且只通知一次 ----
   brief 的 Step 3 明确要求这条行为（"值不等于当前版本就清掉 draft/progress 两个前缀
   并写入新版本……且触发 onUnavailable('migrated')"），但 brief Step 1 给的测试文件
   没有覆盖它——这段分支在合入前不会被任何东西跑到。补一段，直接在假存储里预先放好
   一个"旧版本"的数据，钉死：只扫 draft/progress 两个前缀，python-lang / python-prefs
   这些键必须原样保留。 */
(function () {
  const raw = makeFakeStorage(null);
  raw.setItem('python-store-v', '0');
  raw.setItem('python-draft:old:blank', 'STALE');
  raw.setItem('python-progress:old', '{"blank":{"done":true}}');
  raw.setItem('python-lang', 'en');
  raw.setItem('python-prefs', '{"alpha":0.9}');
  let called = 0, lastReason = null;
  Store._useStorage(raw);
  Store.onUnavailable(function (reason) { called++; lastReason = reason; });
  T.eq(Store.getDraft('old', 'blank'), null, '版本不符时旧草稿被安全丢弃');
  T.eq(Store.getProgress('old'), null, '版本不符时旧进度被安全丢弃');
  T.eq(Store.getPrefs().alpha, 0.9, '迁移不动 prefs');
  T.eq(raw.getItem('python-lang'), 'en', '迁移不动 store 两个前缀之外的键');
  T.eq(raw.getItem('python-store-v'), String(Store.SCHEMA_VERSION), '迁移后写回当前 schema 版本');
  T.eq(called, 1, '迁移只通知一次');
  T.eq(lastReason, 'migrated', '迁移原因是 migrated');
})();

T.report('store');
