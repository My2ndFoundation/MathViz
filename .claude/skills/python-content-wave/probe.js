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
 *      必须判错、反馈不印字面量原文；报出实际检查次数 literalChecks，并在页面上真点一次「检查」核对渲染出的反馈。
 *      literalChecks 为 0 就是「没测」，不是通过——这时 literalMode = 'fallback'，下面第 3 项是替代测量。
 *   3. 全空各改一个字符（中英）：0 次判对、0 次印出标准答案行、0 条空消息；另加合成字面量对照
 *      （x = "abcd" 答成 "abcQ"：判错、不印 abcd）。第 2 项为 0 次时这一项就是字面量那一格的结论；不为 0 时照跑。
 *   4. 临摹三层对齐：第一个程序打入前 4 行，从末尾往前找**第一个可见字符**，在 .py-typed 与 .py-shadow 里各取它的 Range 矩形，
 *      zoom = 0.9 / 1 / 1.25 三档 dx = dy = 0；每档报这个字符的宽度，宽度必须随缩放严格变大（证明缩放真的生效）。
 *      负控制：.py-typed 加 3px padding-left，dx 必须 ≠ 0。
 *   5. （给了 copyIds 才做）三种模式的复制内容相同、不含 BLANK 指令。复制内容**真跑**不在这里——node 裸 vm 取、python3 跑，见 SKILL 第 4 步。
 *   最后：zoom 复原、临摹输入清空、localStorage 按**排序后的键**比较复原（键序会变）。
 *
 * 不点同意横幅；语言走 ctl.setLang（不改地址栏、不写语言键）；localStorage 先记后还。
 */
window.PYPROBE = async function (opts) {
  var o = opts || {};
  var page = o.page, marker = o.marker, copyIds = o.copyIds || [];
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
  function snapLS() {
    var o2 = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); o2[k] = localStorage.getItem(k); }
    return JSON.stringify(Object.keys(o2).sort().map(function (k) { return [k, o2[k]]; }));
  }
  var lsBefore = snapLS();
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
    if (firstLiteral) {
      ctl.setLang('zh'); ctl.setProgram(firstLiteral.prog); ctl.setMode('blank'); await sleep(40);
      var ta = stage.querySelectorAll('textarea.py-blank-in')[firstLiteral.blankIndex];
      ta.value = firstLiteral.wrong; ta.dispatchEvent(new Event('input', { bubbles: true }));
      var box = ta.closest('.py-blankbox');
      var chk = Array.prototype.filter.call(box.querySelectorAll('button'), function (b3) {
        return b3.textContent.indexOf('检查') === 0 || b3.textContent.indexOf('Check') === 0;
      })[0];
      if (!chk) { bad('页面层：找不到「检查」按钮'); }
      else {
        chk.click(); await sleep(40);
        var msgs = box.querySelectorAll('.py-msg'), shown = msgs.length ? msgs[msgs.length - 1].textContent : '';
        out.literalDom = { prog: firstLiteral.prog, blank: firstLiteral.blank, shown: shown, leaks: shown.indexOf(firstLiteral.literal) !== -1 };
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
    var tl = stage.querySelector('.py-typed'), oldPad = tl.style.paddingLeft;
    tl.style.paddingLeft = '3px';
    out.alignNegative = measure();
    tl.style.paddingLeft = oldPad;
    if (!out.alignNegative.dx) { bad('对齐负控制没有变红：' + JSON.stringify(out.alignNegative)); }
    var inp = stage.querySelector('textarea.py-input'); inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true }));

    /* 5. 复制内容（可选） */
    if (copyIds.length) {
      out.copies = {};
      for (var ci = 0; ci < copyIds.length; ci++) {
        var id = copyIds[ci];
        var prog = progs.filter(function (q) { return q.id === id; })[0];
        if (!prog) { bad('copyIds 里的 ' + id + ' 不在本页'); continue; }
        var read = PyInteract.copyPayload('read', prog, {});
        var answers = {};
        Exercise.parse(prog.source).blanks.forEach(function (b) { answers[b.id] = b.body; });
        var blankCopy = PyInteract.copyPayload('blank', prog, { answers: answers });
        var traceCopy = PyInteract.copyPayload('trace', prog, { typed: read });
        out.copies[id] = { same: read === blankCopy && read === traceCopy, noDirective: read.indexOf('# >>> BLANK') === -1 && read.indexOf('# <<< BLANK') === -1 };
        if (!out.copies[id].same || !out.copies[id].noDirective) { bad('复制内容 ' + id + '：' + JSON.stringify(out.copies[id])); }
      }
    }
  } catch (e) {
    bad('探针崩溃（这不是页面的结论）：' + e + ' ' + (e && e.stack ? e.stack : ''));
  } finally {
    document.body.style.zoom = '1';
    await sleep(400);                                              /* 等页面自己的边输边存落盘，再复原 */
    var saved = JSON.parse(lsBefore);
    localStorage.clear();
    saved.forEach(function (kv) { localStorage.setItem(kv[0], kv[1]); });
    out.localStorageRestored = snapLS() === lsBefore;
    if (!out.localStorageRestored) { bad('localStorage 没复原'); }
  }
  return out;
};
'PYPROBE loaded';
