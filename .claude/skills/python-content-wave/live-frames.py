#!/usr/bin/env python3
"""pygame 程序的活体跑帧（python-content-wave 第 4 步的标准件；第 5 期 m7a 的 live-frames.py 与 m7b 的 run-frames.py 合成）。

门对 pygame 程序只过 compile()（没有 run.expect），property 只验纯逻辑函数——main() 的主循环在任何门里都没有跑过。
这里在无头 SDL 下导入程序（run_name 不是 __main__，守卫不触发），把 pygame.event.get 打桩成第 N 次调用时
追加一个 QUIT，再调 main()：跑满 N 帧后正常返回 = OK；**不到 N 帧就正常返回 = SHORT**（主循环提前退出：`running` 条件写反、
`return` 放进了循环……）；超时 = HANG；抛错 / 非零退出 = ERROR。每个程序一个子进程（进程组 + 超时）。
（第 5 期收尾评审 I3：初版只看「rc 0 且末行以 FRAMES 开头」，一个第一帧就退出的程序报 `OK FRAMES 1`、还印「跑满 30 帧」——
测量报了一句它没有核过的话。现在比 FRAMES 与 N。）

用法：
  python3 live-frames.py --repo <worktree 绝对路径> --chapters ch29-pygame-basics ch30-pygame-sprites [--frames 30]
  python3 live-frames.py <.py 路径> …                 # 直接给文件（相对路径也行，下面会先 resolve）
  python3 live-frames.py --self-test                  # 四道对照：正常 OK、第一帧就退出 SHORT、不看 QUIT 的主循环 HANG、第一帧抛错 ERROR
每次在新的一批程序上用之前先跑一次 --self-test：它证明这个测量分得清四种结局（m7a 的三道对照 + 收尾评审加的 exits-early）。

子进程的 cwd 是一个临时目录（程序写文件——image-save-and-load 写 ship.png——落在那里，跑完即删），
所以**路径在交给子进程之前一律 resolve 成绝对路径**。m7a 初版没有这一步，传相对路径时子进程找不到文件，
报成 ERROR（m7a 修复者发现）；这里结构上免掉，不再靠「记得传绝对路径」。

只读仓库；退出码：0 = 全部 OK（且 --self-test 四道对照都如期）；1 = 有程序不是 OK（SHORT / HANG / ERROR），或对照不如期。
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import signal
import subprocess
import sys
import tempfile

CHILD = r'''
import os, sys, runpy
os.environ["SDL_VIDEODRIVER"] = "dummy"; os.environ["SDL_AUDIODRIVER"] = "dummy"; os.environ["PYGAME_HIDE_SUPPORT_PROMPT"] = "1"
import pygame
N = int(sys.argv[2]); calls = {"n": 0}
real_get = pygame.event.get
def fake_get(*a, **k):
    calls["n"] += 1
    evs = list(real_get(*a, **k))
    if calls["n"] >= N:
        evs.append(pygame.event.Event(pygame.QUIT))
    return evs
pygame.event.get = fake_get
ns = runpy.run_path(sys.argv[1], run_name="__live__")
try:
    ns["main"]()
except SystemExit:
    pass
print("FRAMES", calls["n"])
'''


def run(path, frames: int = 30, timeout: float = 30.0):
    """跑一个程序的 main()；返回 (结局, 说明)。path 先 resolve：子进程的 cwd 是临时目录。"""
    path = pathlib.Path(path).resolve()
    if not path.is_file():
        return 'ERROR', f'找不到文件 {path}'
    env = dict(os.environ, SDL_VIDEODRIVER='dummy', SDL_AUDIODRIVER='dummy', PYGAME_HIDE_SUPPORT_PROMPT='1')
    with tempfile.TemporaryDirectory() as td:
        p = subprocess.Popen([sys.executable, '-c', CHILD, str(path), str(frames)], cwd=td, env=env,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
        try:
            out, err = p.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL)
            p.communicate()
            return 'HANG', f'{timeout:g} 秒没有退出'
        except BaseException:
            os.killpg(p.pid, signal.SIGKILL)
            raise
    last = (out.strip().splitlines() or [''])[-1]
    if p.returncode == 0 and last.startswith('FRAMES'):
        n = int(last.split()[1])
        if n < frames:                                   # 正常返回了，但主循环没跑到第 N 帧的 QUIT 就退了
            return 'SHORT', f'{last}（应跑满 {frames} 帧）'
        return 'OK', last
    return 'ERROR', (err.strip().splitlines() or [f'rc={p.returncode}'])[-1]


SELF_TEST = {
    'ok': ('OK', '''
import pygame
def main():
    pygame.init(); screen = pygame.display.set_mode((64, 48)); clock = pygame.time.Clock(); running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        screen.fill((0, 0, 0)); pygame.display.flip(); clock.tick(600)
    pygame.quit()
if __name__ == "__main__":
    main()
'''),
    'exits-early': ('SHORT', '''
import pygame
def main():
    pygame.init(); screen = pygame.display.set_mode((64, 48)); clock = pygame.time.Clock(); running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        running = False
        screen.fill((0, 0, 0)); pygame.display.flip(); clock.tick(600)
    pygame.quit()
if __name__ == "__main__":
    main()
'''),
    'ignores-quit': ('HANG', '''
import pygame
def main():
    pygame.init(); screen = pygame.display.set_mode((64, 48)); clock = pygame.time.Clock()
    while True:
        pygame.event.get()
        screen.fill((0, 0, 0)); pygame.display.flip(); clock.tick(600)
if __name__ == "__main__":
    main()
'''),
    'raises-first-frame': ('ERROR', '''
import pygame
def main():
    pygame.init(); screen = pygame.display.set_mode((64, 48))
    for event in pygame.event.get():
        pass
    screen.fill("not-a-colour")
if __name__ == "__main__":
    main()
'''),
}


def self_test() -> int:
    bad = 0
    with tempfile.TemporaryDirectory() as td:
        for name, (want, src) in SELF_TEST.items():
            f = pathlib.Path(td, f'{name}.py')
            f.write_text(src.lstrip('\n'), encoding='utf-8')
            got, info = run(f, frames=10, timeout=8)
            ok = got == want
            bad += not ok
            print(f'{"ok " if ok else "BAD"} 对照 {name:20s} 期望 {want:5s} 实得 {got:5s} {info}')
    print(f'{len(SELF_TEST)} 道对照都如期：这个测量分得清 OK / SHORT / HANG / ERROR' if not bad else f'{bad} 道对照不如期——测量不可信，别用它下结论')
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('files', nargs='*', help='直接给 .py 文件')
    ap.add_argument('--repo', help='worktree 根（与 --chapters 一起用）')
    ap.add_argument('--chapters', nargs='*', default=[], help='章目录名，如 ch29-pygame-basics')
    ap.add_argument('--frames', type=int, default=30)
    ap.add_argument('--timeout', type=float, default=30.0, help='每个程序的超时秒数')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    targets = [pathlib.Path(f).resolve() for f in a.files]
    if a.chapters:
        if not a.repo:
            ap.error('--chapters 要和 --repo 一起给')
        repo = pathlib.Path(a.repo).resolve()
        for ch in a.chapters:
            d = repo / 'python/programs' / ch
            for prog in json.loads((d / 'chapter.json').read_text(encoding='utf-8'))['programs']:
                if 'pygame' in prog.get('requires', []):
                    targets.append(d / prog['file'])
    if not targets:
        ap.error('没有要跑的程序（给文件，或 --repo 加 --chapters；只数 requires 含 pygame 的程序）')
    bad = 0
    for t in targets:
        st, info = run(t, a.frames, a.timeout)
        bad += st != 'OK'
        print(f'{st:5s} {t.parent.name}/{t.name}  {info}')
    print(f'{len(targets) - bad}/{len(targets)} 个程序跑满 {a.frames} 帧、收到 QUIT 后正常返回' if not bad
          else f'{bad}/{len(targets)} 个程序不是 OK')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
