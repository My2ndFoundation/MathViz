"""Space Invaders: a fleet marches side to side and steps down at each edge; one cannon, one bullet."""
import pygame

WIDTH, HEIGHT = 640, 480
ALIEN_W, ALIEN_H = 30, 20
COLS, ROWS = 8, 3
STEP, DROP = 10, 16
MOVE_TIME = 0.35
CANNON_W, CANNON_H = 40, 16
CANNON_Y = HEIGHT - 40
CANNON_SPEED = 300
BULLET_SPEED = 480
BACKGROUND = (8, 10, 20)
ALIEN = (120, 230, 150)
CANNON = (160, 140, 255)
BULLET = (255, 220, 120)
TEXT = (230, 230, 240)


def make_fleet():
    return [(60 + c * 50, 50 + r * 36) for r in range(ROWS) for c in range(COLS)]


def fleet_step(aliens, direction, step, width, drop):
    if direction > 0:
# >>> BLANK id=right-edge level=2 hint="一行，给 blocked 赋一个布尔（等号右边不加括号）：最右边那个外星人的 x（对生成器 x for x, y in aliens 取 max）加上外星人的宽度、再加上这一步，是否严格大于 width；三项按这个顺序相加，width 写在最右 || x 是外星人的左边；它的右边在 x + ALIEN_W。只看左边的话，队伍会先有一截钻进右墙里才掉头" hintEn="One line assigning a boolean to blocked (no brackets on the right of the =): whether the x of the right-most alien (max over the generator x for x, y in aliens) plus the alien's width plus this step is strictly greater than width; add the three in that order, with width at the far right || x is an alien's left edge; its right edge is at x + ALIEN_W. Looking only at the left edge would let part of the fleet slide into the right wall before it turns"
        blocked = max(x for x, y in aliens) + ALIEN_W + step > width
# <<< BLANK
    else:
        blocked = min(x for x, y in aliens) - step < 0
    if blocked:
# >>> BLANK id=drop level=2 hint="一行 return：外层带括号的元组。第一项是用列表推导式重建的队伍——每个外星人写成 (x, y + drop)，for x, y in aliens 里的 x, y 不加括号；第二项是反过来的方向，写成 -direction || 撞墙的这一步不再横着走：整队往下挪一行，方向取负" hintEn="One return line: a tuple in outer brackets. Its first item rebuilds the fleet with a list comprehension - each alien written (x, y + drop), with no brackets round the x, y in for x, y in aliens; its second item is the reversed direction, written -direction || On the step that would hit the wall there is no sideways move: the whole fleet moves down a row and the direction is negated"
        return ([(x, y + drop) for x, y in aliens], -direction)
# <<< BLANK
    return ([(x + direction * step, y) for x, y in aliens], direction)


def alien_rects(aliens):
    return [pygame.Rect(x, y, ALIEN_W, ALIEN_H) for x, y in aliens]


def draw(screen, font, aliens, cannon, bullet, message):
    screen.fill(BACKGROUND)
    for rect in alien_rects(aliens):
        pygame.draw.rect(screen, ALIEN, rect, border_radius=4)
    pygame.draw.rect(screen, CANNON, cannon)
    if bullet:
        pygame.draw.rect(screen, BULLET, bullet)
    if message:
        text = font.render(message, True, TEXT)
        screen.blit(text, (WIDTH // 2 - text.get_width() // 2, HEIGHT // 2))
    pygame.display.flip()


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Space Invaders")
    clock = pygame.time.Clock()
    font = pygame.font.Font(None, 36)
    aliens, direction, timer = make_fleet(), 1, 0.0
    cannon = pygame.Rect(WIDTH // 2 - CANNON_W // 2, CANNON_Y, CANNON_W, CANNON_H)
    bullet = None
    message = ""
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
                if bullet is None and not message:
                    bullet = pygame.Rect(cannon.centerx - 2, cannon.top - 12, 4, 12)
        if not message:
            keys = pygame.key.get_pressed()
            cannon.x += round((keys[pygame.K_RIGHT] - keys[pygame.K_LEFT]) * CANNON_SPEED * dt)
            cannon.clamp_ip(screen.get_rect())
        if bullet and not message:
            bullet.y -= round(BULLET_SPEED * dt)
# >>> BLANK id=shot-down level=2 hint="一行：调用 bullet 的 collidelist 方法，结果存进 hit；实参是整队外星人的矩形列表——用本程序里现成的那个函数从 aliens 建出来，不自己写推导式 || 那个函数是 alien_rects(aliens)；collidelist 一个都没撞到时交回 -1，撞到了交回的下标正好是 aliens 里的同一个位置" hintEn="One line: call bullet's collidelist method and keep the result in hit; the argument is the list of the whole fleet's rectangles - built from aliens with the function this program already has, not with a comprehension of your own || That function is alien_rects(aliens); collidelist gives back -1 when it hits nothing, and when it does hit, the index is the same position in aliens"
            hit = bullet.collidelist(alien_rects(aliens))
# <<< BLANK
            if hit != -1:
                del aliens[hit]
                bullet = None
            elif bullet.bottom < 0:
                bullet = None
        timer += dt
        if timer >= MOVE_TIME and aliens and not message:
            timer -= MOVE_TIME
            aliens, direction = fleet_step(aliens, direction, STEP, WIDTH, DROP)
        if not aliens:
            message = "You win!"
        elif max(y for x, y in aliens) + ALIEN_H >= CANNON_Y:
            message = "The invaders have landed - game over"
        draw(screen, font, aliens, cannon, bullet, message)
    pygame.quit()


if __name__ == "__main__":
    main()
