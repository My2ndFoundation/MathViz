"""An AI paddle chases the ball, but it may only move a limited distance each frame."""
import pygame

WIDTH, HEIGHT = 640, 480
PADDLE_X, PADDLE_W, PADDLE_H = WIDTH - 30, 10, 80
BALL = 10
BALL_VEL = (330, 250)
START_SPEED = 180
BACKGROUND = (14, 17, 28)
PADDLE = (230, 230, 240)
BALL_COLOUR = (255, 200, 90)
TEXT = (160, 140, 255)


def ai_follow(paddle_y, ball_y, speed, dt):
    centre = paddle_y + PADDLE_H / 2
    step = speed * dt
# >>> BLANK id=close level=2 hint="两行：一个 if 加一次赋值。条件用 abs 量距离——abs 里先写 ball_y、再减 centre——整个 abs(...) 写在左边，用 <= 与 step 比；下一行直接给 paddle_y 赋值（不用 +=），半个拍子高写成 PADDLE_H / 2 || 够得着就一步到位：让拍子的中心正对着球，也就是 paddle_y 等于 ball_y 减去半个拍子高" hintEn="Two lines: an if and one assignment. The condition measures the distance with abs - inside it ball_y first, minus centre - with the whole abs(...) on the left, compared with step using <=; the next line assigns paddle_y directly (not with +=), writing half the paddle's height as PADDLE_H / 2 || If it is within reach, get there in one go: put the paddle's centre level with the ball, so paddle_y is ball_y minus half the paddle's height"
    if abs(ball_y - centre) <= step:
        paddle_y = ball_y - PADDLE_H / 2
# <<< BLANK
    elif ball_y > centre:
        paddle_y += step
    else:
        paddle_y -= step
# >>> BLANK id=clamp level=2 hint="一行 return，最外层是 round(…, 9)；里面把 paddle_y 夹在屏幕里：外层 max 管下限、内层 min 管上限，两个函数里都是界限写在前、要夹的值写在后；两个界限都写成浮点数（下限 0.0，上限套一层 float()） || 上限是 float(HEIGHT - PADDLE_H)：夹到边上时交回的仍是浮点数，检查器逐项比类型" hintEn="One return line with round(..., 9) on the outside; inside, keep paddle_y on the screen - an outer max for the lower limit and an inner min for the upper limit, and in both the limit comes first and the value being clamped last; write both limits as floats (0.0 below, the upper one wrapped in float()) || The upper limit is float(HEIGHT - PADDLE_H): a paddle pinned to an edge still comes back as a float, and the checker compares types"
    return round(max(0.0, min(float(HEIGHT - PADDLE_H), paddle_y)), 9)
# <<< BLANK


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    font = pygame.font.Font(None, 32)
    paddle_y = (HEIGHT - PADDLE_H) / 2
    ball = pygame.Vector2(WIDTH / 2, HEIGHT / 2)
    vel = pygame.Vector2(BALL_VEL)
    speed, misses = START_SPEED, 0
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_UP:
                speed += 60
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_DOWN:
                speed = max(60, speed - 60)
# >>> BLANK id=follow level=1 hint="一行：调用 ai_follow，把结果存回 paddle_y；实参依次是拍子现在的 y、球的 y（写 ball.y）、速度上限、这一帧的时长" hintEn="One line: call ai_follow and store the result back in paddle_y; the arguments are, in order, the paddle's current y, the ball's y (written ball.y), the speed limit and this frame's time"
        paddle_y = ai_follow(paddle_y, ball.y, speed, dt)
# <<< BLANK
        ball += vel * dt
        if ball.x < BALL / 2:
            vel.x = abs(vel.x)
        if ball.y < BALL / 2:
            vel.y = abs(vel.y)
        if ball.y > HEIGHT - BALL / 2:
            vel.y = -abs(vel.y)
        paddle = pygame.Rect(PADDLE_X, round(paddle_y), PADDLE_W, PADDLE_H)
        if paddle.collidepoint(round(ball.x + BALL / 2), round(ball.y)):
            vel.x = -abs(vel.x)
        if ball.x > WIDTH:
            misses += 1
            ball = pygame.Vector2(WIDTH / 2, HEIGHT / 2)
        screen.fill(BACKGROUND)
        pygame.draw.rect(screen, PADDLE, paddle)
        pygame.draw.circle(screen, BALL_COLOUR, (round(ball.x), round(ball.y)), BALL // 2)
        label = font.render(f"AI speed {speed} px/s   misses {misses}", True, TEXT)
        screen.blit(label, (20, 20))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
