#!/usr/bin/env python3
"""按配方解 python/ 注册表与导航页的合并冲突（python-content-wave 第 3、6、7 步用）。

配方（第 1 期 R1 起两期共十余次冲突都这样解，零次手工合并）：
  取一侧（--take）的 python-tools.json / app.html / index.html
  → 把另一侧（--from）有、这一侧没有的注册表条目按原顺序追加到 tools 末尾
  → 冲突的工具页取 --take 一侧，GENERATED:PROGRAMS 交给 build_programs.py 重写
  → build_programs.py、inline_core.py、sync_fallback.py、check.py 依次跑
  → 只 `git add` 显式路径（冲突文件 + 生成脚本报出改过的文件）；不提交，提交由你做。

两种用法（都在 `git merge --no-commit --no-ff <另一侧>` 停下之后、在那个 worktree 里跑——有没有文本冲突都停，MERGE_HEAD 在）：
  集成构建者分支：  --take HEAD        --from MERGE_HEAD   （集成分支为准，补回构建者那一页）
  集成分支合 main： --take MERGE_HEAD  --from HEAD         （main 为准，本波各页追加在 main 已有条目之后）
为什么一律 --no-commit：没有文本冲突的合并 git 会自动提交，而它照样可能是红的——第 5 期回放实测，m7a 合 basics 构建者分支
（a853573 + 92d4ecf）与 m7b 合 #198（437ac7d + 6e6f1d7）都是文本干净、engine 不一致（退出码 4 那一类）。
提交要接在它后面用 `&&`：它红了之后冲突在索引里已标为解决，不接 `&&` 的 `git commit` 会照样成功。

退出码：
  0  全绿，已按显式路径暂存。
  1  生成脚本或 check.py 红、或超时：生成结果没有 `git add`，但冲突文件已按 --take 一侧写回并进了索引——
     此时直接 `git merge --abort` 会失败（索引 ≠ HEAD，工作区又被生成脚本改过）。脚本会打印一条实测可用的恢复命令，照它做。
  2  冲突落在这四类文件之外（.py、chapter.json、refs、core……）：什么都没动。那不是配方能解的。
  3  同一个注册表条目在 --from 一侧相对合并基改过、又与 --take 一侧不同（programs / lines 除外）：什么都没动。
     配方「取 --take 一侧」会静默丢掉 --from 一侧对这条的改动（若 --take 一侧也改过，两边都有改动要保），
     所以配方不适用。判定只读合并基、不做三方合并：只有 --take 一侧改过的条目照常取 --take 一侧，不算冲突。
     **撞上一处，脚本就整体拒绝、什么都不动**——这一次合并的注册表、两个导航页与生成区段要全部手工做
     （照配方的各步：取一侧、合入这几条的改动、追加本页条目、跑三个生成脚本与 check.py、显式 add），
     并在台账里写明理由。这是 skill 红旗「注册表冲突不手工改」的唯一例外，只在升级波（本波有意改已有条目）出现。
  4  要追加的条目的 engine 与 --take 一侧不同（有一侧改过 core/、升了 engine，另一侧的新页还是旧 engine），
     而没给 --engine-from take：什么都没动。page_mirror_check 要求全库 engine 唯一，照旧追加只会让 check.py 红（rc=1）。
     加 `--engine-from take`：追加的条目的 engine 改成 --take 一侧的（它必须全库唯一），对应工具页的
     `<meta name="tool-engine">` 同步改，页面的 core 区段由 inline_core.py 重写。不升这些页的 version——
     engine 升而页面行为不变时不升 tool-version（第 5 期 #198 的裁决）；新页本来就是 1.0.0。
     第 5 期撞上两次：m7a 两个构建者基于 py-1.1.x、集成分支合 #198 后已是 py-1.2.0（当时手工做）；
     m7b 合 #198 时文本**没有冲突**、git 自动提交了一个门红的合并。后一种要先让合并停下来：
     `git merge --no-commit --no-ff origin/main`（没有冲突也会停，MERGE_HEAD 在），再跑本脚本。

子进程一律带超时，并各自开一个进程组（start_new_session），超时或本脚本被打断（Ctrl-C / SIGTERM）时就 os.killpg 整组——
（自己的进程组意味着外面按进程组发的信号到不了它；所以打断时要由本脚本来杀。SIGKILL 接不住：--check-timeout 要短于调用方的超时。）

subprocess.run(timeout=…) 只杀直接子进程，check.py 起的 node / python 孙进程会留下（本机 macOS 也没有 `timeout` 命令）。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import signal
import subprocess
import sys
from pathlib import Path

REGISTRY = 'python/python-tools.json'
NAV_PAGES = ('python/app.html', 'python/index.html')
GENERATORS = ('python/scripts/build_programs.py',
              'python/scripts/inline_core.py',
              'python/scripts/sync_fallback.py')
DERIVED = ('programs', 'lines')
META_ENGINE_RE = re.compile(r'(<meta\s+name="tool-engine"\s+content=")([^"]+)(")')   # 与 gates/registry.py 的同一条


def run_grouped(cmd: list[str], cwd: Path, timeout: int) -> subprocess.CompletedProcess:
    """跑子进程；超时就杀掉它的整个进程组再抛 TimeoutExpired。"""
    p = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                         text=True, start_new_session=True)
    try:
        out, err = p.communicate(timeout=timeout)
    except BaseException:
        # 不只超时：本脚本被 Ctrl-C / SIGTERM（main() 里转成 KeyboardInterrupt）打断时也杀整组。
        # 子进程在自己的进程组里，外面按进程组发的信号到不了它——不在这里杀，它就成了孤儿。
        # SIGKILL 谁也接不住：所以 --check-timeout 要小于调用方（例如 Bash 工具）的超时，让这里先超时。
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        p.communicate()
        raise
    return subprocess.CompletedProcess(cmd, p.returncode, out, err)


def git(repo: Path, *args: str, check: bool = True) -> str:
    try:
        r = run_grouped(['git', '-C', str(repo), *args], cwd=repo, timeout=120)
    except subprocess.TimeoutExpired:
        sys.exit(f'ERROR: git {" ".join(args)} 超过 120 秒没有结束')
    if check and r.returncode != 0:
        sys.exit(f'ERROR: git {" ".join(args)} 失败（rc={r.returncode}）：\n{r.stderr}')
    return r.stdout


def recovery(repo: Path, pages: list[str]) -> str:
    """rc=1 时的恢复命令：先让这几类文件回到 HEAD、生成脚本改过的其余文件回到索引，再 merge --abort。"""
    head_side = [REGISTRY, *NAV_PAGES, *pages]
    dirty = git(repo, 'diff', '--name-only', check=False).splitlines()   # 工作区 ≠ 索引
    extra = [p for p in dirty if p.strip() and p not in head_side]
    r = shlex.quote(str(repo))
    cmd = f'git -C {r} checkout HEAD -- ' + ' '.join(shlex.quote(p) for p in head_side)
    if extra:
        cmd += f' && git -C {r} checkout -- ' + ' '.join(shlex.quote(p) for p in extra)
    cmd += f' && git -C {r} merge --abort'
    return ('生成结果没有 git add，但冲突文件已按 --take 一侧写回并进了索引，'
            '此刻直接 git merge --abort 会失败。要从头来，照这条做（做完合并状态清除、工作区回到 HEAD）：\n  ' + cmd)


def run(repo: Path, script: str, *args: str, timeout: int, pages: list[str]) -> subprocess.CompletedProcess:
    try:
        return run_grouped([sys.executable, script, *args], cwd=repo, timeout=timeout)
    except subprocess.TimeoutExpired:
        sys.exit(f'ERROR: {script} 超过 {timeout} 秒没有结束（整个进程组已杀掉）——当作红，停下查原因。\n'
                 + recovery(repo, pages))


def strip_derived(entry: dict) -> dict:
    return {k: v for k, v in entry.items() if k not in DERIVED}


def load_registry(repo: Path, rev: str) -> dict[str, dict]:
    return {t['id']: t for t in json.loads(git(repo, 'show', f'{rev}:{REGISTRY}'))['tools']}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--repo', required=True, help='停在冲突上的那个 worktree 的绝对路径')
    ap.add_argument('--take', required=True, help='以哪一侧为准：HEAD 或 MERGE_HEAD（或任一提交）')
    ap.add_argument('--from', dest='src', required=True, help='从哪一侧补回缺的条目')
    ap.add_argument('--check-timeout', type=int, default=600, help='check.py 的超时秒数')
    ap.add_argument('--engine-from', choices=['take'], default=None,
                    help='追加的条目与它们的工具页改用 --take 一侧的 engine（见退出码 4）')
    a = ap.parse_args()

    def _on_term(_signum, _frame):
        raise KeyboardInterrupt('SIGTERM')
    signal.signal(signal.SIGTERM, _on_term)   # 让 run_grouped 的 except 分支在被 TERM 时也能杀掉子进程组

    repo = Path(a.repo).resolve()
    abort = f'git -C {shlex.quote(str(repo))} merge --abort'

    if not (repo / '.git').exists():
        sys.exit(f'ERROR: {repo} 不是一个 git worktree 的根')
    if git(repo, 'rev-parse', '-q', '--verify', 'MERGE_HEAD', check=False).strip() == '':
        sys.exit('ERROR: 没有进行中的合并（找不到 MERGE_HEAD）——先 git merge，停在冲突上再跑')
    take = git(repo, 'rev-parse', '--verify', a.take + '^{commit}').strip()
    src = git(repo, 'rev-parse', '--verify', a.src + '^{commit}').strip()

    unmerged = sorted(set(git(repo, 'diff', '--name-only', '--diff-filter=U').split()))
    known = {REGISTRY, *NAV_PAGES}
    pages = [p for p in unmerged if p.startswith('python/tools/') and p.endswith('.html')]
    other = [p for p in unmerged if p not in known and p not in pages]
    # 合并之前就有的、与本次合并无关的未提交改动：rc=1 的恢复命令会用 checkout -- 抹掉它们，
    # 所以一开始就拒绝，什么都不动。
    stray = [p for p in git(repo, 'diff', '--name-only', check=False).split()
             if p not in unmerged]
    if stray:
        print('ERROR: 工作区里有与这次合并无关的未提交改动，脚本什么都没动（它的恢复命令会抹掉它们）：',
              file=sys.stderr)
        for p in stray:
            print(f'  - {p}', file=sys.stderr)
        print('先提交或另存这些改动，再重跑。', file=sys.stderr)
        return 2
    if other:
        print('ERROR: 下列冲突不在配方范围内，脚本什么都没动：', file=sys.stderr)
        for p in other:
            print(f'  - {p}', file=sys.stderr)
        print(f'要放弃这次合并：{abort}', file=sys.stderr)
        return 2

    # 0. 两侧都有、--from 一侧又改过的条目：配方不适用（先判，什么都不动）
    theirs = load_registry(repo, src)
    ours = load_registry(repo, take)
    base_sha = git(repo, 'merge-base', take, src, check=False).strip()
    base = load_registry(repo, base_sha) if base_sha else {}
    clash = []
    for tid, t in theirs.items():
        if tid not in ours or strip_derived(t) == strip_derived(ours[tid]):
            continue
        if tid in base and strip_derived(t) == strip_derived(base[tid]):
            continue                      # 只有 --take 一侧改过：取 --take 一侧就对
        fields = sorted(k for k in set(t) | set(ours[tid])
                        if k not in DERIVED and t.get(k) != ours[tid].get(k))
        clash.append((tid, fields))
    if clash:
        print('ERROR: 下列注册表条目在 --from 一侧相对合并基改过、又与 --take 一侧不同——取 --take 一侧会丢掉 '
              '--from 一侧的改动，配方不适用，脚本什么都没动：', file=sys.stderr)
        for tid, fields in clash:
            print(f'  - {tid}（不同的字段：{", ".join(fields)}）', file=sys.stderr)
        print('升级波（本波有意改已有条目）才会撞上这一类：这一次合并整个手工做（照配方各步，并合入这几条的改动），'
              f'在台账写明理由。要放弃这次合并：{abort}', file=sys.stderr)
        return 3

    # 0b. engine：要追加的条目与 --take 一侧不一致时，不给 --engine-from 就什么都不动（先判）
    take_engines = sorted({t.get('engine') for t in ours.values()})
    to_append = [t for tid, t in theirs.items() if tid not in ours]
    odd = [(t['id'], t.get('engine')) for t in to_append if t.get('engine') not in take_engines or len(take_engines) != 1]
    if odd and a.engine_from != 'take':
        print(f'ERROR: 要追加的条目的 engine 与 --take 一侧（{", ".join(map(str, take_engines))}）不同，脚本什么都没动：',
              file=sys.stderr)
        for tid, eng in odd:
            print(f'  - {tid}：{eng}', file=sys.stderr)
        print('照旧追加只会让 page_mirror_check 红。确认是「一侧升过 core、另一侧的新页还是旧 engine」之后，'
              f'加 --engine-from take 重跑。要放弃这次合并：{abort}', file=sys.stderr)
        return 4
    if a.engine_from == 'take' and len(take_engines) != 1:
        print(f'ERROR: --take 一侧自己的 engine 就不唯一（{take_engines}），没有可取的值；什么都没动', file=sys.stderr)
        return 4

    # 1. 取 --take 一侧的三个文件与冲突的工具页
    git(repo, 'checkout', take, '--', REGISTRY, *NAV_PAGES)
    for p in pages:
        git(repo, 'checkout', take, '--', p)
        print(f'WARN: {p} 取了 --take 一侧；它的 GENERATED 区段会重生成，'
              f'非生成部分若两侧都改过，要自己 diff 两侧核一遍', file=sys.stderr)

    # 2. 补回 --from 一侧多出来的条目
    reg_path = repo / REGISTRY
    reg = json.loads(reg_path.read_text(encoding='utf-8'))
    appended = []
    engine_pages = []
    for tid, t in theirs.items():
        if tid not in ours:
            if a.engine_from == 'take' and t.get('engine') != take_engines[0]:
                t = dict(t, engine=take_engines[0])                 # 字段顺序不变，只换值
                page_rel = 'python/' + t['file']
                page_path = repo / page_rel
                text = page_path.read_text(encoding='utf-8')
                new, n = META_ENGINE_RE.subn(lambda m: m.group(1) + take_engines[0] + m.group(3), text)
                if n != 1:
                    sys.exit(f'ERROR: {page_rel} 里 <meta name="tool-engine"> 有 {n} 个（应恰好 1 个）。'
                             + recovery(repo, pages))
                page_path.write_text(new, encoding='utf-8')
                engine_pages.append(page_rel)
            reg['tools'].append(t)
            appended.append(tid)
    reg_path.write_text(json.dumps(reg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'追加条目：{", ".join(appended) if appended else "（无）"}')
    if engine_pages:
        print(f'engine 改成 {take_engines[0]}（--engine-from take）：{", ".join(engine_pages)}（注册表条目与 tool-engine meta）')
    print('注册表顺序：' + ' '.join(f'{t["id"]}(M{t["module"]})' for t in reg['tools']))

    # 3. 三个生成脚本（--print-changed 会照常写文件，并把改过的路径一行一个打出来）
    changed: set[str] = set()
    for g in GENERATORS:
        r = run(repo, g, '--print-changed', timeout=300, pages=pages)
        if r.returncode != 0:
            print(r.stdout + r.stderr, file=sys.stderr)
            sys.exit(f'ERROR: {g} rc={r.returncode}。' + recovery(repo, pages))
        for line in r.stdout.splitlines():
            if line.strip():
                changed.add(str(Path(line.strip()).resolve().relative_to(repo)))

    # 4. check.py 必须全绿（红时汇总行在 stderr，绿时在 stdout）
    r = run(repo, 'python/scripts/check.py', timeout=a.check_timeout, pages=pages)
    stream = r.stderr if r.returncode != 0 else r.stdout
    tail = ([s for s in stream.splitlines() if s.strip()] or ['(无输出)'])[-1]
    print(f'check.py rc={r.returncode}：{tail}')
    if r.returncode != 0:
        print(r.stdout[-4000:] + r.stderr[-4000:], file=sys.stderr)
        sys.exit('ERROR: check.py 红。' + recovery(repo, pages))

    # 5. 只暂存显式路径
    to_add = sorted({REGISTRY, *NAV_PAGES, *pages, *engine_pages, *changed})
    git(repo, 'add', '--', *to_add)
    print('已暂存：\n  ' + '\n  '.join(to_add))
    status = git(repo, 'status', '--short').splitlines()
    loose = [s for s in status if s[1:2] != ' ']
    print(f'索引里共 {len(status) - len(loose)} 条已暂存（含合并本身带进来的）；'
          '未暂存 / 未跟踪的（应为空，有就逐行看是不是别人的）：')
    print('\n'.join('  ' + s for s in loose) or '  （无）')
    print(f'下一步：git -C {shlex.quote(str(repo))} commit --no-edit')
    return 0


if __name__ == '__main__':
    sys.exit(main())
