'use strict';
const T = require('../_test.js');
const C = require('../crypto-core.js');
const enigma = require('./enigma.js');

const A = C.ALPHABET;

/* ================= 接线本身 =================
   历史接线是公开且早已确立的（Wikipedia "Enigma rotor details"）。这一节不验
   "接线是不是历史上那一份"——那由下面的教科书向量来验；这一节验的是它们的
   **结构**：转子必须是置换，反射器必须是无不动点的对合。两者中任何一条被破坏，
   下面全部性质断言都会跟着塌，而错误信息会指向莫名其妙的地方。 */
enigma.ROTOR_NAMES.forEach(function (name) {
  const R = enigma.ROTORS[name];
  T.eq(R.wiring.length, 26, '转子 ' + name + ' 的接线是 26 个字母');
  const seen = new Set(R.wiring.split(''));
  T.eq(seen.size, 26, '转子 ' + name + ' 的接线是一个置换（26 个互不相同的字母）');
  T.eq(R.fwd.map(function (v, i) { return R.rev[v] === i; }).every(Boolean), true,
       '转子 ' + name + ' 的 rev 确实是 fwd 的逆');
  T.eq(R.notchIndex, R.notch.charCodeAt(0) - 65, '转子 ' + name + ' 的 notchIndex 与 notch 一致');
});
T.eq(enigma.ROTORS.I.notch + enigma.ROTORS.II.notch + enigma.ROTORS.III.notch +
     enigma.ROTORS.IV.notch + enigma.ROTORS.V.notch, 'QEVJZ',
     '五个转子的缺口字母是历史上的 Q E V J Z');

Object.keys(enigma.REFLECTORS).forEach(function (name) {
  const map = enigma.REFLECTORS[name].map;
  let fixed = 0, notInvolution = 0;
  for (let i = 0; i < 26; i++) {
    if (map[i] === i) fixed++;
    if (map[map[i]] !== i) notInvolution++;
  }
  /* 这两条是整台机器唯一那道结构性裂缝的来源：对合 ⟹ 加密即解密；
     无不动点 ⟹ 没有字母能加密成自己 ⟹ crib 可以被"自己撞自己"就地划掉。 */
  T.eq(fixed, 0, '反射器 ' + name + ' 没有不动点（这正是"没有字母加密成自己"的来源）');
  T.eq(notInvolution, 0, '反射器 ' + name + ' 是对合（这正是"加密即解密"的来源）');
});

/* ================= 教科书向量之一 =================
   转子 I·II·III（左→右）、反射器 B、环位 AAA、初始位置 AAA、不插线，
   敲 AAAAA 得 BDZGO。这是 Enigma 实现的标准自检向量，见 Wikipedia
   "Enigma rotor details"。26 个字母那一版是它的自然延长。 */
const BOOK = { rotors: ['I', 'II', 'III'], reflector: 'B', rings: 'AAA', positions: 'AAA' };
T.eq(enigma.encrypt('AAAAA', BOOK), 'BDZGO', '教科书向量：AAAAA → BDZGO');
T.eq(enigma.encrypt('AAAAAAAAAAAAAAAAAAAAAAAAA', BOOK), 'BDZGOWCXLTKSBTMCDLPBMUQOF',
     '教科书向量（25 个 A）：BDZGOWCXLTKSBTMCDLPBMUQOF');
T.eq(enigma.decrypt('BDZGO', BOOK), 'AAAAA', '同一套设置解回去（Enigma 自反）');

/* ================= 教科书向量之二：1941-07-07 巴巴罗萨电报 =================
   公开的历史电报，各家模拟器都拿它当验收用例。设置：转子 II·IV·V、反射器 B、
   环位 BUL、位置 BLA、插线 AV BS CG DL FU HZ IN KM OW RX。
   它比第一条值钱的地方在于**同时**用上了非平凡的环位、插线板与转子 IV/V——
   第一条向量对这三样一无所知，环位或插线板的符号写反了它照样绿。
   而这一条的判据是解出来的德文本身：一个差一位的实现不会碰巧拼出
   "AUFKLXABTEILUNG…"（侦察分队…）。 */
const BARB_CT =
  'EDPUDNRGYSZRCXNUYTPOMRMBOFKTBZREZKMLXLVEFGUEYSIOZVEQMIKUBPMMYLKLTTDEISMDICAGYKUA' +
  'CTCDOMOHWXMUUIAUBSTSLRNBZSZWNRFXWFYSSXJZVIJHIDISHPRKLKAYUPADTXQSPINQMATLPIFSVKDA' +
  'SCTACDPBOPVHJK';
const BARB_PT =
  'AUFKLXABTEILUNGXVONXKURTINOWAXKURTINOWAXNORDWESTLXSEBEZXSEBEZXUAFFLIEGERSTRASZER' +
  'IQTUNGXDUBROWKIXDUBROWKIXOPOTSCHKAXOPOTSCHKAXUMXEINSAQTDREINULLXUHRANGETRETENXAN' +
  'GRIFFXINFXRGTX';
const BARB = { rotors: ['II', 'IV', 'V'], reflector: 'B', rings: 'BUL', positions: 'BLA',
               plugs: 'AV BS CG DL FU HZ IN KM OW RX' };
T.eq(enigma.decrypt(BARB_CT, BARB), BARB_PT, '巴巴罗萨电报解出历史德文原文');
T.eq(enigma.encrypt(BARB_PT, BARB), BARB_CT, '同一套设置把它加回原密文');

/* 环位与插线板都必须真的参与运算——把任一项挪掉，上面那条必须**不**成立。
   没有这两条，一个把环位整个忽略掉的实现也能让上面那条绿（因为它是 BUL，
   而 encrypt/decrypt 用的是同一份忽略）。 */
T.ok(enigma.decrypt(BARB_CT, Object.assign({}, BARB, { rings: 'AAA' })) !== BARB_PT,
     '环位改成 AAA 之后解不出原文（说明 Ringstellung 真的参与了运算）');
T.ok(enigma.decrypt(BARB_CT, Object.assign({}, BARB, { plugs: '' })) !== BARB_PT,
     '拔掉插线之后解不出原文（说明 Steckerbrett 真的参与了运算）');

/* ================= 双步进 =================
   转子 I·II·III、缺口 Q·E·V。从 ADU 起连按四次：
     ADU → ADV → AEW → BFX → BFY
   第三步是双步进：中转子停在自己的缺口 E 上，于是被左转子那只推爪带着**又**
   走了一格，同时把左转子推进一格——尽管右转子这一次并没有对上缺口。
   把这条断言写成整串而不是只看末态：漏掉双步进的实现会给出
   ADU → ADV → AEW → AEX → AEY，第一个分岔就在第三步。 */
(function () {
  let m = enigma.makeMachine({ rotors: ['I', 'II', 'III'], positions: 'ADU' });
  const seen = [enigma.windows(m)];
  const plans = [];
  for (let i = 0; i < 4; i++) {
    plans.push(enigma.stepPlan(m));
    m = enigma.step(m);
    seen.push(enigma.windows(m));
  }
  T.eq(seen, ['ADU', 'ADV', 'AEW', 'BFX', 'BFY'], '双步进：ADU → ADV → AEW → BFX → BFY');
  T.eq(plans.map(function (p) { return p.middle; }), [false, true, true, false],
       '中转子在连续两次按键里都进了位（这就是"双步进"这个名字的由来）');
  T.eq(plans.map(function (p) { return p.doubleStep; }), [false, false, true, false],
       '只有第三步是由中转子**自己的**缺口触发的');
  T.eq(plans.map(function (p) { return p.left; }), [false, false, true, false],
       '左转子只在双步进那一步动');
})();

/* 环位不改变进位发生在哪个窗口字母——缺口在环上，不在接线上。
   这是一条极容易写反的细节：把 notch 判据写成"接线位置到了 notch"而不是
   "窗口字母是 notch"，在环位 AAA 下两者恰好相同，于是所有默认设置的测试
   全绿，只有非平凡环位才露馅。 */
(function () {
  const ringed = enigma.makeMachine({ rotors: ['I', 'II', 'III'], rings: 'XYZ', positions: 'ADU' });
  let m = ringed;
  const seen = [enigma.windows(m)];
  for (let i = 0; i < 4; i++) { m = enigma.step(m); seen.push(enigma.windows(m)); }
  T.eq(seen, ['ADU', 'ADV', 'AEW', 'BFX', 'BFY'],
       '换成环位 XYZ，进位序列一字不变（缺口绑在环上，不绑在接线上）');
})();

/* ================= 位置周期 = 16900 =================
   26·25·26 而不是 26³ = 17576：中转子被双步进吃掉了一步，26 个位置里只有
   25 个是"能停下来"的。少掉的 676 个状态正是双步进的全部代价。 */
T.eq(enigma.positionCycle(enigma.makeMachine({ rotors: ['I', 'II', 'III'] })), 16900,
     '位置周期 = 26·25·26 = 16900（不是 26³ = 17576）');
T.eq(26 * 25 * 26, 16900, '16900 就是 26·25·26');
[['III', 'II', 'I'], ['V', 'IV', 'III'], ['I', 'V', 'III'], ['IV', 'I', 'II']].forEach(function (rs) {
  T.eq(enigma.positionCycle(enigma.makeMachine({ rotors: rs, positions: 'MNO' })), 16900,
       '周期与转子选择无关：' + rs.join(' ') + ' 仍是 16900');
});

/* 少掉的 676 个状态**去哪了**——这是写这条测试时才发现、值得钉住的一件事。
   它们不是"被算重了"，而是**进不去**：中转子只能在右转子越过缺口的那一次
   被推上自己的缺口，所以任何"中转子停在缺口上、而右转子并不刚越过缺口"的
   窗口组合都没有前驱。从这样一个状态出发按键，机器会滑进那条 16900 长的
   环里，再也回不到出发点。

   实测（转子 I·II·III，把全部 17576 个状态的后继关系建出来数）：
     · 环长                       16900
     · 环外状态                     676
     · 其中中转子停在缺口 E 上的     650 = 26 × 25（左轮任意 × 右轮 25 种"不刚越过缺口"）
     · 其余 26 个是那 650 个的后继，同样只进不出 */
(function () {
  const NM = enigma.ROTORS.II.notchIndex;
  const stuck = enigma.makeMachine({ rotors: ['I', 'II', 'III'], positions: [0, NM, 0] });
  T.eq(enigma.positionCycle(stuck, 2000), 2000,
       '从"中转子停在缺口上"出发，2000 步内回不到出发点——那是个进不去的状态');

  const key = function (p) { return (p[0] * 26 + p[1]) * 26 + p[2]; };
  const succ = new Array(17576);
  for (let l = 0; l < 26; l++) {
    for (let m = 0; m < 26; m++) {
      for (let r = 0; r < 26; r++) {
        succ[key([l, m, r])] =
          key(enigma.step(enigma.makeMachine({ rotors: ['I', 'II', 'III'], positions: [l, m, r] })).pos);
      }
    }
  }
  const onCycle = new Set();
  let cur = key([0, 0, 0]);
  for (let i = 0; i < 16900; i++) { onCycle.add(cur); cur = succ[cur]; }
  T.eq(cur, key([0, 0, 0]), '走满 16900 步正好回到 AAA');
  T.eq(onCycle.size, 16900, '这 16900 步里没有一步重复');
  T.eq(17576 - onCycle.size, 676, '17576 个窗口组合里有 676 个在环外');
  let midAtNotch = 0;
  for (let i = 0; i < 17576; i++) {
    if (!onCycle.has(i) && Math.floor(i / 26) % 26 === NM) midAtNotch++;
  }
  T.eq(midAtNotch, 650, '环外那 676 个里，650 个是"中转子停在缺口上"（26 × 25）');
})();

/* ================= 没有字母会加密成它自己 =================
   全部 60 种转子排列 × 2 个反射器 × 26 个字母 × 若干个机器状态。
   这条性质是第三页那个顿悟点的全部依据，所以要**普查**着测，不是抽样。 */
(function () {
  const names = enigma.ROTOR_NAMES;
  let checked = 0, selfMapped = 0;
  const positions = ['AAA', 'QEV', 'MNO', 'ZZZ', 'ADU'];
  for (let a = 0; a < 5; a++) {
    for (let b = 0; b < 5; b++) {
      if (b === a) continue;
      for (let c = 0; c < 5; c++) {
        if (c === a || c === b) continue;
        ['B', 'C'].forEach(function (refl) {
          positions.forEach(function (p) {
            const m = enigma.makeMachine({
              rotors: [names[a], names[b], names[c]], reflector: refl,
              rings: 'BUL', positions: p, plugs: 'AV BS CG DL FU HZ IN KM OW RX'
            });
            for (let i = 0; i < 26; i++) {
              const r = enigma.trace(A.charAt(i), m);
              checked++;
              if (r.out === i) selfMapped++;
            }
          });
        });
      }
    }
  }
  T.eq(checked, 60 * 2 * 5 * 26, '普查覆盖了 60 种转子排列 × 2 反射器 × 5 个位置 × 26 字母');
  T.eq(selfMapped, 0, '这 15600 次映射里，没有一次把字母映到它自己');
})();

/* 同一件事在报文层面再验一次：逐位比对明密文。 */
(function () {
  const plain = C.normalize(BARB_PT + BARB_PT);
  const cipher = enigma.encrypt(plain, BARB);
  T.eq(cipher.length, plain.length, '密文与明文逐位对齐（encrypt 只吐字母）');
  let same = 0;
  for (let i = 0; i < plain.length; i++) if (plain.charAt(i) === cipher.charAt(i)) same++;
  T.eq(same, 0, '一段 ' + plain.length + ' 字母的报文里，没有一位密文等于同位明文');
})();

/* ================= 自反性（往返） ================= */
(function () {
  const P = 'ATTACKATDAWNTHEQUICKBROWNFOXJUMPSOVERTHELAZYDOG';
  const names = enigma.ROTOR_NAMES;
  let n = 0;
  for (let a = 0; a < 5; a++) {
    for (let b = 0; b < 5; b++) {
      if (b === a) continue;
      for (let c = 0; c < 5; c++) {
        if (c === a || c === b) continue;
        const cfg = { rotors: [names[a], names[b], names[c]], reflector: (n % 2 ? 'C' : 'B'),
                      rings: [a, b, c], positions: [c, a, b], plugs: 'QW ER TZ UI OP' };
        T.eq(enigma.decrypt(enigma.encrypt(P, cfg), cfg), P,
             '往返：' + names[a] + names[b] + names[c] + ' 解回原文');
        n++;
      }
    }
  }
  T.eq(n, 60, '60 = 5·4·3 种转子排列全都跑过了');
})();

/* 非字母被丢掉（不是保留）——见模块顶部第 ④ 条。 */
T.eq(enigma.encrypt('AA AAA', BOOK), 'BDZGO', '空格与标点在按键之前就不存在了');
T.eq(enigma.encrypt('中文 aaaaa!', BOOK), 'BDZGO', '非 ASCII 与小写：丢弃 + 大写化');
T.eq(enigma.encrypt('', BOOK), '', '空串是空串');

/* ================= 不可变性 =================
   时间轴的"上一步"直接取快照数组的前一项，前提是每一步都是**新的**对象、
   旧对象一个字节不动。可变实现下这条会退化成"所有快照指向同一台机器"，
   而画面上的表现是往回退时数字纹丝不动——很容易被当成"按钮没接上"。 */
(function () {
  const m0 = enigma.makeMachine({ rotors: ['I', 'II', 'III'], positions: 'ADU' });
  const before = enigma.windows(m0);
  const m1 = enigma.step(m0);
  T.eq(enigma.windows(m0), before, 'step() 之后原机器的窗口没有变');
  T.ok(m1 !== m0, 'step() 返回的是新对象');
  T.ok(m1.pos !== m0.pos, '连内部的 pos 数组也是新的');
  T.eq(Object.isFrozen(m0), true, '机器对象被冻结');
  T.eq(Object.isFrozen(m0.pos), true, 'pos 数组被冻结');
  const chain = [m0];
  for (let i = 0; i < 5; i++) chain.push(enigma.step(chain[chain.length - 1]));
  T.eq(chain.map(enigma.windows), ['ADU', 'ADV', 'AEW', 'BFX', 'BFY', 'BFZ'],
       '一串快照各自保留了自己那一刻的状态');
})();

/* ================= trace 的形状 ================= */
(function () {
  const m = enigma.makeMachine({ rotors: ['I', 'II', 'III'], reflector: 'B',
                                 rings: 'AAA', positions: 'AAB', plugs: 'AB CD' });
  const r = enigma.trace('G', m);
  T.eq(r.stages.length, 9, '九段：插线板 + 三转子 + 反射器 + 三转子 + 插线板');
  T.eq(r.stages.map(function (s) { return s.kind; }),
       ['plug', 'rotor', 'rotor', 'rotor', 'reflector', 'rotor', 'rotor', 'rotor', 'plug'],
       '九段的类型顺序');
  T.eq(r.stages.map(function (s) { return s.name; }),
       ['plugboard', 'III', 'II', 'I', 'B', 'I', 'II', 'III', 'plugboard'],
       '去程从右转子进、回程从左转子出');
  /* 每一段的出口必须就是下一段的入口——链子断了画出来的路径就是假的。 */
  for (let i = 1; i < r.stages.length; i++) {
    T.eq(r.stages[i].in, r.stages[i - 1].out, '第 ' + i + ' 段的入口接在上一段的出口上');
  }
  T.eq(r.stages[0].in, r.in, '第一段的入口是按下的那个键');
  T.eq(r.stages[8].out, r.out, '最后一段的出口是亮起的那盏灯');
  T.eq(r.railsFwd.length, 5, '去程 5 条触点轨');
  T.eq(r.railsBack.length, 5, '回程 5 条触点轨');
  T.eq(r.railsFwd[0], r.in, '去程第 0 条轨就是键盘侧的输入');
  T.eq(r.railsBack[0], r.out, '回程第 0 条轨就是键盘侧的输出');
  T.ok(r.railsFwd[4] !== r.railsBack[4], '反射器两侧的触点必然不同（无不动点）');
  /* trace 是纯函数：不进位。 */
  T.eq(enigma.windows(m), 'AAB', 'trace() 不推动转子');
  /* 自反性在单个字母上：同一状态下 trace(out) 必回到 in。 */
  T.eq(enigma.trace(r.outLetter, m).out, r.in, '同一状态下 trace 把密文字母送回明文字母');
})();

/* ================= rotorMap 与 trace 必须是同一份真相 =================
   工具页用 rotorMap() 画出一个转子的全部 26 根线，同时用 trace() 画出真正
   通电的那一条——两者就在同一幅画面上，公式抄反了会画出一条"不在自己的
   线束里"的路径。这里把两者钉在一起。 */
(function () {
  const m = enigma.makeMachine({ rotors: ['V', 'III', 'I'], reflector: 'C',
                                 rings: 'BUL', positions: 'XYZ', plugs: 'AB CD' });
  for (let slot = 0; slot <= 2; slot++) {
    const fwd = enigma.rotorMap(m, slot, 'fwd');
    const rev = enigma.rotorMap(m, slot, 'rev');
    T.eq(fwd.length, 26, 'slot ' + slot + ' 的有效置换有 26 项');
    T.eq(new Set(fwd).size, 26, 'slot ' + slot + ' 的有效置换仍是置换');
    let inverseOk = true;
    for (let x = 0; x < 26; x++) if (rev[fwd[x]] !== x) inverseOk = false;
    T.eq(inverseOk, true, 'slot ' + slot + ' 的 rev 是 fwd 的逆');
  }
  const r = enigma.trace('K', m);
  r.stages.forEach(function (s) {
    if (s.kind !== 'rotor') return;
    const map = enigma.rotorMap(m, s.slot, s.dir);
    T.eq(map[s.in], s.out,
         'trace 走的那一步就在 rotorMap 给出的线束里（slot ' + s.slot + ' ' + s.dir + '）');
  });
  T.throws(function () { enigma.rotorMap(m, 3); }, 'slot 只能是 0/1/2', /slot 只能是/);
})();

/* ================= "先进位、后通电"必须只有一份真相 =================
   工具页不调用 encrypt() 来画路径：它自己攒一条机器快照链（靠 step() 的
   不可变性），第 i 个字母用的是 machineAt(i + 1)，再交给 trace()。
   这条断言把那条链与 encrypt() 钉在一起——两者一旦分岔，画面上那条路径
   与读数里那个密文字母就会指向不同的机器状态，而屏幕上看不出来。 */
(function () {
  const P = 'DASISTEINTESTDERMASCHINE';
  let m = enigma.makeMachine(BARB);
  let cipher = '';
  const p = C.normalize(P);
  for (let i = 0; i < p.length; i++) {
    m = enigma.step(m);                       // 先进位
    cipher += enigma.trace(p.charAt(i), m).outLetter;   // 后通电
  }
  T.eq(cipher, enigma.encrypt(P, BARB), 'step() + trace() 逐字母重放等于 encrypt()');
  T.eq(cipher.length, p.length, '一个字母一次按键');
})();

/* ================= 插线板的解析 ================= */
(function () {
  const ok = enigma.parsePlugs('AV BS CG');
  T.eq(ok.pairs, [['A', 'V'], ['B', 'S'], ['C', 'G']], '正常解析三组');
  T.eq(ok.dropped, [], '没有被丢弃的 token');
  T.eq(ok.map[0], 21, 'A ↔ V');
  T.eq(ok.map[21], 0, 'V ↔ A（映射是对称的）');
  T.eq(ok.map[25], 25, '没插线的字母映到自己');
  T.eq(enigma.parsePlugs('').pairs, [], '空串 = 不插线');
  T.eq(enigma.parsePlugs(null).pairs, [], 'null = 不插线');
  T.eq(enigma.parsePlugs([['A', 'V'], 'BS']).pairs, [['A', 'V'], ['B', 'S']],
       '数组形式：既收 ["A","V"] 也收 "BS"');
  T.eq(enigma.parsePlugs('av-bs, cg').pairs.length, 3, '分隔符随便，小写也收');

  /* 宽容的一半：看不懂的原样报回来，界面才能说清楚为什么。 */
  const bad = enigma.parsePlugs('AV AB CC D');
  T.eq(bad.pairs, [['A', 'V']], '冲突的组没有进来');
  T.eq(bad.dropped.map(function (d) { return d.reason; }), ['reused', 'self', 'length'],
       '三种拒绝理由各报各的');

  /* 严格的一半：makeMachine 当场抛，不悄悄丢掉使用者的输入。 */
  T.throws(function () { enigma.makeMachine({ plugs: 'AV AB' }); },
           'makeMachine 拒绝一个字母插两次', /插线板配置无效/);
  T.throws(function () { enigma.makeMachine({ plugs: 'AA' }); },
           'makeMachine 拒绝自己插自己', /插线板配置无效/);
})();

/* ================= 配置的守卫 ================= */
T.throws(function () { enigma.makeMachine({ rotors: ['I', 'I', 'III'] }); },
         '同一个转子不能装两次', /不能装两次/);
T.throws(function () { enigma.makeMachine({ rotors: ['I', 'II'] }); },
         'rotors 必须是 3 个', /需要 3 个转子/);
T.throws(function () { enigma.makeMachine({ rotors: ['I', 'II', 'VI'] }); },
         '本模块没有转子 VI', /未知转子/);
T.throws(function () { enigma.makeMachine({ reflector: 'A' }); },
         '本模块没有反射器 A', /未知反射器/);
T.throws(function () { enigma.makeMachine({ rings: 'AB' }); },
         '环位要三个字母', /需要 3 个字母/);
T.throws(function () { enigma.makeMachine({ positions: [1, 2] }); },
         '位置要三项', /需要 3 项/);
T.throws(function () { enigma.makeMachine({ positions: [1, 2, 0.5] }); },
         '位置必须是整数', /不是整数/);
T.throws(function () { enigma.trace('AB', enigma.makeMachine()); },
         'trace 一次只处理一个字母', /一次只处理一个字母/);
T.throws(function () { enigma.step({}); },
         'step 只吃真正的机器', /需要一台由 makeMachine/);

/* 数字与字母两种写法必须给出同一台机器。 */
T.eq(enigma.encrypt('HELLOWORLD', { rotors: [1, 2, 3], rings: [0, 0, 0], positions: [0, 0, 0] }),
     enigma.encrypt('HELLOWORLD', BOOK), '转子写成 1,2,3 与写成 I,II,III 等价');

/* ================= crib 沿密文滑动 ================= */
(function () {
  const rows = enigma.cribPositions('ABCDEF', 'AB');
  T.eq(rows.length, 5, '6 个字母、长度 2 的 crib，有 5 个可放的位置');
  T.eq(rows[0].possible, false, '位置 0：A 对 A、B 对 B，两处撞车');
  T.eq(rows[0].clashes, [0, 1], '两处都被记下来了（画面要标出是哪几位）');
  T.eq(rows[1].possible, true, '位置 1：BC 对 AB，不撞');
  T.eq(rows[1].clashes, [], '不撞就是空数组');

  const s = enigma.cribStats('ABCDEF', 'AB');
  T.eq(s.total, 5, 'total = 位置数');
  T.eq(s.survivors, 4, '只有位置 0 被划掉');
  T.eq(s.eliminated, 1, 'eliminated = total − survivors');
  T.eq(Math.abs(s.expectedSurvivorRate - Math.pow(25 / 26, 2)) < 1e-12, true,
       '理论存活率是 (25/26)^L');

  T.throws(function () { enigma.cribPositions('ABC', ''); },
           '空 crib 没有意义', /至少要有一个字母/);
  T.eq(enigma.cribPositions('AB', 'ABCD'), [], 'crib 比密文长时一个位置都没有');

  /* 真正要紧的一条：**正确的那个位置永远不会被划掉**。
     把一段明文用真机器加密，再把这段明文自己当 crib 沿密文滑——它在真实
     偏移处必定存活（因为没有字母加密成自己），在别处被划掉多少是统计问题，
     但那一个位置的存活是**结构性保证**。一条把判据写反（"必须相同才可能"）
     的实现，会在这里当场翻车。 */
  const plain = C.normalize(BARB_PT);
  const cipher = enigma.encrypt(plain, BARB);
  const crib = plain.slice(40, 40 + 20);
  const rows2 = enigma.cribPositions(cipher, crib);
  T.eq(rows2[40].possible, true, '真实偏移 40 处，crib 一定存活');
  const st = enigma.cribStats(cipher, crib);
  T.ok(st.eliminated > 0, '别的位置确实被划掉了一些（长度 20：' +
       st.eliminated + '/' + st.total + '）');
  /* 实测存活率应当落在理论值附近。区间给得宽（±0.15），因为这是一段真实
     德文、字母分布远非均匀；给窄了这条断言会变成一个偶尔发作的假警报。 */
  const rate = st.survivors / st.total;
  T.ok(Math.abs(rate - st.expectedSurvivorRate) < 0.15,
       '实测存活率 ' + rate.toFixed(3) + ' 落在理论值 ' +
       st.expectedSurvivorRate.toFixed(3) + ' 附近');
})();

T.report('enigma');
