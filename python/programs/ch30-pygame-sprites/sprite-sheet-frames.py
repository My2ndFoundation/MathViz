"""Cut a sprite sheet into equal frames with subsurface, row by row, and play them in turn."""
import pygame

WIDTH = 480
HEIGHT = 320
BACKGROUND = (16, 20, 36)
CELL = 40
COLOURS = [
    (255, 90, 90), (255, 170, 60), (240, 230, 80), (90, 220, 120),
    (80, 200, 255), (110, 120, 255), (190, 110, 255), (240, 240, 240),
]


def frame_rects(sheet_w, sheet_h, frame_w, frame_h):
    rects = []
    for row in range(sheet_h // frame_h):
# >>> BLANK id=cols level=1 hint="照上一行 row 的写法：一行里能整放下几个帧宽，就有几列；循环变量叫 col，range 只给一个实参" hintEn="Write it like the row line above: there are as many columns as whole frame widths fit across the sheet; the loop variable is col, and range gets a single argument"
        for col in range(sheet_w // frame_w):
# <<< BLANK
# >>> BLANK id=cell level=2 hint="追加一个四元组，顺序是 x、y、宽、高；两个乘法都是行号或列号写在前面、帧的宽或高写在后面 || 第 col 列的左边离大图左边 col 个帧宽；第 row 行的上边离顶上 row 个帧高；宽和高原样给" hintEn="Append a 4-tuple in the order x, y, width, height; in both products the row or column number comes first and the frame width or height second || Column col starts col frame widths in from the left of the sheet; row row starts row frame heights down from the top; width and height go in unchanged"
            rects.append((col * frame_w, row * frame_h, frame_w, frame_h))
# <<< BLANK
    return rects


def make_sheet():
    sheet = pygame.Surface((4 * CELL, 2 * CELL))
    for i, colour in enumerate(COLOURS):
        x = (i % 4) * CELL
        y = (i // 4) * CELL
        pygame.draw.circle(sheet, colour, (x + CELL // 2, y + CELL // 2), 4 + 2 * i)
    return sheet


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Frames cut from one sheet")
    clock = pygame.time.Clock()
    sheet = make_sheet()
    sheet_w, sheet_h = sheet.get_size()
    rects = frame_rects(sheet_w, sheet_h, CELL, CELL)
# >>> BLANK id=cut level=2 hint="列表推导式，循环变量叫 rect；对每个矩形向 sheet 要一张子图，结果存进 frames || 子图不复制像素，它和大图共用同一块内存；方法名是 subsurface" hintEn="A list comprehension whose loop variable is called rect; for each rectangle ask sheet for a sub-surface, and store the result in frames || A sub-surface copies no pixels - it shares the big sheet's memory; the method is subsurface"
    frames = [sheet.subsurface(rect) for rect in rects]
# <<< BLANK
    elapsed = 0
    running = True
    while running:
        elapsed += clock.tick(60)
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        current = frames[(elapsed // 150) % len(frames)]
        screen.fill(BACKGROUND)
        screen.blit(sheet, (40, 40))
        screen.blit(current, (320, 140))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
