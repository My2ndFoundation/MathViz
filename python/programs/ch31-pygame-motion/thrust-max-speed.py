"""Arrow keys push a ship; its speed is capped by length, not axis by axis."""
import pygame

WIDTH, HEIGHT = 640, 480
THRUST = 400
MAX_SPEED = 250
BACKGROUND = (20, 24, 36)
SHIP = (255, 190, 90)
TEXT = (200, 200, 220)


def accelerate(vel, acc, dt, max_speed):
# >>> BLANK id=integrate level=2 hint="一行赋值给 v：pygame.Vector2(vel) 加上 pygame.Vector2(acc) 乘以 dt——速度写在加号左边，dt 写在乘号右边 || 加速度的单位是「像素每秒每秒」，乘上这一帧的秒数，就是速度这一帧该变多少" hintEn="One assignment to v: pygame.Vector2(vel) plus pygame.Vector2(acc) times dt - the velocity on the left of the +, dt on the right of the * || Acceleration is in pixels per second per second; times the seconds this frame took, it is how much the velocity changes this frame"
    v = pygame.Vector2(vel) + pygame.Vector2(acc) * dt
# <<< BLANK
# >>> BLANK id=cap level=2 hint="两行：一个 if 加一次赋值。if 用 v.length() 判断长度大于 0；下一行把 clamp_magnitude 交回的新向量赋回 v（不用 clamp_magnitude_ip） || 零向量不能 clamp_magnitude（会抛 ValueError）；其余情况把长度压到 max_speed 以内，方向不变" hintEn="Two lines: an if and one assignment. The if checks that v.length() is greater than 0; the next line assigns the new vector that clamp_magnitude returns back to v (not clamp_magnitude_ip) || clamp_magnitude refuses a zero vector (it raises ValueError); otherwise it shrinks the length to at most max_speed and keeps the direction"
    if v.length() > 0:
        v = v.clamp_magnitude(max_speed)
# <<< BLANK
    return (round(v.x, 9), round(v.y, 9))


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    font = pygame.font.Font(None, 28)
    pos = pygame.Vector2(WIDTH / 2, HEIGHT / 2)
    vel = (0.0, 0.0)
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        keys = pygame.key.get_pressed()
        ax = keys[pygame.K_RIGHT] - keys[pygame.K_LEFT]
        ay = keys[pygame.K_DOWN] - keys[pygame.K_UP]
        push = pygame.Vector2(ax, ay)
        vel = accelerate(vel, push * THRUST, dt, MAX_SPEED)
        pos += pygame.Vector2(vel) * dt
        pos.x %= WIDTH
        pos.y %= HEIGHT
        speed = pygame.Vector2(vel).length()
        screen.fill(BACKGROUND)
        pygame.draw.circle(screen, SHIP, pos, 12)
        label = font.render(f"speed {speed:.0f}", True, TEXT)
        screen.blit(label, (10, 10))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
