"""Leave by the right edge, come back on the left: wrap-around with %."""
import pygame

WIDTH, HEIGHT = 640, 480
RADIUS = 20
BACKGROUND = (20, 24, 36)
ROCK = (200, 200, 220)


def wrap(x, y):
# >>> BLANK id=modulo level=2 hint="两行普通赋值（不用 %=），先 x 后 y；各自对自己那条边的长度取模：x 对 WIDTH，y 对 HEIGHT || Python 的 % 在除数为正时，结果总落在 0 到除数之间（不含除数）——负数也一样，所以从左边出去（x 变成负数）也会从右边回来" hintEn="Two ordinary assignments (not %=), x first and then y; each one takes the remainder by the length of its own side: x by WIDTH, y by HEIGHT || With a positive divisor Python's % always lands between 0 and the divisor (not including it) - negative numbers too, so leaving on the left (x going negative) brings it back on the right"
    x = x % WIDTH
    y = y % HEIGHT
# <<< BLANK
    return (round(x, 9), round(y, 9))


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    rocks = [[100.0, 100.0, 120.0, 40.0], [500.0, 300.0, -90.0, -70.0], [320.0, 60.0, 0.0, -150.0]]
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        for rock in rocks:
# >>> BLANK id=drift level=2 hint="一行元组赋值，把 wrap 交回的两个数写回这块石头列表的前两个下标（左边写两个用逗号隔开的下标，不用切片）；wrap 的两个实参各是「位置加上速度乘 dt」，位置写在加号左边、速度在 dt 前面 || 下标 0、1 是位置 x、y，下标 2、3 是速度：先各自走一帧，再交给 wrap 把出界的拉回来" hintEn="One tuple assignment that writes the two numbers wrap returns back into the rock list's first two indexes (two indexes separated by a comma on the left, not a slice); each of wrap's two arguments is a position plus a velocity times dt, the position on the left of the + and the velocity before dt || Indexes 0 and 1 are the position x and y, indexes 2 and 3 the velocity: move each by one frame first, then let wrap bring back whatever went off the edge"
            rock[0], rock[1] = wrap(rock[0] + rock[2] * dt, rock[1] + rock[3] * dt)
# <<< BLANK
        screen.fill(BACKGROUND)
        for x, y, _, _ in rocks:
            for dx in (-WIDTH, 0, WIDTH):
                for dy in (-HEIGHT, 0, HEIGHT):
                    pygame.draw.circle(screen, ROCK, (x + dx, y + dy), RADIUS)
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
