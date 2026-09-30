"""Arrow keys set a velocity - and a diagonal comes out faster."""
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
# >>> BLANK id=direction level=2 hint="一个 pygame.Vector2，两个分量各是两个按键之差；每个布尔都用 int() 包起来，x 分量是 right 减 left，y 分量是 down 减 up，结果存进 direction || 屏幕坐标里 y 向下变大，所以按「下」是 y 的正方向：两个键都按或都不按时，这个分量就是 0" hintEn="One pygame.Vector2 whose two components are each the difference of two keys; wrap every boolean in int(), the x component is right minus left, the y component down minus up, stored in direction || On screen y grows downwards, so the down key is the positive y direction: with both keys of a pair held, or neither, that component is 0"
    direction = pygame.Vector2(int(right) - int(left), int(down) - int(up))
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
        player += pygame.Vector2(vel) * dt
        for racer in racers:
# >>> BLANK id=finish level=2 hint="一个 if：用 Vector2 的 distance_to 量这个赛车手（racer[0]）到 START 的距离，严格小于 FINISH 才走——距离写在小于号左边；从 racer[0] 上调用 distance_to，START 直接当实参（不包 Vector2）；不用 length()，不用 <= || 还没碰到圆环的才继续前进，到了圆环就停在那里" hintEn="One if: measure the distance from this racer's position (racer[0]) to START with the Vector2 method distance_to, and move only while it is strictly less than FINISH - the distance on the left of the <; call distance_to on racer[0] and pass START as it is (not wrapped in Vector2); not length(), not <= || Only a racer that has not reached the ring yet keeps going; once it is at the ring it stays put"
            if racer[0].distance_to(START) < FINISH:
# <<< BLANK
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
