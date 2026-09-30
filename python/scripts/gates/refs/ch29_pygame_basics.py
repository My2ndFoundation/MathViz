"""ch29-pygame-basics 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。下面注释里说「实测」的变异，都是把被测 `.py` 里那一行
改坏、跑 `algorithm_property_check()` 看到红之后才写进来的（协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

**pygame 层。** 被测程序 import pygame（门在无头 SDL 下导入它，主循环在 main() 里、不会跑）；
这里的参照一律**纯 Python、不 import pygame**，用坐标算术重算 pygame 替被测程序做的事。
入口都收内置值、交回内置类型（Rect / Color 在入口里转成 tuple），门逐层比类型。

**参照所依据的 pygame 行为，是 pygame 2.6.1 上实测的，不是凭记忆写的**（第 5 期清单 §0、裁决 M7A-D7）：
  · `Color.lerp` 逐分量按 `a·(1 − t) + b·t` 算、再四舍五入（对半向上）：
    `Color(10, 20, 30).lerp((255, 0, 101), 0.5)` → `(133, 10, 66, 255)`。
    清单 §0 写的等价式 `int(a + (b − a)·t + 0.5)` **只在 t 能被二进制浮点精确表示时**与它逐位相同：
    t 取 k/100 时 10 万组里有 291 组差 1（例：a = 205、b = 255、t = 0.29，实数上恰好 219.5，
    两种写法的浮点误差落在 0.5 两侧，pygame 给 219、这个式子给 220），t 取 k/4、k/8、k/64 时 0 组。所以下面 colour-lerp 的
    cases 只取 t = k/64（二进制精确，两种写法都没有舍入误差），参照照清单用 `a + (b − a)·t + 0.5`。
    **别把 t 的生成器「放宽」成 rng.random()**——那样参照会在对半的边界上与 pygame 差 1，门报的是参照的错。
    t 超出 [0, 1] 时 lerp 抛 ValueError（被测不处理它，cases 不造）。
  · `Rect.center = (cx, cy)` 之后 `topleft == (cx − w // 2, cy − h // 2)`；
    `Rect(0, 0, W, H).center == (W // 2, H // 2)`（5×3 放在 (10, 10) → (8, 9)）。
  · `collidepoint` 是半开区间：含左边、上边，不含右边、下边——`Rect(0, 0, 4, 4)` 对 (3, 3)、(0, 0) 真，
    对 (4, 4)、(4, 0) 假；宽或高为 0 的矩形对任何点都假。
  · `Rect(1.7, 2.5, 3.9, 4)` 与 `Rect.move(1.7, 0)` 都把浮点截断成整数——所以 move-with-dt 的位置存在浮点 x 里，
    画的时候才取整；keyboard-move-clamped 的每步像素数在 main() 里先 round 成整数再交给 Rect。
  · `Rect.clamp(area)`：矩形比 area 小时，等于把 x 夹进 [area.left, area.right − w]、y 夹进 [area.top, area.bottom − h]
    （矩形比 area 大时它改为居中——本页的方块 40×40 远小于窗口，走不到那一支）。

**entry 不改实参。** 每个入口只读实参：`step` 读 pos 与 keys、新建 Rect；`clicked` 为每个按钮新建 Rect；
`run_events` 只重绑局部名 state；其余入口的实参都是数。构建时逐个用 `copy.deepcopy` 比对过跑前跑后的实参。

**贴边 cases（裁决 M7A-D5）。** keyboard-move-clamped 与 mouse-click-buttons 的错误只在贴边时露馅，
两个生成器各有**至少三分之一**的组专门造贴边的情形（见各自注释）；别为了「更随机」把这两支删掉。
"""


# 与被测程序里的常量相同（参照不 import 被测程序，所以抄一份；被测改了常量，这里要跟着改）
KEYBOARD_WIDTH = 480
KEYBOARD_HEIGHT = 320
KEYBOARD_SIZE = 40


# ── move-with-dt ─────────────────────────────────────────────────────────

def _frames_and_speed(rng):
    # 每帧 0..50 毫秒（0 = 两次 tick 之间几乎没过时间）、0..60 帧，速度 -400..400 像素 / 秒。
    # 整数毫秒 × 整数速度 ÷ 1000 都是 0.001 的倍数：逐帧累加的浮点误差远小于 round(…, 9) 的半格。
    frames = [rng.randint(0, 50) for _ in range(rng.randint(0, 60))]
    return frames, rng.randint(-400, 400)


def _position_after_ref(frames_ms, speed):
    # 被测逐帧把 ms 换成秒、乘速度、累加；参照先把总毫秒数加起来，一步算完。
    total_ms = 0
    for ms in frames_ms:
        total_ms += ms
    return round(total_ms * speed / 1000, 9)


# ── draw-primitives-grid ─────────────────────────────────────────────────

def _grid_args(rng):
    # 0..8 列、0..6 行（0 = 空网格），格子 1..60，间隙 0..20。
    return rng.randint(0, 8), rng.randint(0, 6), rng.randint(1, 60), rng.randint(0, 20)


def _grid_rects_ref(cols, rows, size, gap):
    # 被测用 for + 乘法算每格左上角；参照用两重 while，逐行逐列把坐标累加上去。
    out = []
    y = gap
    r = 0
    while r < rows:
        x = gap
        c = 0
        while c < cols:
            out.append((x, y, size, size))
            x += size + gap
            c += 1
        y += size + gap
        r += 1
    return out


# ── colour-lerp ──────────────────────────────────────────────────────────

def _colour_pair_t(rng):
    # t = k/64（k = 0..64）：二进制浮点精确，见文件头「Color.lerp」一条——别换成 rng.random()。
    # 两端 k = 0 与 k = 64 各有约 1/65 的机会；另有 1/8 的组让两色相同（渐变恒等于它自己）。
    c1 = (rng.randint(0, 255), rng.randint(0, 255), rng.randint(0, 255))
    if rng.random() < 1 / 8:
        c2 = c1
    else:
        c2 = (rng.randint(0, 255), rng.randint(0, 255), rng.randint(0, 255))
    return c1, c2, rng.randint(0, 64) / 64


def _blend_ref(c1, c2, t):
    # 被测交给 Color.lerp；参照逐分量 a + (b − a)·t 再加 0.5 截断（t 是 k/64，全程无舍入误差）。
    return tuple(int(a + (b - a) * t + 0.5) for a, b in zip(c1, c2))


# ── keyboard-move-clamped ────────────────────────────────────────────────

_DIRECTIONS = ('left', 'right', 'up', 'down')


def _keyboard_args(rng):
    # 方向键：四个方向各自按或不按（含同时按左右、一个都不按）。步长 0..60 像素。
    # 至少三分之一的组起点**贴在边上**（x 取 0 或 WIDTH − SIZE、y 取 0 或 HEIGHT − SIZE 之一），
    # 并且按下朝那条边外走的键、步长大于 0——夹住这一步只在这时起作用（裁决 M7A-D5）。
    max_x = KEYBOARD_WIDTH - KEYBOARD_SIZE
    max_y = KEYBOARD_HEIGHT - KEYBOARD_SIZE
    keys = {d for d in _DIRECTIONS if rng.random() < 0.4}
    pixels = rng.randint(0, 60)
    x = rng.randint(0, max_x)
    y = rng.randint(0, max_y)
    if rng.random() < 0.4:
        edge = rng.choice(_DIRECTIONS)
        if edge == 'left':
            x = 0
        elif edge == 'right':
            x = max_x
        elif edge == 'up':
            y = 0
        else:
            y = max_y
        keys.add(edge)
        pixels = rng.randint(1, 60)
    return (x, y), keys, pixels


def _step_ref(pos, keys, pixels):
    # 被测逐键 if 累加位移、再交给 Rect.clamp；参照拿「右减左」「下减上」两个布尔差乘步长，再 min / max 夹住。
    dx = (('right' in keys) - ('left' in keys)) * pixels
    dy = (('down' in keys) - ('up' in keys)) * pixels
    x = min(max(pos[0] + dx, 0), KEYBOARD_WIDTH - KEYBOARD_SIZE)
    y = min(max(pos[1] + dy, 0), KEYBOARD_HEIGHT - KEYBOARD_SIZE)
    return (x, y)


# ── mouse-click-buttons ──────────────────────────────────────────────────

def _buttons_and_pos(rng):
    # 0..5 个按钮，左上角 0..200、宽高 0..80（0 = 空按钮，谁也点不中），可以互相重叠（先列出的赢）。
    # 一半的组把点**正好放在某个按钮的边上**：右边 x + w、下边 y + h（不算在里面），
    # 或左边 x、上边 y（算在里面）——半开区间写错只在这时露馅（裁决 M7A-D5：至少三分之一）。
    # 另五分之一的组插进一个与已有按钮**重叠**的按钮、把点放在两者的公共部分：「先列出的赢」
    # 只在这时有意义（去掉这一支，200 组里一次重叠都没有，倒着找按钮的写法门看不见）。其余的点随机撒在 0..300。
    buttons = [(rng.randint(0, 200), rng.randint(0, 200), rng.randint(0, 80), rng.randint(0, 80))
               for _ in range(rng.randint(0, 5))]
    pos = (rng.randint(0, 300), rng.randint(0, 300))
    roll = rng.random()
    if buttons and roll < 0.5:
        x, y, w, h = rng.choice(buttons)
        inside_x = rng.randint(x, x + max(w - 1, 0))
        inside_y = rng.randint(y, y + max(h - 1, 0))
        pos = rng.choice([(x + w, inside_y), (inside_x, y + h), (x, inside_y), (inside_x, y),
                          (x + w, y + h), (x, y)])
    elif buttons and roll < 0.7:
        x, y, w, h = rng.choice(buttons)
        if w > 0 and h > 0:
            px, py = x + rng.randint(0, w - 1), y + rng.randint(0, h - 1)
            pos = (px, py)
            extra = (px - rng.randint(0, 20), py - rng.randint(0, 20), rng.randint(21, 60), rng.randint(21, 60))
            buttons.insert(rng.randint(0, len(buttons)), extra)
    return buttons, pos


def _clicked_ref(buttons, pos):
    # 被测问 Rect.collidepoint；参照用 range 的半开区间直接判坐标。
    px, py = pos
    for index in range(len(buttons)):
        x, y, w, h = buttons[index]
        if px in range(x, x + w) and py in range(y, y + h):
            return index
    return -1


# ── text-centred ─────────────────────────────────────────────────────────

def _text_and_screen(rng):
    # 文字 0..600 × 0..200（可以比屏幕还大：左上角为负），屏幕 1..800 × 1..600；奇偶都常见。
    return rng.randint(0, 600), rng.randint(0, 200), rng.randint(1, 800), rng.randint(1, 600)


def _centre_topleft_ref(text_w, text_h, screen_w, screen_h):
    # 被测把两个 Rect 的 center 对齐、读 topleft；参照直接做整数算术。
    return (screen_w // 2 - text_w // 2, screen_h // 2 - text_h // 2)


# ── screen-states ────────────────────────────────────────────────────────

_STATES = ('title', 'playing', 'paused', 'over')
_EVENTS = ('enter', 'p', 'crash', 'x')


def _state_and_events(rng):
    # 起始状态四选一；事件 0..20 个，含一个表里哪儿都没有的 'x'（状态不变那一支）。
    return rng.choice(_STATES), [rng.choice(_EVENTS) for _ in range(rng.randint(0, 20))]


def _run_events_ref(state, events):
    # 被测查 TRANSITIONS 表；参照是一条 if / elif 链，一条转移一个分支。
    for event in events:
        if state == 'title' and event == 'enter':
            state = 'playing'
        elif state == 'playing' and event == 'p':
            state = 'paused'
        elif state == 'paused' and event == 'p':
            state = 'playing'
        elif state == 'playing' and event == 'crash':
            state = 'over'
        elif state == 'over' and event == 'enter':
            state = 'title'
    return state


REFERENCES = {
    'move-with-dt': {
        'ref': _position_after_ref,
        'cases': _frames_and_speed,
    },
    'draw-primitives-grid': {
        'ref': _grid_rects_ref,
        'cases': _grid_args,
    },
    'colour-lerp': {
        'ref': _blend_ref,
        'cases': _colour_pair_t,
    },
    'keyboard-move-clamped': {
        'ref': _step_ref,
        'cases': _keyboard_args,
    },
    'mouse-click-buttons': {
        'ref': _clicked_ref,
        'cases': _buttons_and_pos,
    },
    'text-centred': {
        'ref': _centre_topleft_ref,
        'cases': _text_and_screen,
    },
    'screen-states': {
        'ref': _run_events_ref,
        'cases': _state_and_events,
    },
}
