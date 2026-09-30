/* python 页浏览器验收探针（python-content-wave「浏览器验收」的标准件）。
 *
 * 由第 4 期 m6a / m6b 两波的探针合成（台账 m6a-probe.js 的 m3probe + m6aAllBlanks、m6b-probe.js 的 M6PROBE）。
 * 每一波别再从上一波台账复制、各改各的：第 3 期修了一次「量到换行符」只修在那次测量上，第 4 期 m6b 的探针又量到了 \n。
 *
 * 用法（浏览器工具的 javascript_exec，每次调用都传显式 tabId；每次导航之后重新注入）：
 *   eval(await (await fetch('/.claude/worktrees/python-wave-<名>/.claude/skills/python-content-wave/probe.js', { cache: 'no-store' })).text());
 *   await PYPROBE({ page: 'py-<页>',
 *                   marker: '/.claude/worktrees/python-wave-<名>/.superpowers/python-waves/<名>/progress.md',
 *                   copyIds: ['<程序 id>', …] });            // copyIds 可省
 *
 * 它做的事（每一项都报数，不只报「通过」）：
 *   0. 先断言 marker 取得到、且 TOOL.id === page；不成立返回 { VOID: true }——这次测量作废（量到了别的分支或别的页）。
 *   1. 中英 × 每个程序 × 读 / 挖空 / 临摹：面板元数据在；挖空输入框数 == 挖空数 ≥ 1；临摹三层在。
 *   2. 字面量泄漏：每个含 ≥ 3 字符字符串字面量的空，改字面量中间一个字符，中英各调一次 blankFeedback：
 *      必须判错、反馈不印字面量原文；报出实际检查次数 literalChecks。
 *      literalChecks 为 0 就是「没测」，不是通过——这时 literalMode = 'fallback'，下面第 3 项是替代测量。
 *      另在页面上真点一次「检查」核对渲染出的反馈（literalDom）：有字面量空就用改了字面量的答案，没有就用第 3 项那种改了一个字符的答案——
 *      fallback 模式下页面层也要走一次。注意两层的负控制不同：把 PyInteract.blankFeedback 包一层只控制判定层（第 2、3 项）；
 *      页面内部调的是闭包里的 blankFeedback，包装到不了它——页面层的负控制要在 DOM 上做（例如 MutationObserver 往 .py-msg 里注入原文）。
 *   3. 全空各改一个字符（中英）：0 次判对、0 次印出标准答案行、0 条空消息；另加合成字面量对照
 *      （x = "abcd" 答成 "abcQ"：判错、不印 abcd）。第 2 项为 0 次时这一项就是字面量那一格的结论；不为 0 时照跑。
 *   4. 临摹三层对齐：第一个程序打入前 4 行，从末尾往前找**第一个可见字符**，在 .py-typed 与 .py-shadow 里各取它的 Range 矩形，
 *      zoom = 0.9 / 1 / 1.25 三档 dx = dy = 0；每档报这个字符的宽度，宽度必须随缩放严格变大（证明缩放真的生效）。
 *      负控制：把 .py-typed 的 padding-left 设成「原值 + 3px」（原值是 16px），dx 必须等于 +3。
 *   5. （给了 copyIds 才做）读与挖空（每空填标准答案）两种模式的复制内容相同、不含 BLANK 指令；
 *      负控制：把第一个空的答案改掉，挖空的复制内容必须与读的不同。**临摹不比**：copyPayload('trace') 按定义交回的就是她打的字
 *      （state.typed 本身），拿读的内容当 typed 传进去再比，结果恒真、什么也观察不到。
 *      复制内容**真跑**不在这里——node 裸 vm 取、python3 跑，见 SKILL 第 4 步。
 *   6. （给了 keys 才做）逐键临摹一段：keys = { prog: '<程序 id>', seg: <段号，0 起；不分段的程序省略> }。
 *      整段粘贴测不到「只有逐键打才会碰到」的问题——第 5 期 #198 评审 I1：段尾空行在影子层看不见，
 *      逐键打的人永远到不了「段完成」，而实现者与控制方的验收都是整段粘贴，都没看见。所以这里一次一个按键：
 *      · 换行：在输入层上派发 keydown Enter，由**页面自己的** keydown 处理（applyEnter 自动缩进 / 跟随影子）；
 *        之后自动缩进与参考下一行的缩进差，多了派发 Backspace（keydown 让页面记退格，再删一个字符、派发 input），少了逐个打空格。
 *      · 其余字符一个一个：keydown（冒泡到 document——页面的 1/2/3/[/] 快捷键在输入框里不得劫持，劫持了这里会测出来）
 *        → beforeinput（严格档会在这里拒绝错字符；拒绝就记一次 blocked）→ 插入 → input。
 *      · 每按一下都看「完成了没有」：缓冲 === 段参考，分段时还要段按钮带 ✓、不是末段时出现「下一段」。
 *        段尾空行由页面的 chunkTailFill 在最后那一下 Enter 时补齐——补齐了就停，不再按多余的 Enter。
 *      负控制（内建）：记下「最后一个按键之前」的完成状态，**必须是未完成**；完成只能出现在最后一下。
 *      报 keysDrive = { events, enters, backspaces, spaces, blocked, done, doneBeforeLast, stats }。
 *      第 5 期 m7b 控制方用这套做法在 pong-full 段 1（35 行、段尾两个空行）上打了 984 个事件：段 ✓、「下一段」、缓冲 == 段全文。
 *   最后：zoom 复原、临摹输入清空、localStorage **只在本页的键上按差分复原**：本页的键 = python-draft:<本页程序 id>:… 、
 *      python-progress:<本页程序 id>，以及 python-prefs / python-store-v / python-lang；其中运行期间新出现的删掉、值变了的写回原值，别的键一概不碰。
 *      8777 是几个会话共用的同源，clear() 再整份写回会抹掉、改回别的标签页这几秒里写的键（第 4 期收尾评审 m5）。
 *      残余风险：别的标签页恰好在这几秒里改了上面那三个共用键之一，会被写回原值。
 *
 * 不点同意横幅；语言走 ctl.setLang（不改地址栏、不写语言键）；localStorage 先记后按差分还。
 */
window.PYPROBE = async function (opts) {
  var o = opts || {};
  var page = o.page, marker = o.marker, copyIds = o.copyIds || [], keys = o.keys || null;
  var out = { page: page, ok: true, problems: [] };
  function bad(msg) { out.ok = false; out.problems.push(msg); }

  /* 0. 先确认量的是谁 */
  var markerOk = false;
  try { markerOk = !!marker && (await fetch(marker, { cache: 'no-store' })).ok === true; } catch (e) { markerOk = false; }
  var toolId = (typeof TOOL !== 'undefined' && TOOL) ? TOOL.id : null;
  if (!(markerOk && page && toolId === page)) {
    return { VOID: true, page: page, marker: marker, markerOk: markerOk, toolId: toolId };
  }

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 20); }); };
  function lsObj() {
    var o2 = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); o2[k] = localStorage.getItem(k); }
    return o2;
  }
  function snapLS(o3) { return JSON.stringify(Object.keys(o3).sort().map(function (k) { return [k, o3[k]]; })); }
  var lsBefore = lsObj();
  var pageIds = PyPrograms.programs.map(function (q) { return q.id; });
  function mine(k) {                                               /* 只有这些键是本页的操作可能写到的 */
    if (k === 'python-prefs' || k === 'python-store-v' || k === 'python-lang') { return true; }
    var rest = k.indexOf('python-draft:') === 0 ? k.slice(13) : (k.indexOf('python-progress:') === 0 ? k.slice(16) : null);
    return rest !== null && pageIds.some(function (id) { return rest === id || rest.indexOf(id + ':') === 0; });
  }
  function mineOnly(o4) { var r = {}; Object.keys(o4).forEach(function (k) { if (mine(k)) { r[k] = o4[k]; } }); return r; }
  var stage = document.getElementById('stage') || document.body;
  var progs = PyPrograms.programs;
  out.programs = progs.length;
  out.blanksTotal = 0;
  out.literalChecks = 0;

  try {
    /* 1. 三种模式 × 中英 */
    for (var li = 0; li < 2; li++) {
      var lang = ['zh', 'en'][li];
      ctl.setLang(lang); await sleep(30);
      for (var pi = 0; pi < progs.length; pi++) {
        var p = progs[pi];
        var nBlanks = Exercise.parse(p.source).blanks.length;
        if (li === 0) { out.blanksTotal += nBlanks; }
        ctl.setProgram(p.id); await sleep();
        var modes = ['read', 'blank', 'trace'];
        for (var mi = 0; mi < modes.length; mi++) {
          ctl.setMode(modes[mi]); await sleep();
          if (!document.querySelector('.py-meta')) { bad(lang + '/' + p.id + '/' + modes[mi] + '：面板没有元数据'); }
          if (modes[mi] === 'blank') {
            var n = stage.querySelectorAll('textarea.py-blank-in').length;
            if (n !== nBlanks || n < 1) { bad(lang + '/' + p.id + '：输入框 ' + n + ' 个，挖空 ' + nBlanks + ' 个'); }
          }
          if (modes[mi] === 'trace' && !(stage.querySelector('textarea.py-input') && stage.querySelector('.py-shadow') && stage.querySelector('.py-typed'))) {
            bad(lang + '/' + p.id + '：临摹层缺失');
          }
        }
      }
    }

    /* 2. 字面量泄漏：判定层逐个查，页面层真点一次 */
    var firstLiteral = null;
    progs.forEach(function (p2) {
      Exercise.parse(p2.source).blanks.forEach(function (b, bi) {
        var re = /(["'])((?:(?!\1).){3,})\1/g, m;
        while ((m = re.exec(b.body))) {
          var inner = m[2], mid = Math.floor(inner.length / 2), rep = inner[mid] === 'Q' ? 'R' : 'Q';
          var at = m.index + 1 + mid;
          var wrong = b.body.slice(0, at) + rep + b.body.slice(at + 1);
          ['zh', 'en'].forEach(function (l) {
            var fb = PyInteract.blankFeedback(wrong, b.body, l);
            out.literalChecks++;
            if (fb.ok) { bad(l + '/' + p2.id + '#' + b.id + '：改了字面量却判对'); }
            if (String(fb.message).indexOf(inner) !== -1) { bad(l + '/' + p2.id + '#' + b.id + '：反馈印出了字面量 ' + inner); }
          });
          if (!firstLiteral) { firstLiteral = { prog: p2.id, blankIndex: bi, blank: b.id, literal: inner, wrong: wrong }; }
        }
      });
    });
    out.literalMode = out.literalChecks > 0 ? 'literal' : 'fallback';
    var domCase = firstLiteral;
    if (!domCase) {                                                /* fallback：用一个改了字符的错答案，页面层照样点一次 */
      progs.some(function (p4) {
        return Exercise.parse(p4.source).blanks.some(function (b, bi) {
          var ans = b.body.trim(), i = b.body.search(/[A-Za-z]/);
          if (i < 0 || ans.length <= 3) { return false; }
          var wrong = b.body.slice(0, i) + (b.body[i] === 'q' ? 'z' : 'q') + b.body.slice(i + 1);
          domCase = { prog: p4.id, blankIndex: bi, blank: b.id, literal: ans, wrong: wrong };
          return true;
        });
      });
    }
    if (domCase) {
      ctl.setLang('zh'); ctl.setProgram(domCase.prog); ctl.setMode('blank'); await sleep(40);
      var ta = stage.querySelectorAll('textarea.py-blank-in')[domCase.blankIndex];
      ta.value = domCase.wrong; ta.dispatchEvent(new Event('input', { bubbles: true }));
      var box = ta.closest('.py-blankbox');
      var chk = Array.prototype.filter.call(box.querySelectorAll('button'), function (b3) {
        return b3.textContent.indexOf('检查') === 0 || b3.textContent.indexOf('Check') === 0;
      })[0];
      if (!chk) { bad('页面层：找不到「检查」按钮'); }
      else {
        chk.click(); await sleep(40);
        var msgs = box.querySelectorAll('.py-msg'), shown = msgs.length ? msgs[msgs.length - 1].textContent : '';
        out.literalDom = { mode: out.literalMode, prog: domCase.prog, blank: domCase.blank, shown: shown, leaks: shown.indexOf(domCase.literal) !== -1 };
        if (!shown || out.literalDom.leaks) { bad('页面层字面量检查：' + JSON.stringify(out.literalDom)); }
      }
      ta.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /* 3. 全空各改一个字符 + 合成字面量对照（第 2 项为 0 次时，这就是字面量那一格的结论） */
    out.allBlanks = { checked: 0, judgedOk: 0, printedAnswer: 0, emptyMsg: 0, bad: [] };
    progs.forEach(function (p3) {
      Exercise.parse(p3.source).blanks.forEach(function (b) {
        var body = b.body, i = body.search(/[A-Za-z0-9]/);
        if (i < 0) { return; }
        var ch = body[i], rep = /[0-9]/.test(ch) ? (ch === '7' ? '8' : '7') : (ch === 'q' ? 'z' : 'q');
        var wrong = body.slice(0, i) + rep + body.slice(i + 1), ans = body.trim();
        ['zh', 'en'].forEach(function (l) {
          var fb = PyInteract.blankFeedback(wrong, body, l);
          out.allBlanks.checked++;
          if (fb.ok) { out.allBlanks.judgedOk++; out.allBlanks.bad.push(l + '/' + p3.id + '#' + b.id + ' 判对'); }
          if (fb.message && ans.length > 3 && String(fb.message).indexOf(ans) !== -1) { out.allBlanks.printedAnswer++; out.allBlanks.bad.push(l + '/' + p3.id + '#' + b.id + ' 印出答案'); }
          if (!fb.message) { out.allBlanks.emptyMsg++; out.allBlanks.bad.push(l + '/' + p3.id + '#' + b.id + ' 空消息'); }
        });
      });
    });
    if (!out.allBlanks.checked || out.allBlanks.judgedOk || out.allBlanks.printedAnswer || out.allBlanks.emptyMsg) {
      bad('全空改字符：' + JSON.stringify(out.allBlanks));
    }
    var syn = PyInteract.blankFeedback('x = "abcQ"', 'x = "abcd"', 'zh');
    out.syntheticLiteral = { ok: syn.ok, leaks: String(syn.message).indexOf('abcd') !== -1, msg: syn.message };
    if (syn.ok || out.syntheticLiteral.leaks) { bad('合成字面量对照：' + JSON.stringify(out.syntheticLiteral)); }

    /* 4. 临摹三层对齐 */
    ctl.setLang('zh'); ctl.setProgram(progs[0].id); ctl.setMode('trace'); await sleep(40);
    /* 第一个程序若声明了 chunks，影子层只显示**当前段**——先切回第 1 段，前 4 行才与影子同源
       （页面记着上次停在哪一段：刷新后从草稿恢复、或上一次探针的逐键项切到了别的段，都会让影子是别的段，
       量出来就是「different chars」。第 5 期收尾在 py-pygame-games 上实测撞到过）。 */
    if (progs[0].chunks) {
      var seg0 = document.querySelectorAll('.py-chunk-seg')[0];
      if (seg0) { seg0.click(); await sleep(60); } else { bad('对齐：第一个程序声明了 chunks，却找不到段按钮'); }
    }
    var typed = Exercise.clean(progs[0].source).split('\n').slice(0, 4).join('\n');
    var idx = typed.length - 1;
    while (idx > 0 && /\s/.test(typed[idx])) { idx--; }            /* 可见字符：换行符的矩形是退化的，dx = 0 会是假阴 */
    function charRect(layer, k) {
      var walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT), node, pos = 0;
      while ((node = walker.nextNode())) {
        var len = node.nodeValue.length;
        if (pos + len > k) {
          var r = document.createRange(); r.setStart(node, k - pos); r.setEnd(node, k - pos + 1);
          return { rect: r.getBoundingClientRect(), ch: node.nodeValue[k - pos] };
        }
        pos += len;
      }
      return null;
    }
    function measure() {
      var input = stage.querySelector('textarea.py-input');
      input.value = typed; input.dispatchEvent(new Event('input', { bubbles: true }));
      var a = charRect(stage.querySelector('.py-typed'), idx), s = charRect(stage.querySelector('.py-shadow'), idx);
      if (!a || !s) { return { err: 'no rect', idx: idx }; }
      if (a.ch !== s.ch) { return { err: 'different chars', typed: a.ch, shadow: s.ch }; }
      return { idx: idx, ch: a.ch, w: +a.rect.width.toFixed(3),
               dx: +(a.rect.left - s.rect.left).toFixed(3), dy: +(a.rect.top - s.rect.top).toFixed(3) };
    }
    out.align = [];
    var zooms = [0.9, 1, 1.25];
    for (var zi = 0; zi < zooms.length; zi++) {
      document.body.style.zoom = String(zooms[zi]); await sleep(60);
      var mz = measure(); mz.zoom = zooms[zi]; out.align.push(mz);
      if (mz.err || mz.dx !== 0 || mz.dy !== 0 || !(mz.w > 0) || /\s/.test(mz.ch)) { bad('对齐 zoom ' + zooms[zi] + '：' + JSON.stringify(mz)); }
    }
    var ws = out.align.map(function (a2) { return a2.w; });
    if (!(ws[0] < ws[1] && ws[1] < ws[2])) { bad('字宽没有随缩放变大（缩放没生效？）：' + JSON.stringify(ws)); }
    document.body.style.zoom = '1'; await sleep(60);
    var tl = stage.querySelector('.py-typed'), oldPad = tl.style.paddingLeft, basePad = getComputedStyle(tl).paddingLeft;
    tl.style.paddingLeft = 'calc(' + basePad + ' + 3px)';
    out.alignNegative = measure(); out.alignNegative.basePad = basePad;
    tl.style.paddingLeft = oldPad;
    if (out.alignNegative.dx !== 3) { bad('对齐负控制：padding 加 3px 后 dx 应为 +3：' + JSON.stringify(out.alignNegative)); }
    var inp = stage.querySelector('textarea.py-input'); inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true }));

    /* 5. 复制内容（可选） */
    if (copyIds.length) {
      out.copies = {};
      for (var ci = 0; ci < copyIds.length; ci++) {
        var id = copyIds[ci];
        var prog = progs.filter(function (q) { return q.id === id; })[0];
        if (!prog) { bad('copyIds 里的 ' + id + ' 不在本页'); continue; }
        var read = PyInteract.copyPayload('read', prog, {});
        var blanks5 = Exercise.parse(prog.source).blanks, answers = {}, wrongAnswers = {};
        blanks5.forEach(function (b) { answers[b.id] = b.body; wrongAnswers[b.id] = b.body; });
        wrongAnswers[blanks5[0].id] = blanks5[0].body + '  # probe-negative';   /* 负控制：改一个空的答案 */
        var blankCopy = PyInteract.copyPayload('blank', prog, { answers: answers });
        var blankWrong = PyInteract.copyPayload('blank', prog, { answers: wrongAnswers });
        out.copies[id] = { readEqualsBlank: read === blankCopy, negativeDiffers: read !== blankWrong,
                           noDirective: read.indexOf('# >>> BLANK') === -1 && read.indexOf('# <<< BLANK') === -1 };
        if (!out.copies[id].readEqualsBlank || !out.copies[id].negativeDiffers || !out.copies[id].noDirective) { bad('复制内容 ' + id + '：' + JSON.stringify(out.copies[id])); }
      }
    }

    /* 6. 逐键临摹（可选） */
    if (keys) {
      var kp = progs.filter(function (q) { return q.id === keys.prog; })[0];
      if (!kp) { bad('keys.prog ' + keys.prog + ' 不在本页'); }
      else {
        ctl.setLang('zh'); ctl.setProgram(kp.id); ctl.setMode('trace'); await sleep(60);
        var kclean = Exercise.clean(kp.source);
        var ksegs = kp.chunks ? PyInteract.chunkSegments(kclean, kp.chunks) : null;
        var kseg = ksegs ? (keys.seg || 0) : null;
        if (ksegs) {
          var segBtns = document.querySelectorAll('.py-chunk-seg');
          if (!segBtns[kseg]) { bad('找不到第 ' + kseg + ' 段的段按钮'); }
          else { segBtns[kseg].click(); await sleep(60); }
        }
        var kref = ksegs ? ksegs[kseg].text : kclean;
        /* 点页面的「重来」：清掉这一段（不分段时整题）的缓冲、开一遍干净的 run——否则前面几项留下的 run
           是 resumed（「接着上次的草稿打的」），统计行的正确率不是这一遍的。重来会重建输入层，之后再取。 */
        var restartBtn = Array.prototype.filter.call(document.querySelectorAll('button'), function (b4) {
          return b4.textContent === '重来' || b4.textContent === 'Restart';
        })[0];
        if (!restartBtn) { bad('逐键：找不到「重来」按钮'); } else { restartBtn.click(); await sleep(60); }
        var kin = stage.querySelector('textarea.py-input');
        kin.focus();
        if (kin.value !== '') { bad('逐键：重来之后输入层不是空的'); }
        var ev = { events: 0, enters: 0, backspaces: 0, spaces: 0, blocked: 0, hijacked: 0 };
        var keyDown = function (k) {
          var e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
          kin.dispatchEvent(e); ev.events++;
          return e.defaultPrevented;
        };
        var insertCh = function (ch) {
          if (keyDown(ch)) { ev.hijacked++; return; }                  /* 普通字符的 keydown 不该被任何人 preventDefault */
          var bi = new InputEvent('beforeinput', { inputType: 'insertText', data: ch, bubbles: true, cancelable: true });
          kin.dispatchEvent(bi);
          if (bi.defaultPrevented) { ev.blocked++; return; }
          var s0 = kin.selectionStart;
          kin.value = kin.value.slice(0, s0) + ch + kin.value.slice(kin.selectionEnd);
          kin.setSelectionRange(s0 + 1, s0 + 1);
          kin.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: ch, bubbles: true }));
        };
        var backspace = function () {
          keyDown('Backspace'); ev.backspaces++;
          var s1 = kin.selectionStart;
          if (s1 === 0) { return; }
          kin.value = kin.value.slice(0, s1 - 1) + kin.value.slice(s1);
          kin.setSelectionRange(s1 - 1, s1 - 1);
          kin.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
        };
        var segDone = function () {
          if (kin.value !== kref) { return false; }
          if (!ksegs) { return true; }
          var b2 = document.querySelectorAll('.py-chunk-seg')[kseg];
          var ticked = !!b2 && b2.textContent.indexOf('✓') === 0;
          var needNext = kseg < ksegs.length - 1;
          return ticked && (!needNext || !!document.querySelector('.py-chunk-go'));
        };
        var doneBefore = null;
        var step = function (fn) { doneBefore = segDone(); fn(); };
        /* 照人打：只打影子层**看得见**的部分——参考去掉结尾换行（段尾空行在影子层里什么都不画），
           打完最后一个可见行再按一下 Enter（手的惯性），然后停。段尾空行靠页面的 chunkTailFill 补。
           第一版驱动逐行照参考打、把段尾空行也按了 Enter，在拿掉 chunkTailFill 的负控制页上照样「完成」——
           它模拟的不是人，测不到 #198 I1；改成这样之后负控制页停在差段尾空行。 */
        var kbody = kref.replace(/\n+$/, '');
        var refLines = kbody.split('\n');
        if (kbody !== kref) { refLines.push(''); }                    /* 那一下惯性的 Enter */
        for (var li = 0; li < refLines.length && !segDone(); li++) {
          var text = refLines[li];
          if (li > 0) {
            step(function () { keyDown('Enter'); ev.enters++; });   /* 页面的 keydown 处理做换行与自动缩进 */
            if (segDone()) { break; }                                  /* chunkTailFill 补齐了段尾 */
            var want = /^ */.exec(text)[0].length;
            var auto = kin.value.slice(kin.value.lastIndexOf('\n') + 1);
            if (/[^ ]/.test(auto)) { bad('逐键：Enter 之后新行里不只是空格：' + JSON.stringify(auto)); break; }
            while (auto.length > want) { step(backspace); auto = kin.value.slice(kin.value.lastIndexOf('\n') + 1); }
            while (auto.length < want) { step(function () { insertCh(' '); ev.spaces++; }); auto = kin.value.slice(kin.value.lastIndexOf('\n') + 1); }
            text = text.slice(want);
          }
          for (var ci2 = 0; ci2 < text.length; ci2++) { step(insertCh.bind(null, text[ci2])); }
        }
        await sleep(60);
        var statsEl = stage.querySelector('.py-stats');
        out.keysDrive = { prog: kp.id, seg: kseg, refChars: kref.length, events: ev.events, enters: ev.enters,
                          backspaces: ev.backspaces, spaces: ev.spaces, blocked: ev.blocked, hijacked: ev.hijacked,
                          done: segDone(), doneBeforeLast: doneBefore, bufferEqualsRef: kin.value === kref,
                          stats: statsEl ? statsEl.textContent : null };
        if (!out.keysDrive.done) { bad('逐键：打完没有完成：' + JSON.stringify(out.keysDrive)); }
        if (out.keysDrive.doneBeforeLast !== false) { bad('逐键负控制：最后一个按键之前就已「完成」——完成判据看不见差别'); }
        if (ev.blocked || ev.hijacked) { bad('逐键：有按键被拒或被劫持：' + JSON.stringify(ev)); }
        kin.value = ''; kin.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  } catch (e) {
    bad('探针崩溃（这不是页面的结论）：' + e + ' ' + (e && e.stack ? e.stack : ''));
  } finally {
    document.body.style.zoom = '1';
    await sleep(400);                                              /* 等页面自己的边输边存落盘，再复原 */
    var now = lsObj(), touched = 0;
    Object.keys(now).forEach(function (k) { if (mine(k) && !(k in lsBefore)) { localStorage.removeItem(k); touched++; } });
    Object.keys(lsBefore).forEach(function (k) { if (mine(k) && now[k] !== lsBefore[k]) { localStorage.setItem(k, lsBefore[k]); touched++; } });
    out.localStorageTouched = touched;
    out.localStorageRestored = snapLS(mineOnly(lsObj())) === snapLS(mineOnly(lsBefore));
    if (!out.localStorageRestored) { bad('localStorage 没复原'); }
  }
  return out;
};
'PYPROBE loaded';
