"""Draw a grid of squares with rect, circle, line and polygon."""
import pygame

WIDTH = 480
HEIGHT = 320
FPS = 30
COLS = 6
ROWS = 4
SIZE = 60
GAP = 12
BORDER = 3
BACKGROUND = pygame.Color(12, 16, 30)
FILL = pygame.Color(70, 110, 200)
EDGE = pygame.Color(230, 230, 240)
ACCENT = pygame.Color(250, 170, 60)


def grid_rects(cols, rows, size, gap):
    rects = []
    for row in range(rows):
        for col in range(cols):
# >>> BLANK id=corner level=2 hint="两行，先 x 后 y，写法对称；每一行都是「gap 写在最前面，再加上格子序号乘以 (size + gap)」，括号不能省 || x 用 col，y 用 row：左上角先留出一个 gap 的边距，之后每多一格就再挪一个格子宽加一个间隙" hintEn="Two lines, x first and y second, written the same way; each is gap first, then plus the cell number times (size + gap), with the brackets kept || x uses col and y uses row: the top-left keeps a margin of one gap, and each further cell moves along by one cell width plus one gap"
            x = gap + col * (size + gap)
            y = gap + row * (size + gap)
# <<< BLANK
            rects.append(pygame.Rect(x, y, size, size))
    return [tuple(rect) for rect in rects]


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Drawing primitives")
    clock = pygame.time.Clock()
    cells = grid_rects(COLS, ROWS, SIZE, GAP)
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        screen.fill(BACKGROUND)
        for i, cell in enumerate(cells):
            box = pygame.Rect(cell)
            if i % 2 == 0:
                pygame.draw.rect(screen, FILL, box)
            else:
# >>> BLANK id=border level=2 hint="一行 draw.rect：表面、颜色、矩形三个实参，顺序和上面画实心方块那一行一样，再多一个第四个位置实参（不写 width=，写常量不写数字）——它不是 0 时，只画这么宽的边框 || 颜色用 EDGE，边框宽度用 BORDER" hintEn="One draw.rect call: surface, colour and rectangle in the same order as the solid square above, plus a fourth positional argument (no width=, a constant rather than a number) - when it is not 0, only a border that wide is drawn || The colour is EDGE and the border width is BORDER"
                pygame.draw.rect(screen, EDGE, box, BORDER)
# <<< BLANK
        first = pygame.Rect(cells[0])
        pygame.draw.circle(screen, ACCENT, first.center, SIZE // 3)
        pygame.draw.line(screen, ACCENT, (0, 0), (WIDTH, HEIGHT), 2)
        triangle = [(WIDTH - 50, 20), (WIDTH - 20, 70), (WIDTH - 80, 70)]
        pygame.draw.polygon(screen, ACCENT, triangle)
        pygame.display.flip()
        clock.tick(FPS)
    pygame.quit()


if __name__ == "__main__":
    main()
