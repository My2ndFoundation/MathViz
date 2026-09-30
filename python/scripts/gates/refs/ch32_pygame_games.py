"""ch32-pygame-games 的 property 参考实现（第 5 期 m7b，pygame 层）。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红（实测记录见构建报告）。

**参照是纯 Python，不 import pygame**（第 5 期 pygame 层的约定）。被测程序在逻辑函数里用
`pygame.Rect`（colliderect / collidelist）与 `deque`，参照一律用坐标算术、下标循环与 `fractions`。
参照里写死的常量**必须与对应 `.py` 顶部的常量一致**——改了那边，这里一起改：
pong（宽 640、高 480、拍 10 × 80、左拍 x = 20、右拍 x = 610、球 10）、pong-ai-paddle（高 480、拍高 80）、
invaders（外星人宽 30）、lives-and-invulnerability（无敌 2.0 秒）。

**舍入写法。** 只有 `pong-ai-paddle`（`round(…, 9)`）、`bullet-cooldown`（剩余时间 `round(…, 9)`）与
`lives-and-invulnerability`（无敌剩余时间 `round(…, 9)`）交回会累积误差的浮点数，入口在函数里自己舍入，参照用下面的 `_r`；pong 的速度两边都只取绝对值 / 变号再
`float()`，不舍入；其余入口交回整数、字符串、元组与列表。

**entry 不改实参。** `snake-move-list` / `snake-move-deque` 的 `advance` 就地改蛇身，所以 entry 是
复制后再调用的三行包装（`list(body)` / `deque(body)`）；其余 entry 不改实参。构建时逐个用
`copy.deepcopy` 比对过跑前跑后的实参。

**专门构造的分支（别删，每条都有守的变异，见构建报告）：**
- `_pong_cases`：四成的组把球放在**出界**位置（「记分方向接反」只在这些组露馅；清单原型首版只有 1/200）；
  两成放在拍子附近、一成五贴着上下墙（撞拍、撞墙两支靠这些组走到）；
- `_ai_cases`：两成的组让球恰在「一步够得着」的范围里（一步到位那一支）；一成五把拍子放在贴边处、
  球在更外面（夹住那两支）；
- `_snake_cases`：三成的组是「蛇头正要走进尾巴此刻所在的格子」的 2 × 2 回环（「把尾巴也算作撞」
  只在这些组露馅；清单原型首版只有 2/200）；另有三成把食物放在蛇头的下一格（「吃到」那一支）；
- `_brick_cases`：用程序里真实的砖墙布局，三成的组把砖的顺序打乱（「第一块」与「最后一块」只在
  球同时碰到两块砖、且顺序不是从左到右时才分得开）；
- `_fleet_cases`：三成的组把队伍推到贴近右墙、两成推到贴近左墙（「判边漏了外星人宽度」只在贴近右墙
  的组露馅；清单原型首版是 0/200）；
- `_cooldown_cases`：三成 remaining 为 0、三成落在「这一帧恰好走完 / 还差一点」的边界附近、一成恰好
  等于 dt（剩余恰为 0 时该开火，`> 0` 写成 `>= 0` 只在这一成露馅）；
- `_lives_cases`：四成的组是「到期那一帧」——invuln 恰好等于 dt，倒计时这一帧正好走到 0，且九成同时被击中
  （「先判后倒计时」「恰为 0 仍当无敌」两种错只在这些组露馅；清单原型首版「恰为 0」只命中 27/200）；
  一成五本来就不无敌、一成让这一帧跨过 0（invuln = dt / 2）、其余落在无敌期内（「不看无敌」靠这些组）；
  命数取 1 的比例最高（「少一条命就结束」与「命数到 0 时 invuln 归 0」靠命数 1、2 的组）。
"""
import math
from fractions import Fraction

WIDTH, HEIGHT = 640, 480
PADDLE_W, PADDLE_H = 10, 80
LEFT_X, RIGHT_X = 20, 610
BALL = 10
ALIEN_W = 30
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]
BRICKS = [(12 + c * 62, 50 + r * 22, 58, 18) for r in range(3) for c in range(10)]
INVULN = 2.0


def _r(v):
    return round(v, 9)


# ── 实参生成器 ───────────────────────────────────────────────────────────

def _pong_cases(rng):
    roll = rng.random()
    y = rng.uniform(-10, HEIGHT + 10)
    if roll < 0.4:
        x = rng.uniform(-20, -6) if rng.random() < 0.5 else rng.uniform(WIDTH + 6, WIDTH + 20)
    elif roll < 0.6:
        x = rng.uniform(8, 40) if rng.random() < 0.5 else rng.uniform(600, 632)
    elif roll < 0.75:
        x = rng.uniform(0, WIDTH)
        y = rng.uniform(-6, 8) if rng.random() < 0.5 else rng.uniform(HEIGHT - 8, HEIGHT + 6)
    else:
        x = rng.uniform(-10, WIDTH + 10)
    left_y = rng.uniform(0, HEIGHT - PADDLE_H)
    right_y = rng.uniform(0, HEIGHT - PADDLE_H)
    if 0.4 <= roll < 0.6:
        near = y - rng.uniform(-10, PADDLE_H + 10)
        left_y = right_y = min(HEIGHT - PADDLE_H, max(0.0, near))
    return ((x, y), (rng.choice([-300, 300]), rng.uniform(-300, 300)), left_y, right_y)


def _ai_cases(rng):
    speed = rng.choice([120, 180, 240, 480])
    dt = rng.choice([1 / 60, 1 / 30, 0.1])
    roll = rng.random()
    paddle_y = rng.uniform(0, HEIGHT - PADDLE_H)
    if roll < 0.2:
        ball_y = paddle_y + PADDLE_H / 2 + rng.uniform(-1, 1) * speed * dt
    elif roll < 0.35:
        paddle_y = rng.choice([rng.uniform(0, 3), rng.uniform(HEIGHT - PADDLE_H - 3, HEIGHT - PADDLE_H)])
        ball_y = rng.uniform(-40, 10) if paddle_y < 10 else rng.uniform(HEIGHT - 10, HEIGHT + 40)
    else:
        ball_y = rng.uniform(0, HEIGHT)
    return (paddle_y, ball_y, speed, dt)


def _snake_cases(rng):
    n = 12
    if rng.random() < 0.3:
        x, y = rng.randint(0, n - 2), rng.randint(0, n - 2)
        body = [(x, y), (x, y + 1), (x + 1, y + 1), (x + 1, y)]
        return (body, (1, 0), (0, 0) if (x, y) != (0, 0) else (n - 1, n - 1), n)
    x, y = rng.randint(0, n - 1), rng.randint(0, n - 1)
    body = [(x, y)]
    for _ in range(rng.randint(0, 7)):
        dx, dy = rng.choice(DIRS)
        nx, ny = body[-1][0] + dx, body[-1][1] + dy
        if (nx, ny) not in body and 0 <= nx < n and 0 <= ny < n:
            body.append((nx, ny))
    if len(body) > 1 and rng.random() < 0.7:
        direction = (body[0][0] - body[1][0], body[0][1] - body[1][1])
    else:
        direction = rng.choice(DIRS)
    if rng.random() < 0.3:
        food = (body[0][0] + direction[0], body[0][1] + direction[1])
    else:
        food = (rng.randint(0, n - 1), rng.randint(0, n - 1))
    return (body, direction, food, n)


def _brick_cases(rng):
    bricks = [b for b in BRICKS if rng.random() < 0.7]
    if rng.random() < 0.3:
        rng.shuffle(bricks)
    return ((rng.randint(-10, WIDTH), rng.randint(30, 130), 10, 10), bricks)


def _fleet_cases(rng):
    step = rng.choice([4, 10])
    xs = sorted(rng.sample(range(0, 400, 10), rng.randint(1, 8)))
    roll = rng.random()
    if roll < 0.3:
        shift = WIDTH - ALIEN_W - max(xs) - rng.randint(0, 12)
        xs = [x + shift for x in xs]
    elif roll < 0.5:
        shift = min(xs) - rng.randint(0, 12)
        xs = [x - shift for x in xs]
    else:
        shift = rng.randint(0, WIDTH - ALIEN_W - max(xs))
        xs = [x + shift for x in xs]
    y = rng.randint(0, 200)
    aliens = [(x, y + 36 * rng.randint(0, 2)) for x in xs]
    return (aliens, rng.choice([-1, 1]), step, WIDTH, 16)


def _cooldown_cases(rng):
    dt = rng.choice([1 / 60, 1 / 30, 1 / 120])
    cooldown = rng.choice([0.1, 0.25, 0.5])
    roll = rng.random()
    if roll < 0.3:
        remaining = 0.0
    elif roll < 0.6:
        remaining = rng.uniform(0, 2 * dt)
    elif roll < 0.7:
        remaining = dt
    else:
        remaining = rng.uniform(0, cooldown)
    return (remaining, rng.random() < 0.5, cooldown, dt)


def _lives_cases(rng):
    dt = rng.choice([1 / 60, 1 / 30, 0.1])
    roll = rng.random()
    if roll < 0.4:
        return (rng.choice([1, 2, 3]), dt, rng.random() < 0.9, dt)
    if roll < 0.55:
        invuln = 0.0
    elif roll < 0.65:
        invuln = dt / 2
    else:
        invuln = rng.choice([0.5, 1.0, INVULN])
    return (rng.choice([1, 1, 2, 3]), invuln, rng.random() < 0.7, dt)


# ── 参照 ─────────────────────────────────────────────────────────────────

def _ball_step(ball, vel, left_y, right_y):
    # 被测：pygame.Rect 的 center / colliderect、abs 定号。参照：边的坐标算术判相交，copysign 定号。
    left = round(ball[0]) - BALL // 2
    top = round(ball[1]) - BALL // 2
    right, bottom = left + BALL, top + BALL
    vx, vy = vel

    def touches(px, py):
        py = round(py)
        return left < px + PADDLE_W and px < right and top < py + PADDLE_H and py < bottom

    if top <= 0:
        vy = math.copysign(vy, 1.0)
    elif bottom >= HEIGHT:
        vy = math.copysign(vy, -1.0)
    if touches(LEFT_X, left_y):
        vx = math.copysign(vx, 1.0)
    elif touches(RIGHT_X, right_y):
        vx = math.copysign(vx, -1.0)
    state = "right-scores" if right < 0 else "left-scores" if left > WIDTH else "play"
    return ((float(vx), float(vy)), state)


def _ai_follow(paddle_y, ball_y, speed, dt):
    # 被测：拍子中心与球比、if / elif / else 三支。参照：目标位置减当前位置，max / min 把这一步夹在 ±step 里。
    step = speed * dt
    delta = max(-step, min(step, (ball_y - PADDLE_H / 2) - paddle_y))
    return _r(min(float(HEIGHT - PADDLE_H), max(0.0, paddle_y + delta)))


def _snake_step(body, direction, food, n):
    # 被测：切片与 + 拼接（snake-full）、先弹尾再头插（list / deque）。参照：range 判界、下标循环找碰撞、逐格 append。
    hx, hy = body[0][0] + direction[0], body[0][1] + direction[1]
    if hx not in range(n) or hy not in range(n):
        return (list(body), "dead")
    for i in range(len(body) - 1):
        if body[i] == (hx, hy):
            return (list(body), "dead")
    grown = (hx, hy) == food
    keep = len(body) if grown else len(body) - 1
    out = [(hx, hy)]
    for i in range(keep):
        out.append(body[i])
    return (out, "ate" if grown else "moved")


def _brick_hit(ball, bricks):
    # 被测：pygame.Rect.collidelist。参照：逐块比四条边（严格不等号：只贴边不算相交）。
    x, y, w, h = ball
    for k, (bx, by, bw, bh) in enumerate(bricks):
        if x < bx + bw and bx < x + w and y < by + bh and by < y + h:
            return k
    return None


def _fleet_step(aliens, direction, step, width, drop):
    # 被测：按方向只看最右（max + 宽度）或最左（min）那一个。参照：先整队走一步，再看有没有谁出了界。
    moved = [(x + direction * step, y) for x, y in aliens]
    if any(x < 0 or x + ALIEN_W > width for x, _ in moved):
        return ([(x, y + drop) for x, y in aliens], -direction)
    return (moved, direction)


def _try_fire(remaining, fire_held, cooldown, dt):
    # 被测：先减 dt、再按「还大于 0」「按着」分三支。参照：精确分数比较「剩余是否多过这一帧」。
    if Fraction(remaining) > Fraction(dt):
        return (_r(remaining - dt), False)
    if fire_held:
        return (float(cooldown), True)
    return (0.0, False)


def _take_hit(lives, invuln, hit, dt):
    # 被测：先用 max 把倒计时托在 0 以上，再判「被击中且计时恰为 0.0」，掉命后另起一个 if 看命数到没到 0。
    # 参照：先算剩余 left（不夹），由 left <= 0 判「可被击中」，再按新命数一次定出计时。
    left = invuln - dt
    vulnerable = left <= 0
    remaining = 0.0 if left <= 0 else left
    if not (hit and vulnerable):
        return (lives, _r(remaining), lives == 0)
    after = lives - 1
    return (after, _r(INVULN) if after else _r(0.0), after == 0)


REFERENCES = {
    'pong-full': {'ref': _ball_step, 'cases': _pong_cases},
    'pong-ai-paddle': {'ref': _ai_follow, 'cases': _ai_cases},
    'snake-full': {'ref': _snake_step, 'cases': _snake_cases},
    'snake-move-list': {'ref': _snake_step, 'cases': _snake_cases},
    'snake-move-deque': {'ref': _snake_step, 'cases': _snake_cases},
    'breakout-full': {'ref': _brick_hit, 'cases': _brick_cases},
    'invaders-full': {'ref': _fleet_step, 'cases': _fleet_cases},
    'bullet-cooldown': {'ref': _try_fire, 'cases': _cooldown_cases},
    'lives-and-invulnerability': {'ref': _take_hit, 'cases': _lives_cases},
}
