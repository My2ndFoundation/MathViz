"""ch30-pygame-sprites 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面注释里说「实测」的变异，都是把被测 `.py` 里那一行
改坏、跑 check.py 看到 algorithm_property_check 断言红之后才写进来的（协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

**参照是纯 Python，不 import pygame**（第 5 期 pygame 层的约定）。被测程序用 `pygame.Rect`、
`Vector2`、`sprite.Group`、`groupcollide`；参照一律走坐标算术、集合或逐步模拟。
入口都只收内置值（整数、元组、列表），返回逐层都是内置类型（`Rect` 由 `tuple(rect)` 转成
四个 int 的元组）。

**pygame 2.6.1 实测行为**（第 5 期 m7a 清单 §0，裁决 M7A-D7；本章讲解照此写，参照照此写）：
- `colliderect` 只碰边不算碰：`Rect(0,0,4,4)` 与 `Rect(4,0,4,4)` 为假；重叠一格（`Rect(3,0,4,4)`）为真。
  所以两个 rect-overlap 程序都是严格不等式；参照「两矩形覆盖的整数格点有交集」天然是这个语义
  （右边、下边那条线上的格点不属于矩形）。
- 零宽或零高的矩形与谁都不碰（`Rect(5,5,0,3)` 对 `Rect(0,0,10,10)` 为假）。参照里零宽高的矩形覆盖
  0 个格点，同样为假；**手写四个不等式的版本在这里与 colliderect 不同**（上例它给真），所以
  `rect-collision-manual` 的 cases 只造宽高 ≥ 1 的矩形，`rect-collision-colliderect` 的 cases
  另有一成零宽高——那一成守的是 pygame 本身的这条行为，不是学生写的哪一行。
- `Rect.move(1.7, 0)` 与 `Rect(1.7, 2.5, 3, 3)` 截断成整数（`(1, 0)`、`(1, 2)`）；另测得**给属性赋浮点**
  （`rect.topleft = Vector2(1.6, 2.5)`、`rect.center = (1.5, 2.5)`）是四舍五入、半数远离零
  （`(2, 3)`；`-1.5 → -2`），与 Python 的 `round`（半数取偶，`round(2.5) == 2`）不同。
  所以本章程序把真实位置存在 `Vector2` / float 里，画之前自己用 `round` 取整再交给 rect。
- `Rect.center = (cx, cy)` 之后 `topleft == (cx - w // 2, cy - h // 2)`（5×3 放在 (10,10) → (8, 9)）。
- `groupcollide(a, b, True, True)` **按 a 的顺序逐个结算**（`inspect.getsource` 可见：对 a 的每个精灵
  调 `spritecollide(…, dokillb)`，命中就 `kill()`）：先命中的子弹已经把目标杀掉，后面打同一目标的子弹
  就不算命中、留在组里。**按「同时结算」写的参照会错**：起草原型的 cases 不专门造双中，在 2/200 组上错；
  本文件的 cases 专门造「两颗子弹打同一目标」，在门的 200 组上错 81 组（见下面 group-collide-kill 的注释）。
  顺序结算是 pygame 的语义，也是 `group-collide-kill` 的讲点，不是参照写错了——**别把参照「修正」成
  同时结算**（裁决 M7A-D6）。

**不挂 P 的两个**（裁决 M7A-D8）：`mask-pixel-collision`（像素级结果取决于 pygame 的圆形光栅化，
纯 Python 写不出逐像素相同的参照）、`image-save-and-load`（它的内容是存文件、读文件、透明色，没有纯函数）。
这两个由 `program_run_check` 的 `compile()` 与构建时的活体跑帧守（见构建报告）。

**entry 不改实参。** 本章每个 entry 都只读实参（Group、Rect、Vector2 都是新建的）。构建时逐个用
`copy.deepcopy` 比对过跑前跑后的实参。
"""
import math


# ── sprite-subclass-group ────────────────────────────────────────────────

def _positions_cases(rng):
    # 0..5 个球（空组也造），起点、速度是整数，dt 是整毫秒 / 1000。
    # 实测门红：update 只挪 x（`self.pos.x += self.vel.x * dt`）、返回时 x、y 对调。
    # 为什么能 round(v, 9) 两边比：真值 = 起点 + 速度 × 毫秒 × 步数 / 1000，是 0.001 的整数倍；
    # 被测逐步累加的浮点误差 < 1e-10（≤ 120 步、|坐标| < 3000），远小于 9 位舍入的半格 5e-10。
    n = rng.randint(0, 5)
    starts = [(rng.randint(-100, 500), rng.randint(-100, 400)) for _ in range(n)]
    vels = [(rng.randint(-300, 300), rng.randint(-300, 300)) for _ in range(n)]
    steps = rng.randint(0, 120)
    dt = rng.randint(1, 50) / 1000
    return (starts, vels, steps, dt)


def _positions_ref(starts, vels, steps, dt):
    # 被测是 Group.update 逐帧累加 Vector2；参照一步算完：起点 + 速度 × dt × 步数。
    return [(round(sx + vx * dt * steps, 9), round(sy + vy * dt * steps, 9))
            for (sx, sy), (vx, vy) in zip(starts, vels)]


# ── animation-frames ─────────────────────────────────────────────────────

def _frame_cases(rng):
    # 一半 loop=True、一半 False。False 的组里一半让 elapsed 落在「还没播完」的范围，
    # 否则只播一次那一支几乎总是停在末帧，把它写成一律 `return n_frames - 1` 的错就看不见（实测门红）。
    # 五分之一的组让 elapsed 恰好是帧时长的整数倍（换帧的那一毫秒）：`(elapsed_ms + 1) // frame_ms`
    # 这类差一毫秒的错只在那里露馅（实测门红）。`% (n_frames + 1)`、`min(step, n_frames)` 也实测门红。
    n = rng.randint(1, 8)
    frame_ms = rng.randint(20, 200)
    loop = rng.random() < 0.5
    r = rng.random()
    if r < 0.2:
        elapsed = frame_ms * rng.randint(0, 3 * n)
    elif not loop and r < 0.6:
        elapsed = rng.randint(0, frame_ms * n - 1)
    else:
        elapsed = rng.randint(0, frame_ms * n * 4)
    return (elapsed, frame_ms, n, loop)


def _frame_ref(elapsed_ms, frame_ms, n_frames, loop):
    # 被测是整除 + 取余 / min；参照逐帧减去帧时长地模拟播放。
    index = 0
    left = elapsed_ms
    while left >= frame_ms:
        left -= frame_ms
        if index < n_frames - 1:
            index += 1
        elif loop:
            index = 0
    return index


# ── sprite-sheet-frames ──────────────────────────────────────────────────

def _sheet_cases(rng):
    # 四成大图恰好是帧的整数倍（含 0 行 / 0 列）；其余随意，常有放不下整帧的边角、帧比图大。
    # 实测门红：列数写成 `(sheet_w - 1) // frame_w`（恰好整数倍时少一列）、四元组里行列对调。
    fw = rng.randint(1, 40)
    fh = rng.randint(1, 40)
    if rng.random() < 0.4:
        sw = fw * rng.randint(0, 6)
        sh = fh * rng.randint(0, 4)
    else:
        sw = rng.randint(0, 250)
        sh = rng.randint(0, 160)
    return (sw, sh, fw, fh)


def _sheet_ref(sheet_w, sheet_h, frame_w, frame_h):
    # 被测是两重 for range(整除)；参照两重 while 逐格推进坐标，放不下整帧就停。
    out = []
    y = 0
    while y + frame_h <= sheet_h:
        x = 0
        while x + frame_w <= sheet_w:
            out.append((x, y, frame_w, frame_h))
            x += frame_w
        y += frame_h
    return out


# ── rect-overlap（rect-collision-colliderect / rect-collision-manual）────────

def _rand_rect(rng, min_size=1):
    return (rng.randint(-20, 40), rng.randint(-20, 40),
            rng.randint(min_size, 25), rng.randint(min_size, 25))


def _flush_pair(rng):
    # 恰好贴边：b 紧贴 a 的四条边之一，另一个方向上的跨度与 a 有重叠。随机对调 a、b。
    ax, ay, aw, ah = a = _rand_rect(rng)
    bw, bh = rng.randint(1, 25), rng.randint(1, 25)
    side = rng.randrange(4)
    if side == 0:
        b = (ax + aw, rng.randint(ay - bh + 1, ay + ah - 1), bw, bh)
    elif side == 1:
        b = (ax - bw, rng.randint(ay - bh + 1, ay + ah - 1), bw, bh)
    elif side == 2:
        b = (rng.randint(ax - bw + 1, ax + aw - 1), ay + ah, bw, bh)
    else:
        b = (rng.randint(ax - bw + 1, ax + aw - 1), ay - bh, bw, bh)
    if rng.random() < 0.5:
        a, b = b, a
    return (a, b)


def _nudge(pair, rng):
    # 把贴边的一对朝里挪一格：重叠恰好一格宽，应为真。守「多减了 1」一类的错。
    a, b = pair
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    if bx == ax + aw:
        b = (bx - 1, by, bw, bh)
    elif ax == bx + bw:
        b = (bx + 1, by, bw, bh)
    elif by == ay + ah:
        b = (bx, by - 1, bw, bh)
    else:
        b = (bx, by + 1, bw, bh)
    return (a, b)


def _rect_pair_cases(rng):
    # 约三成恰好贴边（清单 §2.2 的要求：`<` 写成 `<=` 只在贴边时露馅），一成贴边后朝里挪一格，
    # 其余随机。宽高 ≥ 1：零宽高是两种写法不同的地方（见文件头），手写版不管它。
    # 实测门红：手写版 across 的第一个 `<` 改 `<=`（红在贴边的一组）、`and` 改 `or`；
    # colliderect 版改成 `inflate(2, 2).colliderect(…)`、改成 `contains(…)`。
    r = rng.random()
    if r < 0.3:
        return _flush_pair(rng)
    if r < 0.4:
        return _nudge(_flush_pair(rng), rng)
    return (_rand_rect(rng), _rand_rect(rng))


def _rect_pair_cases_with_empty(rng):
    # colliderect 版多一成零宽或零高的矩形：守的是 pygame 自己「零宽高与谁都不碰」这条（文件头）。
    # 实测：把 colliderect 版的函数体换成手写的四个严格比较，门红在 ((35, 12, 14, 0), (23, 8, 24, 13))——
    # 这一成是那个差别唯一的守门，别删。
    if rng.random() < 0.1:
        a = _rand_rect(rng, min_size=0)
        a = (a[0], a[1], 0, a[3]) if rng.random() < 0.5 else (a[0], a[1], a[2], 0)
        b = _rand_rect(rng)
        return (a, b) if rng.random() < 0.5 else (b, a)
    return _rect_pair_cases(rng)


def _cells(rect):
    x, y, w, h = rect
    return {(i, j) for i in range(x, x + w) for j in range(y, y + h)}


def _overlaps_ref(a, b):
    # 被测是 colliderect / 四个严格不等式；参照枚举两矩形覆盖的整数格点求交。
    return bool(_cells(a) & _cells(b))


# ── circle-collision ─────────────────────────────────────────────────────

_TRIPLES = ((3, 4, 5), (5, 12, 13), (8, 15, 17), (7, 24, 25), (20, 21, 29), (0, 1, 1))


def _circle_cases(rng):
    # 约三成五恰好相切（圆心距是勾股数的斜边、半径和等于它），其中四分之一再把半径和挪 ±1；
    # 其余随机。`<=` 写成 `<` 只在恰好相切时露馅（实测门红，红在 ((10, 26), 3, (94, 106), 113)：
    # 84² + 80² = 116²）。`dy` 取错下标也实测门红。
    c1 = (rng.randint(-50, 50), rng.randint(-50, 50))
    if rng.random() < 0.35:
        a, b, c = rng.choice(_TRIPLES)
        k = rng.randint(1, 4)
        dx, dy = a * k, b * k
        if rng.random() < 0.5:
            dx, dy = dy, dx
        dx *= rng.choice((1, -1))
        dy *= rng.choice((1, -1))
        total = c * k + rng.choice((0, 0, 0, 0, 0, 0, -1, 1))
        r1 = rng.randint(0, total)
        return (c1, r1, (c1[0] + dx, c1[1] + dy), total - r1)
    c2 = (rng.randint(-50, 50), rng.randint(-50, 50))
    return (c1, rng.randint(0, 40), c2, rng.randint(0, 40))


def _circles_ref(c1, r1, c2, r2):
    # 被测比平方、不开方；参照开方：math.dist(c1, c2) <= r1 + r2。
    # 整数圆心下，距离的平方若恰是完全平方，sqrt 精确（IEEE 开方正确舍入）；不是时离整数远大于舍入误差。
    return math.dist(c1, c2) <= r1 + r2


# ── group-collide-kill ───────────────────────────────────────────────────

def _hits(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah


def _bullet(rng):
    return (rng.randint(0, 80), rng.randint(0, 60), rng.randint(1, 6), rng.randint(2, 12))


def _collide_cases(rng):
    # 目标 0..6 个、子弹 0..6 个；一半的组专门造「两颗子弹打同一目标」：挑一个目标，
    # 在它里面各放一颗子弹，插到子弹列表的随机位置。这是顺序结算与同时结算分道的地方。
    targets = [(rng.randint(0, 80), rng.randint(0, 60), rng.randint(5, 30), rng.randint(5, 20))
               for _ in range(rng.randint(0, 6))]
    bullets = [_bullet(rng) for _ in range(rng.randint(0, 6))]
    if targets and rng.random() < 0.5:
        tx, ty, tw, th = rng.choice(targets)
        for _ in range(2):
            shot = (rng.randint(tx, tx + tw - 1), rng.randint(ty, ty + th - 1),
                    rng.randint(1, 6), rng.randint(2, 12))
            bullets.insert(rng.randint(0, len(bullets)), shot)
    return (bullets, targets)


def _resolve_ref(bullets, targets):
    # 被测是 sprite.Group + groupcollide(True, True)；参照按子弹顺序逐颗模拟（AABB 严格不等式）：
    # 这颗子弹碰到的每个还活着的目标都消失、各记一分，子弹也消失；什么都没碰到的子弹留下。
    # 实测：把参照换成「同时结算」（每颗子弹都对**初始**目标列表判，碰到任何目标的子弹、被任何子弹碰到的
    # 目标一起删，分数 = 被删的目标数），门的 200 组里有 81 组与被测不同，门红在第一组
    # ([(91, 52, 5, 2), (80, 29, 4, 8), (86, 62, 2, 6)], [(69, 47, 28, 19), (55, 12, 19, 17)])：
    # 第 1、3 颗子弹都在第一个目标里，pygame 只让第 1 颗命中，第 3 颗留下。那是 pygame 的语义，
    # 不是参照的错（裁决 M7A-D6）。下面这些变异门都红（断言失败）：dokilla 改 False、dokillb 改 False、
    # 分数改成 len(hits)（一颗子弹同时盖住两个目标时少算）。
    alive = list(targets)
    left = []
    score = 0
    for shot in bullets:
        struck = [t for t in alive if _hits(shot, t)]
        if struck:
            score += len(struck)
            alive = [t for t in alive if not _hits(shot, t)]
        else:
            left.append(tuple(shot))
    return score, left, [tuple(t) for t in alive]


REFERENCES = {
    'sprite-subclass-group': {'ref': _positions_ref, 'cases': _positions_cases},
    'animation-frames': {'ref': _frame_ref, 'cases': _frame_cases},
    'sprite-sheet-frames': {'ref': _sheet_ref, 'cases': _sheet_cases},
    'rect-collision-colliderect': {'ref': _overlaps_ref, 'cases': _rect_pair_cases_with_empty},
    'rect-collision-manual': {'ref': _overlaps_ref, 'cases': _rect_pair_cases},
    'circle-collision': {'ref': _circles_ref, 'cases': _circle_cases},
    'group-collide-kill': {'ref': _resolve_ref, 'cases': _collide_cases},
}
