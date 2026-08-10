(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    /* node 下取兄弟目录的 crypto-core：路径用 path.join 拼，不写字面的父目录
       相对路径。理由与 caesar.js 完全相同——那个字符串会被 inline_core.py 原样
       内联进每一个工具页，而 check.py 的 outbound_ref_check() 正在数整个子树里
       的父目录引用，用它守住"cryptography/ 可以整体搬走"这条约束。 */
    module.exports = factory(require(require('path').join(__dirname, '..', 'crypto-core.js')));
  } else {
    root.CryptoAlgos = root.CryptoAlgos || {};
    root.CryptoAlgos.enigma = factory(root.CryptoCore);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* ================= 德军 Enigma I / M3 =================

     一次按键的电流路径（本模块的全部内容都是它的展开）：

       键盘 → 插线板 → ETW → 右转子 → 中转子 → 左转子 → 反射器
            → 左转子 → 中转子 → 右转子 → ETW → 插线板 → 灯泡

     四条设计取舍写在最前面，后面的代码都是它们的后果：

     ① **转子数组一律左→右**（rotors[0] 是最左、最慢的那一个，rotors[2] 是最右、
        每次按键都动的那一个）。德军的 Walzenlage「I II III」就是这个顺序，
        窗口里读到的三个字母也是这个顺序。整个模块不再出现第二种约定。

     ② **机器状态不可变**。step(machine) 返回一个**新的**机器，原对象一个字节
        都不改（连内部的数组都 Object.freeze 过）。这不是洁癖：工具页的时间轴
        要能往回退一步，而"往回退"在可变状态下只能靠反向推演——转子进位不是
        双射的逆运算好写的东西（双步进使得"上一步"需要额外信息），一旦写错，
        错的是使用者正在观察的那个现象本身。存一串不可变快照，退一步就是取
        cache[i-1]。

     ③ **ETW 是恒等**（Enigma I / M3 的入口轮 A→A）。商用 Enigma 的 QWERTZU
        入口轮不在本模块范围内；写死成恒等而不是留一个永远传恒等的参数，
        是为了不假装支持一件没测过的事。

     ④ **encrypt 只处理字母**（走 C.letters 规范化）。这与 caesar.js 保留标点的
        做法**相反**，是刻意的：Enigma 的键盘上根本没有标点和空格，报务员发报前
        自己就把它们替换掉了（ X 当句号、 ZZ 当逗号）。更要紧的是本工具第三页
        要逐位比对明密文——"第 i 个密文字母绝不等于第 i 个明文字母"这句话只有在
        两串逐位对齐时才检查得了，保留标点会让下标错开。 */

  const N = C.N;
  const A = C.ALPHABET;

  /* ---- 历史接线（公开且早已确立，见 Wikipedia "Enigma rotor details"） ----
     wiring 的第 i 个字母 = 从右侧第 i 号触点进、从左侧哪个触点出（转子在
     A 位、环位 A 时）。notch 是**窗口字母**：窗口显示这个字母时按下一个键，
     它左边那个转子跟着进一位。注意 notch 绑在环上而不是绑在接线上，所以
     环位（Ringstellung）改变接线偏移，**不改变**进位发生在哪个窗口字母。 */
  const ROTOR_SPEC = {
    I:   { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
    II:  { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
    III: { wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' },
    IV:  { wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notch: 'J' },
    V:   { wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', notch: 'Z' }
  };
  const ROTOR_NAMES = ['I', 'II', 'III', 'IV', 'V'];

  const REFLECTOR_SPEC = {
    B: 'YRUHQSLDPXNGOKMIEBFZCWVJAT',
    C: 'FVPJIAOYEDRZXWGCTKUQSBNMHL'
  };

  /* 把一条 26 字母的接线串变成下标数组，顺带把"它必须是一个置换"钉死。
     不是防御性编程的门面活：接线串抄错一个字母时，最常见的形状是某个字母
     出现两次、另一个一次都不出现——加解密照样"能跑"，只是有一个字母永远
     解不回来，而这种错要靠一条恰好撞上的测试向量才发现。 */
  function permOf(s, label) {
    if (typeof s !== 'string' || s.length !== N) {
      throw new Error(label + ' 必须是 ' + N + ' 个字母的接线串，收到 ' + JSON.stringify(s));
    }
    const f = new Array(N);
    const seen = new Array(N).fill(false);
    for (let i = 0; i < N; i++) {
      const v = s.charCodeAt(i) - 65;
      if (v < 0 || v >= N) throw new Error(label + ' 里有非 A–Z 字符：' + JSON.stringify(s.charAt(i)));
      if (seen[v]) throw new Error(label + ' 不是置换：字母 ' + A.charAt(v) + ' 出现了两次');
      seen[v] = true;
      f[i] = v;
    }
    return f;
  }

  function invert(f) {
    const r = new Array(N);
    for (let i = 0; i < N; i++) r[f[i]] = i;
    return r;
  }

  const ROTORS = (function () {
    const out = {};
    ROTOR_NAMES.forEach(function (name) {
      const spec = ROTOR_SPEC[name];
      const fwd = permOf(spec.wiring, '转子 ' + name + ' 的接线');
      out[name] = Object.freeze({
        name: name,
        wiring: spec.wiring,
        notch: spec.notch,
        notchIndex: spec.notch.charCodeAt(0) - 65,
        fwd: Object.freeze(fwd),
        rev: Object.freeze(invert(fwd))
      });
    });
    return Object.freeze(out);
  })();

  /* 反射器在加载时就被检查成**无不动点的对合**，检查不过当场抛。
     这两条性质不是实现细节，是这台机器唯一的结构性漏洞的来源：
       · 对合（reflect(reflect(x)) === x）⟹ 加密即解密，收发双方用同一套设置；
       · 无不动点（reflect(x) !== x）⟹ 任何字母都不可能加密成它自己。
     第二条让"把一段猜测的明文沿密文滑动，凡是有一位自己撞上自己的位置就地
     划掉"成为可能，而那正是 Bletchley Park 每天开工的第一步。把它写成加载期
     断言，是因为一旦某天有人改错一个字母而这两条悄悄不成立，工具页第三页
     讲的整个故事就变成了假的，而画面上看不出任何异常。 */
  const REFLECTORS = (function () {
    const out = {};
    Object.keys(REFLECTOR_SPEC).forEach(function (name) {
      const map = permOf(REFLECTOR_SPEC[name], '反射器 ' + name + ' 的接线');
      for (let i = 0; i < N; i++) {
        if (map[i] === i) {
          throw new Error('反射器 ' + name + ' 有不动点：' + A.charAt(i) + ' 映到了自己');
        }
        if (map[map[i]] !== i) {
          throw new Error('反射器 ' + name + ' 不是对合：' + A.charAt(i) + ' → ' +
                          A.charAt(map[i]) + ' → ' + A.charAt(map[map[i]]));
        }
      }
      out[name] = Object.freeze({ name: name, wiring: REFLECTOR_SPEC[name], map: Object.freeze(map) });
    });
    return Object.freeze(out);
  })();

  /* ================= 插线板 =================
     两个函数各管一件事，刻意不合并：
       · parsePlugs()  —— "读懂人打的那行字"。宽容：看不懂的 token 收进 dropped
         原样报给调用方，让界面能说"这两组我没收，因为 A 已经被占了"。
       · makeMachine() —— "拒绝一台不自洽的机器"。严格：任何 dropped 当场抛。
     工具页的输入框是逐字符触发的，中间必然经过 'A' 这种半截状态；让那半截
     状态每帧抛一次异常，页面就停在空白画布上了。 */
  function parsePlugs(spec) {
    const tokens = [];
    if (spec == null || spec === '') {
      /* 空 = 不插线，完全合法（1930 年代早期的用法）。 */
    } else if (Array.isArray(spec)) {
      for (let i = 0; i < spec.length; i++) {
        const p = spec[i];
        tokens.push(Array.isArray(p) ? p.join('') : String(p));
      }
    } else {
      const raw = String(spec).split(/[^A-Za-z]+/);
      for (let i = 0; i < raw.length; i++) if (raw[i]) tokens.push(raw[i]);
    }

    const map = new Array(N);
    for (let i = 0; i < N; i++) map[i] = i;
    const pairs = [];
    const dropped = [];
    const used = new Array(N).fill(false);

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const s = C.normalize(tok);
      if (s.length !== 2) { dropped.push({ token: tok, reason: 'length' }); continue; }
      const a = s.charCodeAt(0) - 65, b = s.charCodeAt(1) - 65;
      if (a === b) { dropped.push({ token: tok, reason: 'self' }); continue; }
      if (used[a] || used[b]) { dropped.push({ token: tok, reason: 'reused' }); continue; }
      /* 13 组是物理上限——26 个插孔，插满就没有空的了。第 14 组一定与前面某组
         共用字母，所以上面那条 reused 已经把它挡住了；这里不需要单独的计数守卫。 */
      used[a] = used[b] = true;
      map[a] = b; map[b] = a;
      pairs.push([A.charAt(a), A.charAt(b)]);
    }
    return { pairs: pairs, map: map, dropped: dropped };
  }

  function plugsStrict(spec) {
    const r = parsePlugs(spec);
    if (r.dropped.length) {
      throw new Error('插线板配置无效（' +
        r.dropped.map(function (d) { return JSON.stringify(d.token) + ':' + d.reason; }).join('、') +
        '）——每组必须是两个不同字母，且同一个字母只能插一次');
    }
    return r;
  }

  /* ================= 机器 ================= */

  function rotorName(r) {
    if (typeof r === 'number') {
      if (!Number.isInteger(r) || r < 1 || r > ROTOR_NAMES.length) {
        throw new Error('转子编号必须是 1–' + ROTOR_NAMES.length + ' 的整数，收到 ' + r);
      }
      return ROTOR_NAMES[r - 1];
    }
    const s = String(r).toUpperCase().trim();
    if (!ROTOR_SPEC[s]) {
      throw new Error('未知转子 ' + JSON.stringify(r) + '——本模块只有 ' + ROTOR_NAMES.join('、'));
    }
    return s;
  }

  /* 环位与初始位置都收「三个字母的串」或「三个 0 基下标的数组」，一律左→右。
     不收 1–26 的编号：历史上 Ringstellung 两种写法都有（A–Z 与 01–26），而
     `[1,1,1]` 在两种约定下分别是 A 和 B——一个静默差一位的错误。要数字就写
     0 基，要人读就写字母，中间那种会被误解的写法不提供。 */
  function triple(v, label, dflt) {
    if (v == null) return dflt.slice();
    if (typeof v === 'string') {
      const s = C.normalize(v);
      if (s.length !== 3) {
        throw new Error(label + ' 需要 3 个字母（左·中·右），收到 ' + JSON.stringify(v));
      }
      return [s.charCodeAt(0) - 65, s.charCodeAt(1) - 65, s.charCodeAt(2) - 65];
    }
    if (Array.isArray(v)) {
      if (v.length !== 3) throw new Error(label + ' 需要 3 项（左·中·右），收到 ' + v.length + ' 项');
      return v.map(function (x, i) {
        if (!Number.isInteger(x)) {
          throw new Error(label + ' 第 ' + i + ' 项不是整数：' + x + '（0 基下标，A=0）');
        }
        return C.mod(x, N);
      });
    }
    throw new Error(label + ' 只收 3 个字母的串或 3 个 0 基下标的数组，收到 ' + typeof v);
  }

  function freezeMachine(rotors, rings, pos, reflector, plugMap, plugPairs) {
    return Object.freeze({
      rotors: Object.freeze(rotors),
      rings: Object.freeze(rings),
      pos: Object.freeze(pos),
      reflector: reflector,
      plugs: Object.freeze(plugMap),
      plugPairs: Object.freeze(plugPairs.map(function (p) { return Object.freeze(p); }))
    });
  }

  function makeMachine(cfg) {
    cfg = cfg || {};
    const names = (cfg.rotors == null) ? ['I', 'II', 'III'] : cfg.rotors;
    if (!Array.isArray(names) || names.length !== 3) {
      throw new Error('rotors 需要 3 个转子（左→右，即慢→快），收到 ' + JSON.stringify(cfg.rotors));
    }
    const rotors = names.map(rotorName);
    /* 同一个转子装两次在物理上办不到——箱子里每种只有一个。允许它会让密钥
       空间凭空多出一批历史上不存在的设置，而工具页第二页正要拿 60 = 5·4·3
       这个数说话。 */
    if (rotors[0] === rotors[1] || rotors[1] === rotors[2] || rotors[0] === rotors[2]) {
      throw new Error('同一个转子不能装两次：' + rotors.join(' '));
    }
    const reflector = String(cfg.reflector == null ? 'B' : cfg.reflector).toUpperCase().trim();
    if (!REFLECTORS[reflector]) {
      throw new Error('未知反射器 ' + JSON.stringify(cfg.reflector) + '——本模块只有 B 与 C');
    }
    const pl = plugsStrict(cfg.plugs);
    return freezeMachine(rotors,
                         triple(cfg.rings, 'rings（环位 Ringstellung）', [0, 0, 0]),
                         triple(cfg.positions, 'positions（初始位置 Grundstellung）', [0, 0, 0]),
                         reflector, pl.map, pl.pairs);
  }

  function isMachine(x) {
    return !!x && Array.isArray(x.rotors) && Array.isArray(x.pos) &&
           Array.isArray(x.rings) && Array.isArray(x.plugs);
  }

  function coerce(config) {
    if (isMachine(config)) return config;
    return makeMachine(config);
  }

  function withPos(m, pos) {
    return freezeMachine(m.rotors.slice(), m.rings.slice(), pos, m.reflector,
                         m.plugs.slice(), m.plugPairs.map(function (p) { return p.slice(); }));
  }

  /* ================= 进位（含双步进） =================
     这不是一个边角情况，这**就是**进位机构本身。

     机械上，每个转子右侧有一圈棘齿，它左边邻居的推爪（Klinke）平时压在棘齿上
     空转，只有当这个转子的窗口露出 notch 那个字母时，推爪才咬得进缺口，于是
     按下一个键时两个转子被一起推动一格。中转子的推爪由右转子的缺口驱动，
     左转子的推爪由中转子的缺口驱动。

     关键在于：**中转子的推爪同时也压在中转子自己的棘齿上**。所以当中转子停在
     自己的 notch 上时，下一次按键它会被左转子那只推爪带着**再走一格**——尽管
     右转子的缺口这一次并没有对上。这就是双步进（double stepping）：

       ADU → ADV → AEW → BFX → BFY        （转子 I·II·III，缺口 Q·E·V）
             ↑右轮到V   ↑中轮进位到E  ↑中轮又进了一格，同时带动左轮

     中转子因此在 26 步里只有 25 个不同的状态可停留（它跳过了一步），
     整机的位置周期从 26³ = 17576 掉到 26·25·26 = **16900**。

     写法上必须先读**全部**三个当前位置再一起写，不能边判边改：先把中转子加一
     再去判"右转子在不在缺口上"会读到已经变了的状态，双步进就消失了，而密文
     只在每 676 次按键中的那一次错——一段短报文根本测不出来。 */
  function step(machine) {
    const m = machine;
    if (!isMachine(m)) throw new Error('step 需要一台由 makeMachine 造出来的机器');
    const p = m.pos;
    const midAtNotch = ROTORS[m.rotors[1]].notchIndex === p[1];
    const rightAtNotch = ROTORS[m.rotors[2]].notchIndex === p[2];
    let l = p[0], mid = p[1];
    if (midAtNotch) {
      mid = C.mod(mid + 1, N);
      l = C.mod(l + 1, N);
    } else if (rightAtNotch) {
      mid = C.mod(mid + 1, N);
    }
    return withPos(m, [l, mid, C.mod(p[2] + 1, N)]);
  }

  /* 这一次按键会推动哪几个转子——画面要给"动了的那一个"打高亮，读数要说清
     "这一步中转子进了两次里的第几次"。判据与 step() 同源（同一对 notch 比较），
     没有第二份进位逻辑。 */
  function stepPlan(machine) {
    const m = machine;
    const midAtNotch = ROTORS[m.rotors[1]].notchIndex === m.pos[1];
    const rightAtNotch = ROTORS[m.rotors[2]].notchIndex === m.pos[2];
    return {
      left: midAtNotch,
      middle: midAtNotch || rightAtNotch,
      right: true,
      /* 双步进 = 中转子这一步是被**它自己的缺口**推动的（而不是被右转子推动的）。
         它与 left 同真同假，分开命名是因为画面上要说的是两件事：
         "左轮动了"是现象，"中轮连着动了两次"是原因。 */
      doubleStep: midAtNotch,
      midAtNotch: midAtNotch,
      rightAtNotch: rightAtNotch
    };
  }

  /* ================= 一次按键的电流路径 =================
     trace() 是**当前状态**的纯函数：它不进位。机械顺序是"先进位、后通电"，
     所以 encrypt() 里写的是 m = step(m) 然后 trace(ch, m)。把进位塞进 trace
     会让工具页没法画"这一步进位之前/之后"的对照，而那正是第二页要画的。 */

  function rotorFwd(m, slot, x) {
    const R = ROTORS[m.rotors[slot]];
    const sh = m.pos[slot] - m.rings[slot];
    return C.mod(R.fwd[C.mod(x + sh, N)] - sh, N);
  }
  function rotorRev(m, slot, x) {
    const R = ROTORS[m.rotors[slot]];
    const sh = m.pos[slot] - m.rings[slot];
    return C.mod(R.rev[C.mod(x + sh, N)] - sh, N);
  }

  function trace(ch, machine) {
    const m = machine;
    if (!isMachine(m)) throw new Error('trace 需要一台由 makeMachine 造出来的机器');
    const s = C.normalize(ch);
    if (s.length !== 1) {
      throw new Error('trace 一次只处理一个字母，收到 ' + JSON.stringify(ch));
    }
    const inIdx = s.charCodeAt(0) - 65;

    const stages = [];
    /* rails 是给画面用的：6 条竖直触点轨，从键盘侧数到反射器侧。
       railsFwd[i] 是去程在第 i 条轨上的触点号，railsBack[i] 是回程的。
       两个数组都按 rail 下标 0..4 存，画线时直接取相邻两项。 */
    const railsFwd = new Array(5);
    const railsBack = new Array(5);

    let x = inIdx;
    railsFwd[0] = x;
    let y = m.plugs[x];
    stages.push({ kind: 'plug', name: 'plugboard', dir: 'in', slot: -1, in: x, out: y,
                  swapped: y !== x });
    x = y; railsFwd[1] = x;

    for (let slot = 2; slot >= 0; slot--) {
      y = rotorFwd(m, slot, x);
      stages.push({ kind: 'rotor', name: m.rotors[slot], slot: slot, dir: 'fwd', in: x, out: y });
      x = y; railsFwd[4 - slot] = x;
    }

    y = REFLECTORS[m.reflector].map[x];
    stages.push({ kind: 'reflector', name: m.reflector, slot: -1, dir: 'refl', in: x, out: y });
    x = y; railsBack[4] = x;

    for (let slot = 0; slot <= 2; slot++) {
      y = rotorRev(m, slot, x);
      stages.push({ kind: 'rotor', name: m.rotors[slot], slot: slot, dir: 'rev', in: x, out: y });
      x = y; railsBack[3 - slot] = x;
    }

    y = m.plugs[x];
    stages.push({ kind: 'plug', name: 'plugboard', dir: 'out', slot: -1, in: x, out: y,
                  swapped: y !== x });
    x = y; railsBack[0] = x;

    return {
      in: inIdx,
      out: x,
      inLetter: A.charAt(inIdx),
      outLetter: A.charAt(x),
      stages: stages,
      railsFwd: railsFwd,
      railsBack: railsBack,
      pos: m.pos.slice(),
      windows: windows(m)
    };
  }

  function windows(m) {
    return A.charAt(m.pos[0]) + A.charAt(m.pos[1]) + A.charAt(m.pos[2]);
  }

  /* 某个转子**此刻**的有效置换：26 个触点各通到哪里，位置与环位都算进去了。
     工具页要把一个转子的全部 26 根线一次画出来（"转子不是一次代换，是一张
     每按一次键就换一张的表"），需要的正是这个数组。
     给出来而不是让页面自己写 mod(fwd[mod(x+sh)] − sh)：那条公式的符号一旦
     在页面里抄反，画出来的线会与真正参与加密的那条路径不符——而两者就在
     同一幅画面上，看的人会以为是自己理解错了。一份公式，一个出口。 */
  function rotorMap(machine, slot, dir) {
    const m = machine;
    if (!isMachine(m)) throw new Error('rotorMap 需要一台由 makeMachine 造出来的机器');
    if (!(slot === 0 || slot === 1 || slot === 2)) {
      throw new Error('rotorMap 的 slot 只能是 0（左）· 1（中）· 2（右），收到 ' + slot);
    }
    const f = (dir === 'rev') ? rotorRev : rotorFwd;
    const out = new Array(N);
    for (let x = 0; x < N; x++) out[x] = f(m, slot, x);
    return out;
  }

  /* ================= 加密 / 解密 =================
     Enigma 自反：同一套设置下 encrypt 就是 decrypt。这不是巧合，是反射器
     那条对合性质的直接后果，所以这里 decrypt 只是 encrypt 的别名而不是
     另写一份——另写一份就会有两个真相。 */
  function encrypt(text, config) {
    let m = coerce(config);
    const idxs = C.letters(text);
    let out = '';
    for (let i = 0; i < idxs.length; i++) {
      m = step(m);
      out += A.charAt(trace(A.charAt(idxs[i]), m).out);
    }
    return out;
  }
  function decrypt(text, config) { return encrypt(text, config); }

  /* 这里刻意**没有**一个"一次跑完整段报文并返回每一步快照"的便利函数。
     工具页要的是随机访问（时间轴可以任意 seek 到第 1500 次按键），它靠的是
     step() 的不可变性自己攒一条懒惰增长的快照链——那条链既服务报文，也服务
     与报文无关的进位演示。再给一个只覆盖前者的 run() 就是第二条路径，
     两条路径迟早给出两个答案，而画面上看不出信的是哪一个。 */

  /* 位置周期：一直按键，直到三个窗口回到出发那一组。
     三个各带一个缺口的转子，答案恒为 26·25·26 = 16900——26 少的那一个正是
     双步进吃掉的那一步。cap 只是护栏，不是答案的一部分。 */
  function positionCycle(machine, cap) {
    const limit = cap == null ? 200000 : cap;
    const start = coerce(machine);
    const key = start.pos.join(',');
    let m = start, n = 0;
    do {
      m = step(m);
      n++;
    } while (m.pos.join(',') !== key && n < limit);
    return n;
  }

  /* ================= 明文猜测（crib）沿密文滑动 =================
     反射器无不动点 ⟹ 任何字母都不会加密成它自己 ⟹ 把一段猜测的明文摆在
     密文的某个位置上时，只要有**一位**猜测字母与它下面的密文字母相同，
     这个位置就**不可能**是对的。不需要任何密钥知识，不需要试解，一眼就能划掉。

     这就是 Bletchley Park 每天开工的第一步，也是本工具第三页要讲的全部：
     倒下的不是密钥空间（10²³ 量级的密钥空间一直好端端地在那里），
     是一条在每个位置上都泄露信息的结构性质。

     返回每个位置一条记录，clashes 是撞上的下标列表——画面要把那几位标出来，
     "为什么这个位置死了"才有答案。 */
  function cribPositions(cipher, crib) {
    const c = C.normalize(cipher);
    const k = C.normalize(crib);
    if (k.length === 0) throw new Error('cribPositions 的 crib 至少要有一个字母');
    const out = [];
    for (let off = 0; off + k.length <= c.length; off++) {
      const clashes = [];
      for (let j = 0; j < k.length; j++) {
        if (c.charCodeAt(off + j) === k.charCodeAt(j)) clashes.push(j);
      }
      out.push({ offset: off, clashes: clashes, possible: clashes.length === 0 });
    }
    return out;
  }

  /* 划掉了多少。expectedSurvivorRate 是 (25/26)^L —— 假定密文的每一位与
     crib 的那一位无关且均匀，一位不撞的概率是 25/26，L 位全不撞就是它的 L 次方。
     页面把实测值印在这个理论值旁边：它们对得上，本身就是"这条性质是结构性的、
     不是这段密文的巧合"的证据。 */
  function cribStats(cipher, crib) {
    const rows = cribPositions(cipher, crib);
    let survivors = 0;
    for (let i = 0; i < rows.length; i++) if (rows[i].possible) survivors++;
    const L = C.normalize(crib).length;
    return {
      total: rows.length,
      survivors: survivors,
      eliminated: rows.length - survivors,
      eliminatedFraction: rows.length ? (rows.length - survivors) / rows.length : 0,
      expectedSurvivorRate: Math.pow((N - 1) / N, L)
    };
  }

  return {
    ROTORS: ROTORS, REFLECTORS: REFLECTORS, ROTOR_NAMES: ROTOR_NAMES,
    makeMachine: makeMachine, isMachine: isMachine,
    step: step, stepPlan: stepPlan, trace: trace, windows: windows, rotorMap: rotorMap,
    encrypt: encrypt, decrypt: decrypt,
    positionCycle: positionCycle,
    parsePlugs: parsePlugs,
    cribPositions: cribPositions, cribStats: cribStats
  };
});
