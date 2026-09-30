# Python 子项目 · 第 5 期 · 波 m7a（M7「图形与游戏」上半）程序清单

> 状态：**已批准**（2026-09-30，Python编程 审，受用户委托；批准时的清单提交 e9a1011）。裁决见 §8。
> 日期：2026-09-30
>
> 上游：
> - 主规格 `docs/superpowers/specs/2026-09-16-python-subproject-design.md` §2.2（M7：`py-pygame-basics` 窗口、主循环、事件、帧率、绘图图元、颜色；
>   `py-pygame-sprites` Sprite/Group、图像加载、动画帧、碰撞检测）、§5.4 末段（pygame 层，PR #196）、§7.1（`pygame_main_guard_check`）、§9
> - 第 5 期派发简报（主工作区 `.superpowers/python-phase5/phase5-brief.md`，Python编程 定）§2：程序结构（纯逻辑函数 + `main()` + 恰好一个 main 守卫）、
>   没有 `run.expect`、正确性靠 property（每页至少一半）、帧率无关（`dt` 当实参）、不带外部资源文件、字体只用 `pygame.font.Font(None, size)`、
>   本波共有 tag `pygame` / `game-loop` / `event` / `collision` / `sprite` / `vector`、长度取向 40–70 行、本波不用 `chunks`
> - 作者须知与控制方作业：集成 worktree 里的 `.claude/skills/python-drill-tool/SKILL.md`、`python-content-wave/`
> - 格式范本：第 4 期 `2026-09-30-python-phase4-m6a-design.md`
>
> 同期并行：波 m7b（`py-pygame-motion` ch31、`py-pygame-games` ch32，外加 `chunks` 落地）由另一会话负责。本文只管 ch29、ch30。

---

## 0. 本波做什么

| 页 | 页名（zh / en） | 章目录 | 模块 | accent | 程序 | 变体组 | 带 P |
|---|---|---|---|---|---|---|---|
| `py-pygame-basics` | 「pygame 入门」/ Pygame Basics | `ch29-pygame-basics` | 7 | violet | 9 | 1 | 7 |
| `py-pygame-sprites` | 「精灵与碰撞」/ Sprites & Collisions | `ch30-pygame-sprites` | 7 | violet | 9 | 1 | 7 |
| **合计** | | | | | **18** | **2** | **14** |

refs 文件：`python/scripts/gates/refs/ch29_pygame_basics.py`、`ch30_pygame_sprites.py`。
集成分支 `claude/python-wave-m7a`，构建者分支 `claude/python-wave-m7a-py-<页>`，一波一个 PR。
所有程序 `requires: ["pygame"]`、`runtime: "cpython"`；门对它们只过 `compile()`（没有 `run.expect`），property 在无头 SDL 下导入后跑（#196）。

**起草期原型**（台账 `.superpowers/python-waves/m7a/draft-proto.py`，pygame 2.6.1、`SDL_VIDEODRIVER=dummy`、逐层比类型、200 组）：
14 个 P 全部「正确 == 参照 200/200」，错误实现全部被抓到——命中数见 §2 各表下注。**原型只证可行（参照机制不同、cases 触得到错），不给构建者抄。**
起草时实测的 pygame 行为（构建者照此写参照，不要凭记忆）：
- `Color.lerp` 对半数向上舍入：`(10,20,30).lerp((255,0,101), 0.5)` → `(133, 10, 66)`，即逐分量 `int(a·(1 − t) + b·t + 0.5)`。**起草时写的公式有误（2026-09-30 构建者实测、控制方复核），已改**：原写 `int(a + (b − a)·t + 0.5)`，实数上相等，但实数值恰为 .5 时浮点结果可落在 .5 两侧（a = 205、b = 255、t = 0.29：pygame 219、原式 220）。
- `Rect.center = (cx, cy)` 之后 `topleft == (cx − w // 2, cy − h // 2)`（5×3 放在 (10,10) → (8, 9)）。
- `collidepoint` 不含右边与下边：4×4 的 `Rect(0,0,4,4)` 对 (3,3) 真、对 (4,4)、(4,0) 假。
- `colliderect` 只碰边不算碰（`Rect(0,0,4,4)` 与 `Rect(4,0,4,4)` 为假）；零宽高的矩形与谁都不碰。
- `Rect.move(1.7, 0)` 截断成整数——**位置要用浮点就别存在 Rect 里**（存在 `Vector2` / 浮点里，画的时候再取整）。
- `groupcollide(a, b, True, True)` **按 a 的顺序逐个结算**：先命中的子弹已把目标杀掉，后面同一目标上的子弹就不算命中（原型里按「同时结算」写的参照在 2/200 组上错，改成顺序结算后 200/200）。这本身是 `group-collide-kill` 的讲点。

---

## 1. 约定

1. **结构**（`pygame_main_guard_check` 守）：每个程序 = 纯逻辑函数 + `main()`（`pygame.init()`、`set_mode`、`Clock`、主循环、`pygame.quit()` 全在里面）+ **恰好一个** `if __name__ == "__main__":` 调 `main()`。
   模块顶层只许 import / def / class / docstring / 常量赋值（调用只许 `pygame.Color` / `Rect` / `Vector2`）。
2. **property 入口**：收内置值（整数、元组、列表、集合），返回内置类型（`Rect` / `Vector2` / `Color` → `tuple`；门逐层比类型）；
   参照**纯 Python**、不 import pygame、机制与被测不同；被测里用 `Rect.colliderect`、`Color.lerp`、`sprite.Group` 是可以的。浮点 `round(v, 9)` 或整数 cases。不改实参。
3. **帧率无关**：运动收 `dt`（秒）；`main()` 里 `dt = clock.tick(60) / 1000`。
4. **不带外部资源文件**；字体只用 `pygame.font.Font(None, size)`；图片先在代码里画、`pygame.image.save` 再 `load`（只在 `image-save-and-load` 里讲）。
5. **`problem`**：变体组 2 个——`frame-independent-motion`（ch29）、`rect-overlap`（ch30），已对全库 244 个 problem 名查过无重名；单个程序 `problem` = `id`。
6. **tags**：本波共有 `pygame`（每个程序都带）、`game-loop`、`event`、`collision`、`sprite`、`vector`（简报 §2.4）；新造之前 grep 全库（已有 `state-machine`、`loop`、`game`、`vector`）。
7. **长度**取向 40–70 行；超过写进报告；**不用 `chunks`**。
8. 讲解按「页面不显示输出」写：**窗口里看到什么，用文字说清楚**；运行要 `pip install pygame`（页面底栏已显示）。

「组」空 = 单个程序；「P」写参照实现的**机制**（空 = 无 property）。「教什么」是这个程序存在的理由，构建者不得偏离；有更好的替换，**上报，不擅自换**。

---

## 2. 程序清单

### 2.1 py-pygame-basics · `ch29-pygame-basics` · M7 · 9

| id | 组 | 教什么 | P |
|---|---|---|---|
| `window-and-game-loop` | | 最小骨架：`pygame.init()`、`set_mode`、`set_caption`、「处理事件 → 更新 → 画 → `flip`」三段式主循环、`QUIT` 事件、`pygame.quit()`；为什么逻辑放在函数里、主循环放在 `main()` 里 | |
| `move-per-frame` | frame-independent-motion | 每帧固定挪几像素：帧率一变速度就变（讲解算给她看：60 帧与 30 帧下一秒各走多远） | |
| `move-with-dt` | frame-independent-motion | 同一问题按「像素 / 秒 × `dt`」挪：`dt = clock.tick(60) / 1000`；入口 `position_after(frames_ms, speed)` 逐帧累加 | 总毫秒数 × 速度 ÷ 1000 一步算完 |
| `draw-primitives-grid` | | 绘图图元（`rect` / `circle` / `line` / `polygon` / 边框宽度）与坐标系（原点在左上、y 向下）；入口 `grid_rects(cols, rows, size, gap)` 算出一格格方块的矩形 | 两重 `while` 逐行逐列累加坐标 |
| `colour-lerp` | | 颜色：RGB 元组、`pygame.Color`、`fill`；两色之间渐变 `Color.lerp`；入口 `blend(c1, c2, t)` 返回 RGB 三元组 | `int(a·(1 − t) + b·t + 0.5)` 逐分量（pygame 实测式；起草时误写成 `a + (b − a)·t`，见 §0） |
| `keyboard-move-clamped` | | 键盘：`KEYDOWN` 事件与 `key.get_pressed()` 的区别；方块随方向键移动、`Rect.clamp` 关在窗口里；入口 `step(pos, keys, step)`（`keys` 是方向名集合） | 方向布尔相减得位移、再 `min` / `max` 夹住 |
| `mouse-click-buttons` | | 鼠标：`MOUSEBUTTONDOWN` 的 `pos`、`Rect.collidepoint` 判点在哪个按钮里（右、下边不算）；入口 `clicked(buttons, pos)` 返回按钮下标或 −1 | `pos[0] in range(x, x + w)` 式的半开区间判断 |
| `text-centred` | | 文字：`pygame.font.Font(None, size)`、`render`、`get_rect(center=…)` 居中后 `blit`；入口 `centre_topleft(text_w, text_h, screen_w, screen_h)` | `cx − w // 2` 的整数算术 |
| `screen-states` | | 标题 / 游戏中 / 暂停 / 结束 四个界面：一个状态变量 + 查表 `(状态, 事件) → 新状态`，主循环按状态分派画面；入口 `run_events(state, events)` | `if / elif` 链逐条转移（查表 vs 条件链） |

- 原型命中：`move-with-dt` 167、`draw-primitives-grid` 111、`colour-lerp` 168、`keyboard-move-clamped` **14**、`mouse-click-buttons` **21**、`text-centred` 85、`screen-states` 114（/200）。
  两个低的是因为错误只在**贴边**时露馅：`keyboard` 的 cases 要多造「起点在边上、步长越界」，`mouse` 的 cases 要多造「点正落在右边 / 下边」——构建者调高到每类至少 1/3。
- `screen-states` 与第 3 期 m5b 的 `traffic-light-fsm`（「模拟」页）都是状态机：本页只「用」，讲解点一句「状态机见「模拟」一页」，讲的是**界面切换**。
- `move-per-frame` 不挂 P（它的教学点是「错」的那种写法；`main()` 之外只有一行乘法，不值得挂）。

### 2.2 py-pygame-sprites · `ch30-pygame-sprites` · M7 · 9

| id | 组 | 教什么 | P |
|---|---|---|---|
| `sprite-subclass-group` | | `pygame.sprite.Sprite` 子类：`image` / `rect` 两个约定属性、`update(dt)`；`Group` 一次 `update` / `draw` 全部；位置存 `Vector2`、画时取整；入口 `positions_after(starts, vels, steps, dt)` | 起点 + 速度 × dt × 步数 一步算完 |
| `image-save-and-load` | | 图像：代码里画一张 `Surface` → `pygame.image.save(surf, "ship.png")` → `pygame.image.load` → `convert_alpha()` → `get_rect(center=…)`；透明色 `set_colorkey`；为什么本页不带图片文件 | |
| `animation-frames` | | 动画帧：累计毫秒决定显示第几帧；循环播放与播一次停在末帧两种；入口 `frame_index(elapsed_ms, frame_ms, n_frames, loop)` | 逐帧减去帧时长的模拟循环 |
| `sprite-sheet-frames` | | 精灵表：一张横竖排好的大图，用 `subsurface(Rect)` 切出一格格帧；入口 `frame_rects(sheet_w, sheet_h, frame_w, frame_h)` 按行优先返回矩形 | 两重 `while` 逐格推进 |
| `rect-collision-colliderect` | rect-overlap | 矩形碰撞 `Rect.colliderect`：只碰边不算碰；入口 `overlaps(a, b)` | 枚举两矩形覆盖的整数格点求交 |
| `rect-collision-manual` | rect-overlap | 同一问题手写：四个严格不等式（AABB）；为什么是 `<` 不是 `<=` | 同上 |
| `circle-collision` | | 圆形碰撞：圆心距离平方 ≤ 半径和平方（不开方）；`pygame.sprite.collide_circle` 作对照；入口 `circles_touch(c1, r1, c2, r2)` | `math.dist` 开方后比较 |
| `group-collide-kill` | | `spritecollide` / `groupcollide`、`dokill`：子弹打目标、两边都消失、计分；**按子弹顺序结算**（先中的子弹杀掉目标，后面的撞不到）；入口 `resolve(bullets, targets)` 返回 `(命中数, 剩下的子弹, 剩下的目标)` | 纯 Python 顺序模拟（AABB 判断） |
| `mask-pixel-collision` | | 像素级碰撞：`pygame.mask.from_surface`、`mask.overlap(offset)`；矩形碰了但像素没碰的例子（两个圆的外接矩形相交） | |

- 原型命中：`sprite-subclass-group` 136、`animation-frames` 57、`sprite-sheet-frames` 38、`rect-collision-*` 56 / 69、`circle-collision` 55、`group-collide-kill` 30（/200）。
  `rect-overlap` 的 cases 约三成造「恰好贴边」；`circle-collision` 的 cases 造「恰好相切」（勾股数距离）；`group-collide-kill` 要多造「两颗子弹打同一目标」。
- `mask-pixel-collision` 不挂 P：像素级结果取决于 pygame 的圆形光栅化，纯 Python 参照写不出与之逐像素相同的实现（原型评估）；由 `compile` 与活体跑帧守。
- `sprite-sheet-frames` 的精灵表在代码里画（`Surface` + 每格一个不同颜色的方块），不带图片文件。

---

## 3. 边界（待裁决）

- **3.1 与 m7b 的分工。** 本波**不讲**向量运动的物理（加速度、重力、反弹、摩擦——`py-pygame-motion`）与完整游戏（`py-pygame-games`）。
  `move-with-dt` 与 `sprite-subclass-group` 只用「速度 × dt」一次积分；`keyboard-move-clamped` 只做「按住就走、松开就停」，不做加速度。
- **3.2 碰撞归本波。** 矩形、圆、组碰撞、像素碰撞都在 `py-pygame-sprites` 讲；m7b 的游戏只「用」。**反弹**（碰撞之后的速度怎么改）归 m7b motion。
- **3.3 状态机只用。** `screen-states` 只讲界面切换，状态机的概念见「模拟」页（m5b `traffic-light-fsm`）。
- **3.4 事件。** `KEYDOWN` / `get_pressed` / 鼠标事件在 `py-pygame-basics` 讲；motion 页「键鼠输入」若与此重叠，请 Python编程 与 m7b 对一下——建议 motion 只讲「输入 → 加速度」的映射，不再讲事件本身。

## 4. 随机

本波**没有**用到随机的程序。构建者若要（例如随机摆放目标），上报；加了就只许 `random.Random(<固定种子>)`（或 `rng` 当实参）。

## 5. 资源

- 不带任何图片 / 声音 / 字体文件。`image-save-and-load` 自己画、自己存、自己读（文件落在运行目录，讲解说明）；`sprite-sheet-frames` 的精灵表在内存里画。
- 字体只用 `pygame.font.Font(None, size)`（`text-centred`、`screen-states` 的标题），不用 `SysFont`。
- 不用 `_fixtures/`。

## 6. 递归

无（⟳ 无）。

## 7. boards（拿不准的，照现行规则四家全写，列表进台账）

| 内容 | 程序 | 疑问 |
|---|---|---|
| pygame 本身 | 全波 | 不在任何考纲；游戏循环、事件驱动、坐标系是 CS 考纲可能提到的概念（事件驱动编程：OCR / AQA？） |
| 状态机 | `screen-states` | AQA 含有限状态机（理论部分）；其余不确定 |
| 碰撞检测 | `rect-collision-*`、`circle-collision` | 不在考纲，属项目（NEA）常见需求 |

---

## 8. 裁决记录

| # | 问题 | 决定 |
|---|---|---|
| M7A-D1 | 页名 | 「pygame 入门 / Pygame Basics」「精灵与碰撞 / Sprites & Collisions」 |
| M7A-D2 | 组名 | `frame-independent-motion`、`rect-overlap` 全库无撞；与 m7b 的交叉核由 Python编程 做 |
| M7A-D3 | §3.1–§3.3 | 同意 |
| M7A-D4 | §3.4 事件 | 同意：KEYDOWN / get_pressed / 鼠标事件归 basics；motion 页「键鼠输入」只讲「输入 → 速度 / 加速度」映射，讲解指回「pygame 入门」页（Python编程 转告 m7b） |
| M7A-D5 | 低命中的两条 P | `keyboard-move-clamped`（14/200）、`mouse-click-buttons`（21/200）贴边 cases ≥ 1/3 的要求保留；构建者报告写出调后的命中数 |
| M7A-D6 | `group-collide-kill` 参照 | 顺序结算是 pygame 的语义，不是抄它的实现，参照照此写；refs 文件头写明「同时结算的写法在 2/200 组上错，这是本程序的讲点」，免得后人「修正」参照 |
| M7A-D7 | 起草时实测的 pygame 行为 | §0 列的五条（lerp 舍入、center / topleft、collidepoint 不含右下、零宽高不碰、move 截断）写进 refs 文件头与对应讲解 |
| M7A-D8 | 不挂 P 的两个 | `mask-pixel-collision`、`move-per-frame` 不挂 P：接受，由 compile 与活体跑帧守，报告里写明 |
| M7A-D9 | §7 boards | 照现行规则四家全写，表进台账 |
