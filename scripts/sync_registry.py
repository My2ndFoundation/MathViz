#!/usr/bin/env python3
"""把 tools.json 同步到各个镜像副本。

tools.json 是唯一真相。目前有两份镜像：

  app.html   —— 内嵌的精简清单，只在 file:// 直接打开（fetch 不可用）时兜底。
                本脚本会**自动重写**标记块 `/* >>> GENERATED:TOOLS */ … /* <<< GENERATED:TOOLS */`。

  index.html —— 手写的 TOOLS 数组（含 desc / tag 等完整文案）。文案需要人工润色，
                所以结构字段 id / file / cat / accent **只校验不改写**。
                但 version / engine 是纯事实而非文案，人手维护只会漂 ——
                这两个字段由本脚本**自动改写**。

                漂移不是假想：加上这条同步时，index.html 里 48 条工具的 version
                落后于 tools.json（pi / phi 都停在 1.0.0，真值是 1.2.0）。原因就是
                老的 check_index 不看这两个字段 —— 没人校验的镜像字段一定会漂。
                画廊卡片要印版本号，印错比不印更糟。

用法：
    python3 scripts/sync_registry.py            # 重写 app.html 与 index.html 的 version/engine（需要时），报告结构差异
    python3 scripts/sync_registry.py --check    # 只检查，不写；不同步则以退出码 1 结束（供 CI / 钩子用）

退出码：0 = 已同步；1 = 存在需要处理的差异。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS_JSON = ROOT / "tools.json"
APP_HTML = ROOT / "app.html"
INDEX_HTML = ROOT / "index.html"

BEGIN = "/* >>> GENERATED:TOOLS */"
END = "/* <<< GENERATED:TOOLS */"


def load_registry() -> list:
    with TOOLS_JSON.open(encoding="utf-8") as fh:
        return json.load(fh)["tools"]


def minimal(tools: list) -> list:
    """tools.json 的条目 -> app.html 侧栏所需的精简条目（category 在前端叫 cat）。

    只保留侧栏真正用到的字段，缩小漂移面：文案改动不会波及外壳。
    """
    return [
        {
            "id": t["id"],
            "file": t["file"],
            "cat": t["category"],
            "accent": t["accent"],
            "title": t["title"],
            "kicker": t["kicker"],
            # version 进这份精简清单，是为了让外壳能给 iframe 的地址加 ?v=<版本>。
            # GitHub Pages 把 HTML 按 max-age=600 发出去，工具页地址若恒定不变，
            # 浏览器就可能长期端出旧副本——升级了版本、用户却要清缓存才看得见。
            # 版本进了地址，版本一变地址就变，缓存自然失效。
            "version": t["version"],
        }
        for t in tools
    ]


def render_block(tools: list) -> str:
    body = json.dumps(minimal(tools), ensure_ascii=False, indent=2)
    return "{}\nvar TOOLS = {};\n{}".format(BEGIN, body, END)


def sync_app(tools: list, write: bool) -> bool:
    """返回 True 表示 app.html 已同步（或已被本次写入修好）。"""
    src = APP_HTML.read_text(encoding="utf-8")
    if BEGIN not in src or END not in src:
        print("error: app.html 缺少 GENERATED:TOOLS 标记块，无法自动同步", file=sys.stderr)
        return False

    pattern = re.compile(re.escape(BEGIN) + r".*?" + re.escape(END), re.S)
    new_src = pattern.sub(lambda _m: render_block(tools), src, count=1)

    if new_src == src:
        print("app.html: 已同步（{} 个工具）".format(len(tools)))
        return True

    if not write:
        print("app.html: 与 tools.json 不同步 —— 运行 python3 scripts/sync_registry.py 修复",
              file=sys.stderr)
        return False

    APP_HTML.write_text(new_src, encoding="utf-8")
    print("app.html: 已重写内嵌清单（{} 个工具）".format(len(tools)))
    return True


TOOLS_ARRAY_HEAD = "const TOOLS = ["


def index_tools_span(src: str) -> tuple:
    """index.html 里 TOOLS 数组的 [起, 止) 下标；找不到抛 LookupError。

    只在这个区间内改写，免得 version: 这种常见片段在别处被误伤。
    """
    start = src.find(TOOLS_ARRAY_HEAD)
    if start < 0:
        raise LookupError("index.html 找不到 `{}`".format(TOOLS_ARRAY_HEAD))
    end = src.find("\n];", start)
    if end < 0:
        raise LookupError("index.html 的 TOOLS 数组没有收尾的 `];`")
    return start, end


def rewrite_index_versions(src: str, tools: list) -> tuple:
    """把 tools.json 的 version / engine 写回 index.html 的 TOOLS 条目。

    返回 (新文本, 改动条数)。只认 tools.json 里存在的 id；index.html 多出来的条目
    交给下面的结构校验去报错，这里不动它。
    """
    start, end = index_tools_span(src)
    body = src[start:end]
    want = {t["id"]: (t["version"], t.get("engine", "")) for t in tools}

    # 逐条切片：从一个 id: '…' 到下一个 id: '…' 之间就是这条工具的字面量
    marks = [(m.start(), m.group(1)) for m in re.finditer(r"id:\s*'([^']+)'", body)]
    changed = 0
    out = []
    cursor = 0
    for i, (pos, tid) in enumerate(marks):
        stop = marks[i + 1][0] if i + 1 < len(marks) else len(body)
        chunk = body[cursor:stop]
        if tid in want:
            ver, eng = want[tid]
            new_chunk = re.sub(r"(version:\s*)'[^']*'", lambda m: m.group(1) + repr_js(ver), chunk)
            new_chunk = re.sub(r"(engine:\s*)'[^']*'", lambda m: m.group(1) + repr_js(eng), new_chunk)
            if new_chunk != chunk:
                changed += 1
            chunk = new_chunk
        out.append(chunk)
        cursor = stop
    out.append(body[cursor:])
    return src[:start] + "".join(out) + src[end:], changed


def repr_js(value: str) -> str:
    """写成 JS 单引号字面量。版本号只含 [0-9a-z.-]，这里仍显式挡一下引号。"""
    if "'" in value or "\\" in value:
        raise ValueError("版本字段不该含引号或反斜杠：{!r}".format(value))
    return "'" + value + "'"


def sync_index_versions(tools: list, write: bool) -> bool:
    """返回 True 表示 index.html 的 version / engine 已与 tools.json 一致。"""
    src = INDEX_HTML.read_text(encoding="utf-8")
    try:
        new_src, changed = rewrite_index_versions(src, tools)
    except LookupError as exc:
        print("error: {}".format(exc), file=sys.stderr)
        return False

    if not changed:
        return True
    if not write:
        print("index.html: {} 条工具的 version/engine 落后于 tools.json —— "
              "运行 python3 scripts/sync_registry.py 修复".format(changed), file=sys.stderr)
        return False
    INDEX_HTML.write_text(new_src, encoding="utf-8")
    print("index.html: 已按 tools.json 回写 {} 条工具的 version/engine".format(changed))
    return True


def check_index(tools: list) -> bool:
    """index.html 的 TOOLS 只做结构校验：id 集合与 file / cat / accent 是否一致。"""
    src = INDEX_HTML.read_text(encoding="utf-8")
    entries = {}
    for m in re.finditer(
        r"\{\s*id:\s*'([^']+)',\s*file:\s*'([^']+)',\s*accent:\s*'([^']+)',\s*cat:\s*'([^']+)'",
        src,
    ):
        entries[m.group(1)] = {"file": m.group(2), "accent": m.group(3), "cat": m.group(4)}

    want = {t["id"]: {"file": t["file"], "accent": t["accent"], "cat": t["category"]} for t in tools}

    ok = True
    missing = sorted(set(want) - set(entries))
    extra = sorted(set(entries) - set(want))
    if missing:
        print("index.html: 缺少工具 -> {}".format(", ".join(missing)), file=sys.stderr)
        ok = False
    if extra:
        print("index.html: 多出 tools.json 里没有的工具 -> {}".format(", ".join(extra)), file=sys.stderr)
        ok = False
    for tid in sorted(set(want) & set(entries)):
        if want[tid] != entries[tid]:
            print("index.html: 「{}」字段与 tools.json 不一致 {} != {}".format(tid, entries[tid], want[tid]),
                  file=sys.stderr)
            ok = False

    if ok:
        print("index.html: 已同步（{} 个工具）".format(len(entries)))
    else:
        print("index.html 是手写文案，需要人工补齐后再提交", file=sys.stderr)
    return ok


def main() -> int:
    ap = argparse.ArgumentParser(description="把 tools.json 同步到 app.html / 校验 index.html")
    ap.add_argument("--check", action="store_true", help="只检查不改写，不同步则退出码 1")
    args = ap.parse_args()

    tools = load_registry()
    app_ok = sync_app(tools, write=not args.check)
    # 先回写 version/engine，再做结构校验——校验会打印「已同步」的总结行，
    # 顺序反了就会在同一次运行里先报同步、后才改文件。
    ver_ok = sync_index_versions(tools, write=not args.check)
    index_ok = check_index(tools)
    return 0 if (app_ok and ver_ok and index_ok) else 1


if __name__ == "__main__":
    raise SystemExit(main())
