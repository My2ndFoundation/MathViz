"""Arrow keys set a velocity - normalised, so a diagonal is no faster."""
import pygame

WIDTH, HEIGHT = 640, 480
SPEED = 200
START = (40, 40)
FINISH = 300
BACKGROUND = (20, 24, 36)
RING = (90, 90, 120)
STRAIGHT = (80, 200, 255)
DIAGONAL = (255, 120, 150)
PLAYER = (240, 240, 240)


def velocity(left, right, up, down, speed):
    direction = pygame.Vector2(int(right) - int(left), int(down) - int(up))
# >>> BLANK id=normalise level=2 hint="两行：一个 if 加一次赋值。if 用 direction.length() 判断长度大于 0（不用 length_squared，也不直接拿 direction 当条件）；下一行把 normalize() 交回的新向量赋回 direction（不用 normalize_ip） || 零向量没有方向，normalize() 会抛 ValueError——一个键都没按时就跳过这一步，direction 保持 (0, 0)" hintEn="Two lines: an if and one assignment. The if checks that direction.length() is greater than 0 (not length_squared, and not direction on its own as the condition); the next line assigns the new vector that normalize() returns back to direction (not normalize_ip) || A zero vector has no direction and normalize() raises ValueError on it - with no key held, skip this step and leave direction as (0, 0)"
    if direction.length() > 0:
        direction = direction.normalize()
# <<< BLANK
    v = direction * speed
    return (round(v.x, 9), round(v.y, 9))


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    racers = [
        [pygame.Vector2(START), pygame.Vector2(velocity(False, True, False, False, SPEED)), STRAIGHT],
        [pygame.Vector2(START), pygame.Vector2(velocity(False, True, False, True, SPEED)), DIAGONAL],
    ]
    player = pygame.Vector2(WIDTH / 2, HEIGHT - 60)
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        keys = pygame.key.get_pressed()
        left, right = keys[pygame.K_LEFT], keys[pygame.K_RIGHT]
        up, down = keys[pygame.K_UP], keys[pygame.K_DOWN]
        vel = velocity(left, right, up, down, SPEED)
# >>> BLANK id=move level=2 hint="一行增量赋值 +=：左边是 player，右边先把 vel 这个元组包成 pygame.Vector2，再乘以 dt（Vector2 写在乘号左边） || 速度的单位是「像素每秒」，乘上这一帧经过的秒数，就是这一帧该走的位移" hintEn="One augmented assignment with +=: player on the left; on the right, wrap the tuple vel in pygame.Vector2 first and then multiply by dt (the Vector2 on the left of the *) || The velocity is in pixels per second; times the seconds this frame took, it is how far to move this frame"
        player += pygame.Vector2(vel) * dt
# <<< BLANK
        for racer in racers:
            if racer[0].distance_to(START) < FINISH:
                racer[0] += racer[1] * dt
        screen.fill(BACKGROUND)
        pygame.draw.circle(screen, RING, START, FINISH, 2)
        for pos, _, colour in racers:
            pygame.draw.rect(screen, colour, (pos.x - 10, pos.y - 10, 20, 20))
        pygame.draw.rect(screen, PLAYER, (player.x - 10, player.y - 10, 20, 20))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
