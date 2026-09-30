"""Breakout: bounce the ball off the paddle to knock out the bricks; a brick breaks at the first touch."""
import pygame

WIDTH, HEIGHT = 640, 480
COLS, ROWS = 10, 3
BRICK_W, BRICK_H, GAP = 58, 18, 4
PADDLE_W, PADDLE_H = 90, 12
PADDLE_Y = HEIGHT - 40
PADDLE_SPEED = 420
BALL = 10
BALL_VEL = (180, -300)
BACKGROUND = (14, 17, 28)
ROW_COLOURS = [(255, 110, 110), (255, 190, 90), (120, 220, 150)]
PADDLE = (230, 230, 240)
BALL_COLOUR = (160, 140, 255)
TEXT = (230, 230, 240)


def make_bricks():
    return [pygame.Rect(12 + c * (BRICK_W + GAP), 50 + r * (BRICK_H + GAP), BRICK_W, BRICK_H)
            for r in range(ROWS) for c in range(COLS)]


def brick_hit(ball, bricks):
# >>> BLANK id=collide level=2 hint="一行：把 ball 整个交给 pygame.Rect 新建一个矩形（不用 * 拆开），接着调用它的 collidelist 方法，实参是 bricks；结果存进 index || collidelist 交回第一个相交的矩形在列表里的下标，一个都不相交时交回 -1" hintEn="One line: hand ball as a whole to pygame.Rect to build a rectangle (no * to unpack it), then call its collidelist method with bricks as the argument, and keep the result in index || collidelist gives back the index of the first rectangle in the list that overlaps, or -1 if none does"
    index = pygame.Rect(ball).collidelist(bricks)
# <<< BLANK
    if index == -1:
        return None
    return index


def bounce_off_walls(box, vel):
    if box.left <= 0:
        vel.x = abs(vel.x)
# >>> BLANK id=right-wall level=1 hint="照上面左墙那两行写镜像：一个 if（不用 elif）判 box 的右边碰到或越过窗口右边（>=，box.right 在左、常量名在右），下一行把 vel.x 设成朝左——abs 取绝对值再取负，不写 -vel.x，也不用 *=" hintEn="Mirror the two left-wall lines above: an if (not elif) that tests whether box's right edge has reached or passed the right of the window (>=, box.right on the left and the constant name on the right), then set vel.x to leftwards on the next line - abs made negative, not -vel.x and not *="
    if box.right >= WIDTH:
        vel.x = -abs(vel.x)
# <<< BLANK
    if box.top <= 0:
        vel.y = abs(vel.y)


def draw(screen, font, bricks, paddle, box, message):
    screen.fill(BACKGROUND)
    for brick in bricks:
        row = (brick.y - 50) // (BRICK_H + GAP)
        pygame.draw.rect(screen, ROW_COLOURS[row], brick)
    pygame.draw.rect(screen, PADDLE, paddle)
    pygame.draw.ellipse(screen, BALL_COLOUR, box)
    if message:
        text = font.render(message, True, TEXT)
        screen.blit(text, (WIDTH // 2 - text.get_width() // 2, HEIGHT // 2))
    pygame.display.flip()


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Breakout")
    clock = pygame.time.Clock()
    font = pygame.font.Font(None, 36)
    bricks = make_bricks()
    paddle = pygame.Rect(WIDTH // 2 - PADDLE_W // 2, PADDLE_Y, PADDLE_W, PADDLE_H)
    pos, vel = pygame.Vector2(WIDTH / 2, PADDLE_Y - 30), pygame.Vector2(BALL_VEL)
    message = ""
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE and message:
                bricks, message = make_bricks(), ""
                pos, vel = pygame.Vector2(WIDTH / 2, PADDLE_Y - 30), pygame.Vector2(BALL_VEL)
        keys = pygame.key.get_pressed()
        paddle.x += round((keys[pygame.K_RIGHT] - keys[pygame.K_LEFT]) * PADDLE_SPEED * dt)
        paddle.clamp_ip(screen.get_rect())
        if not message:
            pos += vel * dt
        box = pygame.Rect(0, 0, BALL, BALL)
        box.center = (round(pos.x), round(pos.y))
        bounce_off_walls(box, vel)
        if box.colliderect(paddle):
            vel.y = -abs(vel.y)
            vel.x = (box.centerx - paddle.centerx) * 5
        index = brick_hit(box, bricks)
        if index is not None:
# >>> BLANK id=break level=2 hint="两行，同一层：第一行用 del 删掉 bricks 里下标为 index 的那块砖（不用 pop）；第二行让球竖直方向掉头，直接给 vel.y 取负（写成 vel.y = -vel.y，不用 *=） || 撞到砖以后，砖要从列表里消失、球要弹回去——顺序是先删砖、再改速度" hintEn="Two lines at the same level: the first deletes the brick at position index from bricks with del (not pop); the second turns the ball round vertically by negating vel.y directly (written vel.y = -vel.y, not *=) || After a hit the brick has to leave the list and the ball has to bounce back - delete the brick first, then change the velocity"
            del bricks[index]
            vel.y = -vel.y
# <<< BLANK
        if box.top > HEIGHT:
            message = "Missed - press Space to play again"
        elif not bricks:
            message = "You win - press Space to play again"
        draw(screen, font, bricks, paddle, box, message)
    pygame.quit()


if __name__ == "__main__":
    main()
