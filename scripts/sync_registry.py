#!/usr/bin/env python3
"""把 tools.json 同步到各个镜像副本。

tools.json 是唯一真相。目前有两份镜像：

  app.html   —— 内嵌的精简清单，只在 file:// 直接打开（fetch 不可用）时兜底。
                本脚本会**自动重写**标记块 `/* >>> GENERATED:TOOLS */ … /* <<< GENERATED:TOOLS */`。

  index.html —— 手写的 TOOLS 数组（含 desc / tag 等完整文案）。文案需要人工润色，
                所以本脚本**只校验不改写**：比对 id / file / cat / accent 是否一致。

用法：
    python3 scripts/sync_registry.py            # 重写 app.html（需要时），报告 index.html 差异
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
    index_ok = check_index(tools)
    return 0 if (app_ok and index_ok) else 1


if __name__ == "__main__":
    raise SystemExit(main())
