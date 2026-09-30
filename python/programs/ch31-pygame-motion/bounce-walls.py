"""Balls bounce off the side walls: fold the overshoot back, point the velocity inwards."""
import pygame

WIDTH, HEIGHT = 640, 480
RADIUS = 15
LEFT = RADIUS
RIGHT = WIDTH - RADIUS
BACKGROUND = (20, 24, 36)
BALL = (255, 120, 150)


def bounce(x, vx):
    if x < LEFT:
        return (round(2 * LEFT - x, 9), round(abs(vx), 9))
# >>> BLANK id=right level=2 hint="两行：一个 if（不用 elif）加一个 return，照左墙那两行的样子写成镜像——比较用严格的大于号，x 写在左边；return 的元组照样带括号，两项各自 round(…, 9) || 越过右墙多少，就从 RIGHT 往回折多少：新位置是 2 * RIGHT - x；速度不管原来朝哪边，都要朝左，所以取 abs 再加负号" hintEn="Two lines: an if (not elif) and a return, the mirror image of the two left-wall lines - a strict greater-than with x on the left; the returned tuple keeps its brackets, with round(…, 9) on each item || However far x is past the right wall, fold it back that far from RIGHT: the new position is 2 * RIGHT - x; whichever way the velocity pointed, it must now point left, so take abs and put a minus in front"
    if x > RIGHT:
        return (round(2 * RIGHT - x, 9), round(-abs(vx), 9))
# <<< BLANK
    return (round(x, 9), round(vx, 9))


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    balls = [[100.0, 180.0], [300.0, -420.0], [-40.0, 150.0]]
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        for ball in balls:
# >>> BLANK id=update level=2 hint="一行元组赋值，把 bounce 交回的两个数一次写回这个球列表的两个下标（先位置、后速度）；第一个实参里位置写在加号左边、「速度乘 dt」写在右边（速度在 dt 前面） || 先照速度走这一帧，走出墙的那一截再交给 bounce 折回来：第一个实参是走了一帧之后的位置，第二个实参是原来的速度" hintEn="One tuple assignment that writes the two numbers bounce returns straight back into the ball list's two indexes (position first, velocity second); in the first argument the position goes on the left of the + and the velocity times dt on the right (velocity before dt) || Move by the velocity for this frame first, then hand any part that went through a wall to bounce to fold back: the first argument is the position after one frame's move, the second is the velocity as it was"
            ball[0], ball[1] = bounce(ball[0] + ball[1] * dt, ball[1])
# <<< BLANK
        screen.fill(BACKGROUND)
        for i, (x, _) in enumerate(balls):
            pygame.draw.circle(screen, BALL, (x, 120 + i * 120), RADIUS)
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
