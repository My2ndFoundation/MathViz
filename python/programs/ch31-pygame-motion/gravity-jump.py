"""Gravity pulls a block down every frame; Space jumps, but only from the ground."""
import pygame

WIDTH, HEIGHT = 640, 480
GROUND_Y = 400
GRAVITY = 1500
JUMP_SPEED = -600
SIZE = 30
BACKGROUND = (20, 24, 36)
GROUND = (90, 90, 120)
BLOCK = (160, 140, 255)


def step(y, vy, on_ground, jump, dt):
# >>> BLANK id=jump level=2 hint="两行：一个 if 加一次赋值。条件是两个布尔用 and 连起来，jump 写在前面；下一行给 vy 赋上一个常量（用常量名，不写数字） || 只有「按了跳」而且「站在地上」才起跳：起跳就是把竖直速度直接设成 JUMP_SPEED（负数，朝上）" hintEn="Two lines: an if and one assignment. The condition joins two booleans with and, jump first; the next line sets vy to a constant (by its name, not a number) || Only 'jump pressed' and 'standing on the ground' together start a jump: a jump simply sets the vertical velocity to JUMP_SPEED (negative, so upwards)"
    if jump and on_ground:
        vy = JUMP_SPEED
# <<< BLANK
# >>> BLANK id=gravity level=2 hint="两行，都用 +=：第一行改 vy，第二行改 y；乘法里常量或速度写在左边、dt 写在右边 || 先让重力改速度（GRAVITY 乘 dt），再用改过的速度改位置（vy 乘 dt）——顺序反过来，这一帧就用了旧速度" hintEn="Two lines, both with +=: the first changes vy, the second changes y; in each product the constant or the velocity goes on the left and dt on the right || First gravity changes the velocity (GRAVITY times dt), then the new velocity changes the position (vy times dt) - swap them and this frame uses the old velocity"
    vy += GRAVITY * dt
    y += vy * dt
# <<< BLANK
    if y >= GROUND_Y:
        return (float(GROUND_Y), 0.0, True)
    return (round(y, 9), round(vy, 9), False)


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    y, vy, on_ground = float(GROUND_Y), 0.0, True
    running = True
    while running:
        dt = clock.tick(60) / 1000
        jump = False
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
                jump = True
        y, vy, on_ground = step(y, vy, on_ground, jump, dt)
        screen.fill(BACKGROUND)
        pygame.draw.line(screen, GROUND, (0, GROUND_Y), (WIDTH, GROUND_Y), 2)
        pygame.draw.rect(screen, BLOCK, (WIDTH / 2 - SIZE / 2, y - SIZE, SIZE, SIZE))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
