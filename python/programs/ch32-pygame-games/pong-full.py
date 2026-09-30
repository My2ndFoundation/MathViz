"""Pong: two paddles and a ball; the ball bounces off walls and paddles, and a miss scores a point."""
import pygame

WIDTH, HEIGHT = 640, 480
PADDLE_W, PADDLE_H = 10, 80
LEFT_X = 20
RIGHT_X = WIDTH - 30
BALL = 10
SERVE_SPEED = (300, 180)
PLAYER_SPEED = 360
AI_SPEED = 150
BACKGROUND = (14, 17, 28)
NET = (60, 64, 96)
PADDLE = (230, 230, 240)
BALL_COLOUR = (255, 200, 90)
SCORE = (160, 140, 255)


def ball_step(ball, vel, left_y, right_y):
    box = pygame.Rect(0, 0, BALL, BALL)
    box.center = (round(ball[0]), round(ball[1]))
    vx, vy = vel
    if box.top <= 0:
        vy = abs(vy)
# >>> BLANK id=bottom level=1 hint="照上面顶边那两行写镜像：一个 if（不用 elif）判 box 的底边碰到或越过窗口底（用 >=，box.bottom 在左、常量名在右），下一行把 vy 设成朝上——用 abs 取绝对值再取负，不直接写 -vy" hintEn="Mirror the two top-edge lines above: an if (not elif) that tests whether box's bottom edge has reached or passed the bottom of the window (use >=, box.bottom on the left and the constant name on the right), then set vy to upwards on the next line - take abs and make it negative, rather than writing -vy"
    if box.bottom >= HEIGHT:
        vy = -abs(vy)
# <<< BLANK
    if box.colliderect(pygame.Rect(LEFT_X, round(left_y), PADDLE_W, PADDLE_H)):
        vx = abs(vx)
    if box.colliderect(pygame.Rect(RIGHT_X, round(right_y), PADDLE_W, PADDLE_H)):
        vx = -abs(vx)
    if box.right < 0:
        return ((float(vx), float(vy)), "right-scores")
# >>> BLANK id=score level=2 hint="和上面判左边出界的那两行成对：一个 if 判 box 的左边已经越过窗口右边（严格大于，box.left 在左、常量名在右），下一行的 return 照抄上面那个 return 的样子（外层括号、双引号都一样），只换掉字符串的内容 || 球从右边出去，是右边的拍子没接住，所以得分的是左边：字符串的内容是 left-scores" hintEn="Pairs with the two left-exit lines above: an if that tests whether box's left edge is already past the right of the window (strictly greater, box.left on the left and the constant name on the right); the return on the next line copies the shape of the return above (same outer brackets, same double quotes) with only the words in the string changed || A ball leaving on the right is one the right paddle missed, so the point goes to the left: the string reads left-scores"
    if box.left > WIDTH:
        return ((float(vx), float(vy)), "left-scores")
# <<< BLANK
    return ((float(vx), float(vy)), "play")


def clamp_paddle(y):
    return max(0.0, min(float(HEIGHT - PADDLE_H), y))


def serve(towards):
    ball = pygame.Vector2(WIDTH / 2, HEIGHT / 2)
    vel = pygame.Vector2(SERVE_SPEED[0] * towards, SERVE_SPEED[1])
    return ball, vel


def draw(screen, font, ball, left_y, right_y, scores):
    screen.fill(BACKGROUND)
    for y in range(0, HEIGHT, 30):
        pygame.draw.rect(screen, NET, (WIDTH // 2 - 2, y, 4, 15))
    pygame.draw.rect(screen, PADDLE, (LEFT_X, round(left_y), PADDLE_W, PADDLE_H))
    pygame.draw.rect(screen, PADDLE, (RIGHT_X, round(right_y), PADDLE_W, PADDLE_H))
    pygame.draw.circle(screen, BALL_COLOUR, (round(ball.x), round(ball.y)), BALL // 2)
    text = font.render(f"{scores[0]}   {scores[1]}", True, SCORE)
    screen.blit(text, (WIDTH // 2 - text.get_width() // 2, 20))
    pygame.display.flip()


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Pong")
    clock = pygame.time.Clock()
    font = pygame.font.Font(None, 48)
    left_y = right_y = (HEIGHT - PADDLE_H) / 2
    scores = [0, 0]
    ball, vel = serve(1)
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        keys = pygame.key.get_pressed()
        if keys[pygame.K_w]:
            left_y -= PLAYER_SPEED * dt
        if keys[pygame.K_s]:
            left_y += PLAYER_SPEED * dt
        step = AI_SPEED * dt
        right_y += max(-step, min(step, ball.y - PADDLE_H / 2 - right_y))
        left_y, right_y = clamp_paddle(left_y), clamp_paddle(right_y)
# >>> BLANK id=move level=2 hint="两行。第一行用 += 按速度与这一帧的时长移动 ball（vel 写在乘号左边）；第二行调用 ball_step，把两个 Vector2 拆成 (ball.x, ball.y) 这样的元组交进去（不写 tuple(ball)），结果解包给 new_vel, state（等号左边不加括号） || ball_step 的四个实参依次是：球的位置、球的速度、左拍的 y、右拍的 y" hintEn="Two lines. The first moves ball with += by its velocity times this frame's time (vel on the left of the *); the second calls ball_step, passing the two Vector2s as tuples like (ball.x, ball.y) (not tuple(ball)), and unpacks the result into new_vel, state (no brackets on the left of the =) || ball_step's four arguments are, in order: the ball's position, the ball's velocity, the left paddle's y and the right paddle's y"
        ball += vel * dt
        new_vel, state = ball_step((ball.x, ball.y), (vel.x, vel.y), left_y, right_y)
# <<< BLANK
        vel = pygame.Vector2(new_vel)
        if state == "left-scores":
            scores[0] += 1
            ball, vel = serve(-1)
        elif state == "right-scores":
            scores[1] += 1
            ball, vel = serve(1)
        draw(screen, font, ball, left_y, right_y, scores)
    pygame.quit()


if __name__ == "__main__":
    main()
