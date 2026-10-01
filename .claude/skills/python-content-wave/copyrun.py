#!/usr/bin/env python3
"""复制内容真跑（python-content-wave 第 4 步的标准件；由第 5 期 m7a 的 pygame 版 copyrun.py 推广到三层）。

复制按钮交出去的是 `Exercise.clean(源码)`；这里用**页面自己内联的** Exercise（从工具页的 GENERATED:EXERCISE 区段取，
node 裸 vm context——走浏览器分支，不走 node 分支，见根 CLAUDE.md），每章按固定种子抽 k 个程序：
  0. 复制内容不含 BLANK 指令；挖空模式每空填标准答案的复制内容（Exercise.merge）与读模式的逐字节相同。
  1. 真跑（按层）：
     · 有 run.expect 的（stdlib / scipy-stack 层）：像 program_run_check 一样在全新临时目录跑（_fixtures/ 整个 copytree、
       PYTHONHASHSEED=0、PYTHONIOENCODING=utf-8、MPLBACKEND=Agg、喂 run.stdin），stdout 逐字节等于 run.expect。
     · pygame 程序：live-frames.py 的跑帧（无头 SDL，第 N 帧 QUIT），main() 正常返回。
     · MicroPython 程序：没有可跑的——只做第 2 道。
  2. 带 check.property 的程序：从复制内容里导入 entry（MicroPython 装门的硬件桩、pygame 无头），
     拿门自己的参照、种子、组数、逐层比较（gates.library._deep_mismatch）比 200 组——跑帧看不见的错，这里看得见。
另外逐章报**空数**（全章每个程序，不只抽到的）：页面自己的 `Exercise.parse` 数出来的挖空个数——构建报告与 PR 描述里的空数照它写、不手数。
负控制（内建，每个程序都做）：第一个空填成 `pass` 的复制内容。第 1 道对它的判别力按层不同——
m7a 实测 pygame 跑帧只抓到 1/6（空多在只有事件或碰撞才走到的分支里），第 2 道抓到 5/6；所以两道的命中数分开报。

跑帧用 live-frames.py 的同一个 run()：不到 N 帧就返回判 SHORT，不算通过（第 5 期收尾评审 I3）。

用法（只读仓库；临时文件都在系统临时目录，正常结束与 node 取内容失败时都会删掉；被 SIGKILL 时可能留下一个 copyrun-exercise-*.js，无害）：
  python3 copyrun.py --repo <worktree 绝对路径> --chapters ch29-pygame-basics ch30-pygame-sprites [--seed 20260930] [--k 3]
退出码：0 = 所有复制内容都过（0、1、2 三项）且负控制至少被抓到一次；1 = 否则。
"""
from __future__ import annotations

import argparse
import copy
import importlib.util
import json
import os
import pathlib
import random
import runpy
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent

JS = (
    "const vm=require('vm'),fs=require('fs');const c={};vm.createContext(c);"
    "vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),c);"
    "if(typeof c.Exercise!=='object'){throw new Error('裸 vm 里没有 Exercise：区段没取对');}"
    "const src=fs.readFileSync(0,'utf8');const b=c.Exercise.parse(src).blanks;const mode=process.argv[2];"
    "if(mode==='count'){process.stdout.write(String(b.length));}"
    "else if(mode==='clean'){process.stdout.write(c.Exercise.clean(src));}"
    "else{const a={};b.forEach((x,i)=>{a[x.id]=(mode==='wrong'&&i===0)?x.indent+'pass':x.body;});"
    "process.stdout.write(c.Exercise.merge(src,a));}"
)


def load_live_frames():
    spec = importlib.util.spec_from_file_location('live_frames', HERE / 'live-frames.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def page_exercise(repo: pathlib.Path, tool: str, library) -> pathlib.Path:
    """把工具页内联的 Exercise 区段写进一个临时文件，交给 node 的裸 vm。"""
    page = (repo / 'python/tools' / f'{tool}.html').read_text(encoding='utf-8')
    body = library._region_body(page, 'EXERCISE')
    if not body:
        sys.exit(f'ERROR: {tool}.html 里找不到 GENERATED:EXERCISE 区段')
    fd, path = tempfile.mkstemp(prefix='copyrun-exercise-', suffix='.js')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        fh.write(body)
    return pathlib.Path(path)


def payload(js_file: pathlib.Path, src: str, mode: str) -> str:
    p = subprocess.run(['node', '-e', JS, str(js_file), mode], input=src, capture_output=True, text=True, timeout=60)
    if p.returncode != 0:
        # 抛异常而不是 sys.exit：调用方的 finally 要删掉临时的 Exercise 文件（第 5 期收尾评审 m5）
        raise RuntimeError(f'node 取复制内容失败（{mode}）：{p.stderr.strip()[:600]}')   # 原因在 stderr 开头，不在结尾
    return p.stdout


def run_stdout(code: str, chapter_dir: pathlib.Path, prog: dict):
    """照 program_run_check 的沙箱跑一段复制内容；返回 (rc, stdout) 或 ('TIMEOUT', '')。"""
    run = prog.get('run') or {}
    with tempfile.TemporaryDirectory() as td:
        if (chapter_dir / '_fixtures').is_dir():
            shutil.copytree(chapter_dir / '_fixtures', os.path.join(td, '_fixtures'))
        pathlib.Path(td, prog['file']).write_text(code, encoding='utf-8')
        env = dict(os.environ, PYTHONHASHSEED='0', PYTHONIOENCODING='utf-8', MPLBACKEND='Agg')
        try:
            r = subprocess.run([sys.executable, prog['file']], cwd=td, env=env, input=run.get('stdin', ''),
                               capture_output=True, text=True, timeout=run.get('timeout', 5) + 5)
        except subprocess.TimeoutExpired:
            return 'TIMEOUT', ''
    return r.returncode, r.stdout


def property_agree(code: str, prog: dict, library, properties) -> str | int:
    """复制内容里的 entry 对门的参照：返回一致的组数，或导入失败的异常名。"""
    micro = library._is_micropython(prog)
    if 'pygame' in prog.get('requires', []):
        library._headless_sdl()
    install = uninstall = None
    if micro:
        install, uninstall = library._micropython_stubs()
        install()
    try:
        with tempfile.TemporaryDirectory() as td:
            f = pathlib.Path(td, prog['file'])
            f.write_text(code, encoding='utf-8')
            try:
                fn = runpy.run_path(str(f), run_name='__copyrun__')[prog['entry']]
            except Exception as e:                                    # noqa: BLE001
                return f'导入失败 {type(e).__name__}'
            ref = properties.REFERENCES[prog['id']]
            rng = random.Random(properties.SEED)
            good = 0
            for _ in range(properties.SAMPLES):
                args = ref['cases'](rng)
                try:
                    got = library._call_with_timeout(fn, copy.deepcopy(args))
                except BaseException as e:                            # noqa: BLE001 —— 超时与抛错都算不一致
                    if isinstance(e, KeyboardInterrupt):
                        raise
                    got = object()
                good += library._deep_mismatch(got, ref['ref'](*copy.deepcopy(args))) is None
            return good
    finally:
        if uninstall:
            uninstall()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--repo', required=True, help='worktree 根的绝对路径')
    ap.add_argument('--chapters', nargs='+', required=True, help='章目录名，如 ch29-pygame-basics')
    ap.add_argument('--seed', type=int, default=20260930)
    ap.add_argument('--k', type=int, default=3, help='每章抽几个程序')
    ap.add_argument('--frames', type=int, default=30)
    a = ap.parse_args()
    repo = pathlib.Path(a.repo).resolve()
    sys.path.insert(0, str(repo / 'python/scripts'))
    from gates import library, properties                            # 门自己的比较、参照、种子、组数、硬件桩
    lf = load_live_frames()

    fails, rows = 0, []
    blank_counts: dict[str, tuple[int, int]] = {}                   # 章 → (空数, 程序数)
    neg = {'run': [0, 0], 'frames': [0, 0], 'property': [0, 0]}      # [抓到, 做了]
    for ch in a.chapters:
        d = repo / 'python/programs' / ch
        data = json.loads((d / 'chapter.json').read_text(encoding='utf-8'))
        js_file = page_exercise(repo, data['tool'], library)
        try:
            progs = {p['id']: p for p in data['programs']}
            # 空数：本章**全部**程序（不只抽到的 k 个），用页面自己的 Exercise.parse 数——构建报告里手数的空数对它核
            # （第 6 期 m8b 构建者报 25，页面实为 26，控制方靠浏览器探针才对出来；复盘 11）。
            blank_counts[ch] = (sum(int(payload(js_file, (d / p['file']).read_text(encoding='utf-8'), 'count'))
                                    for p in data['programs']), len(progs))
            for pid in random.Random(a.seed).sample(sorted(progs), min(a.k, len(progs))):
                prog = progs[pid]
                src = (d / prog['file']).read_text(encoding='utf-8')
                clean, merged, wrong = (payload(js_file, src, m) for m in ('clean', 'merged', 'wrong'))
                notes = []
                ok = '# >>> BLANK' not in clean and '# <<< BLANK' not in clean and clean == merged
                notes.append('读==挖空' if clean == merged else '读≠挖空')
                if 'run' in prog and 'expect' in (prog.get('run') or {}):
                    rc, out = run_stdout(clean, d, prog)
                    same = rc == 0 and out == prog['run']['expect']
                    ok &= same
                    notes.append('stdout==expect' if same else f'stdout≠expect rc={rc}')
                    rcw, outw = run_stdout(wrong, d, prog)
                    neg['run'][1] += 1
                    neg['run'][0] += not (rcw == 0 and outw == prog['run']['expect'])
                elif 'pygame' in prog.get('requires', []):
                    with tempfile.TemporaryDirectory() as td:
                        pathlib.Path(td, 'copy.py').write_text(clean, encoding='utf-8')
                        pathlib.Path(td, 'wrong.py').write_text(wrong, encoding='utf-8')
                        st, info = lf.run(pathlib.Path(td, 'copy.py'), a.frames)
                        stw, _ = lf.run(pathlib.Path(td, 'wrong.py'), a.frames)
                    ok &= st == 'OK'
                    notes.append(f'跑帧 {st}')
                    neg['frames'][1] += 1
                    neg['frames'][0] += stw != 'OK'
                else:
                    notes.append('无可跑（只做 property）')
                if (prog.get('check') or {}).get('property'):
                    g = property_agree(clean, prog, library, properties)
                    gw = property_agree(wrong, prog, library, properties)
                    ok &= g == properties.SAMPLES
                    notes.append(f'P {g}/{properties.SAMPLES}（首空填 pass：{gw}）')
                    neg['property'][1] += 1
                    neg['property'][0] += gw != properties.SAMPLES
                fails += not ok
                rows.append(f'{"ok " if ok else "BAD"} {ch}/{pid}  ' + ' · '.join(notes))
        finally:
            js_file.unlink(missing_ok=True)
    print('\n'.join(rows))
    for ch, (nb, np_) in blank_counts.items():
        print(f'空数：{ch} {nb} 个空（全章 {np_} 个程序，页面自己的 Exercise.parse 数）')
    if len(blank_counts) > 1:
        print(f'空数合计：{sum(v[0] for v in blank_counts.values())}')
    caught = sum(v[0] for v in neg.values())
    print('负控制（首空填 pass 的复制内容被抓到 / 做了）：' +
          '，'.join(f'{k} {v[0]}/{v[1]}' for k, v in neg.items() if v[1]))
    for k, (got, done) in neg.items():                               # 按层报：合计抓到 ≥ 1 会掩盖某一层 0 / n（第 5 期收尾评审 m4）
        if done and got == 0:
            print(f'WARN: {k} 这一层的负控制 0/{done}——这一层对错答案没有判别力，它的「通过」不说明什么')
    if caught == 0:
        print('负控制一个都没抓到——这次测量没有判别力，别据此下结论')
    print(f'{len(rows) - fails}/{len(rows)} 个程序的复制内容全部通过' if not fails else f'{fails}/{len(rows)} 个程序不通过')
    return 1 if fails or caught == 0 else 0


if __name__ == '__main__':
    sys.exit(main())
