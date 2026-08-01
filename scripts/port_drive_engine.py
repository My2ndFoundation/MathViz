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

用法：
    python3 scripts/port_drive_engine.py            # 补齐 + 更新
    python3 scripts/port_drive_engine.py --check    # 只检查，未落地/有漂移则 exit 1
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STARTER = os.path.join(ROOT, 'design-system', 'math-viz-starter.html')
OUTPUTS = os.path.join(ROOT, 'outputs')

# engine-version: pre-declarative，没有 SCENES，不在本次移植范围内
EXCLUDE = {'trig-essence-3d-new.html'}


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
    i = _one(L, lambda l: l == '    applyDrive();', 'frame 内 applyDrive')
    g['frame'] = L[i:i + 3]
    assert 'syncParamSlider(dv.key)' in g['frame'][2], g['frame']

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
    ('frame', lambda l: l == '    applyDrive();',
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

    return lines, done


def main():
    check = '--check' in sys.argv
    g = extract_starter()

    files = sorted(f for f in os.listdir(OUTPUTS)
                   if f.endswith('.html') and f not in EXCLUDE)
    changed, skipped, untouched = [], [], []

    for name in files:
        path = os.path.join(OUTPUTS, name)
        with open(path, encoding='utf-8') as fh:
            src = fh.read()
        try:
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
