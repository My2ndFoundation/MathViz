"""Holding Space fires again and again, but a cooldown timer keeps the shots spaced out."""
import pygame

WIDTH, HEIGHT = 640, 480
START_COOLDOWN = 0.25
BULLET_SPEED = 500
BACKGROUND = (8, 10, 20)
CANNON = (160, 140, 255)
BULLET = (255, 220, 120)
BAR = (255, 110, 110)
TEXT = (230, 230, 240)


def try_fire(remaining, fire_held, cooldown, dt):
    remaining -= dt
# >>> BLANK id=waiting level=2 hint="两行：一个 if 头加一行 return。条件判 remaining 还严格大于整数 0（remaining 写在左边）；return 一个外层带括号的元组：剩下的时间舍入到 9 位小数（round(…, 9)）与 False || 冷却还没走完，按着空格也不开火，把还剩多少时间交回去，下一帧接着减" hintEn="Two lines: an if line and a one-line return. The condition checks that remaining is still strictly greater than the whole number 0 (remaining on the left); return a tuple in outer brackets of the time left rounded to 9 decimal places (round(..., 9)) and False || The cooldown has not run out, so no shot even with Space held; hand back how much time is left, and the next frame carries on counting it down"
    if remaining > 0:
        return (round(remaining, 9), False)
# <<< BLANK
# >>> BLANK id=fire level=2 hint="两行：一个 if 头加一行 return。条件只看 fire_held 本身（不写 == True）；return 一个外层带括号的元组：用 float() 包起来的 cooldown 与 True || 冷却走完了、空格又按着：开火，计时器重新从整整一个 cooldown 开始倒数" hintEn="Two lines: an if line and a one-line return. The condition is just fire_held on its own (no == True); return a tuple in outer brackets of cooldown wrapped in float() and True || The cooldown has run out and Space is held: fire, and start the timer counting down again from a whole cooldown"
    if fire_held:
        return (float(cooldown), True)
# <<< BLANK
    return (0.0, False)


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    font = pygame.font.Font(None, 32)
    cannon = pygame.Rect(WIDTH // 2 - 20, HEIGHT - 50, 40, 16)
    bullets = []
    remaining, cooldown = 0.0, START_COOLDOWN
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_UP:
                cooldown = round(cooldown + 0.05, 2)
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_DOWN:
                cooldown = max(0.05, round(cooldown - 0.05, 2))
        held = pygame.key.get_pressed()[pygame.K_SPACE]
# >>> BLANK id=call level=1 hint="一行：调用 try_fire，结果解包给 remaining, fired（等号左边不加括号）；实参依次是剩下的冷却时间、空格是否按着、冷却时长、这一帧的时长" hintEn="One line: call try_fire and unpack the result into remaining, fired (no brackets on the left of the =); the arguments are, in order, the cooldown time left, whether Space is held, the cooldown length and this frame's time"
        remaining, fired = try_fire(remaining, held, cooldown, dt)
# <<< BLANK
        if fired:
            bullets.append(pygame.Rect(cannon.centerx - 2, cannon.top - 12, 4, 12))
        for bullet in bullets:
            bullet.y -= round(BULLET_SPEED * dt)
        bullets = [b for b in bullets if b.bottom > 0]
        screen.fill(BACKGROUND)
        pygame.draw.rect(screen, CANNON, cannon)
        for bullet in bullets:
            pygame.draw.rect(screen, BULLET, bullet)
        pygame.draw.rect(screen, BAR, (20, HEIGHT - 20, round(200 * remaining / cooldown), 6))
        label = font.render(f"cooldown {cooldown:.2f} s   bullets on screen {len(bullets)}", True, TEXT)
        screen.blit(label, (20, 20))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
