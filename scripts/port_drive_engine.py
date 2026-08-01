#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把「场景时间驱动」引擎从 starter 逐字移植进 outputs/*.html。

真源是 design-system/math-viz-starter.html —— 本脚本不内联任何引擎代码，
所有片段都在运行时从 starter 里按标记切出来，避免手抄产生第 52 份变体。

设计要点：
  * 幂等：每处改动都有一个 probe 字符串，已存在就跳过；重复运行零改动。
  * 失败要响：锚点命中数 != 1 就报错并整文件跳过（不做部分写入、不模糊匹配）。
  * cartesian-polar-coordinate-3d 用 paramRefs / ref.cfg 而非 paramWraps / e.p，
    脚本按该文件的实际登记表改写 syncParamSlider，不并列引入第二套登记表。

两个阶段，别混为一谈：
  ① 补齐（第 ①…⑫ 步）——判据是「整文件存在性」：probe 字符串出现过就整块跳过。
     这一段只管「引擎有没有落地」，天生**只能补齐，不能更新**。
  ② 更新（update_blocks）——判据是「位置」：BLOCK_SPECS 给每个逐字复制块配一个
     锚点行 + 收尾规则，同一个定位器在 outputs 里切出旧文本、与 starter 的当前
     文本比对，不同就整块换掉。starter 改了措辞或实现，靠这一段传播过去。

  更新阶段的边界（写在这里，省得下一个人再踩）：
    * 只覆盖「逐字复制自 starter」的块。工具局部区（PARAMS / SCENES / draw /
      readout）永远不在此列 —— 那是各工具自己的代码，脚本无权改。
    * 锚点行必须稳定。改了锚点行 = 定位失败 = 当场 Miss 并整文件跳过，
      不做模糊匹配，也不会「猜」一个位置写进去。
    * relabel 块**不在** BLOCK_SPECS 里：paramWraps 版以 `    upd();` 开头，
      paramRefs 版把这行丢掉了，同一个锚点切不出两种形态。它仍只走补齐这一路，
      改动传播不过去 —— 真要改 relabel 块的文本，得先给它补一条能区分两种形态
      的定位规则。

第三件事（阶段 4 起）：帧级兜底的收口（harden）——见 FRAME_OLD_* 与 harden()。
  它覆盖**全部** outputs（含 EXCLUDE 里的 trig-essence-3d-new：那个文件没有
  SCENES、进不了移植阶段，但有同构的 frame() 与同样的「变砖」风险）。

  阶段 5 把判据从「frame() 是否与 starter 逐字节相同」改成「**兜底那一层是否
  合规**」，两者天差地别：
    * 合规 = 有引擎标准的 frameError()（按 curTab + 消息去重、console.warn）、
      声明块排在 resetSim() 之前、resetSim() 会清表。
    * frame() **循环体的形状不在判据里**。帧内定步长子步进（混沌 / 多体工具
      必须这样积分）、达到条件重新播种，都是正当写法，不该被报成偏离。
      见规范 §6「主循环体内」与 §8 第 7 条的结构断言。
  所以「跳过清单」里只会出现真正需要人看的东西：兜底缺失且形状认不出、或者
  有 try/catch 却用了认不出的错误容器。形状不同而兜底合规的工具**根本不进
  跳过清单**——它在 harden 里一步都不会被改动。

用法：
    python3 scripts/port_drive_engine.py            # 补齐 + 更新 + 加固
    python3 scripts/port_drive_engine.py --check    # 只检查，未落地/有漂移则 exit 1
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STARTER = os.path.join(ROOT, 'design-system', 'math-viz-starter.html')
OUTPUTS = os.path.join(ROOT, 'outputs')

# engine-version: pre-declarative，没有 SCENES，不在**移植**范围内。
# 注意它仍在 **frame() 加固** 范围内（harden 单独跑，见 main()）。
EXCLUDE = {'trig-essence-3d-new.html'}

# resetSim() 与 frame() 之间那一行标准声明。收口时该区间要归一成它。
LASTTS = 'let lastTs = performance.now(), lastRO = 0;'


# ---------------------------------------------------------------- starter 抽取

def _lines(path):
    with open(path, encoding='utf-8') as fh:
        return fh.read().split('\n')


def _one(lines, pred, what):
    hits = [i for i, l in enumerate(lines) if pred(l)]
    if len(hits) != 1:
        raise SystemExit('starter 抽取失败：%s 命中 %d 次' % (what, len(hits)))
    return hits[0]


def _slice_until_blank(lines, start):
    end = start
    while end < len(lines) and lines[end].strip() != '':
        end += 1
    return lines[start:end]


def _slice_until_prefix(lines, start, stop_prefix):
    end = start
    while end < len(lines) and not lines[end].startswith(stop_prefix):
        end += 1
    while end > start and lines[end - 1].strip() == '':
        end -= 1
    return lines[start:end]


def extract_starter():
    L = _lines(STARTER)
    g = {}

    # ① CSS：.drive / .dmode 规则
    i = _one(L, lambda l: l == '/* 驱动控制行 */', 'CSS 驱动控制行')
    g['css'] = _slice_until_blank(L, i)
    # 内容 assert 与 ui/tables/frame/reset 同理：_slice_until_blank 以空行收尾，
    # starter 若在 .drive 规则中间插一个空行，这里会静默截断并把半截 CSS 写进 50 个文件。
    assert (len(g['css']) == 4
            and g['css'][1].startswith('.drive{')
            and g['css'][2].startswith('.drive .dmode{')
            and g['css'][3].startswith('.drive .dmode .btn{')), g['css']

    # ② DOM 容器
    i = _one(L, lambda l: 'id="driveHost"' in l, '#driveHost 容器')
    g['dom'] = [L[i]]

    # ③ UI 字典的三条双语文案
    i = _one(L, lambda l: l.startswith('  autoPlay: {'), 'UI.autoPlay')
    g['ui'] = L[i:i + 3]
    assert g['ui'][1].startswith('  pingpong:') and g['ui'][2].startswith('  loop:'), g['ui']

    # ④ 四张按页签的表
    i = _one(L, lambda l: l.startswith('const autoPlay = {};'), 'autoPlay 表')
    g['tables'] = L[i:i + 4]
    assert g['tables'][3].startswith('const driveOffAt = {};'), g['tables']

    # ⑤ 引擎函数：driveClock → syncParamSlider，跳过 syncParamVisibility（工具里已有），
    #    再接 setAutoPlayFor → buildDrive
    i = _one(L, lambda l: l.startswith('/* 驱动时钟：引擎时钟减去'), 'driveClock 注释')
    part1 = _slice_until_prefix(L, i, '/* 按当前页签的 params 显隐滑块。')
    i = _one(L, lambda l: l.startswith('/* 开关自动播放的唯一入口'), 'setAutoPlayFor 注释')
    part2 = _slice_until_prefix(L, i, '/* ================= UI 生成')
    g['funcs'] = (['/* ================= 场景时间驱动（引擎区） ================= */']
                  + part1 + [''] + part2)

    # ⑥ frame() 里的驱动求值与滑块同步
    #    starter 的 frame() 已加固（函数体整体缩进两格），所以这里切出来的是
    #    **加固后**的 6 空格形态 frame_h；补齐阶段面对的是尚未加固的文件，
    #    需要 4 空格形态，故一并保存一份去掉两格缩进的 frame。
    i = _one(L, lambda l: l == '      applyDrive();', 'frame 内 applyDrive')
    g['frame_h'] = L[i:i + 3]
    assert 'syncParamSlider(dv.key)' in g['frame_h'][2], g['frame_h']
    assert all(l.startswith('      ') for l in g['frame_h']), g['frame_h']
    g['frame'] = [l[2:] for l in g['frame_h']]

    # ⑦ resetSim() 里对 driveOff / driveOffAt 的归零
    i = _one(L, lambda l: l.startswith('  /* 驱动时钟的偏移一并归零'), 'resetSim 归零注释')
    g['reset'] = L[i:i + 3]
    assert 'Object.keys(driveOff)' in g['reset'][2], g['reset']

    # ⑧ buildParams() 里「拖动被驱动滑块则关闭自动播放」的监听
    i = _one(L, lambda l: l.startswith('    /* 用户伸手拖被驱动的滑块'), 'buildParams 接管监听')
    end = i
    while L[end] != '    });':
        end += 1
    g['takeover'] = L[i:end + 1]

    # ⑨ buildParams() 的 render / upd 拆分（starter 的注释写明这是为 drive 而做的：
    #    被 drive 驱动的参数其 state 值比滑杆 step 精细得多，语言切换若调 upd()
    #    就会把它永久量化一次）
    i = _one(L, lambda l: l.startswith('    /* render 只回显滑杆当前刻度；'), 'render 拆分注释')
    end = i
    while L[end] != '    };':
        end += 1
    g['render'] = L[i:end + 1]

    # ⑩ 初始化 upd() + relabel 只调 render()
    i = _one(L, lambda l: l.startswith('    upd();'), 'buildParams 初始化 upd()')
    end = i
    while not L[end].startswith('    const relabel = () =>'):
        end += 1
    g['relabel'] = L[i:end + 1]

    # ⑪ 帧级异常兜底（阶段 4）：frameError 定义 + 加固后的 frame() 外壳。
    #    只切「新文本」——「旧文本」starter 里已经不存在了，见 FRAME_OLD_* 一节。
    #    阶段 5 起，这一块的**位置**也是规范的一部分：必须排在 resetSim() 之前，
    #    否则 resetSim() 引用 frameErrSeen 只靠启动序列的调用顺序躲开 TDZ。
    i = _one(L, lambda l: l.startswith('/* 帧级异常兜底'), 'frameError 注释')
    j = _one(L, lambda l: l == 'function frame(ts) {', 'frame 定义')
    r = _one(L, lambda l: l == 'function resetSim() {', 'resetSim 定义')
    assert i < r, 'starter 的 frameErrSeen 声明必须排在 resetSim() 之前'
    assert L[r - 1] == '' and L[r - 2] == '}', L[r - 2:r]
    # 前导空行 + 注释 + frameErrSeen + frameError() + 收尾空行。**两端的空行都要
    # 带上**：place_frameerr 摘块时把两端空行一并吃掉、插入前也把落点前的空行
    # 清干净，一进一出对称，脚本才是幂等的（不对称会让第二次运行少一个空行）。
    assert L[i - 1] == '', L[i - 2:i]
    g['frameerr'] = L[i - 1:r]
    assert 'const frameErrSeen = Object.create(null);' in g['frameerr'], g['frameerr']
    assert 'function frameError(err) {' in g['frameerr'], g['frameerr']
    assert g['frameerr'][0] == '' and g['frameerr'][-1] == '', g['frameerr'][:1] + g['frameerr'][-2:]
    assert g['frameerr'][-2] == '}', g['frameerr'][-3:]
    assert L[j - 1] == LASTTS, L[j - 2:j]
    k = _one(L, lambda l: l == '  } catch (err) {', 'frame 的 catch 行')
    e = k
    while L[e] != '}':
        e += 1
    g['frame_new'] = L[j:e + 1]         # 加固后的 frame() 全文，仅用于自检
    g['frame_tail'] = L[k:e + 1]        # } catch … } finally { … rAF … } }
    assert g['frame_new'][1] == '  try {', g['frame_new'][:3]
    assert g['frame_tail'][-2:] == ['  }', '}'], g['frame_tail'][-3:]
    assert g['frame_tail'][-3] == '    requestAnimationFrame(frame);', g['frame_tail'][-3]

    # ⑫ resetSim() 开头清空去重表的两行
    i = _one(L, lambda l: l == 'function resetSim() {', 'resetSim 定义')
    g['resetguard'] = L[i + 1:i + 3]
    assert g['resetguard'][0].startswith('  /* 清空帧级异常去重表'), g['resetguard']
    assert 'Object.keys(frameErrSeen)' in g['resetguard'][1], g['resetguard']

    # 自检：把内联的旧文本 A 走一遍机械包裹，必须逐字等于 starter 的现状。
    # starter 一旦改了 frame() 的措辞或实现，这里当场炸，不会把过期文本铺出去。
    got = _wrap_frame(FRAME_OLD_A, g)
    if got != g['frame_new']:
        raise SystemExit('frame() 加固自检失败：包裹 FRAME_OLD_A 的结果与 starter 不符\n'
                         + '\n'.join('  %-2s %s' % ('!' if a != b else ' ', a)
                                     for a, b in zip(got + [''] * 9, g['frame_new'] + [''] * 9)))
    return g


# ------------------------------------------------- cartesian-polar 的等价改写
# starter 的 render/upd 用 paramWraps 的自由变量 p；该文件用 paramRefs 的
# ref.cfg（configParam() 会整体换掉 ref.cfg），故逐行做等价映射。映射表里的
# 每个源行都必须在 starter 抽出的块里出现，否则报错——starter 改了就会当场炸，
# 不会悄悄漏改。
REF_RENDER = {
    '    const render = () => { val.textContent = p.fmt(parseFloat(input.value)); };':
        '    ref.render = () => { val.textContent = ref.cfg.fmt(parseFloat(input.value)); };',
    '    const upd = () => {':
        '    ref.upd = () => {',
    '      state[p.key] = p.map ? p.map(raw) : raw;':
        '      state[p.key] = ref.cfg.map ? ref.cfg.map(raw) : raw;',
    '      render();':
        '      ref.render();',
}
REF_RELABEL = {
    '    const relabel = () => { wrap.querySelector(\'label\').innerHTML = t(p.label); render(); };':
        '    ref.relabel = () => { ref.labelEl.innerHTML = t(ref.cfg.label); ref.render(); };',
}


def _remap(block, table, drop_prefix=None):
    seen = set()
    out = []
    for l in block:
        if drop_prefix and l.startswith(drop_prefix):
            continue
        if l in table:
            seen.add(l)
            out.append(table[l])
        else:
            out.append(l)
    missing = set(table) - seen
    if missing:
        raise SystemExit('cartesian-polar 等价改写失败，starter 里找不到这些行：%r' % sorted(missing))
    return out


# ---------------------------------------------------------------- 单文件移植

class Miss(Exception):
    pass


# --------------------------------------------------------- frame() 加固（阶段 4）
# 目的：frame() 里任何一段抛出，末尾那句 requestAnimationFrame(frame) 就到不了，
#      渲染循环永久断掉 —— 相机 / 页签 / 语言切换一起死，整个工具变砖。
#      加固 = 整帧包一层 try/catch，rAF 挪进 finally。
#
# 为什么旧文本必须内联：starter 里已经是**加固后**的样子，切不出「加固前」。
# outputs 里的 frame() 只有三种字面变体（sha1 前 10 位 / 个数）：
#   3596fa4be1  49  与 starter 加固前逐字节相同
#   97f4b2f9e5   1  cartesian-polar-coordinate-3d：state.running 块多了 kPhase / morphK
#   4a471a027f   1  trig-essence-3d-new：pre-declarative，无 applyDrive，windowSec 另算
# 三段都逐字列在下面，替换命中数必须恰为 1，绝不模糊匹配。
#
# 注意：A / B 两段里已经含有阶段 1/3 的驱动引擎行（applyDrive / syncParamSlider）。
# 若日后要给一个**尚未落地驱动引擎**的文件跑本脚本，先跑一遍补齐（那一阶段会把
# 驱动行插进 4 空格形态的 frame()），本轮加固就能命中；顺序在 port() 里已排好。

FRAME_OLD_HEAD = '''\
function frame(ts) {
  const dt = clamp((ts - lastTs) / 1000, 0, 0.05);
  lastTs = ts;

  if (tween) {
    const k = Math.min(1, (ts - tween.t0) / tween.dur);
    const e = ease(k);
    const f = tween.from, o = tween.to;
    cam.az = f.az + wrapPI(o.az - f.az) * e;
    cam.el = f.el + (o.el - f.el) * e;
    cam.dist = f.dist + (o.dist - f.dist) * e;
    cam.tx = f.tx + (o.tx - f.tx) * e;
    cam.ty = f.ty + (o.ty - f.ty) * e;
    cam.tz = f.tz + (o.tz - f.tz) * e;
    if (k >= 1) tween = null;
  }

'''

FRAME_OLD_FOOT = '''

  draw();
  if (ts - lastRO > 120) { lastRO = ts; updateReadout(); }
  requestAnimationFrame(frame);
}'''

FRAME_OLD_A = (FRAME_OLD_HEAD + '''\
  if (state.running) {
    state.t += dt;
    state.theta += state.omega * dt;
    applyDrive();
    const dv = SCENES[curTab].drive;
    if (dv && autoPlay[curTab]) syncParamSlider(dv.key);
    pushSample();
  }
  const windowSec = (SCENES[curTab].sampleWindow || (() => 10))();
  while (samples.length && samples[0].t < state.t - windowSec) samples.shift();\
''' + FRAME_OLD_FOOT).split('\n')

FRAME_OLD_B = (FRAME_OLD_HEAD + '''\
  if (state.running) {
    state.t += dt;
    state.theta += state.speed * 0.75 * dt;
    state.kPhase += state.speed * 0.55 * dt;
    state.morphK = 0.5 - 0.5 * Math.cos(state.kPhase);
    syncKSlider();
    applyDrive();
    const dv = SCENES[curTab].drive;
    if (dv && autoPlay[curTab]) syncParamSlider(dv.key);
    pushSample();
  }
  const windowSec = (SCENES[curTab].sampleWindow || (() => 10))();
  while (samples.length && samples[0].t < state.t - windowSec) samples.shift();\
''' + FRAME_OLD_FOOT).split('\n')

FRAME_OLD_C = (FRAME_OLD_HEAD + '''\
  if (state.running) {
    state.t += dt;
    state.theta += state.omega * dt;
    pushSample();
  }
  const windowSec = WAVE_LEN / state.waveSpeed + 0.5;
  while (samples.length && samples[0].t < state.t - windowSec) samples.shift();\
''' + FRAME_OLD_FOOT).split('\n')

FRAME_VARIANTS = [('A', FRAME_OLD_A), ('B', FRAME_OLD_B), ('C', FRAME_OLD_C)]

# 头注释 changelog 里新增的那一行（版本号按各文件实际递增值填）
CHANGELOG_NOTE = '2026-08-01  帧级异常兜底：单帧抛出不再杀死渲染循环'
UNIFY_NOTE = '2026-08-01  帧级异常兜底收口到引擎标准：按页签去重，不再全局只报一次'

# 自造的一次性错误容器。**判据是「有没有用非标准容器」，不是「frame() 是否与
# starter 逐字节相同」**——形状不同而兜底合规的工具（例如帧内定步长子步进的
# 混沌 / 多体工具）不该被报成偏离，见规范 §6「主循环体内」。
DEVIANT_PROBES = ('frameErrLogged', 'frameErr ', 'frameErr=')


def _wrap_frame(old, g):
    """把一段未加固的 frame() 机械地包进 try/catch/finally。

    机械 = 只做两件事：函数体整体缩进两格；把末尾那句 rAF 换成 starter 的
    catch/finally 尾巴。新代码一个字都不在这里内联，全部来自 starter。
    """
    assert old[0] == 'function frame(ts) {' and old[-1] == '}', old[:1] + old[-1:]
    assert old[-2] == '  requestAnimationFrame(frame);', old[-2]
    body = old[1:-2]
    return ([old[0], '  try {']
            + [('  ' + l if l.strip() else l) for l in body]
            + g['frame_tail'])


def _find_block(lines, old, what):
    """字面块的唯一位置；找不到返回 None，找到多处即 Miss。"""
    hits = [i for i in range(len(lines) - len(old) + 1)
            if lines[i:i + len(old)] == old]
    if len(hits) > 1:
        raise Miss('%s：待替换块命中 %d 次（期望 1）' % (what, len(hits)))
    return hits[0] if hits else None


def _frame_span(lines):
    """frame() 的 (定义行, 顶格收尾 } 行)。只认结构，不管循环体写了什么。"""
    j = _idx(lines, lambda l: l == 'function frame(ts) {', 'frame 定义')
    e = next((i for i in range(j + 1, len(lines)) if lines[i] == '}'), None)
    if e is None:
        raise Miss('frame() 找不到顶格收尾 }')
    return j, e


def place_frameerr(lines, g):
    """把 frameErrSeen / frameError() 的声明块放到 resetSim() **之前**，文本对齐 starter。

    位置是结构性的，不是风格：resetSim() 引用 frameErrSeen，声明留在它下方就只靠
    「启动序列恰好先求值到这里」躲开 TDZ。**零行为变化**——const 在任何调用之前
    就求值完毕，所以这一步不递增版本号。

    块已存在就整块摘走再按位插入（顺带把 starter 改过的措辞传播过去，与
    update_blocks 同一思路）；不存在（刚被 unify / 机械包裹处理过）就直接插入。
    """
    lines = list(lines)
    have = [i for i, l in enumerate(lines) if l == 'const frameErrSeen = Object.create(null);']
    if len(have) > 1:
        raise Miss('frameErrSeen 声明命中 %d 次（期望 1）' % len(have))
    if have:
        s = _idx(lines, lambda l: l.startswith('/* 帧级异常兜底'), 'frameError 注释')
        f = _idx(lines, lambda l: l == 'function frameError(err) {', 'frameError 定义')
        if not s < have[0] < f:
            raise Miss('声明块三行不按 注释→const→function 排列')
        e = next((i for i in range(f + 1, len(lines)) if lines[i] == '}'), None)
        if e is None:
            raise Miss('frameError() 找不到顶格收尾 }')
        # 连同两端紧邻的空行一起摘走。g['frameerr'] 自带两端空行，一进一出必须
        # 对称，否则第二次运行会比第一次少一个空行（脚本就不幂等了）。
        lo, hi = s, e + 1
        while hi < len(lines) and lines[hi] == '':
            hi += 1
        while lo > 0 and lines[lo - 1] == '':
            lo -= 1
        del lines[lo:hi]
    r = _idx(lines, lambda l: l == 'function resetSim() {', 'resetSim 定义')
    while r > 0 and lines[r - 1] == '':      # 落点前的空行也清干净，同上
        r -= 1
        del lines[r]
    lines[r:r] = g['frameerr']
    return lines


def _decl_run(lines):
    """resetSim() 收尾 } 与 frame() 定义之间那段声明区的 (起, 止)。"""
    r = _idx(lines, lambda l: l == 'function resetSim() {', 'resetSim 定义')
    j = _idx(lines, lambda l: l == 'function frame(ts) {', 'frame 定义')
    k = next((i for i in range(r + 1, j) if lines[i] == '}'), None)
    if k is None:
        raise Miss('resetSim() 找不到顶格收尾 }（或它排在 frame() 之后）')
    return k + 1, j


def unify(lines, g):
    """把手写的一次性错误容器收口到引擎标准。返回新行列表。

    **结构定位，不比对 frame() 循环体的形状** —— 体内写什么是工具自己的事
    （规范 §6「主循环体内」）。只动两处，循环体一个字不碰：
      ① resetSim() 与 frame() 之间的声明区，归一成单独一行 LASTTS；
      ② catch 到函数收尾，整段换成 starter 的标准尾巴（catch 里只调 frameError）。
    """
    lines = list(lines)

    # ① 声明区。只允许含空行 / 注释 / lastTs 声明 / 自造容器这四类，
    #    出现别的东西就当场 Miss —— 宁可跳过让人来看，不做「猜一个位置删掉」。
    s, e = _decl_run(lines)
    run, inc = lines[s:e], False
    for l in run:
        t = l.strip()
        if inc:
            inc = '*/' not in t
            continue
        if t == '' or t.startswith(LASTTS[:14]) or any(p in l for p in DEVIANT_PROBES):
            continue
        if t.startswith('/*'):
            inc = '*/' not in t
            continue
        raise Miss('声明区里有预料之外的一行，不敢动：%r' % t)
    if inc:
        raise Miss('声明区里的块注释没有收尾')
    lines[s:e] = ['', LASTTS]

    # ② catch → 函数收尾
    j, fe = _frame_span(lines)
    ci = [i for i in range(j + 1, fe) if lines[i] == '  } catch (err) {']
    if len(ci) != 1:
        raise Miss('frame() 内 } catch (err) { 命中 %d 次（期望 1）' % len(ci))
    lines[ci[0]:fe + 1] = g['frame_tail']
    return lines


def bump_patch(lines, note=CHANGELOG_NOTE):
    """meta 的 patch 位 +1，并在 changelog 顶端加一行。返回 (旧版本, 新版本)。

    **读该文件当前的值再加一**，不写死 1.1.0 → 1.1.1：仓库里版本号分散在
    1.0.1 / 1.1.0 / 1.1.1 / 1.2.0 / 1.3.0 五个值上，照字面套会写错 16 个文件。
    """
    # 只认 <meta> 声明本身：面板版本徽章那句 querySelector('meta[name="tool-version"]')
    # 也含同一串文字，不能一并命中
    mi = [i for i, l in enumerate(lines) if l.startswith('<meta name="tool-version"')]
    if len(mi) != 1:
        raise Miss('tool-version meta 命中 %d 次（期望 1）' % len(mi))
    m = re.search(r'content="(\d+)\.(\d+)\.(\d+)"', lines[mi[0]])
    if not m:
        raise Miss('tool-version meta 不是三段式 semver：%s' % lines[mi[0]].strip())
    old_v = '%s.%s.%s' % m.groups()
    new_v = '%s.%s.%d' % (m.group(1), m.group(2), int(m.group(3)) + 1)
    lines[mi[0]] = lines[mi[0]].replace('content="%s"' % old_v, 'content="%s"' % new_v)

    # changelog 标题两种写法（「版本记录（新→旧）：」/「版本记录（changelog，新→旧）：」）
    # 各文件保持原样，这里只认前后缀
    ci = [i for i, l in enumerate(lines)
          if l.startswith('  版本记录（') and l.endswith('新→旧）：')]
    if len(ci) != 1:
        raise Miss('changelog 标题命中 %d 次（期望 1）' % len(ci))
    lines[ci[0] + 1:ci[0] + 1] = ['    %s  %s' % (new_v, note)]
    return old_v, new_v


def harden(lines, g):
    """帧级兜底的收口。判据只看**兜底那一层**，与 frame() 循环体的形状无关。

    三步，各自独立：
      ① 兜底缺失 / 不合规 → 补齐或收口（真实行为变化，递增 patch 版本号）；
      ② 声明块归位到 resetSim() 之前（纯位置调整，零行为变化，不动版本号）；
      ③ resetSim() 清空去重表。
    """
    lines = list(lines)
    done = []

    def already(probe):
        return any(probe in l for l in lines)

    note = None
    if not already('function frameError(err) {'):
        if already('} finally {'):
            # 已经有 try/catch/finally，但用的是自造的错误容器（全局一次性布尔）。
            # 那种写法第一条错报完就永久关麦，第二个页签抛出的错会被完全吞掉。
            if not any(p in l for l in lines for p in DEVIANT_PROBES):
                raise Miss('frame() 有 try/catch 但既无 frameError() 也认不出错误容器，'
                           '需人工判断')
            lines = unify(lines, g)
            done.append('unify')
            note = UNIFY_NOTE
        else:
            # 完全没加固。机械包裹只对已知的三种 frame() 字面形态成立；
            # 形状不同的新工具应当直接从 starter 拷，脚本不猜。
            found = [(tag, old, _find_block(lines, old, 'frame() 变体 %s' % tag))
                     for tag, old in FRAME_VARIANTS]
            hit = [f for f in found if f[2] is not None]
            if len(hit) != 1:
                raise Miss('frame() 没有 try/catch，且不是已知的三种字面形态之一'
                           '（命中 %d 种）：请照 starter 手工加固' % len(hit))
            tag, old, at = hit[0]
            lines[at:at + len(old)] = _wrap_frame(old, g)
            done.append('frame~' + tag)
            note = CHANGELOG_NOTE

    # 声明块归位：位置是结构性的（TDZ），文本顺带对齐 starter。零行为变化。
    moved = place_frameerr(lines, g)
    if moved != lines:
        lines = moved
        if not note:
            done.append('frameerr~pos')

    if not already('清空帧级异常去重表'):
        at = _idx(lines, lambda l: l == 'function resetSim() {', 'resetSim 定义')
        lines[at + 1:at + 1] = g['resetguard']
        done.append('resetguard')

    # 版本号只在「本轮真的改了兜底行为」时递增：位置调整不算，重复运行也不会
    # 重复 +1，而从 starter 拷出来的新工具（生来就合规）不会被误伤。
    if note:
        old_v, new_v = bump_patch(lines, note)
        done.append('ver %s→%s' % (old_v, new_v))

    return lines, done


# ------------------------------------------------------------- 更新阶段的定位表
# 每项 = (块名, 锚点判据, 收尾规则)。收尾规则四选一：
#   ('blank', None)   直到第一个空行（不含）
#   ('lines', n)      锚点起算 n 行
#   ('incl',  pred)   直到第一条满足 pred 的行（含）
#   ('excl',  pred)   直到第一条满足 pred 的行（不含），并去掉尾部空行
# 锚点在整份文件里必须唯一命中一次，否则 Miss。
BLOCK_SPECS = [
    ('css', lambda l: l == '/* 驱动控制行 */',
     ('blank', None)),
    ('dom', lambda l: 'id="driveHost"' in l,
     ('lines', 1)),
    ('ui', lambda l: l.startswith('  autoPlay: {'),
     ('incl', lambda l: l.startswith('  loop:'))),
    ('tables', lambda l: l.startswith('const autoPlay = {};'),
     ('incl', lambda l: l.startswith('const driveOffAt = {};'))),
    # funcs 是脚本插进去的整段，头一行就是它自带的分节注释，结尾恰好抵住 switchTab
    ('funcs', lambda l: l == '/* ================= 场景时间驱动（引擎区） ================= */',
     ('excl', lambda l: l.startswith('function switchTab(id) {'))),
    # 加固后 frame() 的函数体缩进两格，锚点用 6 空格形态；文件若尚未加固则
    # 这一条当场 Miss 并跳过（本次运行的补齐阶段刚从 starter 插进去，本就是最新的）
    ('frame_h', lambda l: l == '      applyDrive();',
     ('incl', lambda l: 'syncParamSlider(dv.key)' in l)),
    ('reset', lambda l: l.startswith('  /* 驱动时钟的偏移一并归零'),
     ('incl', lambda l: 'Object.keys(driveOff)' in l)),
    ('takeover', lambda l: l.startswith('    /* 用户伸手拖被驱动的滑块'),
     ('incl', lambda l: l == '    });')),
    ('render', lambda l: l.startswith('    /* render 只回显滑杆当前刻度；'),
     ('incl', lambda l: l == '    };')),
]


def _span(lines, at, end, what):
    hits = [i for i, l in enumerate(lines) if at(l)]
    if len(hits) != 1:
        raise Miss('%s：锚点命中 %d 次（期望 1）' % (what, len(hits)))
    s = hits[0]
    kind, arg = end
    if kind == 'lines':
        return s, s + arg
    e = s
    if kind == 'blank':
        while e < len(lines) and lines[e].strip() != '':
            e += 1
        return s, e
    while e < len(lines) and not arg(lines[e]):
        e += 1
    if e >= len(lines):
        raise Miss('%s：找不到收尾行' % what)
    if kind == 'incl':
        return s, e + 1
    while e > s and lines[e - 1].strip() == '':
        e -= 1
    return s, e


def update_blocks(lines, g, reg, cfg):
    """把已落地的逐字复制块对齐到 starter 的当前文本。返回 (新行列表, 更新过的块名)。

    只在「块已存在」时才动手 —— 不存在是补齐阶段的事。
    """
    lines = list(lines)
    hit = []
    for name, at, end in BLOCK_SPECS:
        want = g[name]
        if name == 'funcs' and reg != 'paramWraps':
            want = [l.replace('const e = paramWraps[key];', 'const e = %s[key];' % reg)
                     .replace('e.p.', 'e.%s.' % cfg) for l in want]
        elif name == 'render' and reg != 'paramWraps':
            want = _remap(g['render'], REF_RENDER)
        try:
            s, e = _span(lines, at, end, '更新 %s' % name)
        except Miss:
            continue                      # 该块还没落地：交给补齐阶段
        if lines[s:e] != want:
            lines[s:e] = want
            hit.append(name + '~upd')
    return lines, hit


def _idx(lines, pred, what):
    hits = [i for i, l in enumerate(lines) if pred(l)]
    if len(hits) != 1:
        raise Miss('%s：锚点命中 %d 次（期望 1）' % (what, len(hits)))
    return hits[0]


def port(lines, g):
    """返回 (新行列表, 已应用的改动名列表)。锚点缺失抛 Miss。"""
    lines = list(lines)
    done = []

    def already(probe):
        return any(probe in l for l in lines)

    def insert_before(anchor_pred, what, payload):
        i = _idx(lines, anchor_pred, what)
        lines[i:i] = payload

    def insert_after(anchor_pred, what, payload):
        i = _idx(lines, anchor_pred, what)
        lines[i + 1:i + 1] = payload

    def replace_block(old, what, payload):
        """把唯一一段连续的字面量行替换成 payload。命中数 != 1 即 Miss。"""
        hits = [i for i in range(len(lines) - len(old) + 1)
                if lines[i:i + len(old)] == old]
        if len(hits) != 1:
            raise Miss('%s：待替换块命中 %d 次（期望 1）' % (what, len(hits)))
        lines[hits[0]:hits[0] + len(old)] = payload

    # 该文件用哪张滑块登记表
    if any(l.startswith('const paramWraps = {};') for l in lines):
        reg, cfg = 'paramWraps', 'p'
        reg_decl = lambda l: l.startswith('const paramWraps = {};')
        reg_line = lambda l: l == '    paramWraps[p.key] = { wrap, input, val, p };'
    elif any(l.startswith('const paramRefs = {};') for l in lines):
        reg, cfg = 'paramRefs', 'cfg'
        reg_decl = lambda l: l.startswith('const paramRefs = {};')
        reg_line = lambda l: l == '    paramRefs[p.key] = ref;'
    else:
        raise Miss('既没有 paramWraps 也没有 paramRefs 登记表')

    # ① CSS
    if not already('.drive .dmode .btn{'):
        insert_before(lambda l: l == '/* 读数与提示 */', 'CSS 读数与提示',
                      g['css'] + [''])
        done.append('css')

    # ② DOM 容器（放在播放/重置行之后、togglesHost 之前，与 starter 同序）
    if not already('id="driveHost"'):
        insert_before(lambda l: l == '    <div id="togglesHost"></div>',
                      'DOM togglesHost', g['dom'])
        done.append('dom')

    # ③ UI 三条双语文案
    if not already('  autoPlay: {'):
        insert_after(lambda l: l == "  views:  { zh: '视角', en: 'View' },",
                     'UI.views', g['ui'])
        done.append('ui')

    # ④ 四张按页签的表
    if not already('const driveOffAt = {};'):
        insert_after(reg_decl, '%s 声明' % reg, g['tables'])
        done.append('tables')

    # ⑤ 引擎函数
    if not already('function buildDrive() {'):
        funcs = g['funcs']
        if reg != 'paramWraps':
            funcs = [l.replace('const e = paramWraps[key];', 'const e = %s[key];' % reg)
                      .replace('e.p.', 'e.%s.' % cfg) for l in funcs]
        insert_before(lambda l: l == 'function switchTab(id) {', 'switchTab 定义',
                      funcs + [''])
        done.append('funcs')

    # ⑥ frame()：在 if (state.running) 块内的 pushSample() 之前求值并同步滑块
    if not already('syncParamSlider(dv.key)'):
        starts = [i for i, l in enumerate(lines) if l == '  if (state.running) {']
        cands = []
        for s in starts:
            e = s
            while e < len(lines) and lines[e] != '  }':
                e += 1
            body = lines[s:e]
            if '    pushSample();' in body:
                cands.append(s + body.index('    pushSample();'))
        if len(cands) != 1:
            raise Miss('frame() 内含 pushSample() 的 state.running 块命中 %d 次' % len(cands))
        lines[cands[0]:cands[0]] = g['frame']
        done.append('frame')

    # ⑦ switchTab()：驱动控制行随页签显隐
    old = "  document.querySelectorAll('.toggles[data-tab], .views[data-tab]').forEach(el => {"
    new = "  document.querySelectorAll('.toggles[data-tab], .views[data-tab], .drive[data-tab]').forEach(el => {"
    if not already('.drive[data-tab]'):
        i = _idx(lines, lambda l: l == old, 'switchTab 显隐选择器')
        lines[i] = new
        done.append('switchtab')

    # ⑧ resetSim()：驱动时钟偏移归零
    if not already('Object.keys(driveOff).forEach'):
        s = _idx(lines, lambda l: l == 'function resetSim() {', 'resetSim 定义')
        e = s
        while e < len(lines) and lines[e] != '}':
            e += 1
        body = lines[s:e]
        if body.count('  samples.length = 0;') != 1:
            raise Miss('resetSim() 内 samples.length = 0 命中 %d 次'
                       % body.count('  samples.length = 0;'))
        at = s + body.index('  samples.length = 0;')
        lines[at:at] = g['reset']
        done.append('reset')

    # ⑨ buildParams()：拖动被驱动的滑块即接管
    if not already('autoPlay[curTab]) setAutoPlay(false)'):
        insert_after(reg_line, '%s[p.key] 登记' % reg, g['takeover'])
        done.append('takeover')

    # ⑩ 启动序列
    if 'buildDrive();' not in lines:
        insert_after(lambda l: l == 'buildParams();', '启动序列 buildParams()',
                     ['buildDrive();'])
        done.append('startup')

    # ⑪ buildParams()：把 upd 拆成 render（只回显刻度）/ upd（写 state）
    #    这是驱动机制的一部分：不拆，语言切换就会把滑杆 step 刻度写回 state，
    #    把被 drive 驱动的参数永久量化一次（starter 的两段注释写明了理由）。
    if not already('render 只回显滑杆当前刻度'):
        if reg == 'paramWraps':
            old = ['    const upd = () => {',
                   '      const raw = parseFloat(input.value);',
                   '      state[p.key] = p.map ? p.map(raw) : raw;',
                   '      val.textContent = p.fmt(raw);',
                   '    };']
            new = g['render']
        else:
            old = ['    ref.upd = () => {',
                   '      const raw = parseFloat(input.value);',
                   '      state[p.key] = ref.cfg.map ? ref.cfg.map(raw) : raw;',
                   '      val.textContent = ref.cfg.fmt(raw);',
                   '    };']
            new = _remap(g['render'], REF_RENDER)
        replace_block(old, 'buildParams 的 upd 闭包', new)
        done.append('render')

    # ⑫ relabel 只调 render()；49 个文件原本靠 relabel() 里的 upd() 初始化 state，
    #    所以要把 starter 那句显式的 upd() 一并带上，初始化不能丢。
    if not already('语言切换只重排文案'):
        if reg == 'paramWraps':
            old = ["    const relabel = () => { wrap.querySelector('label').innerHTML = t(p.label); upd(); };"]
            new = g['relabel']
        else:
            # 该文件的 relabel 本来就不调 upd()（末尾另有 ref.upd() 初始化 state），
            # 没有「语言切换写回 state」的病；这里只补 render()，让 fmt 里的 t()
            # 能随语言重渲染，与 starter 语义对齐。故丢掉那句初始化 upd()。
            old = ["    ref.relabel = () => { ref.labelEl.innerHTML = t(ref.cfg.label); };"]
            new = _remap(g['relabel'], REF_RELABEL, drop_prefix='    upd();')
        replace_block(old, 'buildParams 的 relabel', new)
        done.append('relabel')

    # ⑬ 更新阶段：把已落地的逐字复制块对齐到 starter 的当前文本（见模块 docstring）
    lines, upd = update_blocks(lines, g, reg, cfg)
    done.extend(upd)

    # ⑭ frame() 加固：**必须排在最后**。加固会把函数体整体缩进两格，
    #    上面 ⑥ 的补齐锚点（'    pushSample();' 等）都是未加固的 4 空格形态。
    lines, hard = harden(lines, g)
    done.extend(hard)

    return lines, done


def main():
    check = '--check' in sys.argv
    g = extract_starter()

    files = sorted(f for f in os.listdir(OUTPUTS) if f.endswith('.html'))
    changed, skipped, untouched = [], [], []

    for name in files:
        path = os.path.join(OUTPUTS, name)
        with open(path, encoding='utf-8') as fh:
            src = fh.read()
        try:
            # EXCLUDE 里的文件进不了移植阶段（没有 SCENES / 滑块登记表），
            # 但 frame() 加固对它同样适用 —— 单独跑 harden。
            if name in EXCLUDE:
                new_lines, done = harden(src.split('\n'), g)
            else:
                new_lines, done = port(src.split('\n'), g)
        except Miss as err:
            skipped.append((name, str(err)))
            continue
        out = '\n'.join(new_lines)
        if out == src:
            untouched.append(name)
        elif check:
            changed.append((name, done))
        else:
            with open(path, 'w', encoding='utf-8') as fh:
                fh.write(out)
            changed.append((name, done))

    for name, done in changed:
        print('%-8s %-52s %s' % ('CHECK' if check else 'PORT', name, ','.join(done)))
    for name in untouched:
        print('%-8s %s' % ('OK', name))
    for name, err in skipped:
        print('SKIP     %-52s %s' % (name, err))

    print('\n合计 %d 个文件：改动 %d · 已就位 %d · 跳过 %d'
          % (len(files), len(changed), len(untouched), len(skipped)))
    if skipped:
        print('跳过清单：' + ', '.join(n for n, _ in skipped))
    if check and (changed or skipped):
        sys.exit(1)
    if skipped:
        sys.exit(1)


if __name__ == '__main__':
    main()
