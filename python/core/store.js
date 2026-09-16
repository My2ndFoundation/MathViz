'use strict';
/* python 子项目的持久化层：边打字边存草稿、记录进度、按三种粒度清空。
   零依赖；node 与浏览器双用；本模块不依赖任何其他 core 模块。

   ---- 这个模块最坏的失败方式：静默地骗人 ----

   写失败有两种常见形状，两种都不会抛到调用方看得见的地方，除非专门去接：
     ① `QuotaExceededError`——配额满了，`setItem` 抛错。
     ② 整个 `localStorage` 不可用——`file://` 下部分浏览器直接禁用，或者
        每个文件各算一个源（Safari 尤其古怪：私密模式下 `localStorage` 这个
        属性本身、甚至只是访问它，就可能抛，不用等到调用 `setItem`）。
     实测过第三种，写在这里备查：Node 25 的实验性 `localStorage`
     （未配置 `--localstorage-file` 时）`typeof localStorage` 是 `'object'`
     ——看起来"有"——但 `.setItem()` 抛 `TypeError: localStorage.setItem is
     not a function`，连"方法存在但真的调用会失败"这条都不成立，方法根本
     没实现。这就是为什么下面不去猜"存储是不是可用"的形状，而是让每一次
     真正的读写都各自包 try/catch，出错就走同一条通知路径。

   使用者以为存住了、其实没有，比明说"存不下"糟得多——她会在关掉标签页之后
   才发现代码没了。所以这两种失败都必须走 `onUnavailable(cb)` 回调，
   由页面挂一条**持久横幅**，而不是在控制台打一行日志了事。

   ---- Store 不认识任何一道题，也不认识模块 ----

   `clearProgram` / `clearMany` 只收 id（列表），由调用方从程序库里取——
   跟 `chess/core/exercise.js` 里"题目只活在调用方传进来的字符串里"是
   同一条纪律。`clearAll` 是唯一的例外：它是"整个子项目"这一级，不需要
   知道具体有哪些题，只需要按前缀扫存储里实际存在的键。

   ---- 内部形状：一份 memory 影子层 ----

   所有真实状态都先写进 `memory`（一份内存里的镜像），再尝试写进真正的
   storage；storage 抛错时 `memory` 已经是对的，于是本次会话里"降级到
   内存"是无缝的——写得进去，读得出来，唯一少的是刷新页面后还在不在。
   所有读**先查 memory，再查 storage**（`memory` 里一个键的值可以是
   `null`，表示"确认已删除"，跟"从没读过、要去问 storage"是两回事）。

   `notified` 是"这一段失败有没有已经喊过"的标志，保证 `onUnavailable`
   在一次连续的失败状态里只响一次，不会每次读写都刷屏。`_useStorage()`
   换一块新的后端时清空这个标志（也清空 `memory` 与 `schemaChecked`）——
   换后端就是开始一段新的会话，旧后端的失败历史不该继续压着新后端。

   ---- `_useStorage` / `_storage`：测试注入口 ----

   下划线前缀标明"非公开、只给测试用"。没有它，这个模块在 node 下没有
   `localStorage` 可用，根本没法测——而它偏偏是最容易静默坏掉的模块。

   ---- schema 版本：安全丢弃优于错误迁移 ----

   启动时（更准确地说，第一次真正碰存储时，见下）读 `python-store-v`：
   没有就写入当前 `SCHEMA_VERSION`；版本不等就把 `python-draft:` 和
   `python-progress:` 两个前缀下的键**全部清掉**再写入新版本，并触发
   `onUnavailable('migrated')` 让页面能说一句"数据格式升级，旧草稿已清空"。
   不尝试把旧格式数据转换成新格式——转错了比丢掉更难查。

   这一步不是在 `_useStorage()` 里立刻做的，而是延迟到第一次真正的读写
   （`ensureSchema()`，一个 `schemaChecked` 标志守住只跑一次）。这样
   `_useStorage(s)` 本身是纯状态切换、不发生任何 I/O：调用方可以先换好
   storage 再挂 `onUnavailable` 监听器，不会错过 `_useStorage` 内部抢先
   发生的一次探测式失败通知。 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Store = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DRAFT_PREFIX = 'python-draft:';
  const PROGRESS_PREFIX = 'python-progress:';
  const PREFS_KEY = 'python-prefs';
  const VERSION_KEY = 'python-store-v';
  const SCHEMA_VERSION = 1;
  const DEBOUNCE_MS = 400;

  let storageRef = null;
  let memory = Object.create(null);
  let degraded = false;
  let notified = false;
  let schemaChecked = false;
  let unavailableCb = null;
  let pending = Object.create(null); /* draftKey -> { timer, value } */

  /* ---- 失败分类与通知（"回调恰好一次"全靠 notified 这一个标志） ---- */

  function classifyError(e) {
    return (e && e.name === 'QuotaExceededError') ? 'quota' : 'unavailable';
  }

  function notify(reason) {
    if (notified) return;
    notified = true;
    if (typeof unavailableCb === 'function') {
      try { unavailableCb(reason); } catch (e) { /* 横幅回调自己炸了也不能拖垮存储层 */ }
    }
  }

  function fail(reason) {
    degraded = true;
    notify(reason);
  }

  /* ---- schema 版本：懒加载，只在第一次真正碰存储时跑一次 ---- */

  function ensureSchema() {
    if (schemaChecked) return;
    schemaChecked = true;
    if (!storageRef) { fail('unavailable'); return; }
    let v;
    try {
      v = storageRef.getItem(VERSION_KEY);
    } catch (e) {
      fail(classifyError(e));
      return;
    }
    if (v === null) {
      try { storageRef.setItem(VERSION_KEY, String(SCHEMA_VERSION)); }
      catch (e) { fail(classifyError(e)); }
      return;
    }
    if (String(v) !== String(SCHEMA_VERSION)) {
      wipePrefixes([DRAFT_PREFIX, PROGRESS_PREFIX]);
      try { storageRef.setItem(VERSION_KEY, String(SCHEMA_VERSION)); }
      catch (e) { fail(classifyError(e)); }
      notify('migrated');
    }
  }

  /* 按前缀清扫：同时扫 memory 与 storage 里出现过的键（并集），
     这样即使某个键此刻只活在 memory 里（之前写 storage 失败过），
     "清空"也不会漏掉它，不给使用者一种"清过了"的假象。 */
  function wipePrefixes(prefixes) {
    const seen = Object.create(null);
    const all = Object.keys(memory);
    if (storageRef) {
      try {
        for (let i = 0; i < storageRef.length; i++) all.push(storageRef.key(i));
      } catch (e) { fail(classifyError(e)); }
    }
    all.forEach(function (k) {
      if (k == null || seen[k]) return;
      seen[k] = true;
      const hit = prefixes.some(function (p) { return k.indexOf(p) === 0; });
      if (!hit) return;
      memory[k] = null;
      if (storageRef) {
        try { storageRef.removeItem(k); } catch (e) { fail(classifyError(e)); }
      }
    });
  }

  /* ---- memory 影子层：hasOwnProperty 且值为 null 表示"确认已删除"，
     不是"没查过" ---- */

  function memGet(key) {
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : undefined;
  }

  function readKey(key) {
    ensureSchema();
    const m = memGet(key);
    if (m !== undefined) return m;
    if (!storageRef) return null;
    try {
      const v = storageRef.getItem(key);
      memory[key] = v;
      return v;
    } catch (e) {
      fail(classifyError(e));
      return null;
    }
  }

  function writeKey(key, value) {
    ensureSchema();
    memory[key] = value; /* 先写 memory：storage 抛错也不丢这次输入 */
    if (!storageRef) { fail('unavailable'); return; }
    try {
      storageRef.setItem(key, value);
    } catch (e) {
      fail(classifyError(e));
    }
  }

  function removeKey(key) {
    ensureSchema();
    memory[key] = null;
    if (!storageRef) { fail('unavailable'); return; }
    try {
      storageRef.removeItem(key);
    } catch (e) {
      fail(classifyError(e));
    }
  }

  function keyExists(key) {
    ensureSchema();
    const m = memGet(key);
    if (m !== undefined) return m !== null;
    if (!storageRef) return false;
    try {
      return storageRef.getItem(key) !== null;
    } catch (e) {
      fail(classifyError(e));
      return false;
    }
  }

  function draftKey(progId, mode) { return DRAFT_PREFIX + progId + ':' + mode; }
  function progressKey(progId) { return PROGRESS_PREFIX + progId; }

  /* 一层深的合并：{blank:{...}} 这样的子对象逐字段并进去，而不是整体替换——
     这样调用方分两次 patch 不同字段（比如先记 done，再记 hintsUsed）不会互相顶掉。 */
  function mergeOneLevel(base, patch) {
    const out = Object.assign({}, base);
    Object.keys(patch).forEach(function (k) {
      const pv = patch[k];
      if (pv && typeof pv === 'object' && !Array.isArray(pv)) {
        out[k] = Object.assign({}, (out[k] && typeof out[k] === 'object') ? out[k] : {}, pv);
      } else {
        out[k] = pv;
      }
    });
    return out;
  }

  function parseJSON(raw) {
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  /* ---- 公开 API ---- */

  function available() {
    ensureSchema();
    return !!storageRef && !degraded;
  }

  function getDraft(progId, mode) {
    return readKey(draftKey(progId, mode));
  }

  function cancelPending(key) {
    if (pending[key]) { clearTimeout(pending[key].timer); delete pending[key]; }
  }

  function setDraft(progId, mode, text) {
    const key = draftKey(progId, mode);
    cancelPending(key); /* 直接写就不再需要之前排队的那次防抖写 */
    writeKey(key, text);
  }

  function scheduleDraft(progId, mode, text) {
    const key = draftKey(progId, mode);
    cancelPending(key);
    pending[key] = {
      value: text,
      timer: setTimeout(function () {
        delete pending[key];
        writeKey(key, text);
      }, DEBOUNCE_MS)
    };
  }

  function flush() {
    Object.keys(pending).forEach(function (key) {
      const p = pending[key];
      clearTimeout(p.timer);
      delete pending[key];
      writeKey(key, p.value);
    });
  }

  function getProgress(progId) {
    return parseJSON(readKey(progressKey(progId)));
  }

  function patchProgress(progId, patch) {
    const existing = getProgress(progId) || {};
    writeKey(progressKey(progId), JSON.stringify(mergeOneLevel(existing, patch || {})));
  }

  function getPrefs() {
    const v = parseJSON(readKey(PREFS_KEY));
    return (v && typeof v === 'object') ? v : {};
  }

  function setPrefs(patch) {
    writeKey(PREFS_KEY, JSON.stringify(Object.assign({}, getPrefs(), patch || {})));
  }

  function countRecords(progIds) {
    let n = 0;
    (progIds || []).forEach(function (id) {
      if (keyExists(draftKey(id, 'blank'))) n++;
      if (keyExists(draftKey(id, 'trace'))) n++;
      if (keyExists(progressKey(id))) n++;
    });
    return n;
  }

  function clearProgram(progId, modes) {
    (modes || ['blank', 'trace']).forEach(function (mode) {
      removeKey(draftKey(progId, mode));
    });
  }

  /* 模块级清空：按设计文档 §4.5，这一级只清 draft，不动 progress——
     进度是"她已经会了"的记录，清草稿不该连带抹掉。 */
  function clearMany(progIds) {
    (progIds || []).forEach(function (id) {
      removeKey(draftKey(id, 'blank'));
      removeKey(draftKey(id, 'trace'));
    });
  }

  function clearAll(opts) {
    opts = opts || {};
    ensureSchema();
    wipePrefixes([DRAFT_PREFIX, PROGRESS_PREFIX]);
    if (opts.prefs) removeKey(PREFS_KEY);
  }

  function onUnavailable(cb) {
    unavailableCb = (typeof cb === 'function') ? cb : null;
  }

  /* ---- 测试注入口（下划线前缀 = 非公开） ---- */

  function _useStorage(s) {
    Object.keys(pending).forEach(function (k) { clearTimeout(pending[k].timer); });
    pending = Object.create(null);
    storageRef = s || null;
    memory = Object.create(null);
    degraded = false;
    notified = false;
    schemaChecked = false;
  }

  function _storage() { return storageRef; }

  /* ---- 默认后端：浏览器里用真正的 localStorage，取它这个动作本身
     就可能抛（见文件头），所以整段包 try/catch，不做任何形状探测——
     形状再古怪也会在第一次真正读写时被 ensureSchema/readKey/writeKey
     的 try/catch 统一接住，不需要在这里提前猜。 */
  function initDefaultStorage() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        _useStorage(localStorage);
        return;
      }
    } catch (e) { /* 访问 localStorage 本身抛错：按不可用处理 */ }
    _useStorage(null);
  }

  initDefaultStorage();

  return {
    available,
    getDraft,
    setDraft,
    scheduleDraft,
    flush,
    getProgress,
    patchProgress,
    getPrefs,
    setPrefs,
    countRecords,
    clearProgram,
    clearMany,
    clearAll,
    onUnavailable,
    DEBOUNCE_MS,
    SCHEMA_VERSION,
    _useStorage,
    _storage
  };
});
