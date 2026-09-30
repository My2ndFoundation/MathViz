#!/usr/bin/env python3
"""按配方解 python/ 注册表与导航页的合并冲突（python-content-wave 第 3、7 步用）。

配方（第 1 期 R1 起两期共十余次冲突都这样解，零次手工合并）：
  取一侧（--take）的 python-tools.json / app.html / index.html
  → 把另一侧（--from）有、这一侧没有的注册表条目按原顺序追加到 tools 末尾
  → 冲突的工具页取 --take 一侧，GENERATED:PROGRAMS 交给 build_programs.py 重写
  → build_programs.py、inline_core.py、sync_fallback.py、check.py 依次跑
  → 只 `git add` 显式路径（冲突文件 + 生成脚本报出改过的文件）；不提交，提交由你做。

两种用法（都在 `git merge` 停在冲突上之后、在那个 worktree 里跑）：
  集成构建者分支：  --take HEAD        --from MERGE_HEAD   （集成分支为准，补回构建者那一页）
  集成分支合 main： --take MERGE_HEAD  --from HEAD         （main 为准，本波各页追加在 main 已有条目之后）

冲突落在这四类文件之外（.py、chapter.json、refs、core……）时什么都不动、退出码 2——那不是配方能解的。
两侧都有、内容却不同的注册表条目（programs / lines 除外）只打印警告，保留 --take 一侧：要不要带上另一侧的改动由你定。

子进程一律带超时（本机 macOS 没有 `timeout` 命令）。
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

REGISTRY = 'python/python-tools.json'
NAV_PAGES = ('python/app.html', 'python/index.html')
GENERATORS = ('python/scripts/build_programs.py',
              'python/scripts/inline_core.py',
              'python/scripts/sync_fallback.py')
DERIVED = ('programs', 'lines')
HALF = ('但冲突文件已按 --take 一侧写回并进了索引（git checkout <提交> -- 会更新索引）；'
        '要从头来就 git merge --abort 再合一次')


def git(repo: Path, *args: str, check: bool = True) -> str:
    r = subprocess.run(['git', '-C', str(repo), *args], capture_output=True, text=True, timeout=120)
    if check and r.returncode != 0:
        sys.exit(f'ERROR: git {" ".join(args)} 失败（rc={r.returncode}）：\n{r.stderr}')
    return r.stdout


def run(repo: Path, script: str, *args: str, timeout: int) -> subprocess.CompletedProcess:
    try:
        return subprocess.run([sys.executable, script, *args], cwd=repo, capture_output=True,
                              text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        sys.exit(f'ERROR: {script} 超过 {timeout} 秒没有结束——当作红，停下查原因')


def strip_derived(entry: dict) -> dict:
    return {k: v for k, v in entry.items() if k not in DERIVED}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--repo', required=True, help='停在冲突上的那个 worktree 的绝对路径')
    ap.add_argument('--take', required=True, help='以哪一侧为准：HEAD 或 MERGE_HEAD（或任一提交）')
    ap.add_argument('--from', dest='src', required=True, help='从哪一侧补回缺的条目')
    ap.add_argument('--check-timeout', type=int, default=600, help='check.py 的超时秒数')
    a = ap.parse_args()
    repo = Path(a.repo).resolve()

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
    if other:
        print('ERROR: 下列冲突不在配方范围内，脚本什么都没动：', file=sys.stderr)
        for p in other:
            print(f'  - {p}', file=sys.stderr)
        return 2

    # 1. 取 --take 一侧的三个文件与冲突的工具页
    git(repo, 'checkout', take, '--', REGISTRY, *NAV_PAGES)
    for p in pages:
        git(repo, 'checkout', take, '--', p)
        print(f'WARN: {p} 取了 --take 一侧；它的 GENERATED 区段会重生成，'
              f'非生成部分若两侧都改过，要自己 diff 两侧核一遍', file=sys.stderr)

    # 2. 补回 --from 一侧多出来的条目
    reg_path = repo / REGISTRY
    reg = json.loads(reg_path.read_text(encoding='utf-8'))
    theirs = json.loads(git(repo, 'show', f'{src}:{REGISTRY}'))
    have = {t['id']: t for t in reg['tools']}
    appended = []
    for t in theirs['tools']:
        if t['id'] not in have:
            reg['tools'].append(t)
            appended.append(t['id'])
        elif strip_derived(t) != strip_derived(have[t['id']]):
            print(f'WARN: 条目 {t["id"]} 两侧内容不同，保留了 --take 一侧', file=sys.stderr)
    reg_path.write_text(json.dumps(reg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'追加条目：{", ".join(appended) if appended else "（无）"}')
    print('注册表顺序：' + ' '.join(f'{t["id"]}(M{t["module"]})' for t in reg['tools']))

    # 3. 三个生成脚本（--print-changed 会照常写文件，并把改过的路径一行一个打出来）
    changed: set[str] = set()
    for g in GENERATORS:
        r = run(repo, g, '--print-changed', timeout=300)
        if r.returncode != 0:
            print(r.stdout + r.stderr, file=sys.stderr)
            sys.exit(f'ERROR: {g} rc={r.returncode}——生成结果没有 git add；' + HALF)
        for line in r.stdout.splitlines():
            if line.strip():
                changed.add(str(Path(line.strip()).resolve().relative_to(repo)))

    # 4. check.py 必须全绿
    r = run(repo, 'python/scripts/check.py', timeout=a.check_timeout)
    tail = (r.stdout.strip().splitlines() or ['(无输出)'])[-1]
    print(f'check.py rc={r.returncode}：{tail}')
    if r.returncode != 0:
        print(r.stdout[-4000:] + r.stderr[-4000:], file=sys.stderr)
        sys.exit('ERROR: check.py 红——生成结果没有 git add；' + HALF)

    # 5. 只暂存显式路径
    to_add = sorted({REGISTRY, *NAV_PAGES, *pages, *changed})
    git(repo, 'add', '--', *to_add)
    print('已暂存：\n  ' + '\n  '.join(to_add))
    status = git(repo, 'status', '--short').splitlines()
    loose = [s for s in status if s[1:2] != ' ']
    print(f'索引里共 {len(status) - len(loose)} 条已暂存（含合并本身带进来的）；'
          '未暂存 / 未跟踪的（应为空，有就逐行看是不是别人的）：')
    print('\n'.join('  ' + s for s in loose) or '  （无）')
    print('下一步：git -C <worktree> commit --no-edit')
    return 0


if __name__ == '__main__':
    sys.exit(main())
