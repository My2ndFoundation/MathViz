#!/usr/bin/env python3
"""从 docs/logo.png 派生品牌标记，并把它铺进每一个页面。

用法：
    python3 scripts/apply_branding.py            # 派生资产 + 写入所有页面
    python3 scripts/apply_branding.py --check    # 只校验；不同步则 exit 1

## 为什么是内联 data URI，不是 favicon.ico

本仓最硬的一条规则是「单文件、零依赖」：每个工具是一整页，双击 file:// 要能打开，
`chess/` 与 `cryptography/` 还要能被整个目录搬走后独立运行（cryptography/scripts/check.py
的 outbound_ref_check() 逐文件数父目录引用）。一个 `<link rel="icon" href="/favicon.ico">`
会同时违反这三条：file:// 下取不到、搬走之后 404、而且是一条出站引用。

所以图标以 base64 data URI 内联进每一页。代价是每页约 1 KB，全仓约 100 KB——
换来的是「任何一页在任何地方单独打开都长得一样」。

## 为什么派生，而不是直接用 docs/logo.png

原图是 1254×1254、白底、830 KB，且坐标轴是近黑色 #001241：在深色 UI（#05070d）上
对比度只有 1.12:1，等于看不见。这里做三件事：

1. 抠掉白底（从白色反解出直通道颜色，保留抗锯齿边缘）。
2. 去掉坐标轴/刻度/箭头（近黑像素），只留 M、V 与正弦曲线——2026-08-11 与使用者确认过
   的选择：M/V 标记在浅色与深色标签栏下表现一致，只需要一份图，16px 仍可辨认。
3. **只在坐标轴经过的地方**把被轴切断的笔画桥接回去。原图里坐标轴是画在字形**之上**的，
   还带一圈白色描边，直接删轴会把 M 和 V 切成好几段。桥接用形态学闭运算，但与
   `dilate(navy)` 求交——这样正弦曲线与字形之间那圈**设计本身的**白色间隙不会被填掉，
   在深色底上它就是一道干净的暗缝，读起来正是「曲线从字形上方穿过」。
   桥接处的颜色用归一化卷积（多尺度模糊的加权比值）扩散填充，而不是最近邻填充——
   后者会沿一个方向拉出条纹，实测很明显。

派生是**幂等**的：同一张 docs/logo.png 永远得到同一份 base64，所以 --check 有意义。
"""
import argparse
import base64
import io
import pathlib
import re
import subprocess
import sys

try:
    import numpy as np
    from PIL import Image, ImageFilter
except ImportError:                                    # pragma: no cover
    print('ERROR: 需要 pillow 与 numpy：pip install pillow numpy', file=sys.stderr)
    raise

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs' / 'logo.png'
MASTER = ROOT / 'docs' / 'logo-mark.png'

FAVICON_PX = 32          # 标签页图标。浏览器会自己降采样到 16
BRAND_PX = 64            # 侧栏/页眉里的可见 logo，按 2× 出图给高分屏
QUANTIZE_COLORS = 64     # 64 色足够表达三段渐变，体积约为全 RGBA 的 40%

FAVICON_BEGIN = '<!-- >>> GENERATED:FAVICON -->'
FAVICON_END = '<!-- <<< GENERATED:FAVICON -->'
BRAND_BEGIN = '/* >>> GENERATED:BRAND-LOGO */'
BRAND_END = '/* <<< GENERATED:BRAND-LOGO */'

# 侧栏/页眉里放可见 logo 的六个导航页。工具页只拿 favicon——它们各有自己的
# 面板与标题，塞一个品牌标记进去只会跟工具自己的图例抢注意力。
BRAND_PAGES = (
    'index.html', 'app.html',
    'chess/index.html', 'chess/app.html',
    'cryptography/index.html', 'cryptography/app.html',
)


# ---------------------------------------------------------------- 派生

def _box1d(x, r, axis):
    n = x.shape[axis]
    pad = [(0, 0)] * x.ndim
    pad[axis] = (r, r)
    c = np.cumsum(np.pad(x, pad, mode='edge'), axis=axis)
    z = [(0, 0)] * x.ndim
    z[axis] = (1, 0)
    c = np.pad(c, z, mode='constant')
    hi = np.take(c, np.arange(2 * r + 1, n + 2 * r + 1), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return (hi - lo) / (2 * r + 1)


def _blur(x, r, passes=3):
    """三次盒式模糊 ≈ 高斯。自己实现是因为 PIL 的 GaussianBlur 不吃 float 图像。"""
    for _ in range(passes):
        x = _box1d(x, r, 0)
        x = _box1d(x, r, 1)
    return x


def _mask_img(mask):
    return Image.fromarray((mask * 255).astype(np.uint8))


def _dilate(mask, r):
    return np.asarray(_mask_img(mask).filter(ImageFilter.MaxFilter(2 * r + 1))) > 127


def _close(mask, r):
    k = 2 * r + 1
    m = _mask_img(mask).filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))
    return np.asarray(m) > 127


def derive_mark() -> Image.Image:
    """docs/logo.png → 透明底的 M/V 标记（见模块 docstring 的三步）。"""
    a = np.asarray(Image.open(SOURCE).convert('RGB')).astype(np.float64)
    mx, mn = a.max(2), a.min(2)
    navy = mx < 120                        # 坐标轴 / 刻度 / 箭头
    colored = ((mx - mn) > 55) & ~navy     # M、V、正弦曲线

    R = 21
    gained = _close(colored, R) & ~colored          # 闭运算会桥接的所有缝
    axis_band = _dilate(navy, R + 6)                # 坐标轴真正经过的地带
    filled = colored | (gained & axis_band)         # 只桥接轴切出来的缝

    w0 = colored.astype(np.float64)
    num = a * w0[..., None]
    acc_n = np.zeros_like(num)
    acc_d = np.zeros_like(w0)
    for r in (3, 8, 18, 40, 90):                    # 由细到粗的多尺度
        w = 1.0 / (r ** 1.5)                        # 细尺度在有数据处占主导
        acc_n += _blur(num, r) * w
        acc_d += _blur(w0, r) * w
    diffused = acc_n / np.maximum(acc_d, 1e-9)[..., None]

    out = np.where(colored[..., None], a, diffused)
    rgba = np.zeros(a.shape[:2] + (4,), np.uint8)
    rgba[..., :3] = np.clip(out, 0, 255).astype(np.uint8)
    rgba[..., 3] = (filled * 255).astype(np.uint8)
    img = Image.fromarray(rgba)
    return img.crop(img.getbbox())


def png_data_uri(mark: Image.Image, size: int) -> str:
    """把标记缩到 size 见方的透明画布上，量化后转成 data URI。"""
    t = mark.copy()
    t.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(t, ((size - t.width) // 2, (size - t.height) // 2), t)
    canvas = canvas.quantize(colors=QUANTIZE_COLORS, method=Image.FASTOCTREE)
    buf = io.BytesIO()
    canvas.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


# ---------------------------------------------------------------- 写入页面

def tracked_pages() -> list:
    """git 跟踪的每一个 .html。

    用 git ls-files 而不是 rglob：工作树里还躺着 .claude/worktrees/（并行构建留下的
    188 个 html 副本）和 tmp/，rglob 会把它们一起改掉。这条同时也让「新加的页面
    会不会漏掉」有了唯一答案——进了 git 就会被铺到。
    """
    out = subprocess.run(['git', '-C', str(ROOT), 'ls-files', '*.html'],
                         capture_output=True, text=True, check=True).stdout
    return [ROOT / p for p in out.split() if p]


def _region(text, begin, end):
    i = text.find(begin)
    if i < 0:
        return None
    j = text.find(end, i)
    if j < 0:
        return None
    return i, j + len(end)


def render_favicon_block(uri: str) -> str:
    return (f'{FAVICON_BEGIN}\n'
            f'<link rel="icon" href="{uri}">\n'
            f'{FAVICON_END}')


def render_brand_block(uri: str) -> str:
    return (f'{BRAND_BEGIN}\n'
            f'.brand-logo{{background-image:url({uri})}}\n'
            f'{BRAND_END}')


def apply_page(path: pathlib.Path, favicon_uri: str, brand_uri: str, check: bool) -> tuple:
    """返回 (是否需要改动, 说明)。check=True 时不落盘。"""
    text = path.read_text(encoding='utf-8')
    orig = text
    rel = path.relative_to(ROOT).as_posix()

    block = render_favicon_block(favicon_uri)
    span = _region(text, FAVICON_BEGIN, FAVICON_END)
    if span:
        text = text[:span[0]] + block + text[span[1]:]
    else:
        # 插在 <title> 之前；没有 <title> 就插在 </head> 之前。
        anchor = text.find('<title')
        if anchor < 0:
            anchor = text.find('</head>')
        if anchor < 0:
            return True, f'{rel}: 既没有 <title> 也没有 </head>，无处安放 favicon'
        text = text[:anchor] + block + '\n' + text[anchor:]

    if rel in BRAND_PAGES:
        span = _region(text, BRAND_BEGIN, BRAND_END)
        if span is None:
            return True, f'{rel}: 缺 GENERATED:BRAND-LOGO 标记区（品牌页必须有）'
        text = text[:span[0]] + render_brand_block(brand_uri) + text[span[1]:]

    if text == orig:
        return False, ''
    if not check:
        path.write_text(text, encoding='utf-8')
    return True, f'{rel}: favicon/brand 与 docs/logo.png 不同步'


def main(check_only=False) -> int:
    if not SOURCE.exists():
        print(f'ERROR: 找不到 {SOURCE.relative_to(ROOT)}', file=sys.stderr)
        return 1

    mark = derive_mark()
    favicon_uri = png_data_uri(mark, FAVICON_PX)
    brand_uri = png_data_uri(mark, BRAND_PX)

    if not check_only:
        MASTER.parent.mkdir(parents=True, exist_ok=True)
        mark.save(MASTER)

    pages = tracked_pages()
    stale = []
    for p in pages:
        changed, why = apply_page(p, favicon_uri, brand_uri, check_only)
        if changed and why:
            stale.append(why)
        elif changed:
            stale.append(f'{p.relative_to(ROOT).as_posix()}: 已更新')

    if check_only:
        if stale:
            print(f'ERROR: {len(stale)} 个页面的品牌资产与 docs/logo.png 不同步：', file=sys.stderr)
            for s in stale[:12]:
                print(f'  {s}', file=sys.stderr)
            if len(stale) > 12:
                print(f'  …… 另有 {len(stale)-12} 个', file=sys.stderr)
            print('  跑一次 `python3 scripts/apply_branding.py` 重新生成。', file=sys.stderr)
            return 1
        print(f'品牌资产：{len(pages)} 个页面的 favicon 均与 docs/logo.png 同步'
              f'（favicon {len(favicon_uri)} B · brand {len(brand_uri)} B）')
        return 0

    print(f'标记：{mark.size[0]}×{mark.size[1]} → {MASTER.relative_to(ROOT)}')
    print(f'favicon {FAVICON_PX}px = {len(favicon_uri)} B · brand {BRAND_PX}px = {len(brand_uri)} B')
    print(f'已写入 {len(pages)} 个页面（其中 {len(BRAND_PAGES)} 个另带可见 logo）')
    return 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='只校验，不写盘；不同步则 exit 1')
    sys.exit(main(check_only=ap.parse_args().check))
