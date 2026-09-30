"""Friction as 'keep 90% of the speed every frame' - simple, but tied to the frame rate."""
import pygame

WIDTH, HEIGHT = 640, 480
KICK = 600
KEEP_PER_FRAME = 0.9
STOP_SPEED = 1
START_X = 40
BACKGROUND = (20, 24, 36)
COLOURS = [(80, 200, 255), (255, 190, 90)]
TEXT = (200, 200, 220)


def slow_down(v, keep_per_frame, dt):
# >>> BLANK id=keep level=2 hint="一行普通赋值（不用 *=）：v 写在乘号左边，乘的是函数的第二个形参；这一行用不到 dt || 「每帧保留 90%」就是每帧乘一次保留的比例——这正是它依赖帧率的原因：一秒里乘几次，取决于一秒有几帧" hintEn="One ordinary assignment (not *=): v on the left of the *, multiplied by the function's second parameter; this line does not use dt || 'Keep 90% every frame' means multiplying by the fraction kept once a frame - which is exactly why it depends on the frame rate: how many times it is applied in a second depends on how many frames a second has"
    v = v * keep_per_frame
# <<< BLANK
    if abs(v) < STOP_SPEED:
        return 0.0
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
# >>> BLANK id=slide level=2 hint="两行，同一层：第一行用 += 改位置那一格（速度乘时间，速度写在乘号左边）；第二行把 slow_down 交回的结果赋回速度那一格，实参按 slow_down 声明的顺序给，时间用 step 而不是 dt || 先按这一次更新的速度走 step 秒，再让摩擦把速度削掉一截" hintEn="Two lines at the same level: the first changes the position slot with += (velocity times time, velocity on the left of the *); the second assigns what slow_down returns back to the velocity slot, passing the arguments in the order slow_down declares them, with step rather than dt as the time || Move for step seconds at this update's velocity first, then let friction take its cut of the velocity"
                puck[0] += puck[1] * step
                puck[1] = slow_down(puck[1], KEEP_PER_FRAME, step)
# <<< BLANK
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
