"""A saved image is figsize (inches) times dpi (dots per inch) pixels; the file name picks the format."""
import os

import matplotlib.pyplot as plt


def pixel_size(width_in, height_in, dpi):
    """The (width, height) in pixels of a figure that size saved at that dpi."""
# >>> BLANK id=pixels level=2 hint="交回一个 (宽, 高) 的像素数：英寸数乘每英寸的点数，各自用内置 round 取成整数——宽在前、高在后，不加括号；英寸数写在乘号左边 || 宽用 width_in，高用 height_in，两个都乘同一个 dpi" hintEn="Hand back (width, height) in pixels: inches times dots per inch, each made a whole number with the built-in round - width first, height second, no brackets round the pair; the inches go on the left of the multiplication || The width uses width_in and the height uses height_in, both times the same dpi"
    return round(width_in * dpi), round(height_in * dpi)
# <<< BLANK


def save_chart(width_in, height_in, dpi, path):
    fig, ax = plt.subplots(figsize=(width_in, height_in))
    ax.plot([1, 2, 3, 4], [3, 1, 4, 2])
# >>> BLANK id=save-dpi level=1 hint="经过 fig 把图存到 path，并用关键字实参 dpi 指定每英寸的点数（值就是形参 dpi）" hintEn="Through fig, save the figure to path, giving the dots per inch with the keyword argument dpi (its value is the parameter dpi)"
    fig.savefig(path, dpi=dpi)
# <<< BLANK
    plt.close(fig)


if __name__ == "__main__":
    for dpi in (100, 200):
        name = f"chart-{dpi}.png"
        save_chart(4, 3, dpi, name)
# >>> BLANK id=read-back level=2 hint="把刚存的图片读回来成一个数组，拆包它的 shape 的三项到 rows、cols、channels——图片数组先是行数（高），再是列数（宽），最后是颜色通道数 || 读图片用 pyplot 的 imread，实参是 name，再取结果的 shape 属性" hintEn="Read the image just saved back as an array and unpack the three items of its shape into rows, cols and channels - an image array gives the number of rows (height) first, then columns (width), then colour channels || Read the image with pyplot's imread, passing name, then take the shape attribute of the result"
        rows, cols, channels = plt.imread(name).shape
# <<< BLANK
        print(dpi, "dpi: expected", pixel_size(4, 3, dpi), "got", (cols, rows), "channels", channels)

    save_chart(4, 3, 100, "chart.pdf")
    save_chart(4, 3, 100, "chart.svg")
    for name in ("chart-100.png", "chart.pdf", "chart.svg"):
        print(name, os.path.exists(name))
    print("figures still open:", len(plt.get_fignums()))
