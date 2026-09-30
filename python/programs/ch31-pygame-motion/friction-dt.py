"""Friction as 'keep a fraction of the speed every second' - the same at any frame rate."""
import pygame

WIDTH, HEIGHT = 640, 480
KICK = 600
KEEP_PER_SECOND = 0.9 ** 60
STOP_SPEED = 1
START_X = 40
BACKGROUND = (20, 24, 36)
COLOURS = [(80, 200, 255), (255, 190, 90)]
TEXT = (200, 200, 220)


def slow_down(v, keep_per_second, dt):
# >>> BLANK id=decay level=2 hint="一行普通赋值（不用 *=）：v 乘以「每秒保留的比例」的 dt 次方，用 ** 写乘方（不用 pow，不用 math.exp，不加多余的括号） || 一秒保留 k，那么过 dt 秒保留的就是 k 的 dt 次方：两个半秒各乘一次，与一整秒乘一次结果相同，所以帧率变了，一秒后剩下的速度不变" hintEn="One ordinary assignment (not *=): v times the fraction kept per second raised to the power dt, written with ** (not pow, not math.exp, and no extra brackets) || If k is kept over one second, then over dt seconds k to the power dt is kept: applying it for two half-seconds gives the same as once for a whole second, so the speed left after a second no longer depends on the frame rate"
    v = v * keep_per_second ** dt
# <<< BLANK
# >>> BLANK id=stop level=2 hint="两行：一个 if 加一个 return。条件用 abs(v) 与 STOP_SPEED 比，严格小于；return 交回一个浮点数（写成 0.0，不写 0） || 按比例衰减的速度永远不会恰好变成 0，只会越来越小：小到比 STOP_SPEED 还小，就直接当作停了" hintEn="Two lines: an if and a return. The condition compares abs(v) with STOP_SPEED, strictly less than; the return hands back a float (written 0.0, not 0) || A speed that shrinks by a fraction never becomes exactly 0, only smaller and smaller: once it is below STOP_SPEED, treat it as stopped"
    if abs(v) < STOP_SPEED:
        return 0.0
# <<< BLANK
    return round(v, 9)


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    font = pygame.font.Font(None, 28)
    pucks = [[START_X, 0.0, 1], [START_X, 0.0, 2]]
    frame = 0
    running = True
    while running:
        dt = clock.tick(60) / 1000
        frame += 1
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
                for puck in pucks:
                    puck[0], puck[1] = START_X, KICK
        for puck in pucks:
            if frame % puck[2] == 0:
                step = dt * puck[2]
                puck[0] += puck[1] * step
                puck[1] = slow_down(puck[1], KEEP_PER_SECOND, step)
        screen.fill(BACKGROUND)
        for i, (x, _, every) in enumerate(pucks):
            y = 160 + i * 160
            pygame.draw.circle(screen, COLOURS[i], (x, y), 14)
            label = font.render(f"{60 // every} fps: {x - START_X:.0f} px", True, TEXT)
            screen.blit(label, (10, y - 50))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
