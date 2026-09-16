'use strict';
/* interact —— 页面装配：把六个 core 模块接成一个三模式页面（读 / 挖空 / 影子临摹）。

   ── 这个文件的分层，是它唯一重要的设计 ──────────────────────────────
   这个模块有 DOM，但它的**决策逻辑不该有**。凡是"该拿哪一份文本""该筛掉谁"
   "该报什么错""光标该落在哪个字符上"这类判断，一律抽成**纯函数并导出**，在
   node 下由 interact.test.js 直接测；DOM 那一半只做一件事：把纯函数算出来的
   结果画出来。这样"挖空模式复制出去的是合并后的完整程序"这种事就有断言守着，
   而不是靠谁记得在浏览器里点一遍。

   导出的纯函数：filterPrograms / copyPayload / requirementLine / hintAt /
   panelLineNotes / clearScope / variantsOf / blankFeedback / traceStates。
   唯一带 DOM 的导出是 mount()，它在没有根节点时当场抛（node 下测得到这一条）。

   ── 剪贴板里只有纯源码 ──────────────────────────────────────────────
   `pip install numpy` 那行显示在按钮**旁边**，绝不进剪贴板：她复制完是要直接
   粘进 PyCharm 跑的，剪贴板里混进一行 pip 提示，粘进去就是一个语法错。整套
   东西存在的理由就是这一下粘贴，所以 copyPayload 只回源码，模式名、行注、
   pip 行一概不掺。

   ── 读 / 临摹 / 复制一律走 Exercise.clean，不是裸 program.source ────
   裸源码里带着 `# >>> BLANK id=… hint="中文提示"` 这两行出题标记：直接显示
   就是把答案的元数据摆在学习者眼前，拿去临摹就是让她把中文提示也逐字敲一遍
   （而且中文全角字符会让三层逐字符对齐当场错位）。裁决 R16。

   ── 依赖惰性取 ──────────────────────────────────────────────────────
   `factory(function () { return root.PyLex; }, …)`，不是 `factory(root.PyLex)`。
   python/scripts/inline_core.py 就地替换每一对标记，不保证 INTERACT 排在最后；
   取值推迟到调用那一刻，块的先后顺序就不再要紧（spec §4.6，有门查这一条）。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      function () { return require('./py-lex.js'); },
      function () { return require('./store.js'); },
      function () { return require('./exercise.js'); },
      function () { return require('./editor.js'); },
      function () { return require('./judge.js'); },
      function () { return require('./trace.js'); }
    );
  } else {
    root.PyInteract = factory(
      function () { return root.PyLex; },
      function () { return root.Store; },
      function () { return root.Exercise; },
      function () { return root.Editor; },
      function () { return root.Judge; },
      function () { return root.Trace; }
    );
  }
})(typeof self !== 'undefined' ? self : this, function (getPyLex, getStore, getExercise, getEditor, getJudge, getTrace) {
  'use strict';

  /* ---- 依赖取用：取到就当场校验，没装载就响亮地抛 ----
     安静地退化（比如"没有 Exercise 就拿裸 source 顶上"）在这里是最坏的选择：
     页面看上去正常，摆出来的却是带出题标记的源码。 */
  function need(get, name, file, method) {
    var m = get();
    if (!m || typeof m[method] !== 'function') {
      throw new Error('PyInteract needs ' + name + ' (python/core/' + file + ') loaded first.');
    }
    return m;
  }
  function pyLex()   { return need(getPyLex,   'PyLex',    'py-lex.js',   'tokenize'); }
  function store()   { return need(getStore,   'Store',    'store.js',    'getDraft'); }
  function exercise(){ return need(getExercise,'Exercise', 'exercise.js', 'clean'); }
  function editor()  { return need(getEditor,  'Editor',   'editor.js',   'highlight'); }
  function judge()   { return need(getJudge,   'Judge',    'judge.js',    'compare'); }
  function trace()   { return need(getTrace,   'Trace',    'trace.js',    'create'); }

  /* ================= i18n =================
     全部面向使用者的文案都是 {zh,en} 对，经 t() 出去；语言由调用方给，
     不在这里读 localStorage（那是壳与页面的事，契约 C7）。 */
  var STR = {
    modeRead:    { zh: '读',       en: 'Read' },
    modeBlank:   { zh: '挖空',     en: 'Fill in' },
    modeTrace:   { zh: '临摹',     en: 'Trace' },
    copy:        { zh: '复制',     en: 'Copy' },
    copied:      { zh: '已复制到剪贴板', en: 'Copied to clipboard' },
    copyFailed:  { zh: '复制失败——请手动选中代码复制', en: 'Copy failed - select the code and copy by hand' },
    filters:     { zh: '筛选',     en: 'Filters' },
    level:       { zh: '难度',     en: 'Level' },
    kind:        { zh: '类型',     en: 'Kind' },
    boards:      { zh: '考试局',   en: 'Boards' },
    maxLines:    { zh: '不超过 {0} 行', en: 'at most {0} lines' },
    anyLength:   { zh: '不限长度', en: 'any length' },
    nothing:     { zh: '这组筛选下没有程序', en: 'No program matches these filters' },
    variants:    { zh: '同一问题的写法', en: 'Other ways to write this' },
    compare:     { zh: '并排对照', en: 'Side by side' },
    lines:       { zh: '{0} 行',   en: '{0} lines' },
    notes:       { zh: '讲解',     en: 'Notes' },
    lineNotes:   { zh: '行注',     en: 'Line notes' },
    stats:       { zh: '统计',     en: 'Stats' },
    hint:        { zh: '提示',     en: 'Hint' },
    giveUp:      { zh: '填进去',   en: 'Fill it in' },
    check:       { zh: '检查',     en: 'Check' },
    checkAll:    { zh: '全部检查', en: 'Check all' },
    blankOk:     { zh: '对了', en: 'Correct' },
    blankDiff:   { zh: '第 {0} 个 token 起不同：期待 {1}，你写了 {2}',
                  en: 'token #{0} differs: expected {1}, you wrote {2}' },
    blankMissing:{ zh: '第 {0} 个 token 还没写：这里应该有 {1}',
                  en: 'token #{0} is missing: {1} should be here' },
    blankExtra:  { zh: '第 {0} 个 token 是多的：{1} 不该在这里',
                  en: 'token #{0} is extra: {1} does not belong here' },
    blankIndent: { zh: '第 {0} 行缩进对不上：期待相对缩进 {1} 格，你写了 {2} 格',
                  en: 'line {0} indent is off: expected {1} spaces relative, you wrote {2}' },
    blankLead:   { zh: '第 1 行缩进对不上：这个空从第 {1} 格开始，你写了 {2} 格',
                  en: 'line 1 indent is off: this blank starts at column {1}, you wrote {2}' },
    blankDiffLiteral: { zh: '第 {0} 个 token（{1}）里第 {2} 个字符起不同',
                  en: 'token #{0} ({1}) differs from character {2}' },
    blankWrongKind:   { zh: '第 {0} 个 token 应该是{1}，你写了 {2}',
                  en: 'token #{0} should be {1}, you wrote {2}' },
    blankMissingLiteral: { zh: '第 {0} 个 token 还没写：这里应该有{1}',
                  en: 'token #{0} is missing: {1} should be here' },
    literalString:  { zh: '一个字符串', en: 'a string' },
    literalFstring: { zh: '一个 f-string', en: 'an f-string' },
    blankAllOk:  { zh: '全部填对了', en: 'All blanks correct' },
    given:       { zh: '（已填入标准答案，不计完成）', en: '(standard answer filled in, not counted as done)' },
    alpha:       { zh: '影子',     en: 'Shadow' },
    alphaTrace:  { zh: '描红',     en: 'Trace 100%' },
    alphaFaint:  { zh: '淡影',     en: 'Faint 35%' },
    alphaBlind:  { zh: '盲打',     en: 'Blind 0%' },
    strictness:  { zh: '错字反馈', en: 'On a wrong key' },
    strictLoose: { zh: '宽松',     en: 'Lenient' },
    strictMark:  { zh: '标红',     en: 'Mark red' },
    strictBlock: { zh: '硬拦截',   en: 'Block it' },
    follow:      { zh: '跟随影子', en: 'Follow the shadow' },
    restart:     { zh: '重来',     en: 'Restart' },
    accuracy:    { zh: '正确率',   en: 'Accuracy' },
    cpm:         { zh: '字符/分',  en: 'chars/min' },
    elapsed:     { zh: '用时',     en: 'Time' },
    backspaces:  { zh: '退格',     en: 'Backspaces' },
    lineMore:    { zh: '你比参考多了 {0} 行', en: 'You are {0} line(s) ahead of the reference' },
    resumed:     { zh: '接着上次的草稿打的，这一遍不计入最好成绩',
                  en: 'Resumed from a saved draft - this run is not counted towards your best' },
    blockedExpect:{ zh: '硬拦截：第 {0} 行第 {1} 格应该是 {2}',
                  en: 'Blocked: line {0}, column {1} should be {2}' },
    blockedNewline:{ zh: '硬拦截：第 {0} 行到这里就该换行了（按回车）',
                  en: 'Blocked: line {0} ends here - press Enter' },
    blockedLineEnd:{ zh: '硬拦截：参考的第 {0} 行只有 {1} 个字符，你已经打到第 {2} 格了——按退格删掉多出来的部分',
                  en: 'Blocked: line {0} of the reference is only {1} characters, you are at column {2} - backspace over the extra' },
    blockedPastEnd:{ zh: '硬拦截：参考只有 {0} 行，这一行已经超出去了——按退格回到参考里',
                  en: 'Blocked: the reference has only {0} lines, this line is past the end - backspace back into it' },
    blockedIndent:{ zh: '硬拦截：这一行的缩进比参考多了 {0} 格——先按 {0} 次退格',
                  en: 'Blocked: this line is indented {0} space(s) more than the reference - backspace {0} time(s) first' },
    lineLess:    { zh: '你比参考少了 {0} 行', en: 'You are {0} line(s) short of the reference' },
    clearOne:    { zh: '清空本题', en: 'Clear this program' },
    clearModule: { zh: '清空本模块', en: 'Clear this module' },
    clearAll:    { zh: '清空全部', en: 'Clear everything' },
    confirmOne:  { zh: '清空本题的草稿？本题现有 {0} 条记录，其中的草稿会被清除，进度保留。',
                  en: 'Clear the drafts for this program? It has {0} record(s); the drafts go, the progress stays.' },
    confirmModule:{ zh: '清空本模块所有题的草稿？本模块现有 {0} 条记录，其中的草稿会被清除，进度保留。',
                  en: 'Clear drafts for every program in this module? {0} record(s) here; the drafts go, the progress stays.' },
    confirmAll:  { zh: '清空整个 python 子项目的草稿与进度？本页涉及 {0} 条记录，其他页的记录也会一并清除（语言与偏好保留）。',
                  en: 'Clear drafts and progress for the whole python subproject? {0} record(s) on this page, plus every record on the other pages (language and preferences are kept).' },
    cleared:     { zh: '已清空',   en: 'Cleared' },
    bannerQuota: { zh: '浏览器存储已满：这次之后的输入不会被保存。先清空一些草稿，再继续。',
                  en: 'Browser storage is full: from now on your typing is NOT being saved. Clear some drafts first.' },
    bannerNone:  { zh: '这个浏览器不让本页使用本地存储：你打的内容不会被保存，关掉页面就没了。',
                  en: 'This browser will not let the page use local storage: nothing you type is being saved.' },
    bannerMigrated:{ zh: '存储格式已升级，旧的草稿与进度已被清除。',
                  en: 'The storage format changed; old drafts and progress were cleared.' },
    metaLevel:   { zh: '难度 L{0}', en: 'Level {0}' },
    blanksCount: { zh: '{0} 个空',  en: '{0} blank(s)' },
    tags:        { zh: '标签',      en: 'Tags' },
    runtime:     { zh: '运行环境',  en: 'Runtime' },
    notTagged:   { zh: '未标注',    en: 'Not tagged' },
    needsPip:    { zh: '需要先装：', en: 'Install first: ' }
  };

  function t(key, lang) {
    var e = STR[key];
    if (!e) { return key; }
    return (lang === 'en') ? e.en : e.zh;
  }
  function fmt(tpl, args) {
    return String(tpl).replace(/\{(\d+)\}/g, function (_m, i) {
      var v = args[Number(i)];
      return (v === undefined || v === null) ? '' : String(v);
    });
  }
  function ts(key, lang, args) { return fmt(t(key, lang), args || []); }

  /* 取 {zh,en} 文案；给的不是对象时原样返回（notes 里允许纯字符串）。 */
  function pick(obj, lang) {
    if (obj == null) { return ''; }
    if (typeof obj === 'string') { return obj; }
    var v = (lang === 'en') ? obj.en : obj.zh;
    return (v == null) ? (obj.en || obj.zh || '') : v;
  }

  /* ======================================================================
     纯函数层 —— 以下全部不碰 DOM，interact.test.js 在 node 下直接测
     ====================================================================== */

  function asList(v) {
    if (Array.isArray(v)) { return v; }
    return (v === undefined || v === null || v === '') ? [] : [v];
  }

  /* ---- 程序元数据的四个闭集 ----
     与 python/scripts/gates/library.py 的 LEVELS / KINDS / BOARDS / RUNTIMES 同值，由
     syntax.closed_set_mirror_check 比对。第 0 期前三个是 mount() 里的局部变量，与门里的
     闭集是一对没人看管的镜像。数组有序：选择器按这个顺序排 chip。 */
  var LEVELS = [1, 2, 3, 4, 5];
  var KINDS = ['syntax', 'pattern', 'algorithm', 'project', 'embedded'];
  var BOARDS = ['AQA', 'OCR', 'Edexcel', 'CIE'];
  var RUNTIMES = ['cpython', 'micropython-microbit', 'micropython-pico'];

  var KIND_LABELS = {
    syntax:    { zh: '语法',     en: 'Syntax' },
    pattern:   { zh: '惯用模式', en: 'Pattern' },
    algorithm: { zh: '算法',     en: 'Algorithm' },
    project:   { zh: '项目',     en: 'Project' },
    embedded:  { zh: '嵌入式',   en: 'Embedded' }
  };
  var RUNTIME_LABELS = {
    'cpython':              { zh: 'CPython', en: 'CPython' },
    'micropython-microbit': { zh: 'MicroPython · micro:bit', en: 'MicroPython · micro:bit' },
    'micropython-pico':     { zh: 'MicroPython · Pico', en: 'MicroPython · Pico' }
  };

  /* 未知值原样给出而不是空串：一个看得出是错的标签，好过一块看起来正常的空白。
     已知键但缺了一种语言的翻译时，退到另一种语言，两者都缺才退到原始值——
     绝不吐 undefined 或空串（那会在面板/选择器上现出一块空白或字面 "undefined"，
     R1 修复轮：这条退化路径原来没有，project.zh 少写一个键就能让 UI 出现空白，
     而闭集镜像门/kindLabel 的旧完整性测试都测不出来）。 */
  function kindLabel(kind, lang) {
    var e = KIND_LABELS[kind];
    if (!e) { return String(kind == null ? '' : kind); }
    return (lang === 'en' ? e.en : e.zh) || (lang === 'en' ? e.zh : e.en) ||
           String(kind == null ? '' : kind);
  }
  function runtimeLabel(rt, lang) {
    var e = RUNTIME_LABELS[rt];
    if (!e) { return String(rt == null ? '' : rt); }
    return (lang === 'en' ? e.en : e.zh) || (lang === 'en' ? e.zh : e.en) ||
           String(rt == null ? '' : rt);
  }

  /* panelMeta(program, lang, blankCount) → [{ key, label, items }]

     说明面板顶部那几行元数据（第 1 期设计 B7）。决定显示什么的逻辑放在这里、可测；
     renderPanel 只负责画。三种模式都显示——元数据不泄题。
       summary  难度 · 类型 · 行数 · 空数（blankCount 不是数字时省略，不编）
       boards   考试局；空时显式写「未标注」，并带 placeholder:true——渲染层靠这个
                布尔判断是不是占位符，而不是拿翻译后的字符串去比「未标注」/'Not tagged'
                （R1 修复轮：字符串比较在换语言、改文案时会悄悄失效）
       tags     标签；空时整行不出
       runtime  只在非 cpython 时出 */
  function panelMeta(program, lang, blankCount) {
    if (!program) { return []; }
    var head = [ts('metaLevel', lang, [program.level]), kindLabel(program.kind, lang)];
    if (typeof program.lines === 'number') { head.push(ts('lines', lang, [program.lines])); }
    if (typeof blankCount === 'number') { head.push(ts('blanksCount', lang, [blankCount])); }
    var rows = [{ key: 'summary', label: '', items: [head.join(' · ')] }];

    var boards = asList(program.boards);
    var boardsRow = { key: 'boards', label: t('boards', lang),
                       items: boards.length ? boards.slice() : [t('notTagged', lang)] };
    if (!boards.length) { boardsRow.placeholder = true; }
    rows.push(boardsRow);

    var tags = asList(program.tags);
    if (tags.length) { rows.push({ key: 'tags', label: t('tags', lang), items: tags.slice() }); }

    if (program.runtime && program.runtime !== 'cpython') {
      rows.push({ key: 'runtime', label: t('runtime', lang), items: [runtimeLabel(program.runtime, lang)] });
    }
    return rows;
  }

  /* filterPrograms(programs, filters) → Program[]

     filters = { level: [1,2], kind: ['pattern'], boards: ['AQA'], maxLines: 40 }
     空/缺省的维度不筛；**多个维度是与、同一维度内是或**；maxLines 含等号。
     level 两侧都过一遍 Number()，因为 UI 的 dataset 只会给字符串——在这里
     统一，比要求每个调用点自己记得转更不容易漏。 */
  function filterPrograms(programs, filters) {
    var f = filters || {};
    var level = asList(f.level).map(Number);
    var kind = asList(f.kind);
    var boards = asList(f.boards);
    var maxLines = (typeof f.maxLines === 'number' && f.maxLines > 0) ? f.maxLines : 0;

    return (programs || []).filter(function (p) {
      if (level.length && level.indexOf(Number(p.level)) === -1) { return false; }
      if (kind.length && kind.indexOf(p.kind) === -1) { return false; }
      if (boards.length) {
        var own = asList(p.boards);
        var hit = own.some(function (b) { return boards.indexOf(b) !== -1; });
        if (!hit) { return false; }
      }
      if (maxLines && !(typeof p.lines === 'number' && p.lines <= maxLines)) { return false; }
      return true;
    });
  }

  /* copyPayload(mode, program, state) → string

     剪贴板里**只有纯源码**：pip 提示、行注、模式名一概不进（见文件头）。
       'read'  → Exercise.clean(source)            ← 不是裸 source（R16）
       'blank' → Exercise.merge(source, answers)   （merge 本就剥掉指令行）
       'trace' → state.typed                       （她自己打的那一份）
     未知模式当场抛：复制是"她要拿去跑"的那一步，静默复制错的东西没有任何
     好处，而三个模式是闭集，传进来别的值一定是调用方的错。 */
  function copyPayload(mode, program, state) {
    var p = program || {};
    var s = state || {};
    var src = (typeof p.source === 'string') ? p.source : '';
    if (mode === 'read')  { return exercise().clean(src); }
    if (mode === 'blank') { return exercise().merge(src, s.answers || {}); }
    if (mode === 'trace') { return (typeof s.typed === 'string') ? s.typed : ''; }
    throw new Error('copyPayload: 未知模式 ' + mode + '（只认 read / blank / trace）');
  }

  /* requirementLine(program) → 'pip install numpy pandas' | null
     按 requires 的声明顺序，不排序（chapter.json 里写的顺序是作者的意思）。 */
  function requirementLine(program) {
    var r = asList(program && program.requires);
    if (!r.length) { return null; }
    return 'pip install ' + r.join(' ');
  }

  /* hintAt(blank, tier, lang) → string

     一个空的提示是一条字符串里用 HINT_MARK（' || '）分好的若干级，点一次展开一级：
     tier=1 只给第一段，tier=2 给前两段，超过 level（或超过实际段数）就钳住。
     展开的几级之间用 HINT_JOIN（' · '）连接——' || ' 是写在 .py 指令行里的出题标记，
     不是给她看的标点。

     为什么是一个显式标记而不是标点（第 1 期设计 B1）：第 0 期按 ' · ' / '；' / '; '
     三者中第一个出现的切分，于是正文里不能随手用分号——level=1 的提示里只要出现
     一个「；」，后半句就被静默截掉。Python 没有 || 运算符，正文几乎不会写到它。

     没有标记就是"这条提示只有一级"——**整条给出去**，而不是给空串：作者没分级
     不等于她点了提示却什么都看不到。 */
  var HINT_MARK = ' || ';
  var HINT_JOIN = ' · ';

  function hintAt(blank, tier, lang) {
    var b = blank || {};
    var raw = (lang === 'en') ? b.hintEn : b.hint;
    if (typeof raw !== 'string' || raw === '') { return ''; }

    var parts = raw.split(HINT_MARK);
    var level = (typeof b.level === 'number' && b.level > 0) ? b.level : parts.length;
    var cap = Math.min(level, parts.length);
    var n = Math.min((typeof tier === 'number') ? tier : 0, cap);
    if (n < 1) { return ''; }
    return parts.slice(0, n).join(HINT_JOIN);
  }

  /* panelLineNotes(program, mode) → 要渲染的行注数组

     **只有读模式给行注**（spec §1.1 的模式表）。这不是排版偏好，是防泄题：
     面板把 `note.at` 的**整行原文**逐字打进一个 `<code>`，而锚可以落在挖空体
     里——挖空模式下那等于把答案印在屏幕右侧。ch01 实测三个挖空的行注全被泄，
     其中一条的正文还直接说破了那个空唯一要考的判断（原文不在这里复述：这段
     注释是随页面一起发出去的字节）。

     **临摹模式一并挡掉**，理由同样具体：临摹有 `alphaBlind` 档（`S.alpha = 0`，
     影子层全透明，她凭记忆敲）。那一档下右侧面板照样印着整行原文——泄的是同
     一件事，只换了个模式。

     所以判据写成 `=== 'read'`（**白名单**）而不是 `!== 'blank'`（黑名单）：
     黑名单在加第四个模式时会默认放行，而「默认放行」正是这个洞的形状。

     两道防线各守一半，缺一不可：
       · 这里：非读模式面板里根本没有行注段；
       · `anchor_check()`：锚一开始就不许落在挖空体内。 */
  function panelLineNotes(program, mode) {
    if (mode !== 'read') { return []; }
    return (program && program.lineNotes) ? program.lineNotes : [];
  }

  /* clearScope(scope, programs, currentId) → string[] | null

     'all' 这一支返回 **null**，含义是"交给 Store.clearAll()，不走 id 列表"：
     整项清空扫的是键前缀，本页根本列举不出别的页的 id，返回一个只含本页
     id 的数组会是一个看上去很对、实际上清不干净的谎（裁决 R4）。
     未知 scope 当场抛——清空是不可撤销的，猜不得。 */
  function clearScope(scope, programs, currentId) {
    if (scope === 'program') { return currentId ? [currentId] : []; }
    if (scope === 'module') {
      return (programs || []).map(function (p) { return p.id; });
    }
    if (scope === 'all') { return null; }
    throw new Error('clearScope: 未知范围 ' + scope + '（只认 program / module / all）');
  }

  /* clearRecords(store, scope, ids) —— 按 scope 真正动手清

     收一个 store 形状的对象（不是直接抓模块）**只为一件事**：让"先 flush 再清"
     这个次序可以在 node 下被断言。次序不是风格问题——`Store.cancelPending`
     只被 setDraft/scheduleDraft 调用，**清空不取消排队中的那次防抖写**，
     所以不先落盘就删，400 ms 后那次写会把草稿原样送回来，而 UI 已经说了
     "已清空"，她不会再去看第二眼。

     `ids === null` 是 `clearScope('all')` 的出口：交给 clearAll 扫键前缀。
     单题 / 模块两级只清 draft（进度不连坐，spec §4.5）。 */
  function clearRecords(store, scope, ids) {
    store.flush();
    if (ids === null) { store.clearAll(); return; }
    if (scope === 'program') {
      ids.forEach(function (id) { store.clearProgram(id); });
      return;
    }
    store.clearMany(ids);
  }

  /* clearHitsCurrent(ids, currentId) → boolean
     这一次清空**动到当前这一题了吗**？

     选择器里每一项的「⋯ → 清空本题」可以清**任意**一个程序，所以"清完要不要
     重新读草稿、要不要把当前这一遍临摹作废"不能无条件成立：她正临摹着 A、
     顺手清掉 B 的草稿，若照样重置，下一次 traceRun() 会看到 S.typed 非空、
     把一遍**从未被打断的**临摹标成 resumed，成绩从此不计——而"重来"又会丢掉
     她真实的进度。`ids === null` 是整项清空（Store.clearAll 扫键前缀），
     那一定包含当前这一题。 */
  function clearHitsCurrent(ids, currentId) {
    if (ids === null) { return true; }
    if (!currentId) { return false; }
    return (ids || []).indexOf(currentId) !== -1;
  }

  /* clearFlash(ui) —— 撤掉硬拦截的红边与说明。

     单拎出来是因为它跑在一个 1600 ms 的延时回调里，而那段时间足够她切走模式
     或换一题，`renderStage()` 会把 traceUI 置空：**回调必须在"已经没人要它"
     的情况下安全返回**，而不是抛一个未捕获的 TypeError 进控制台。
     （拆除那一侧还会 clearTimeout，两道保险互不依赖。） */
  function clearFlash(ui) {
    if (!ui || !ui.input) { return; }
    ui.input.classList.remove('py-blocked');
    if (ui.blockNote) { ui.blockNote.hidden = true; }
  }

  /* variantsOf(programs, program) → Program[]
     同一个 `problem` 的几种写法（§2.4），按注册表顺序、含自己。
     缺 `problem` 字段的程序**只和自己一组**：naive 的 `q.problem === p.problem`
     会把所有 undefined 判成同一组，把毫不相干的程序摆成"变体"。 */
  function variantsOf(programs, program) {
    var p = program || {};
    var key = p.problem;
    if (typeof key !== 'string' || key === '') { return p.id ? [p] : []; }
    return (programs || []).filter(function (q) { return q.problem === key; });
  }

  /* 一行的前导空格数（只数半角空格，与 Editor.indentOf 同法）。 */
  function leadSpaces(line) {
    var i = 0;
    while (i < line.length && line.charAt(i) === ' ') { i++; }
    return i;
  }

  /* literalKindName(type, lang) → 字面量类别的双语名字（'一个字符串' / '一个 f-string'）。
     只在这一处定义；blankFeedback 的字面量分支都从这里取，不各自拼一遍。 */
  function literalKindName(type, lang) {
    return t(type === 'fstring' ? 'literalFstring' : 'literalString', lang);
  }

  /* blankFeedback(answer, reference, lang) → { ok, kind, message, caret }

     逐空判定的那句话与光标位置。**不给答案**（不回整段 body），只报
     "第几个 token 起开始不同：期待 X，你写了 Y"，caret 是要送进 textarea
     的字符下标（Judge 的两种 index 语义完全不同，见下）。

       kind 'different' / 'missing' / 'extra'：index 是**有效 token 下标**，
         expected/got 是 token 原文（字符串或 null）。光标去那个 token 的起点，
         所以要用 PyLex.significant 现取它在 answer 里的偏移。
       kind 'indent'：index 是**物理行号**，expected/got 是**相对缩进数值**
         （不是 null、不是字符串）。光标去那一行的行首。裁决 R30/R31。

     另有 Judge 结构上看不见的一种错：**整块的绝对缩进**。Judge.normalize 比的是
     行与行之间的相对缩进，所以单行挖空体 `    x = 1` 与 `x = 1` 在它眼里完全
     相等——可 Exercise.merge 是拿她这一份原样替换回源码的，少了那四格，粘进
     PyCharm 就是 IndentationError。所以这里先自己比一遍第一行的绝对缩进。

     字面量例外（Task 11b，控制方裁决 T11-1，源自 Task 11 评审 C1）：PyLex 把
     一整个字符串或 f-string 切成**一个** token，"期待的 token 原文"对字面量
     来说就是答案本身——照其他 token 那样把 expected 印出来，等于把整行答案
     摆在她眼前。所以期待的 token 是 string/fstring 时，消息里绝不出现它的原文：
     kind 'different' 只说"第几个字符起不同"（下标是在 token 原文——含引号
     与 f-string 的 `f` 前缀——里数的，1 起）；她自己写的（`cmp.got`）仍可以
     照常复述，那是她自己的输入，不是答案。kind 'missing' 只说"这里该有一个
     字符串/f-string"，不带任何原文。kind 'extra' 与 'indent'/'lead-indent'
     不受影响——'extra' 没有 expected 可印，indent 系两种从不涉及字面量原文。 */
  function blankFeedback(answer, reference, lang) {
    var a = String(answer == null ? '' : answer);
    var r = String(reference == null ? '' : reference);

    var aFirst = a.split('\n')[0];
    var rFirst = r.split('\n')[0];
    if (aFirst.trim() !== '' && leadSpaces(aFirst) !== leadSpaces(rFirst)) {
      return {
        ok: false,
        kind: 'lead-indent',
        caret: 0,
        message: ts('blankLead', lang, [1, leadSpaces(rFirst), leadSpaces(aFirst)])
      };
    }

    var cmp = judge().compare(a, r);
    if (cmp.ok) {
      return { ok: true, kind: 'equal', caret: 0, message: t('blankOk', lang) };
    }

    if (cmp.kind === 'indent') {
      var starts = editor().lineStarts(a);
      var li = Math.max(0, Math.min(cmp.index, starts.length - 1));
      return {
        ok: false,
        kind: 'indent',
        caret: starts[li],
        message: ts('blankIndent', lang, [cmp.index + 1, cmp.expected, cmp.got])
      };
    }

    var L = pyLex();
    var toks = L.significant(L.tokenize(a));

    /* 字面量分支：只有 'different' / 'missing' 会指向一个"期待的 token"，
       'extra' 没有期待值可言。refTok 取参考侧同一下标的有效 token——与
       Judge.compare 用的是同一套 PyLex.significant(PyLex.tokenize(...))，
       下标口径一致（brief 已确认）。 */
    var refToks = (cmp.kind === 'different' || cmp.kind === 'missing')
      ? L.significant(L.tokenize(r)) : null;
    var refTok = refToks ? refToks[cmp.index] : null;
    var isLiteral = !!refTok && (refTok.type === 'string' || refTok.type === 'fstring');

    if (isLiteral && cmp.kind === 'missing') {
      return {
        ok: false,
        kind: cmp.kind,
        caret: a.length,
        message: ts('blankMissingLiteral', lang, [cmp.index + 1, literalKindName(refTok.type, lang)])
      };
    }

    if (isLiteral && cmp.kind === 'different') {
      var atTok = toks[cmp.index];
      if (atTok && (atTok.type === 'string' || atTok.type === 'fstring')) {
        /* 两边都是字面量：逐字符比 token 原文（含引号/前缀），找第一个不同的
           下标 k——一方是另一方前缀时取较短者的长度。绝不把 rt[i] 的原文
           （cmp.expected）放进消息，只用它来算 k。 */
        var refText = cmp.expected, atText = cmp.got;
        var short = Math.min(refText.length, atText.length);
        var k = short;
        for (var ci = 0; ci < short; ci++) {
          if (refText.charAt(ci) !== atText.charAt(ci)) { k = ci; break; }
        }
        return {
          ok: false,
          kind: cmp.kind,
          caret: Math.min(a.length, atTok.start + k),
          message: ts('blankDiffLiteral', lang, [cmp.index + 1, literalKindName(refTok.type, lang), k + 1])
        };
      }
      /* 她在该放字面量的位置写了别的东西：只说该放哪一类，仍可以复述她
         自己写的（cmp.got 是答案侧原文，不是答案）。 */
      return {
        ok: false,
        kind: cmp.kind,
        caret: atTok ? atTok.start : a.length,
        message: ts('blankWrongKind', lang, [cmp.index + 1, literalKindName(refTok.type, lang), cmp.got])
      };
    }

    var caret = (cmp.kind === 'missing' || !toks[cmp.index]) ? a.length : toks[cmp.index].start;
    var key = cmp.kind === 'missing' ? 'blankMissing'
            : cmp.kind === 'extra' ? 'blankExtra' : 'blankDiff';
    var args = cmp.kind === 'missing' ? [cmp.index + 1, cmp.expected]
             : cmp.kind === 'extra' ? [cmp.index + 1, cmp.got]
             : [cmp.index + 1, cmp.expected, cmp.got];
    return { ok: false, kind: cmp.kind, caret: caret, message: ts(key, lang, args) };
  }

  /* traceStates(reference, typed, result) → ('ok'|'bad'|'over')[]

     临摹中间层要按**她打的文本**的字符下标上色，而 Trace.update 给的
     marks[].index 是**参考侧**的偏移，两者在她多打/少打时根本不是一回事。
     这里用 Trace.alignLines 把两侧按行重新对齐，把 marks 按 update() 里
     同样的顺序（逐行、行内 j < min(typedFull, refFull)）消费回来，再把
     overflow 的 {line,col} 折回 typed 的下标。

     产出的数组长度恒等于 typed.length —— trace.js 文件头写死的不变量是
     `marks.length + overflow.length === typed.length`；万一哪天不成立，
     这里**整片不标红**而不是错位标红：一片无来由的红比没有红更难看懂。 */
  function traceStates(reference, typed, result) {
    var text = String(typed == null ? '' : typed);
    var states = new Array(text.length);
    for (var i = 0; i < text.length; i++) { states[i] = 'ok'; }

    var marks = (result && result.marks) || [];
    var overflow = (result && result.overflow) || [];
    if (marks.length + overflow.length !== text.length) { return states; }

    var rows = trace().alignLines(String(reference == null ? '' : reference), text);
    var lineStart = [];
    var pos = 0;
    for (var r = 0; r < rows.length; r++) {
      lineStart.push(pos);
      pos += rows[r].typedFull.length;
    }

    var m = 0;
    for (var k = 0; k < rows.length; k++) {
      var row = rows[k];
      var matchLen = Math.min(row.typedFull.length, row.refFull.length);
      for (var j = 0; j < matchLen && m < marks.length; j++, m++) {
        states[lineStart[k] + j] = (marks[m].state === 'ok') ? 'ok' : 'bad';
      }
    }
    for (var o = 0; o < overflow.length; o++) {
      var ov = overflow[o];
      var idx = (lineStart[ov.line] || 0) + ov.col;
      if (idx >= 0 && idx < states.length) { states[idx] = 'over'; }
    }
    return states;
  }

  /* expectedCharAt(reference, text, offset) → string | null

     「她打的这一格，按参考应当是哪个字符？」——硬拦截档要不要拒绝这次按键、
     以及拒绝之后屏幕上该说什么，都由它回答。

     用**文本自己的行列**去查参考，而不是全局偏移：她多打/少打一行之后，
     全局偏移就不再指向同一个位置了（`trace.js` 按行重新对齐，同一条道理）。
     两种"参考在这里没有内容"的情形都回 null，调用方分别说人话：
       · 这一行整行超出了参考（line >= 参考行数）
       · 这一列超出了本行、而本行是参考的最后一行（后面没有换行符可打了）
     本行未到结尾时列越界则应当打换行符，所以回 '\n' 而不是 null。 */
  function expectedCharAt(reference, text, offset) {
    var ref = String(reference == null ? '' : reference);
    var s = String(text == null ? '' : text);
    var before = s.slice(0, offset);
    var line = before.split('\n').length - 1;
    var col = offset - (before.lastIndexOf('\n') + 1);
    var refLines = ref.split('\n');
    var refLine = refLines[line];
    if (refLine === undefined) { return null; }
    if (col < refLine.length) { return refLine.charAt(col); }
    return (line < refLines.length - 1) ? '\n' : null;
  }

  /* charMatches(reference, text, offset) → boolean
     text[offset] 这个字符与参考的同一行同一列一致吗？参考在那里没有内容
     （expectedCharAt 回 null）时一律不一致——硬拦截档据此拒绝这次按键。 */
  function charMatches(reference, text, offset) {
    var expected = expectedCharAt(reference, text, offset);
    return expected !== null && expected === String(text == null ? '' : text).charAt(offset);
  }

  /* blockedHint(reference, text, offset, lang) → string

     硬拦截档**拒绝了一次按键**时屏幕上要说的那句话。这句话不是装饰：
     `applyEnter` 会把上一行的缩进带到下一行，而参考的下一行可能顶格，
     于是 col 一直落在参考行的内容之外——**她打什么都被拒**，唯一的出路是
     猜到要连按几次退格。一次她看不见的拒绝，与一个死掉的页面无法区分。 */
  function blockedHint(reference, text, offset, lang) {
    var ref = String(reference == null ? '' : reference);
    var s = String(text == null ? '' : text);
    var before = s.slice(0, offset);
    var line = before.split('\n').length - 1;
    var col = offset - (before.lastIndexOf('\n') + 1);
    var refLines = ref.split('\n');
    var expected = expectedCharAt(ref, s, offset);
    if (refLines[line] === undefined) {
      return ts('blockedPastEnd', lang, [refLines.length]);
    }
    if (expected === null) {
      return ts('blockedLineEnd', lang, [line + 1, refLines[line].length, col]);
    }
    if (expected === '\n') {
      return ts('blockedNewline', lang, [line + 1]);
    }
    /* 最常见的那一种拒绝：`applyEnter` 把上一行的深缩进带了下来，而参考这一行
       更浅。只报"第 N 格应该是 o"她仍要自己数格子；直接说多了几格、按几次退格。
       判据：光标之前这一行全是空格（就是自动缩进那几格），且比参考的缩进深。 */
    var lineStart = offset - col;
    var typedIndent = s.slice(lineStart, offset);
    var refIndent = leadSpaces(refLines[line]);
    if (/^ *$/.test(typedIndent) && col > refIndent) {
      return ts('blockedIndent', lang, [col - refIndent]);
    }
    return ts('blockedExpect', lang, [line + 1, col + 1, expected]);
  }

  /* ---- 一次临摹 run 的生命周期（三个决策，全是纯的）----

     `trace.js` 只在某个下标**首次被 seen** 时把它记进 firstWrong。所以把一整段
     文本一次喂进一个**新建**的 session，每个字符都在它最终正确的样子下被首次
     看见——历史上的错全没了：

       连续会话（打错→退格→改对）   accuracy 0.9730  errors 1  backspaces 1
       新建 session 喂同样的终文本   accuracy 1.0000  errors 0  backspaces 0

     于是两条纪律：
       1. 一次 run 只持有**一个** session，跨模式切换存活（`reuseRun`）——
          否则按一次 `1` 再按一次 `3` 就能刷出 100%，而 bestAcc 走 Math.max
          且熬得过清空，那个她没打出来的成绩会**永久**留在进度里。
       2. 从一份非空草稿上接着打的 run 标成 `resumed`，**不写 progress**
          （`shouldSaveBest`），直到「重来」开一遍干净的。 */
  function newRun(progId, reference, typed) {
    var ref = String(reference == null ? '' : reference);
    return {
      progId: progId,
      reference: ref,
      session: trace().create(ref),
      resumed: String(typed == null ? '' : typed) !== '',
      saved: false
    };
  }

  /* 这个 run 还能接着用吗？同一题、同一份参考才行——模式来回切时正是靠它
     不去重建 session。 */
  function reuseRun(run, progId, reference) {
    return !!run && run.progId === progId &&
           run.reference === String(reference == null ? '' : reference);
  }

  /* 这一遍的成绩该写进 progress 吗？只有"从零开始、这一遍真打完了、且还没记过"
     才算数。 */
  function shouldSaveBest(run, stats) {
    if (!run || run.resumed || run.saved) { return false; }
    if (!stats || !(stats.total > 0)) { return false; }
    return stats.correct >= stats.total;
  }

  /* applyFollowEnter(reference, value, pos) → { value, selStart, selEnd }
     「跟随影子」：Enter 直接跳到标准程序下一行的缩进位。默认关——缩进正是
     最该练的那一样，帮她跳等于把练习本身拿掉了。形状与 Editor.applyTab /
     applyEnter 一致（selEnd === selStart 恒成立，裁决 R32）。 */
  function applyFollowEnter(reference, value, pos) {
    var ref = String(reference == null ? '' : reference);
    var v = String(value == null ? '' : value);
    var before = v.slice(0, pos);
    var lineIdx = before.split('\n').length; /* 换行之后落到的那一行（0-based） */
    var refLines = ref.split('\n');
    var indent = ' '.repeat(leadSpaces(refLines[lineIdx] || ''));
    var at = pos + 1 + indent.length;
    return { value: before + '\n' + indent + v.slice(pos), selStart: at, selEnd: at };
  }

  /* ======================================================================
     DOM 层 —— 只把上面算出来的东西画出来
     ====================================================================== */

  /* 三层临摹的 CSS 跟着模块走，不留给页面去复刻：三层共用 `.py-layer`
     这一个类是整个临摹模式的对齐前提（字体 / 行高 / 内边距 / tab-size 四样
     必须逐字相同），把它和依赖它的代码放在同一个文件里，才不会有人改了页面
     样式却不知道自己在改什么。页面只负责提供 --font-code 等令牌。 */
  var STYLE_ID = 'py-interact-style';
  var CSS = [
    '.py-root{display:flex;flex-direction:column;height:100%;min-height:0;position:relative;',
    '  color:var(--ui-bright,#e2e8f0);font-family:var(--font-cn,ui-sans-serif,sans-serif);',
    '  --py-accent:var(--trace-cyan,#2dd4ea)}',
    '.py-root *{box-sizing:border-box}',
    '.py-banner{padding:9px 14px;font-size:13px;line-height:1.5;color:#fff7ed;',
    '  background:rgba(251,146,60,.18);border-bottom:1px solid rgba(251,146,60,.45)}',
    '.py-body{display:flex;flex:1;min-height:0}',
    '.py-picker{flex:0 0 230px;min-width:0;display:flex;flex-direction:column;overflow:auto;',
    '  background:var(--panel-bg,rgba(13,20,36,.74));border-right:1px solid var(--panel-line,rgba(148,163,184,.16))}',
    '.py-main{flex:1;min-width:0;display:flex;flex-direction:column}',
    '.py-panel{flex:0 0 288px;min-width:0;overflow:auto;padding:12px 14px;font-size:13px;line-height:1.66;',
    '  background:var(--panel-bg,rgba(13,20,36,.74));border-left:1px solid var(--panel-line,rgba(148,163,184,.16))}',
    '.py-sec{padding:10px 12px;border-bottom:1px solid var(--panel-line,rgba(148,163,184,.16))}',
    '.py-sec h4{margin:0 0 7px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--ui-slate,#9fb0c8);font-weight:600}',
    '.py-chips{display:flex;flex-wrap:wrap;gap:5px}',
    '.py-chip{padding:3px 9px;font-size:12px;border-radius:999px;cursor:pointer;color:var(--ui-slate,#9fb0c8);',
    '  background:transparent;border:1px solid var(--panel-line,rgba(148,163,184,.3))}',
    '.py-chip[aria-pressed="true"]{color:#05070d;background:var(--py-accent);border-color:var(--py-accent)}',
    '.py-list{list-style:none;margin:0;padding:6px 0;flex:1}',
    '.py-item{display:flex;align-items:flex-start;gap:6px;padding:7px 12px;cursor:pointer}',
    '.py-item:hover{background:rgba(148,163,184,.08)}',
    '.py-item[aria-current="true"]{background:rgba(148,163,184,.14);box-shadow:inset 3px 0 0 var(--py-accent)}',
    '.py-item-t{flex:1;min-width:0;font-size:13px;line-height:1.4}',
    '.py-item-m{display:block;font-size:11px;color:var(--ui-slate,#9fb0c8);margin-top:2px}',
    '.py-x{flex:0 0 auto;border:0;background:transparent;color:var(--ui-slate,#9fb0c8);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px}',
    '.py-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 12px;',
    '  border-bottom:1px solid var(--panel-line,rgba(148,163,184,.16))}',
    '.py-bottom{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;',
    '  border-top:1px solid var(--panel-line,rgba(148,163,184,.16))}',
    '.py-spacer{flex:1}',
    '.py-btn{padding:4px 11px;font-size:12px;border-radius:7px;cursor:pointer;color:var(--ui-bright,#e2e8f0);',
    '  background:rgba(148,163,184,.1);border:1px solid var(--panel-line,rgba(148,163,184,.3));font-family:inherit}',
    '.py-btn:hover{background:rgba(148,163,184,.2)}',
    '.py-btn[aria-pressed="true"]{color:#05070d;background:var(--py-accent);border-color:var(--py-accent)}',
    '.py-pip{font-family:var(--font-code,ui-monospace,monospace);font-size:12px;color:var(--ui-slate,#9fb0c8)}',
    '.py-stage{position:relative;flex:1;min-height:0;overflow:hidden;background:rgba(5,7,13,.45)}',
    '.py-docs{display:flex;height:100%;gap:1px;background:var(--panel-line,rgba(148,163,184,.16))}',
    '.py-doc{flex:1;min-width:0;height:100%;overflow:auto;background:rgba(5,7,13,.45)}',
    '.py-doc-h{position:sticky;top:0;z-index:2;padding:4px 12px;font-size:11px;color:var(--ui-slate,#9fb0c8);',
    '  background:rgba(5,7,13,.92)}',
    /* ---- 代码行：行号槽 + 代码。行号槽固定宽度，代码区 white-space:pre 绝不软换行 ---- */
    '.py-line{display:flex;align-items:flex-start;min-width:max-content}',
    '.py-line.py-diff{background:rgba(167,139,250,.12)}',
    '.py-line.py-anchor{background:rgba(45,212,234,.12)}',
    '.py-num{flex:0 0 52px;text-align:right;padding:0 10px 0 6px;cursor:default;user-select:none;',
    '  position:sticky;left:0;z-index:1;background:rgba(5,7,13,.92);',
    '  font-family:var(--font-code,ui-monospace,monospace);font-size:12px;line-height:20px;color:rgba(159,176,200,.55)}',
    '.py-num.py-has-note{cursor:pointer;color:var(--py-accent)}',
    '.py-code{flex:0 0 auto;white-space:pre;overflow-wrap:normal;word-break:normal;',
    '  font-family:var(--font-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);',
    '  font-size:13px;line-height:20px;padding-right:16px;tab-size:4;-moz-tab-size:4;',
    '  font-variant-ligatures:none;font-feature-settings:"liga" 0,"clig" 0,"calt" 0}',
    /* ---- 挖空 ---- */
    '.py-blankbox{flex:1;min-width:0;padding:2px 16px 6px 0}',
    '.py-blank-in{width:100%;min-height:22px;color:var(--ui-bright,#e2e8f0);background:rgba(45,212,234,.07);',
    '  border:1px solid rgba(45,212,234,.4);border-radius:5px;padding:2px 6px;resize:vertical;',
    '  font-family:var(--font-code,ui-monospace,monospace);font-size:13px;line-height:20px;',
    '  tab-size:4;-moz-tab-size:4;white-space:pre;overflow-wrap:normal;font-variant-ligatures:none}',
    '.py-blank-in.py-given{color:var(--ui-slate,#9fb0c8);border-style:dashed}',
    '.py-blank-in.py-okk{border-color:var(--trace-emerald,#34d399)}',
    '.py-blank-in.py-badd{border-color:var(--trace-rose,#fb7185)}',
    '.py-blank-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px}',
    '.py-msg{font-size:12px;line-height:1.5;color:var(--ui-slate,#9fb0c8)}',
    '.py-msg.py-bad-msg{color:var(--trace-rose,#fb7185)}',
    '.py-msg.py-ok-msg{color:var(--trace-emerald,#34d399)}',
    '.py-badge{flex:0 0 52px;text-align:right;padding:0 10px 0 6px;user-select:none;',
    '  position:sticky;left:0;z-index:1;background:rgba(5,7,13,.92);',
    '  font-family:var(--font-code,ui-monospace,monospace);font-size:12px;line-height:20px;color:var(--py-accent)}',
    /* ---- 三层临摹：三层共用 .py-layer，字体/行高/内边距/tab-size 逐字相同 ---- */
    '.py-layer{position:absolute;top:0;left:0;margin:0;border:0;outline:0;background:transparent;',
    '  font-family:var(--font-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);',
    '  font-size:13px;line-height:20px;padding:12px 16px;',
    '  tab-size:4;-moz-tab-size:4;letter-spacing:normal;',
    '  white-space:pre;overflow-wrap:normal;word-break:normal;',
    '  font-variant-ligatures:none;font-feature-settings:"liga" 0,"clig" 0,"calt" 0}',
    /* 中间层是她**看得见**的那一层（顶层 textarea 的文字才是透明的）：
       层 2 画的是她打的内容的高亮，错处标红——所以这里绝不能也 transparent。 */
    '.py-shadow,.py-typed{pointer-events:none;min-width:100%;color:var(--ui-bright,#e2e8f0)}',
    '.py-typed .py-bad{color:var(--trace-rose,#fb7185);background:rgba(251,113,133,.22);border-radius:2px}',
    '.py-typed .py-over{color:var(--trace-orange,#fb923c);background:rgba(251,146,60,.26);border-radius:2px}',
    '.py-input{right:0;bottom:0;width:100%;height:100%;overflow:auto;resize:none;',
    '  color:transparent;-webkit-text-fill-color:transparent;caret-color:var(--py-accent)}',
    '.py-input::selection{background:rgba(45,212,234,.3)}',
    /* 硬拦截档拒绝一次按键时：输入层闪一圈红边 + 舞台底部一行说明。
       一次她看不见的拒绝，与一个死掉的页面无法区分。 */
    '.py-input.py-blocked{box-shadow:inset 0 0 0 2px var(--trace-rose,#fb7185);',
    '  animation:py-blink .18s steps(1) 2}',
    '@keyframes py-blink{50%{box-shadow:inset 0 0 0 2px transparent}}',
    '.py-blocknote{position:absolute;left:0;right:0;bottom:0;z-index:4;padding:6px 14px;',
    '  font-size:12px;line-height:1.5;color:#fff1f2;background:rgba(251,113,133,.24);',
    '  border-top:1px solid rgba(251,113,133,.5)}',
    '.py-slider{width:132px;vertical-align:middle}',
    '.py-stats{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--ui-slate,#9fb0c8)}',
    '.py-stats b{color:var(--ui-bright,#e2e8f0);font-weight:600}',
    '.py-warn{color:var(--trace-orange,#fb923c)}',
    '.py-toast{position:absolute;left:50%;bottom:58px;transform:translateX(-50%);z-index:9;',
    '  padding:7px 14px;font-size:13px;border-radius:8px;color:#05070d;background:var(--py-accent)}',
    '.py-meta{margin:0 0 12px;padding:0 0 10px;border-bottom:1px solid var(--panel-line,rgba(148,163,184,.16))}',
    '.py-meta-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 6px;margin:0 0 4px;',
    '  font-size:12px;color:var(--ui-slate,#9fb0c8)}',
    '.py-meta-k{font-weight:600}',
    '.py-meta-v{color:var(--ui-bright,#e2e8f0)}',
    '.py-board{padding:0 7px;border-radius:999px;border:1px solid var(--panel-line,rgba(148,163,184,.3));',
    '  color:var(--ui-bright,#e2e8f0)}',
    '.py-tag{padding:0 6px;border-radius:4px;background:rgba(148,163,184,.12);',
    '  font-family:var(--font-code,ui-monospace,monospace);font-size:11px}',
    '.py-note{margin:0 0 9px}',
    '.py-note.py-anchor{background:rgba(45,212,234,.12);border-radius:5px;padding:3px 6px}',
    '.py-note-at{display:block;font-family:var(--font-code,ui-monospace,monospace);font-size:11px;',
    '  color:var(--ui-slate,#9fb0c8);white-space:pre;overflow-x:auto}',
    /* 语法高亮：与 Editor.highlight 的 tok-<type> 一一对应 */
    '.tok-keyword{color:#c4b5fd}.tok-string,.tok-fstring{color:#86efac}.tok-number{color:#fbbf24}',
    '.tok-comment{color:#64748b;font-style:italic}.tok-op,.tok-punct{color:#94a3b8}',
    '.tok-builtin{color:#67e8f9}.tok-softkw{color:#a5b4fc}.tok-name{color:#e2e8f0}',
    '.tok-decorator{color:#bef264}',
    '@media (max-width:880px){.py-picker{flex-basis:170px}.py-panel{display:none}}'
  ].join('\n');

  function ensureStyle(doc) {
    if (doc.getElementById(STYLE_ID)) { return; }
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  var ACCENTS = { cyan: 1, rose: 1, violet: 1, emerald: 1, orange: 1 };

  /* mount({ root, programs, lang, accent }) → controller
     controller: { setMode, setProgram, setLang, destroy } */
  function mount(opts) {
    opts = opts || {};
    var rootEl = opts.root;
    if (!rootEl || typeof rootEl.appendChild !== 'function' || !rootEl.ownerDocument) {
      throw new Error('PyInteract.mount({ root, programs, lang }) 需要一个真实的 DOM 节点作为 root；' +
                      '纯函数层（filterPrograms / copyPayload / …）不需要 DOM，可以单独调用。');
    }
    var doc = rootEl.ownerDocument;
    var win = doc.defaultView;
    var St = store();

    /* ---- 小工具 ---- */
    function h(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) { e.className = cls; }
      if (text !== undefined && text !== null) { e.textContent = String(text); }
      return e;
    }
    function wipe(node) { while (node.firstChild) { node.removeChild(node.firstChild); } }
    function btn(cls, text, onClick) {
      var b = h('button', cls, text);
      b.type = 'button';
      b.addEventListener('click', onClick);
      return b;
    }

    /* 存储不可用 / 配额满 / schema 迁移：顶部**持久横幅**，不是 toast、不自动消失。
       她以为存住了而其实没有，是这套东西最坏的失败方式（spec §4.5）。

       注册必须排在**第一次碰存储之前**（下面的 getPrefs 就会碰）：Store 的
       `notified` 标志保证回调最多响一次，第一次读写若在注册之前失败，这条
       回调就永远不会被调用，横幅永远不出现——一个只在存储真的坏掉时才暴露
       的顺序 bug。建壳之后还会再用 available() 兜一次底（同一页里若有别的
       代码先触发过 notify，回调同样不会再响）。 */
    var bannerKey = null;
    St.onUnavailable(function (reason) {
      bannerKey = reason === 'quota' ? 'bannerQuota'
                : reason === 'migrated' ? 'bannerMigrated' : 'bannerNone';
      paintBanner();
    });

    /* ---- 状态 ---- */
    var PROGRAMS = (opts.programs || []).slice();
    var prefs = St.getPrefs() || {};
    var S = {
      lang: (opts.lang === 'en') ? 'en' : 'zh',
      mode: 'read',
      progId: PROGRAMS.length ? PROGRAMS[0].id : null,
      filters: (prefs.filters && typeof prefs.filters === 'object') ? prefs.filters : {},
      compareId: null,
      answers: {},
      given: {},
      hintTier: {},
      typed: '',
      alpha: (typeof prefs.alpha === 'number') ? prefs.alpha : 1,
      strictness: (prefs.strictness === 'loose' || prefs.strictness === 'block') ? prefs.strictness : 'mark',
      followShadow: prefs.followShadow === true,
      anchorLine: -1,
      /* 当前这一遍临摹的 run（{progId, reference, session, resumed, saved}）。
         挂在 S 上而不是 traceUI 上，模式来回切时才不会被重建，见 traceRun()。 */
      run: null
    };

    /* ---- 骨架 ---- */
    ensureStyle(doc);
    wipe(rootEl);
    rootEl.classList.add('py-root');
    if (opts.accent && ACCENTS[opts.accent]) {
      rootEl.style.setProperty('--py-accent', 'var(--trace-' + opts.accent + ')');
    }

    var bannerSlot = h('div', 'py-banner-slot');
    var body = h('div', 'py-body');
    var picker = h('aside', 'py-picker');
    var main = h('main', 'py-main');
    var topBar = h('div', 'py-bar');
    var stage = h('div', 'py-stage');
    var bottom = h('div', 'py-bottom');
    var panel = h('aside', 'py-panel');
    main.appendChild(topBar);
    main.appendChild(stage);
    main.appendChild(bottom);
    body.appendChild(picker);
    body.appendChild(main);
    body.appendChild(panel);
    rootEl.appendChild(bannerSlot);
    rootEl.appendChild(body);

    function paintBanner() {
      if (!bannerSlot) { return; } /* 回调可能在建壳之前就响 */
      wipe(bannerSlot);
      if (!bannerKey) { return; }
      bannerSlot.appendChild(h('div', 'py-banner', t(bannerKey, S.lang)));
    }
    if (!St.available() && !bannerKey) { bannerKey = 'bannerNone'; }

    var toastTimer = null;
    function toast(text) {
      var el = h('div', 'py-toast', text);
      stage.appendChild(el);
      if (toastTimer) { clearTimeout(toastTimer); }
      toastTimer = setTimeout(function () {
        if (el.parentNode) { el.parentNode.removeChild(el); }
      }, 1800);
    }

    /* ---- 当前程序 ---- */
    function current() {
      for (var i = 0; i < PROGRAMS.length; i++) {
        if (PROGRAMS[i].id === S.progId) { return PROGRAMS[i]; }
      }
      return null;
    }
    /* 读 / 临摹 / 复制看到的源码一律是 clean 过的（R16） */
    function cleanSource(p) {
      return p ? exercise().clean(typeof p.source === 'string' ? p.source : '') : '';
    }

    /* ---- 草稿 ---- */
    function loadDrafts() {
      var p = current();
      S.answers = {};
      S.given = {};
      S.hintTier = {};
      S.typed = '';
      if (!p) { return; }
      var raw = St.getDraft(p.id, 'blank');
      if (raw) {
        try {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') { S.answers = parsed; }
        } catch (e) { /* 草稿坏了就当没有，不拿一个异常把整页拖垮 */ }
      }
      var typed = St.getDraft(p.id, 'trace');
      if (typeof typed === 'string') { S.typed = typed; }
      /* ⚠ 这里**不碰 S.run**。loadDrafts 是共享的，而"这一遍临摹作不作废"
         只有真正换了题 / 真正清掉了当前这一题的草稿才成立：清别人的草稿时
         照样重置，会把一遍从未被打断的临摹标成 resumed（成绩不计），
         而"重来"又会丢掉她真实的进度。重置放在调用方，各自说明理由。 */
    }
    function saveBlank() { if (S.progId) { St.scheduleDraft(S.progId, 'blank', JSON.stringify(S.answers)); } }
    function saveTyped() { if (S.progId) { St.scheduleDraft(S.progId, 'trace', S.typed); } }
    /* patchProgress / setPrefs 都是**顶层键浅合并**：给的必须是完整子对象（R9）。 */
    function savePrefs() {
      St.setPrefs({
        alpha: S.alpha,
        strictness: S.strictness,
        followShadow: S.followShadow,
        filters: S.filters
      });
    }

    /* ================= 程序选择器 ================= */
    var LINE_CAPS = [0, 20, 40, 80];

    function toggleFilter(dim, value) {
      var list = asList(S.filters[dim]).slice();
      var at = list.indexOf(value);
      if (at === -1) { list.push(value); } else { list.splice(at, 1); }
      S.filters[dim] = list;
      savePrefs();
      renderPicker();
    }

    function chipRow(dim, values, labelOf) {
      var wrap = h('div', 'py-chips');
      values.forEach(function (v) {
        var on = asList(S.filters[dim]).indexOf(v) !== -1;
        var c = btn('py-chip', labelOf(v), function () { toggleFilter(dim, v); });
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
        wrap.appendChild(c);
      });
      return wrap;
    }

    function renderPicker() {
      wipe(picker);

      var fs = h('div', 'py-sec');
      fs.appendChild(h('h4', null, t('level', S.lang)));
      fs.appendChild(chipRow('level', LEVELS, function (v) { return 'L' + v; }));
      fs.appendChild(h('h4', null, t('kind', S.lang)));
      fs.appendChild(chipRow('kind', KINDS, function (v) { return kindLabel(v, S.lang); }));
      fs.appendChild(h('h4', null, t('boards', S.lang)));
      fs.appendChild(chipRow('boards', BOARDS, function (v) { return v; }));
      fs.appendChild(h('h4', null, t('filters', S.lang)));
      var caps = h('div', 'py-chips');
      LINE_CAPS.forEach(function (n) {
        var on = (Number(S.filters.maxLines) || 0) === n;
        var c = btn('py-chip', n === 0 ? t('anyLength', S.lang) : ts('maxLines', S.lang, [n]), function () {
          S.filters.maxLines = n;
          savePrefs();
          renderPicker();
        });
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
        caps.appendChild(c);
      });
      fs.appendChild(caps);
      picker.appendChild(fs);

      var list = h('ul', 'py-list');
      var shown = filterPrograms(PROGRAMS, S.filters);
      if (!shown.length) {
        list.appendChild(h('li', 'py-item', t('nothing', S.lang)));
      }
      shown.forEach(function (p) {
        var li = h('li', 'py-item');
        li.setAttribute('aria-current', p.id === S.progId ? 'true' : 'false');
        var tx = h('div', 'py-item-t', pick(p.title, S.lang) || p.id);
        var meta = h('span', 'py-item-m',
          'L' + p.level + ' · ' + kindLabel(p.kind, S.lang) + ' · ' + ts('lines', S.lang, [p.lines]));
        tx.appendChild(meta);
        li.appendChild(tx);
        li.addEventListener('click', function () { setProgram(p.id); });
        li.appendChild(btn('py-x', '⋯', function (ev) {
          ev.stopPropagation();
          askClear('program', p.id);
        }));
        list.appendChild(li);
      });
      picker.appendChild(list);

      var tools = h('div', 'py-sec');
      var row = h('div', 'py-chips');
      row.appendChild(btn('py-btn', t('clearModule', S.lang), function () { askClear('module', null); }));
      row.appendChild(btn('py-btn', t('clearAll', S.lang), function () { askClear('all', null); }));
      tools.appendChild(row);
      picker.appendChild(tools);
    }

    /* ================= 三级清空 ================= */
    function askClear(scope, progId) {
      var ids = clearScope(scope, PROGRAMS, progId || S.progId);
      /* 二次确认里的条数是 Store.countRecords 的**真实条数**，不是估的。
         两处措辞上的诚实，都是因为这个数字与"这一级实际清掉什么"并不重合：
           · countRecords 数的是 draft:blank + draft:trace + progress 三种键，
             而单题 / 模块两级只清 draft（进度是"她已经会了"的记录，spec §4.5
             明确不连坐），所以文案说"其中的草稿会被清除、进度保留"。
           · 'all' 这一级本页列举不出别的页的 id，所以只能数出本页的那一部分，
             文案就明说"本页 N 条，其他页的记录也会一并清除"——报一个看上去
             精确、实际只数了本页的数字，是在撒谎。 */
      var n = St.countRecords(ids === null ? PROGRAMS.map(function (p) { return p.id; }) : ids);
      var key = scope === 'program' ? 'confirmOne' : scope === 'module' ? 'confirmModule' : 'confirmAll';
      var ask = (win && typeof win.confirm === 'function') ? win.confirm : null;
      if (ask && !ask.call(win, ts(key, S.lang, [n]))) { return; }
      /* 动手的次序（先 flush 再清）在 clearRecords 里，那里测得到。 */
      clearRecords(St, scope, ids);
      /* 只有清到当前这一题时才重读草稿、作废当前这一遍；清别人的不动她。 */
      if (clearHitsCurrent(ids, S.progId)) {
        loadDrafts();
        S.run = null;
      }
      renderAll();
      toast(t('cleared', S.lang));
    }

    /* ================= 代码文档（读模式 / 对照）================= */
    function noteLineIndex(p, lines) {
      /* lineNotes 用整行原文当锚（不是行号）：找到第一条逐字相同的行。 */
      var map = {};
      (p && p.lineNotes ? p.lineNotes : []).forEach(function (note, i) {
        var at = String(note.at == null ? '' : note.at);
        for (var k = 0; k < lines.length; k++) {
          if (lines[k] === at) { map[k] = i; return; }
        }
      });
      return map;
    }

    function renderDoc(p, src, otherLines) {
      var docEl = h('div', 'py-doc');
      var lines = src.split('\n');
      var notes = noteLineIndex(p, lines);
      var frs = editor().highlight(src);

      var rows = [];
      var makeRow = function (i) {
        var row = h('div', 'py-line');
        var num = h('div', 'py-num', String(i + 1));
        if (notes[i] !== undefined) {
          num.className = 'py-num py-has-note';
          num.textContent = (i + 1) + ' ●';
          num.addEventListener('click', function () {
            S.anchorLine = i;
            renderPanel();
            highlightAnchor();
          });
        }
        var code = h('div', 'py-code');
        row.appendChild(num);
        row.appendChild(code);
        if (otherLines && otherLines[i] !== lines[i]) { row.className = 'py-line py-diff'; }
        docEl.appendChild(row);
        rows.push({ row: row, code: code });
        return code;
      };

      var li = 0;
      var code = makeRow(0);
      frs.forEach(function (f) {
        var parts = f.text.split('\n');
        for (var i = 0; i < parts.length; i++) {
          if (i > 0) { li++; code = makeRow(li); }
          if (parts[i] !== '') { code.appendChild(h('span', f.cls, parts[i])); }
        }
      });
      /* 空行也要有高度，否则行号与代码错位 */
      rows.forEach(function (r) { if (!r.code.firstChild) { r.code.appendChild(h('span', 'tok-plain', '​')); } });
      docEl.__rows = rows;
      return docEl;
    }

    function highlightAnchor() {
      var docs = stage.querySelectorAll('.py-doc');
      for (var d = 0; d < docs.length; d++) {
        var rows = docs[d].__rows || [];
        for (var i = 0; i < rows.length; i++) {
          var on = (i === S.anchorLine);
          var cls = rows[i].row.className.replace(/ ?py-anchor/, '');
          rows[i].row.className = on ? (cls + ' py-anchor') : cls;
          if (on && rows[i].row.scrollIntoView) {
            rows[i].row.scrollIntoView({ block: 'nearest' });
          }
        }
      }
    }

    function renderRead() {
      var p = current();
      var docs = h('div', 'py-docs');
      var mine = cleanSource(p);
      var other = null;
      if (S.compareId) {
        var q = null;
        PROGRAMS.forEach(function (x) { if (x.id === S.compareId) { q = x; } });
        if (q) { other = { prog: q, src: cleanSource(q) }; }
      }
      var otherLines = other ? other.src.split('\n') : null;
      docs.appendChild(renderDoc(p, mine, otherLines));
      if (other) {
        docs.appendChild(renderDoc(other.prog, other.src, mine.split('\n')));
      }
      stage.appendChild(docs);
    }

    /* ================= 挖空模式 ================= */
    var blankInputs = {};

    function renderBlank() {
      var p = current();
      blankInputs = {};
      var parsed;
      try {
        parsed = exercise().parse(typeof p.source === 'string' ? p.source : '');
      } catch (e) {
        stage.appendChild(h('div', 'py-msg py-bad-msg', String(e && e.message ? e.message : e)));
        return;
      }
      var byId = {};
      parsed.blanks.forEach(function (b) { byId[b.id] = b; });

      var docEl = h('div', 'py-doc');
      var lines = parsed.stripped.split('\n');
      var badge = 0;

      lines.forEach(function (lineText, i) {
        var entry = parsed.lineMap[i];
        var row = h('div', 'py-line');
        if (entry && entry.kind === 'blank') {
          badge++;
          var b = byId[entry.blankId];
          row.appendChild(h('div', 'py-badge', '①②③④⑤⑥⑦⑧⑨'.charAt(badge - 1) || String(badge)));
          row.appendChild(blankBox(b));
        } else {
          row.appendChild(h('div', 'py-num', String(i + 1)));
          var code = h('div', 'py-code');
          editor().highlight(lineText).forEach(function (f) {
            code.appendChild(h('span', f.cls, f.text));
          });
          if (!code.firstChild) { code.appendChild(h('span', 'tok-plain', '​')); }
          row.appendChild(code);
        }
        docEl.appendChild(row);
      });
      stage.appendChild(docEl);
    }

    function blankBox(b) {
      var box = h('div', 'py-blankbox');
      var ta = doc.createElement('textarea');
      ta.className = 'py-blank-in';
      ta.spellcheck = false;
      ta.rows = Math.max(1, String(b.body).split('\n').length);
      /* 缺省值是这个空的缩进本身：Exercise.merge 拿她这一份原样替换回源码，
         少了那几格粘进 PyCharm 就是 IndentationError（Judge 看不见绝对缩进）。 */
      ta.value = (S.answers[b.id] !== undefined && S.answers[b.id] !== null)
        ? S.answers[b.id] : b.indent;
      if (S.given[b.id]) { ta.className += ' py-given'; }

      var msg = h('div', 'py-msg');

      ta.addEventListener('input', function () {
        S.answers[b.id] = ta.value;
        /* 她一动手，"已填入标准答案"这个标记就不再成立——留着的话，一个她
           自己打出来的空会一直灰着显示"不计完成"。 */
        if (S.given[b.id]) {
          delete S.given[b.id];
          ta.className = ta.className.replace(/ ?py-given/, '');
          msg.className = 'py-msg';
          msg.textContent = '';
        }
        saveBlank();
      });
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
          /* 挖空模式 Tab 在空与空之间跳（spec §3.3）——临摹模式的 Tab 才插四格。 */
          e.preventDefault();
          jumpBlank(b.id, e.shiftKey ? -1 : 1);
          return;
        }
        if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          var r = editor().applyEnter(ta.value, ta.selectionStart);
          ta.value = r.value;
          ta.setSelectionRange(r.selStart, r.selEnd);
          ta.rows = Math.max(1, ta.value.split('\n').length);
          S.answers[b.id] = ta.value;
          saveBlank();
        }
      });

      var bar = h('div', 'py-blank-bar');
      var hintMsg = h('div', 'py-msg');
      bar.appendChild(btn('py-btn', t('hint', S.lang) + ' (L' + b.level + ')', function () {
        var tier = (S.hintTier[b.id] || 0) + 1;
        S.hintTier[b.id] = Math.min(tier, b.level);
        hintMsg.textContent = hintAt(b, S.hintTier[b.id], S.lang);
        noteProgress();
      }));
      bar.appendChild(btn('py-btn', t('giveUp', S.lang), function () {
        S.answers[b.id] = b.body;
        S.given[b.id] = true;
        ta.value = b.body;
        ta.className = 'py-blank-in py-given';
        ta.rows = Math.max(1, b.body.split('\n').length);
        msg.className = 'py-msg';
        msg.textContent = t('given', S.lang);
        saveBlank();
      }));
      bar.appendChild(btn('py-btn', t('check', S.lang), function () { checkBlank(b); }));

      box.appendChild(ta);
      box.appendChild(bar);
      box.appendChild(hintMsg);
      box.appendChild(msg);
      blankInputs[b.id] = { ta: ta, msg: msg, blank: b };
      return box;
    }

    function jumpBlank(fromId, dir) {
      var ids = Object.keys(blankInputs);
      var at = ids.indexOf(fromId);
      var next = ids[at + dir];
      if (next && blankInputs[next]) { blankInputs[next].ta.focus(); }
    }

    function checkBlank(b) {
      var ui = blankInputs[b.id];
      if (!ui) { return null; }
      var fb = blankFeedback(ui.ta.value, b.body, S.lang);
      ui.msg.className = 'py-msg ' + (fb.ok ? 'py-ok-msg' : 'py-bad-msg');
      ui.msg.textContent = fb.message;
      ui.ta.className = 'py-blank-in' + (S.given[b.id] ? ' py-given' : '') + (fb.ok ? ' py-okk' : ' py-badd');
      if (!fb.ok) {
        /* 光标送到出错的位置——不给答案，只指路（spec §3.3） */
        ui.ta.focus();
        var at = Math.max(0, Math.min(fb.caret, ui.ta.value.length));
        ui.ta.setSelectionRange(at, at);
      }
      return fb;
    }

    function checkAllBlanks() {
      var ids = Object.keys(blankInputs);
      var allOk = ids.length > 0;
      ids.forEach(function (id) {
        var fb = checkBlank(blankInputs[id].blank);
        if (!fb || !fb.ok || S.given[id]) { allOk = false; }
      });
      if (allOk) { toast(t('blankAllOk', S.lang)); }
      noteProgress(allOk);
      return allOk;
    }

    function noteProgress(done) {
      if (!S.progId) { return; }
      var used = 0;
      Object.keys(S.hintTier).forEach(function (k) { used += S.hintTier[k]; });
      /* 顶层键浅合并：blank 这个子对象整体替换，调用方给完整的一份（R9）。 */
      var prev = St.getProgress(S.progId) || {};
      var wasDone = !!(prev.blank && prev.blank.done);
      St.patchProgress(S.progId, {
        blank: { done: done === true || wasDone, hintsUsed: used, at: Date.now() }
      });
    }

    /* ================= 影子临摹 ================= */
    var traceUI = null;

    /* 一次「run」= 一个 Trace session，**跨模式切换存活**。

       为什么不能在每次 renderTrace 里新建：`trace.js` 只在某个下标**首次被
       seen** 时记进 firstWrong，而重建后的 session 是被整段 `S.typed` 一次
       喂进去的——每个字符都在它**最终正确的样子**下被首次看见，于是
         连续会话（打错→退格→改对）  accuracy 0.9730  errors 1
         重建 session（同样的最终文本）accuracy 1.0000  errors 0  backspaces 0
       按一次 `1` 再按一次 `3` 就能把一个她没打出来的 100% 经 bestAcc 的
       Math.max **永久**写进进度（清空也删不掉）。

       从一份已有草稿接着打的 run 同样洗掉了历史，所以标成 resumed：统计照显
       （并写明"这一遍不计"），但**不写 progress**，直到「重来」开一遍干净的。 */
    function traceRun(reference) {
      if (reuseRun(S.run, S.progId, reference)) { return S.run; }
      S.run = newRun(S.progId, reference, S.typed);
      return S.run;
    }

    function restartTrace() {
      S.typed = '';
      saveTyped();
      S.run = null;   /* 下一次 traceRun() 开一遍干净的：resumed 为假，成绩算数 */
      renderStage();
      renderBottom();
      paintTrace();
    }

    function renderTrace() {
      var p = current();
      var reference = cleanSource(p);
      var run = traceRun(reference);

      var shadow = h('pre', 'py-layer py-shadow');
      var typedLayer = h('pre', 'py-layer py-typed');
      var input = doc.createElement('textarea');
      input.className = 'py-layer py-input';
      input.spellcheck = false;
      input.autocapitalize = 'off';
      input.autocomplete = 'off';
      input.setAttribute('autocorrect', 'off');
      input.value = S.typed;

      editor().highlight(reference).forEach(function (f) {
        shadow.appendChild(h('span', f.cls, f.text));
      });
      shadow.style.opacity = String(S.alpha);

      stage.appendChild(shadow);
      stage.appendChild(typedLayer);
      stage.appendChild(input);

      /* 拒绝一次按键时说明原因的那一行；不占布局（绝对定位在舞台底部）。 */
      var blockNote = h('div', 'py-blocknote');
      blockNote.hidden = true;
      stage.appendChild(blockNote);

      traceUI = { shadow: shadow, typed: typedLayer, input: input,
                  run: run, reference: reference, blockNote: blockNote, blockTimer: null };

      /* 同步滚动由顶层 textarea 的 scroll 驱动，另外两层用 transform：
         translate 不像 scrollTop 那样有子像素抖动，三层才不会在滚动时错开。 */
      input.addEventListener('scroll', function () {
        var tr = 'translate(' + (-input.scrollLeft) + 'px,' + (-input.scrollTop) + 'px)';
        shadow.style.transform = tr;
        typedLayer.style.transform = tr;
      });

      input.addEventListener('beforeinput', function (e) {
        if (S.strictness !== 'block') { return; }
        if (e.inputType !== 'insertText' || e.data == null || e.data.length !== 1) { return; }
        var s = input.selectionStart, en = input.selectionEnd;
        var next = input.value.slice(0, s) + e.data + input.value.slice(en);
        if (charMatches(reference, next, s)) { return; }
        e.preventDefault();
        /* 拒绝必须**看得见**：自动缩进会把她推进"参考这一行早就结束了"的
           死角，那时她打什么都被拒，而屏幕上什么都没有——与页面坏掉无法区分。 */
        showBlocked(blockedHint(reference, next, s, S.lang));
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' || e.key === 'Delete') { run.session.noteBackspace(); return; }
        if (e.key === 'Tab') {
          e.preventDefault();
          var r = editor().applyTab(input.value, input.selectionStart, input.selectionEnd);
          input.value = r.value;
          input.setSelectionRange(r.selStart, r.selEnd);
          onTyped();
          return;
        }
        if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          var r2 = S.followShadow
            ? applyFollowEnter(reference, input.value, input.selectionStart)
            : editor().applyEnter(input.value, input.selectionStart);
          input.value = r2.value;
          /* applyTab 与 applyEnter 同形（selEnd === selStart 恒成立），
             两种按键都能直接 setSelectionRange，不必分支（裁决 R32）。 */
          input.setSelectionRange(r2.selStart, r2.selEnd);
          onTyped();
        }
      });

      input.addEventListener('input', onTyped);
      paintTrace();
    }

    /* 拒绝反馈：文字说明 + 顶层输入框闪一下红边。文字留到下一次按键或 1.6 秒
       后才撤，闪光只是把视线拉过去。 */
    function showBlocked(text) {
      if (!traceUI) { return; }
      var note = traceUI.blockNote;
      note.textContent = text;
      note.hidden = false;
      traceUI.input.classList.add('py-blocked');
      if (traceUI.blockTimer) { clearTimeout(traceUI.blockTimer); }
      /* 回调读的是**外层的** traceUI：1.6 秒之内她完全可能切走模式或换一题，
         那时它已经是 null。clearFlash 自带守卫，安全返回。 */
      traceUI.blockTimer = setTimeout(function () { clearFlash(traceUI); }, 1600);
    }

    /* 拆掉当前这一层临摹 UI：**先停掉延时回调**，再置空。只加回调里的守卫也
       能不崩，但那样会留下一个"还会醒来、醒来却无事可做"的定时器；两件事一起
       消灭，才不用去想它醒来时世界长什么样。 */
    function teardownTrace() {
      if (traceUI && traceUI.blockTimer) { clearTimeout(traceUI.blockTimer); }
      traceUI = null;
    }

    function onTyped() {
      if (!traceUI) { return; }
      S.typed = traceUI.input.value;
      saveTyped();
      paintTrace();
    }

    function paintTrace() {
      if (!traceUI) { return; }
      /* 一个字都还没打时**不碰 session**：Trace 的时钟从第一次 update() 起走，
         装配时先 update 一次，等于把她读题、找键盘的时间算进速度里
         （spec §3.4「计时在首次按键开始」）。 */
      if (S.typed === '') {
        wipe(traceUI.typed);
        if (statsBox) { wipe(statsBox); }
        return;
      }
      var res = traceUI.run.session.update(S.typed);
      var states = traceStates(traceUI.reference, S.typed, res);

      if (S.strictness === 'loose') {
        /* 宽松档：光标所在的那一行还没打完，先不结算（行尾才算数）。 */
        var pos = traceUI.input.selectionStart || 0;
        var lineNo = S.typed.slice(0, pos).split('\n').length - 1;
        var start = 0, seen = 0, i;
        for (i = 0; i < S.typed.length && seen < lineNo; i++) {
          if (S.typed.charAt(i) === '\n') { seen++; }
        }
        start = i;
        for (i = start; i < S.typed.length; i++) {
          if (S.typed.charAt(i) === '\n') { break; }
          states[i] = 'ok';
        }
      }

      wipe(traceUI.typed);
      var frs = editor().highlight(S.typed);
      var off = 0;
      frs.forEach(function (f) {
        var runStart = 0;
        for (var i = 1; i <= f.text.length; i++) {
          var endOfRun = (i === f.text.length) || (states[off + i] !== states[off + runStart]);
          if (!endOfRun) { continue; }
          var state = states[off + runStart];
          var cls = f.cls + (state === 'bad' ? ' py-bad' : state === 'over' ? ' py-over' : '');
          traceUI.typed.appendChild(h('span', cls, f.text.slice(runStart, i)));
          runStart = i;
        }
        off += f.text.length;
      });

      renderStats(res.stats);
    }

    var statsBox = null;
    function renderStats(st) {
      if (!statsBox) { return; }
      wipe(statsBox);
      function cell(label, value) {
        var s = h('span', null, label + ' ');
        s.appendChild(h('b', null, value));
        statsBox.appendChild(s);
      }
      /* 向下取整，不四舍五入：她打错了一个字符、屏幕上明明标着红，正确率却
         写着 100%（236 个字符里错 1 个 = 99.6%），是一个会让人不信这块表的读数。 */
      cell(t('accuracy', S.lang), Math.floor(st.accuracy * 100) + '%');
      cell(t('cpm', S.lang), String(Math.round(st.cpm)));
      cell(t('elapsed', S.lang), Math.round(st.elapsedMs / 1000) + 's');
      cell(t('backspaces', S.lang), String(st.backspaces));
      /* 行数差要**明说**：她多打一行之后，逐行对齐会让后面整片变红，
         不说清楚她面对的就是一片无来由的红（裁决 R39）。 */
      if (st.lineDelta !== 0) {
        var key = st.lineDelta > 0 ? 'lineMore' : 'lineLess';
        statsBox.appendChild(h('span', 'py-warn', ts(key, S.lang, [Math.abs(st.lineDelta)])));
      }
      var run = traceUI && traceUI.run;
      /* 这一遍是接着草稿打的：历史错误早就不在这个 session 里了，显示出来的
         正确率必然偏高——说清楚，并且**不写进 progress**（见 traceRun 的注释）。 */
      if (run && run.resumed) {
        statsBox.appendChild(h('span', 'py-warn', t('resumed', S.lang)));
      }
      /* 只在**这一遍打完**时落一次盘：每个按键都写一次 localStorage 既没必要，
         也会把一遍还没打完的中途成绩记成"最好成绩"。 */
      if (S.progId && shouldSaveBest(run, st)) {
        run.saved = true;
        var prev = St.getProgress(S.progId) || {};
        var old = prev.trace || {};
        /* 顶层键浅合并：trace 这个子对象整体替换，给完整的一份（R9）。 */
        St.patchProgress(S.progId, {
          trace: {
            bestAcc: Math.max(Number(old.bestAcc) || 0, st.accuracy),
            bestCpm: Math.max(Number(old.bestCpm) || 0, st.cpm),
            at: Date.now()
          }
        });
      }
    }

    /* ================= 顶栏 / 底栏 / 讲解面板 ================= */
    function renderTopBar() {
      wipe(topBar);
      var p = current();
      if (!p) { return; }

      var vs = variantsOf(PROGRAMS, p);
      if (vs.length > 1) {
        topBar.appendChild(h('span', 'py-pip', t('variants', S.lang)));
        vs.forEach(function (q) {
          var b = btn('py-btn', pick(q.title, S.lang) || q.id, function () {
            if (q.id === p.id) { return; }
            if (S.compareId === q.id) { S.compareId = null; } else { S.compareId = q.id; }
            renderStage();
          });
          b.setAttribute('aria-pressed', (q.id === S.compareId) ? 'true' : 'false');
          if (q.id === p.id) { b.disabled = true; }
          topBar.appendChild(b);
        });
        topBar.appendChild(h('span', 'py-pip', t('compare', S.lang)));
      }

      if (S.mode === 'trace') {
        topBar.appendChild(h('span', 'py-pip', t('alpha', S.lang)));
        var sl = doc.createElement('input');
        sl.type = 'range';
        sl.className = 'py-slider';
        sl.min = '0'; sl.max = '1'; sl.step = '0.01';
        sl.value = String(S.alpha);
        sl.addEventListener('input', function () {
          S.alpha = Number(sl.value);
          if (traceUI) { traceUI.shadow.style.opacity = String(S.alpha); }
          savePrefs();
        });
        topBar.appendChild(sl);
        [['alphaTrace', 1], ['alphaFaint', 0.35], ['alphaBlind', 0]].forEach(function (pair) {
          topBar.appendChild(btn('py-btn', t(pair[0], S.lang), function () {
            S.alpha = pair[1];
            sl.value = String(S.alpha);
            if (traceUI) { traceUI.shadow.style.opacity = String(S.alpha); }
            savePrefs();
          }));
        });

        topBar.appendChild(h('span', 'py-pip', t('strictness', S.lang)));
        [['strictLoose', 'loose'], ['strictMark', 'mark'], ['strictBlock', 'block']].forEach(function (pair) {
          var b = btn('py-btn', t(pair[0], S.lang), function () {
            S.strictness = pair[1];
            savePrefs();
            renderTopBar();
            paintTrace();
          });
          b.setAttribute('aria-pressed', S.strictness === pair[1] ? 'true' : 'false');
          topBar.appendChild(b);
        });

        var fb = btn('py-btn', t('follow', S.lang), function () {
          S.followShadow = !S.followShadow;
          savePrefs();
          renderTopBar();
        });
        fb.setAttribute('aria-pressed', S.followShadow ? 'true' : 'false');
        topBar.appendChild(fb);

        topBar.appendChild(btn('py-btn', t('restart', S.lang), restartTrace));
      }

      if (S.mode === 'blank') {
        topBar.appendChild(btn('py-btn', t('checkAll', S.lang), checkAllBlanks));
      }
    }

    function renderBottom() {
      wipe(bottom);
      [['modeRead', 'read'], ['modeBlank', 'blank'], ['modeTrace', 'trace']].forEach(function (pair, i) {
        var b = btn('py-btn', t(pair[0], S.lang) + '  ' + (i + 1), function () { setMode(pair[1]); });
        b.setAttribute('aria-pressed', S.mode === pair[1] ? 'true' : 'false');
        bottom.appendChild(b);
      });
      bottom.appendChild(h('span', 'py-spacer'));

      /* pip 提示显示在按钮**旁边**，绝不进剪贴板 */
      var line = requirementLine(current());
      if (line) {
        bottom.appendChild(h('span', 'py-pip', t('needsPip', S.lang) + line));
      }
      bottom.appendChild(btn('py-btn', t('copy', S.lang), doCopy));

      if (S.mode === 'trace') {
        statsBox = h('div', 'py-stats');
        bottom.appendChild(statsBox);
      } else {
        statsBox = null;
      }
    }

    function renderPanel() {
      wipe(panel);
      var p = current();
      if (!p) { return; }
      /* 元数据在最上面（第 1 期设计 B7）。空数现数：parse 失败时挖空模式自己会把错误
         摆在舞台上，这里只是不显示空数，不另报一次——但 exercise() 本身必须留在
         try 外面：need() 找不到模块时故意抛得很响，那种炸是「装配错了」，跟
         「这一份源码 parse 不出空数」完全是两件事，不能被这层 catch 一起吞掉
         （R1 修复轮：原来整段都在 try 里，两种炸法分不出来）。 */
      var blankCount = null;
      var ex = exercise();
      try {
        blankCount = ex.parse(typeof p.source === 'string' ? p.source : '').blanks.length;
      } catch (e) {
        blankCount = null;
      }
      var metaRows = panelMeta(p, S.lang, blankCount);
      if (metaRows.length) {
        var meta = h('div', 'py-meta');
        metaRows.forEach(function (row) {
          var r = h('div', 'py-meta-row');
          if (row.label) { r.appendChild(h('span', 'py-meta-k', row.label)); }
          /* 占位符（考试局为空时的「未标注」）用普通值样式，不套 py-board 药丸——
             靠 row.placeholder 这个布尔判断，不拿翻译后的字符串去比对
             （R1 修复轮：字符串比较换语言就失效，布尔标记不会）。 */
          var cls = row.key === 'tags' ? 'py-tag' :
                    (row.key === 'boards' && !row.placeholder ? 'py-board' : 'py-meta-v');
          row.items.forEach(function (it) { r.appendChild(h('span', cls, it)); });
          meta.appendChild(r);
        });
        panel.appendChild(meta);
      }
      panel.appendChild(h('h4', null, pick(p.title, S.lang) || p.id));
      var blurb = pick(p.blurb, S.lang);
      if (blurb) { panel.appendChild(h('p', 'py-note', blurb)); }

      var notes = (p.notes && (S.lang === 'en' ? p.notes.en : p.notes.zh)) || [];
      if (notes.length) {
        panel.appendChild(h('h4', null, t('notes', S.lang)));
        notes.forEach(function (para) { panel.appendChild(h('p', 'py-note', String(para))); });
      }

      /* 取哪些行注是一条**决策**，所以它住在模块级、可以被测（见 panelLineNotes）。
         规矩一句话：只有读模式给行注。 */
      var ln = panelLineNotes(p, S.mode);
      if (ln.length) {
        panel.appendChild(h('h4', null, t('lineNotes', S.lang)));
        var lines = cleanSource(p).split('\n');
        var map = noteLineIndex(p, lines);
        ln.forEach(function (note, i) {
          var box = h('div', 'py-note');
          var owner = -1;
          Object.keys(map).forEach(function (k) { if (map[k] === i) { owner = Number(k); } });
          if (owner === S.anchorLine && owner >= 0) { box.className = 'py-note py-anchor'; }
          box.appendChild(h('code', 'py-note-at', String(note.at == null ? '' : note.at)));
          box.appendChild(h('span', null, pick(note, S.lang)));
          panel.appendChild(box);
        });
      }
    }

    function renderStage() {
      teardownTrace();
      wipe(stage);
      if (!current()) { return; }
      if (S.mode === 'read') { renderRead(); }
      else if (S.mode === 'blank') { renderBlank(); }
      else { renderTrace(); }
    }

    function renderAll() {
      paintBanner();
      renderPicker();
      renderTopBar();
      renderStage();
      renderBottom();
      renderPanel();
      if (S.mode === 'trace') { paintTrace(); }
    }

    /* ================= 复制 ================= */
    function fallbackCopy(text) {
      /* file:// 下 clipboard API 会被拒，这条降级是必须的（spec §3.5）。 */
      try {
        var ta = doc.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-2000px';
        ta.style.opacity = '0';
        doc.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        var ok = doc.execCommand && doc.execCommand('copy');
        doc.body.removeChild(ta);
        return !!ok;
      } catch (e) {
        return false;
      }
    }

    function doCopy() {
      var p = current();
      if (!p) { return; }
      var text = copyPayload(S.mode, p, { answers: S.answers, typed: S.typed });
      var done = function (ok) { toast(ok ? t('copied', S.lang) : t('copyFailed', S.lang)); };
      var nav = (win && win.navigator) ? win.navigator : null;
      if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
        try {
          nav.clipboard.writeText(text).then(function () { done(true); },
                                            function () { done(fallbackCopy(text)); });
          return;
        } catch (e) { /* 同步就抛的实现：继续走降级 */ }
      }
      done(fallbackCopy(text));
    }

    /* ================= 控制器 ================= */
    function setMode(mode) {
      if (mode !== 'read' && mode !== 'blank' && mode !== 'trace') { return; }
      S.mode = mode;
      renderTopBar();
      renderStage();
      renderBottom();
      /* 面板**必须**跟着重渲：行注段是按模式取舍的（见 renderPanel），
         不重渲的话按 2 切到挖空模式时，上一模式留在右侧的行注会原样挂着。 */
      renderPanel();
      if (mode === 'trace') { paintTrace(); }
    }

    function setProgram(id) {
      if (!id || id === S.progId) { return; }
      St.flush();
      S.progId = id;
      S.compareId = null;
      S.anchorLine = -1;
      loadDrafts();
      S.run = null;   /* 旧 run 属于上一题的参考 */
      renderAll();
    }

    function setLang(lang) {
      S.lang = (lang === 'en') ? 'en' : 'zh';
      renderAll();
    }

    function stepProgram(dir) {
      var shown = filterPrograms(PROGRAMS, S.filters);
      if (!shown.length) { return; }
      var at = -1;
      shown.forEach(function (p, i) { if (p.id === S.progId) { at = i; } });
      var next = shown[(at + dir + shown.length) % shown.length];
      if (next) { setProgram(next.id); }
    }

    function doCheck() {
      if (S.mode === 'blank') {
        var focused = doc.activeElement;
        var hit = null;
        Object.keys(blankInputs).forEach(function (id) {
          if (blankInputs[id].ta === focused) { hit = blankInputs[id].blank; }
        });
        if (hit) { checkBlank(hit); } else { checkAllBlanks(); }
      } else if (S.mode === 'trace') {
        paintTrace();
      }
    }

    function isTyping(el) {
      if (!el) { return false; }
      var tag = (el.tagName || '').toUpperCase();
      return tag === 'TEXTAREA' || tag === 'INPUT' || el.isContentEditable === true;
    }

    function onKey(e) {
      var typing = isTyping(e.target);
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        doCheck();
        return;
      }
      if (e.key === 'Escape') {
        if (typing && e.target.blur) { e.target.blur(); }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) { return; }
      /* 输入焦点在 textarea/input 里时，1/2/3 与 [ ] 不得劫持——她正在打的
         就是 `1`、`[` 这些字符本身。 */
      if (typing) { return; }
      if (e.key === '1') { setMode('read'); }
      else if (e.key === '2') { setMode('blank'); }
      else if (e.key === '3') { setMode('trace'); }
      else if (e.key === '[') { stepProgram(-1); }
      else if (e.key === ']') { stepProgram(1); }
      else { return; }
      e.preventDefault();
    }

    function onHide() { St.flush(); }
    function onVisibility() { if (doc.visibilityState === 'hidden') { St.flush(); } }

    doc.addEventListener('keydown', onKey);
    doc.addEventListener('visibilitychange', onVisibility);
    if (win) { win.addEventListener('pagehide', onHide); }

    loadDrafts();
    renderAll();

    return {
      setMode: setMode,
      setProgram: setProgram,
      setLang: setLang,
      destroy: function () {
        St.flush();
        teardownTrace();
        doc.removeEventListener('keydown', onKey);
        doc.removeEventListener('visibilitychange', onVisibility);
        if (win) { win.removeEventListener('pagehide', onHide); }
        wipe(rootEl);
      }
    };
  }

  return {
    mount: mount,
    filterPrograms: filterPrograms,
    copyPayload: copyPayload,
    requirementLine: requirementLine,
    hintAt: hintAt,
    HINT_MARK: HINT_MARK,
    panelLineNotes: panelLineNotes,
    clearScope: clearScope,
    clearRecords: clearRecords,
    clearHitsCurrent: clearHitsCurrent,
    clearFlash: clearFlash,
    variantsOf: variantsOf,
    blankFeedback: blankFeedback,
    traceStates: traceStates,
    newRun: newRun,
    reuseRun: reuseRun,
    shouldSaveBest: shouldSaveBest,
    expectedCharAt: expectedCharAt,
    charMatches: charMatches,
    blockedHint: blockedHint,
    applyFollowEnter: applyFollowEnter,
    STYLE_CSS: CSS,
    LEVELS: LEVELS,
    KINDS: KINDS,
    BOARDS: BOARDS,
    RUNTIMES: RUNTIMES,
    kindLabel: kindLabel,
    runtimeLabel: runtimeLabel,
    KIND_LABELS: KIND_LABELS,
    RUNTIME_LABELS: RUNTIME_LABELS,
    panelMeta: panelMeta
  };
});
