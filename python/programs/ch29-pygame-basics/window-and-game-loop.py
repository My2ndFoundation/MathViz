"""The smallest pygame program: open a window and run the game loop."""
import pygame

WIDTH = 480
HEIGHT = 320
FPS = 60
BACKGROUND = pygame.Color(20, 24, 40)
DOT_COLOUR = pygame.Color(240, 200, 60)
DOT_RADIUS = 12


def dot_position(frame):
    x = (frame * 2) % WIDTH
    return x, HEIGHT // 2


def main():
    pygame.init()
# >>> BLANK id=window level=2 hint="一行赋值：窗口对象叫 screen；display 模块里开窗口的那个函数只收一个位置实参——宽和高用两个常量，放进一对圆括号里（元组，不是列表） || set_mode((…, …))，里面依次是 WIDTH 和 HEIGHT 两个常量" hintEn="One assignment: the window object is called screen; the display function that opens a window takes a single positional argument - width and height as the two constants, inside one pair of round brackets (a tuple, not a list) || set_mode((…, …)) with the constants WIDTH and HEIGHT inside, in that order"
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
# <<< BLANK
    pygame.display.set_caption("Game loop")
    clock = pygame.time.Clock()
    frame = 0
    running = True
    while running:
        # 1. handle events
        for event in pygame.event.get():
# >>> BLANK id=quit level=2 hint="两行：一个 if 加一行赋值；event.type 写在 == 的左边，右边写全名 pygame.QUIT（不用 from pygame.locals 导入） || 用户点了窗口的关闭按钮时，把控制 while 的那个标志改成 False" hintEn="Two lines: an if and one assignment; event.type on the left of ==, the full name pygame.QUIT on the right (no import from pygame.locals) || When the user clicks the window's close button, set the flag that controls the while to False"
            if event.type == pygame.QUIT:
                running = False
# <<< BLANK
        # 2. update
        frame += 1
        # 3. draw
        screen.fill(BACKGROUND)
        pygame.draw.circle(screen, DOT_COLOUR, dot_position(frame), DOT_RADIUS)
        pygame.display.flip()
        clock.tick(FPS)
# >>> BLANK id=close level=1 hint="循环结束之后、main 里的最后一行：关掉 pygame 自己（与开头 main 的第一行成对）" hintEn="After the loop, the last line of main: shut pygame itself down (the partner of the first line of main)"
    pygame.quit()
# <<< BLANK


if __name__ == "__main__":
    main()
