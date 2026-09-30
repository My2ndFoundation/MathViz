# Python 子项目 · 第 5 期 · 波 m7b：py-pygame-motion、py-pygame-games 程序清单

> 状态：**已批准**（2026-09-30，Python编程 审定 4fc58e2；裁决见 §9）。派构建者等第 4 期收尾 PR 合并；games 另等 `chunks` PR 合并。
> 日期：2026-09-30
>
> 上游：主规格 §2.2（`py-pygame-motion` — 键鼠输入、向量运动、重力、反弹、摩擦；`py-pygame-games` — Pong、贪吃蛇、打砖块、太空侵略者（分段可读））、
> §2.3 / §3.4（`chunks`）、§5.4 末段（pygame 层，#196）；第 5 期派发简报 `.superpowers/python-phase5/phase5-brief.md` §2；
> m7a 已批准的清单边界（Python编程 转达：basics 讲事件本身，sprites 讲全部碰撞，`move-with-dt` 做「速度 × dt」一次积分；组名 `frame-independent-motion`、`rect-overlap`）。

---

## 0. 固定取值

| 页 | 章目录 | refs 文件 | 页名（title，提请审定） | 程序数 |
|---|---|---|---|---|
| `py-pygame-motion` | `ch31-pygame-motion` | `gates/refs/ch31_pygame_motion.py` | 「运动与物理」/ "Motion & Physics" | 9 |
| `py-pygame-games` | `ch32-pygame-games` | `gates/refs/ch32_pygame_games.py` | 「图形游戏」/ "Graphical Games" | 9 |

`module` = 7，`accent` = `violet`，`requires` = `["pygame"]`。合计 **18 个程序、3 个变体组、18 个带 P（每个程序都挂在纯逻辑函数上）、4 个声明 `chunks`、0 个用递归**。

页名与全部模块比过：「图形游戏」与 M5 的「控制台游戏」对照成对、不混；与 M7 模块名「图形与游戏」不同形（模块名在导航分组里，页名在卡片上）。

**变体组名**（本波新起，已对全库 ch01–ch28 的 `problem` 名、m7a 的 `frame-independent-motion` / `rect-overlap` 查过无重名）：
`diagonal-speed`、`friction-decay`、`snake-move`。

**pygame 版本**：本机 `python3 -c "import pygame;print(pygame.version.ver)"` → `2.6.1`（= CI 钉版本）。

---

## 1. 查重与边界来源

| 已有 / 并行 | 在哪 | 本波怎么避开 |
|---|---|---|
| 事件本身（KEYDOWN / `get_pressed` / 鼠标） | m7a `py-pygame-basics` | motion 只讲「输入 → 速度 / 加速度」的映射，讲解指回「pygame 入门」页 |
| 碰撞（矩形、圆、组、像素） | m7a `py-pygame-sprites` | 反弹、打砖块、Pong 用到的碰撞判定「用，不重讲」，指回「精灵与碰撞」页 |
| 「速度 × dt」一次积分（`frame-independent-motion` 组） | m7a | motion **不再做**逐帧 vs 按秒移动的对照；从加速度、重力、摩擦讲起 |
| M5「控制台游戏」（井字棋、2048、扫雷……） | ch22 | 本页四个游戏与它不重；游戏循环写成状态机的**概念**已在 ch22 `ttt-game-loop` 与 ch21 `traffic-light-fsm` 讲过，本页 `game-state-screens` 只用在画面切换上 |
| 队列 / `deque` | ch12 | `snake-move-deque` 只用，指回「栈与队列」页 |

---

## 2. 程序清单

「组」空 = 单个程序（`problem` = id）。「P」= property：入口是纯逻辑函数，收内置值、返回内置类型（`Vector2` / `Rect` → `tuple`），参照纯 Python（不 import pygame）、机制不同。
「⧉」= 声明 `chunks`。「🎲」= 用 `random.Random(<种子>)`。浮点：入口与参照都 `round(v, 9)`。

### 2.1 py-pygame-motion · `ch31-pygame-motion` · M7 · 9

取向 40–70 行。每个程序：常量 → 纯逻辑函数 → `main()`（`init` / `set_mode` / `Clock` / 主循环 / `quit`）→ 恰好一个 `if __name__ == "__main__": main()`。运动函数收 `dt`（秒）。

| id | 组 | 教什么 | P 入口 · 参照 |
|---|---|---|---|
| `diagonal-unnormalised` | diagonal-speed | 方向键 → `Vector2(dx, dy) * speed`：斜着走比直着走快 √2 倍（窗口里两个方块同时出发，斜的先到） | `velocity(left, right, up, down, speed)` → `(vx, vy)` · 参照：布尔转 ±1 逐分量乘 |
| `diagonal-normalised` | diagonal-speed | 同一映射先 `normalize()` 再乘速度；**零向量不能 normalize**（不按键时） | 同名入口 · 参照 `math.hypot` 除长度、零向量单独判 |
| `mouse-steer-toward` | | `Vector2.move_towards(target, speed * dt)`：追鼠标、不超调；没有目标（鼠标在窗外）时原地不动 | `step_toward(pos, target, speed, dt)` → `(x, y)` · 参照 `hypot` 算距离、够不着就按比例走 |
| `thrust-max-speed` | | 加速度积分到速度 + `clamp_magnitude` 限速（按长度限，不按分量限——分量限速斜向会超速） | `accelerate(vel, acc, dt, max_speed)` · 参照 `hypot` 缩放 |
| `gravity-jump` | | 每帧 `vy += g * dt; y += vy * dt`；落地夹住、`vy = 0`、`on_ground`；**只有在地上才能起跳** | `step(y, vy, on_ground, jump, dt)` → `(y, vy, on_ground)` · 参照另写的顺序求值 |
| `bounce-walls` | | 越过墙的那一截折返回来（`2W − x`），速度按墙的朝向取符号（`abs` 而不是单纯取反——卡在墙外时单纯取反会来回抖） | `bounce(x, vx)` · 参照三角波折返 |
| `friction-per-frame` | friction-decay | 每帧 `v *= 0.9`：简单，但**依赖帧率**（60 帧与 30 帧停下来的距离不同——讲解用文字说出两个数） | `slow_down(v, keep_per_frame, dt)` · 参照逐帧乘 |
| `friction-dt` | friction-decay | `v *= keep_per_second ** dt`：与帧率无关的衰减；速度小于阈值就归零 | 同名入口 · 参照 `math.exp(dt * log(k))` |
| `screen-wrap` | | 出右边从左边进来：`x % width`（负数取模在 Python 里也落在 `[0, width)`） | `wrap(x, y)` · 参照 `while` 加减 |

### 2.2 py-pygame-games · `ch32-pygame-games` · M7 · 9

四个完整游戏（⧉，约 90–120 行，每段 20–40 行）+ 五个聚焦单一机制的短程序（40–70 行）。一个游戏只做**机制完整的最小版本**（派发简报 §2.3）。
完整游戏的 property 挂在它最核心的那一个逻辑函数上；聚焦短程序把同一机制拆出来单独练。

| id | 组 | ⧉ | 教什么 | P 入口 · 参照 |
|---|---|---|---|---|
| `pong-full` | | ⧉ | 两拍一球一记分：球步进、撞上下墙反弹、撞拍反弹、出界记分；AI 右拍 | `ball_step(ball, vel, left_y, right_y)` → `((vx, vy), 状态)` · 参照坐标算术判相交 |
| `pong-ai-paddle` | | | 追球的 AI 拍：每帧最多移动 `speed * dt`、夹在屏幕内——**有速度上限才打得过** | `ai_follow(paddle_y, ball_y, speed, dt)` · 参照 `max(-step, min(step, …))` |
| `snake-full` | | ⧉ | 移动、吃食变长、撞墙撞自己；食物用 `random.Random(种子)` 落在空格 🎲 | `snake_step(body, direction, food, n)` → `(body, "moved" / "ate" / "dead")` · 参照另写的列表切片实现 |
| `snake-move-list` | snake-move | | 蛇身用列表：头插一格、没吃到就弹尾；**尾巴这一步会让开**，所以走进尾巴此刻的格子不算撞 | 同上入口 · 同上参照 |
| `snake-move-deque` | snake-move | | 同一步用 `deque`：`appendleft` / `pop` 两头都是 O(1)（讲解一句，指回「栈与队列」页） | 同上 |
| `breakout-full` | | ⧉ | 一排砖、一拍、一球：`Rect.collidelist` 找撞到的第一块砖、删掉它、反弹 | `brick_hit(ball, bricks)` → 下标或 `None` · 参照逐块坐标判相交 |
| `invaders-full` | | ⧉ | 一队外星人左右行进、碰边整体下移并掉头；一炮、一发子弹 | `fleet_step(aliens, direction, step, width, drop)` → `(aliens, direction)` · 参照先走一步再判越界 |
| `bullet-cooldown` | | | 按住空格也不能连发：冷却计时器 `remaining -= dt`，到 0 才能再开火 | `try_fire(remaining, fire_held, cooldown, dt)` → `(remaining, fired)` · 参照另写的计时 |
| `game-state-screens` | | | 标题 / 游戏中 / 暂停 / 结束四个画面：转移表（字典）驱动；状态机概念指回「模拟」页的交通灯 | `next_state(state, event)` · 参照 if 链 |

---

## 3. 边界（交裁决）

| # | 知识点 | 本清单的做法 | 需要裁决的 |
|---|---|---|---|
| B1 | 输入事件 | motion 只讲映射；事件本身归 m7a「pygame 入门」 | 确认 |
| B2 | 碰撞 | 用 `colliderect` / `collidelist`，不重讲；指回「精灵与碰撞」 | 确认 |
| B3 | 帧率无关 | m7a 已讲 `速度 × dt`；motion 的 `friction-per-frame` / `friction-dt` 是**衰减**的帧率无关，不是位移的 | 确认不算重复 |
| B4 | 状态机 | 概念在 M5 讲过；`game-state-screens` 只用在画面切换 | 确认 |
| B5 | Sprite / Group | 四个游戏都**不用** `Sprite` 类（用 `Rect` + 列表），免得本页变成第二个 sprites 页 | 确认，或允许 invaders 用 Group |

## 4. 随机

只有 `snake-full` 用：`rng = random.Random(<种子>)` 在空格里选食物（`rng.choice(free_cells)`），property 不经过 rng（入口 `snake_step` 收的 `food` 是实参）。无模块级 `random.*`。

## 5. 资源

不带任何外部文件。图形全在代码里画（`pygame.draw.rect` / `circle`）；字体 `pygame.font.Font(None, size)`。不讲 `image.load`（归 m7a sprites）。

## 6. chunks（依赖 chunks PR）

四个完整游戏声明 `chunks`，每个 3–4 段，按「常量与数据 / 逻辑函数 / 绘制 / main 循环」的自然边界；每段 20–40 行（取向，不进门）；
首段 `from` 是第 1 行 docstring；段间只有空行（`chunks_check`）。chunks PR 合并前不派 games 的构建者。

## 7. 递归

两页都不用递归（逐个程序问过；贪吃蛇、打砖块都是迭代）。

## 8. 起草原型（`.superpowers/python-waves/m7b/draft-proto.py`）

每个 P 函数：正确实现（用 pygame 的 `Vector2` / `Rect`，如程序会写的）、纯 Python 参照、一个错误实现、cases；种子 20260916、200 组、**逐层**比值与类型。

| 函数 | 正确 vs 参照 不同 | 错误实现 | 错误 vs 参照 不同 |
|---|---|---|---|
| diagonal-normalised | 0 | 不 normalize | 46 |
| diagonal-unnormalised | 0 | 左右接反 | 107 |
| mouse-steer-toward | 0 | 按比例插值（会超调 / 不到） | 137 |
| thrust-max-speed | 0 | 按分量限速 | 148 |
| gravity-jump | 0 | 空中也能跳 | 56 |
| bounce-walls | 0 | 贴墙、单纯取反 | 21 |
| friction-per-frame | 0 | 减法代替乘法 | 200 |
| friction-dt | 0 | `k * dt` 代替 `k ** dt` | 199 |
| screen-wrap | 0 | y 按宽度取模 | 60 |
| snake-move-list / -deque | 0 | 把尾巴也算作撞 | 61（首版 cases 只有 2——蛇头很少恰好走进尾巴格；改成 30% 专门造 2×2 回环） |
| pong-ball-step | 0 | 记分方向接反 | 84（首版 1——球很少出界；改成 40% 造出界位置） |
| pong-ai-paddle | 0 | 瞬移、无速度上限 | 195 |
| breakout-brick-hit | 0 | 没撞到交回 −1 | 95 |
| invaders-fleet-step | 0 | 判边时漏了外星人宽度 | 24（首版 **0**——cases 里的外星人从没走到右墙；改成可以贴近右墙） |
| game-state-screens | 0 | 未知事件回标题 | 106 |

`bullet-cooldown` 与 `game-state-screens` 同类（纯逻辑、离散），构建者照同一协议补原型。三处「首版命中太少」就是简报 §2.4 要原型的原因：写进构建者简报，cases 必须带这些专门构造的分支。

---

## 9. 裁决（2026-09-30，Python编程 审定）

| # | 问题 | 决定 |
|---|---|---|
| 页名 | | 「运动与物理」/ Motion & Physics、「图形游戏」/ Graphical Games |
| 组名 | | diagonal-speed、friction-decay、snake-move 与全库、与 m7a（frame-independent-motion、rect-overlap）都不撞 |
| B1–B4 | | 确认 |
| B5 | Sprite 类 | 四个游戏**都不用** Sprite 类（Rect + 列表）；讲解点一句「用 Sprite / Group 写的版本见「精灵与碰撞」页」 |
| 原型 | | 三处低命中（invaders 0/200、snake 2/200、pong 1/200）与改后的 cases 构造写进构建者简报，构建者报告写出最终命中数；bullet-cooldown 由构建者照同一协议补原型 |
| 随机 / 资源 / 递归 / chunks | | 同意 |
| 英文跨页写法 | 第 4 期收尾的新裁决 | 英文讲解写 `the <英文页名> page`（不加引号、不夹「」），中文写「页名」 |
| 时序 | | motion 的构建者也等第 4 期收尾 PR 合并、main SHA 到了再派（本期两波同一版模板）；games 另等 chunks PR |
