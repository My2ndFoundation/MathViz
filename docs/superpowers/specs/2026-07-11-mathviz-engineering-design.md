# MathViz 工程化改造 · 设计文档

日期：2026-07-11
状态：已确认（用户批准）

## 目标

把「新增 / 升级一个可视化工具」的流程固化为可重复的工程动作，并为整个工具集补齐两块基础设施：

1. **中英文双语支持与运行时切换**（存量工具 + 落地页 + starter + 设计系统）
2. **每工具独立的语义化版本号与变更记录**

三者以一张**工具注册表 `tools.json`** 为枢纽：登记工具即完成「上落地页 + 进 README + 记版本」。

## 已确认的决策

| 决策点 | 结论 |
|---|---|
| 双语深度 | 全量双语：HTML UI + Canvas 内标注全部可切换 |
| 切换机制 | 右上角切换按钮 + `?lang=` URL 参数 + localStorage 记忆 + 首访跟随浏览器语言 |
| 版本方案 | 中心注册表 + 文件内嵌双落地，语义化版本 |
| 落地页数据 | 内嵌 `TOOLS` JS 数组（与 tools.json 同步），保持 file:// 双击可开 |
| 老工具 `trig-essence-3d.html` | 退役归档到 `archive/`，不做双语改造 |

## A. 工具注册表 `tools.json`

仓库根目录，唯一登记处。结构：

```json
{
  "schemaVersion": 1,
  "tools": [
    {
      "id": "complex-mult-3d",
      "file": "outputs/complex-mult-3d.html",
      "accent": "orange",
      "kicker":  { "zh": "复数",          "en": "Complex Numbers" },
      "title":   { "zh": "复数乘法的本质", "en": "The Essence of Complex Multiplication" },
      "desc":    { "zh": "…",             "en": "…" },
      "tag":     { "zh": "旋转 · 伸缩",   "en": "rotate · scale" },
      "version": "1.1.0",
      "engine":  "1.0.0",
      "changelog": [
        { "version": "1.1.0", "date": "2026-07-11", "zh": "全量双语支持", "en": "Full bilingual support" },
        { "version": "1.0.0", "date": "2026-07-11", "zh": "首个版本",     "en": "Initial release" }
      ]
    }
  ]
}
```

- `accent` 取自设计系统曲线色（rose / violet / emerald / orange / cyan），用于落地页卡片顶部渐变与圆点。
- `engine` 记录该工具复制自哪个版本的 starter；starter 自身开始带 `STARTER_VERSION`。引擎升级时据此排查落后工具。
- changelog 按新→旧排列，双语摘要。

## B. i18n 机制（引擎层）

**核心：就地双语对象，不设集中词典。** 所有面向人的文案在声明处写成 `{ zh: '运动轨迹', en: 'Trail' }`。引擎提供：

```js
function t(s){ return (s && typeof s === 'object') ? (s[LANG] ?? s.zh) : s; }
```

传对象取当前语言（缺英文回退中文），传字符串原样返回——数学符号、数字、公式天然免翻译。

**覆盖范围**（全部支持双语对象）：

- `PARAMS[].label`、`SCENES` 的 `label / brand / tips`、`views[].label`、`toggles[].label`
- `readout()` 返回的 HTML 中的说明文字
- Canvas 内 `label3()` 等标注（每帧重画，绘制时经 `t()`，零额外成本）
- 页面 `<title>`、`<h1>`、hint 文案；眉题 `INTERACTIVE MATH · 交互式数学` 是品牌常量，**不参与切换**

**语言解析优先级**：`?lang=` → `localStorage('mathviz-lang')` → `navigator.language`（zh* → zh，否则 en）→ 默认 `zh`。

**切换行为**：右上角 `中 / EN` 按钮；切换时 `history.replaceState` 更新 URL、写 localStorage、更新 `<html lang>` 与 `document.title`、重建面板 DOM；Canvas 下一帧自然跟随。localStorage 不可用（隐私模式等）时静默降级，仅本页生效。

**语言跟随**：落地页所有工具链接携带当前 `?lang=`。

**文案规范增补**（设计系统 §7）：英文 sentence case；数字格式规则（U+2212、两位小数、±∞）中英一致；核心术语对照表（顿悟视角 → epiphany view 等）。

## C. 版本机制

- 语义化版本：不兼容的大改 major / 新增功能或场景 minor / 修复与文案微调 patch。
- 三处落地，**注册表为准**：
  1. `tools.json` 的 `version` + `changelog`
  2. 工具 HTML：`<meta name="tool-version" content="…">` + 文件头部注释 changelog 块
  3. 页面右上角语言按钮旁小字 `v1.1.0`
- **强制规则**（写入设计系统 §8 与 skill）：对已有工具的任何修改必须 bump 版本，并同步 ①② 两处 changelog；作为验收门槛。
- 本次改造后已发布的 3 个存量工具定为 `1.1.0`（1.0.0 = 首个版本，1.1.0 = 双语支持）；`cartesian-polar-coordinate-3d` 尚未发布，首次登记即含双语，定为 `1.0.0`；starter 定为 `STARTER_VERSION = '1.0.0'`（含 i18n 后的首个受管版本）。

## D. 落地页 index.html

- 卡片从内嵌 `TOOLS` JS 数组渲染（数据与 tools.json 逐字段一致，由 skill 收尾步骤同步维护）；工具计数自动计算。
- 落地页整体双语（lead、hint、分节标题、卡片、页脚），同一套切换机制与记忆。
- 零 fetch，file:// 双击可开。

## E. 流程固化（skill 增补）

`.claude/skills/math-viz-tool/SKILL.md`：

- 新增 **Step 4「注册与发布」**：① 登记 tools.json（双语文案 + version 1.0.0 + changelog）→ ② 同步 index.html 内嵌 `TOOLS` 数组 → ③ 更新 README 工具表 → ④ 验收 → ⑤ 提交。
- 新增 **「升级已有工具」** 小节：bump 版本 + 双处 changelog + 注册表同步；skill description 增加「改进 / 调整 / 升级 / upgrade / improve」类触发词。

## F. 退役与存量改造

- `git mv outputs/trig-essence-3d.html archive/`，从落地页与 README 移除（README 可留一行归档说明）。
- 存量工具全部双语改造 + 版本内嵌：`trig-essence-3d-new`、`fourier-essence-3d`、`complex-mult-3d`、`cartesian-polar-coordinate-3d`、`conic-essence-3d`（后两者尚未发布，顺带首次登记为 1.0.0、上落地页、提交）。
- 补充发现：`trig-essence-3d-new` 的面板为手写静态 HTML（非声明式架构），双语改造采用 data-i18n 标记 + 页面级词典的一次性方案，不强行重建为声明式。

## 实施顺序（design-system-first）

1. 设计系统文档：新增 i18n 章节、版本管理章节，§7 英文文案规范，§8 清单更新
2. starter：加 `t()` / 语言解析与切换 / 版本内嵌位 / `STARTER_VERSION`
3. 存量 4 个工具逐个改造（含英文文案撰写）
4. `tools.json` + index.html 重构 + README 更新
5. skill 增补 + 老工具归档
6. 全量验收 + 提交

## 验收标准

每个工具：

- `awk … | node --check` 语法检查通过
- 浏览器实测：中英切换后 HTML 与 Canvas 标注全部跟随；六处一色不破；数学符号仍为 serif italic；`?lang=en` 直达生效；切换后刷新记忆保持；file:// 双击可开；暂停仅冻结模拟等既有不变量不回归
- 版本号在 meta / 角标 / 注册表三处一致

落地页：两种语言下卡片、计数、页脚正确；工具链接携带语言参数；file:// 可开。
