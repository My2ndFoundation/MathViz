"""ch31-pygame-motion 的 property 参考实现（第 5 期 m7b，pygame 层）。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红（实测记录见构建报告）。

**参照是纯 Python，不 import pygame**（第 5 期 pygame 层的约定）。被测程序在逻辑函数里用
`pygame.Vector2`（normalize / move_towards / clamp_magnitude），参照一律用坐标算术与 `math`。
参照里写死的常量（宽 640、高 480、半径 15、地面 400、重力 1500、起跳 -600、停速 1）
**必须与对应 `.py` 顶部的常量一致**——改了那边，这里一起改。

**舍入写法。** 入口与参照两边都 `round(v, 9)`（浮点结果逐项舍入；入口在函数里自己舍入，
参照用下面的 `_r`）。`gravity-jump` 落地那一支两边都交回 `float(GROUND_Y)`、`0.0`，不经舍入；
两个摩擦程序「停下」那一支两边都交回 `0.0`。

**entry 不改实参。** 本章每个 entry 收的都是数、布尔、元组或 None（不可变），
构建时仍逐个用 `copy.deepcopy` 比对过跑前跑后的实参。

**专门构造的分支（别删，每条都有守的变异，见构建报告）：**
- `_keys_cases`：一成的组四个键全不按——`diagonal-normalised` 的零向量分支
  （删掉 length() > 0 的判断，normalize 抛 ValueError）只靠这些组走到；
- `_steer_cases`：一成 target 为 None、一成 target 与 pos 重合；
- `_thrust_cases`：一成的组速度与加速度都为零（clamp_magnitude 对零向量抛 ValueError）；
- `_gravity_cases`：一半的组 y 恰在地面上（起跳分支要 on_ground 与 jump 同真）；
- `_bounce_cases`：四成的组 x 在墙外，其中一半「已经在往回走」——「单纯取反」只在这些组露馅；
- `_friction_cases`：一成的组速度很小，好走到「停下」那一支；
- `_wrap_cases`：两成的组离屏幕好几个宽度 / 高度远——「只加减一次宽度」只在这些组露馅。
"""
import math
from fractions import Fraction

WIDTH, HEIGHT = 640, 480


def _r(v):
    return round(v, 9)


# ── 实参生成器 ───────────────────────────────────────────────────────────

def _keys_cases(rng):
    speed = rng.choice([100, 150, 200, 250])
    if rng.random() < 0.1:
        return (False, False, False, False, speed)
    return (rng.random() < 0.5, rng.random() < 0.5, rng.random() < 0.5, rng.random() < 0.5, speed)


def _steer_cases(rng):
    pos = (rng.randint(-50, 50), rng.randint(-50, 50))
    roll = rng.random()
    if roll < 0.1:
        target = None
    elif roll < 0.2:
        target = pos
    else:
        target = (rng.randint(-50, 50), rng.randint(-50, 50))
    return (pos, target, rng.choice([60, 120, 300]), rng.choice([1 / 60, 1 / 30, 0.5]))


def _thrust_cases(rng):
    if rng.random() < 0.1:
        return ((0.0, 0.0), (0.0, 0.0), rng.choice([1 / 60, 0.1]), rng.choice([100, 250]))
    vel = (rng.uniform(-300, 300), rng.uniform(-300, 300))
    acc = (rng.uniform(-500, 500), rng.uniform(-500, 500))
    return (vel, acc, rng.choice([1 / 60, 0.1, 0.5]), rng.choice([100, 250]))


def _gravity_cases(rng):
    y = 400.0 if rng.random() < 0.5 else rng.uniform(250, 400)
    return (y, rng.uniform(-700, 700), rng.random() < 0.5, rng.random() < 0.5,
            rng.choice([1 / 60, 1 / 30]))


def _bounce_cases(rng):
    vx = rng.uniform(-400, 400)
    roll = rng.random()
    if roll < 0.2:
        x = rng.uniform(-40, 14)             # 左墙（LEFT = 15）外
    elif roll < 0.4:
        x = rng.uniform(626, 680)            # 右墙（RIGHT = 625）外
    else:
        x = rng.uniform(15, 625)
    return (x, vx)


def _friction_cases(rng):
    v = rng.uniform(-2, 2) if rng.random() < 0.1 else rng.uniform(-400, 400)
    return (v, rng.choice([0.5, 0.2, 0.9, 0.9 ** 60]), rng.choice([1 / 60, 1 / 30, 1 / 120]))


def _wrap_cases(rng):
    if rng.random() < 0.2:
        return (rng.uniform(-3 * WIDTH, 4 * WIDTH), rng.uniform(-3 * HEIGHT, 4 * HEIGHT))
    return (rng.uniform(-100, WIDTH + 100), rng.uniform(-100, HEIGHT + 100))


# ── 参照 ─────────────────────────────────────────────────────────────────

def _unit(b):
    return 1 if b else 0


def _velocity_raw(left, right, up, down, speed):
    # 被测：Vector2(差, 差) * speed。参照：逐分量整数乘，最后才变 float。
    return (_r(float((_unit(right) - _unit(left)) * speed)),
            _r(float((_unit(down) - _unit(up)) * speed)))


def _velocity_unit(left, right, up, down, speed):
    # 被测：Vector2.normalize()。参照：math.hypot 求长度、逐分量除，零方向单独判。
    dx = _unit(right) - _unit(left)
    dy = _unit(down) - _unit(up)
    n = math.hypot(dx, dy)
    if n == 0:
        return (0.0, 0.0)
    return (_r(dx / n * speed), _r(dy / n * speed))


def _step_toward(pos, target, speed, dt):
    # 被测：Vector2.move_towards。参照：hypot 量距离，够得着就落在目标上，否则按比例走。
    if target is None:
        return (_r(float(pos[0])), _r(float(pos[1])))
    dx, dy = target[0] - pos[0], target[1] - pos[1]
    dist = math.hypot(dx, dy)
    reach = speed * dt
    if dist <= reach:
        return (_r(float(target[0])), _r(float(target[1])))
    return (_r(pos[0] + dx / dist * reach), _r(pos[1] + dy / dist * reach))


def _accelerate(vel, acc, dt, max_speed):
    # 被测：Vector2 相加 + clamp_magnitude。参照：逐分量相加，hypot 超限就按比例缩。
    vx = vel[0] + acc[0] * dt
    vy = vel[1] + acc[1] * dt
    n = math.hypot(vx, vy)
    if n > max_speed:
        vx, vy = vx / n * max_speed, vy / n * max_speed
    return (_r(vx), _r(vy))


def _gravity_step(y, vy, on_ground, jump, dt):
    # 被测：if 起跳、两次 +=、判落地。参照：新速度、新位置各一个表达式，再据此判落地。
    new_vy = (-600 if (on_ground and jump) else vy) + 1500 * dt
    new_y = y + new_vy * dt
    if new_y >= 400:
        return (400.0, 0.0, True)
    return (_r(new_y), _r(new_vy), False)


def _bounce(x, vx):
    # 被测：两个 if 各自 2 * 墙 - x。参照：以 LEFT 为原点、周期 2 * 跨度的三角波折回，
    # 速度符号用 math.copysign 定。墙外的越界量远小于跨度，一次折回就够。
    left, right = 15, 625
    if left <= x <= right:
        return (_r(x), _r(vx))
    span = right - left
    t = (x - left) % (2 * span)
    folded = left + (t if t <= span else 2 * span - t)
    return (_r(folded), _r(math.copysign(abs(vx), 1.0 if x < left else -1.0)))


def _slow_per_frame(v, keep_per_frame, dt):
    # 被测：浮点乘 + abs 判停。参照：精确分数相乘（float 乘法是正确舍入的，所以相同），
    # 用链式比较判停，最后才变 float。
    p = Fraction(v) * Fraction(keep_per_frame)
    if -1 < p < 1:
        return 0.0
    return _r(float(p))


def _slow_per_second(v, keep_per_second, dt):
    # 被测：keep_per_second ** dt。参照：math.exp(dt * math.log(k))。
    nv = v * math.exp(dt * math.log(keep_per_second))
    if -1 < nv < 1:
        return 0.0
    return _r(nv)


def _wrap(x, y):
    # 被测：x % WIDTH、y % HEIGHT。参照：while 循环反复加减。
    while x < 0:
        x += WIDTH
    while x >= WIDTH:
        x -= WIDTH
    while y < 0:
        y += HEIGHT
    while y >= HEIGHT:
        y -= HEIGHT
    return (_r(x), _r(y))


REFERENCES = {
    'diagonal-unnormalised': {'ref': _velocity_raw, 'cases': _keys_cases},
    'diagonal-normalised': {'ref': _velocity_unit, 'cases': _keys_cases},
    'mouse-steer-toward': {'ref': _step_toward, 'cases': _steer_cases},
    'thrust-max-speed': {'ref': _accelerate, 'cases': _thrust_cases},
    'gravity-jump': {'ref': _gravity_step, 'cases': _gravity_cases},
    'bounce-walls': {'ref': _bounce, 'cases': _bounce_cases},
    'friction-per-frame': {'ref': _slow_per_frame, 'cases': _friction_cases},
    'friction-dt': {'ref': _slow_per_second, 'cases': _friction_cases},
    'screen-wrap': {'ref': _wrap, 'cases': _wrap_cases},
}
