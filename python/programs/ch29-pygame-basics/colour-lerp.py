"""Fill the window with a gradient that blends one colour into another."""
import pygame

WIDTH = 480
HEIGHT = 240
FPS = 30
LEFT = (255, 90, 60)
RIGHT = (40, 120, 255)
PANEL = pygame.Color(20, 20, 30)


def blend(c1, c2, t):
    start = pygame.Color(c1)
# >>> BLANK id=lerp level=2 hint="一行赋值，结果叫 mixed：在 start 这个 Color 上调用它自己的渐变方法，实参依次是另一端的颜色（c2 原样传，不先包成 Color）和比例（不自己逐分量算） || start.lerp(…, …)，先 c2 后 t" hintEn="One assignment, the result called mixed: call the blending method of the Color start itself, passing the other end's colour (c2 as it is, not wrapped in a Color first) and then the fraction (do not work it out channel by channel) || start.lerp(…, …) with c2 first and t second"
    mixed = start.lerp(c2, t)
# <<< BLANK
# >>> BLANK id=rgb level=2 hint="一行 return：Color 有四个分量（最后一个是透明度 alpha），这里只要前三个；先把整个 mixed 变成元组，再在元组上切片，切片省略起点、终点写正数 3（不写 -1，也不逐个写 .r .g .b） || tuple(mixed) 之后接一个只取前 3 个的切片" hintEn="One return: a Color has four parts (the last is alpha, the transparency) and only the first three are wanted; turn the whole of mixed into a tuple first and then slice that tuple, leaving out the start of the slice and ending it at a positive 3 (not -1, and do not list .r .g .b one by one) || tuple(mixed) followed by a slice that keeps the first 3"
    return tuple(mixed)[:3]
# <<< BLANK


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Colour blend")
    clock = pygame.time.Clock()
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        screen.fill(PANEL)
        for x in range(WIDTH):
# >>> BLANK id=fraction level=2 hint="一行赋值，存进 t：x 从 0 走到 WIDTH - 1，要让最左一列是 0、最右一列恰好是 1，就除以最大的那个 x——用常量 WIDTH 写出来，不写数字（括号不能省） || t 等于 x 除以 (WIDTH - 1)" hintEn="One assignment into t: x runs from 0 to WIDTH - 1; to make the leftmost column 0 and the rightmost exactly 1, divide by the largest x - written with the constant WIDTH, not as a number (keep the brackets) || t is x divided by (WIDTH - 1)"
            t = x / (WIDTH - 1)
# <<< BLANK
            colour = blend(LEFT, RIGHT, t)
            pygame.draw.line(screen, colour, (x, 40), (x, HEIGHT - 40))
        pygame.display.flip()
        clock.tick(FPS)
    pygame.quit()


if __name__ == "__main__":
    main()
