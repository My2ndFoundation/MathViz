"""Snake: arrow keys steer, food makes the snake longer, and a wall or its own body ends the game."""
import random

import pygame

CELL = 24
N = 20
SIZE = CELL * N
STEP_TIME = 0.12
SEED = 20260930
BACKGROUND = (12, 16, 24)
SNAKE = (90, 220, 140)
HEAD = (180, 255, 210)
FOOD = (255, 110, 110)
TEXT = (230, 230, 240)
KEYS = {
    pygame.K_UP: (0, -1),
    pygame.K_DOWN: (0, 1),
    pygame.K_LEFT: (-1, 0),
    pygame.K_RIGHT: (1, 0),
}


def snake_step(body, direction, food, n):
    head = (body[0][0] + direction[0], body[0][1] + direction[1])
    if not (0 <= head[0] < n and 0 <= head[1] < n):
        return (list(body), "dead")
# >>> BLANK id=bite level=2 hint="只有一个 if 头（下一行的 return 没挖）：用 in 判断新的头是不是落在蛇身上——但不含最后一格，所以用切片把 body 的最后一个元素去掉；切片只写终点，用负下标 || 这一步尾巴会让开，走进尾巴此刻所在的格子不算撞：切片写 body[:-1]" hintEn="Just the if line (the return below it is not blanked): use in to ask whether the new head lands on the body - but not on the last cell, so slice the last element off body; give the slice only an end, as a negative index || The tail moves out of the way on this step, so moving into the cell the tail is in now is not a crash: the slice is body[:-1]"
    if head in body[:-1]:
# <<< BLANK
        return (list(body), "dead")
    if head == food:
        return ([head] + body, "ate")
# >>> BLANK id=moved level=2 hint="一行 return，照上面「吃到」那一行的样子（外层括号、双引号都一样）：第一项用 + 拼出新的蛇身，新头放在一个单元素列表里写在前面；去掉最后一格的切片只写终点，用负下标 || 没吃到，蛇身长度不变：新头加上去，最后一格去掉；字符串的内容是 moved" hintEn="One return line shaped like the ate line above (same outer brackets, same double quotes): the first item builds the new body with +, the new head in a one-element list written first; the slice that drops the last cell gives only an end, as a negative index || Nothing eaten, so the length stays the same: add the new head and drop the last cell; the string reads moved"
    return ([head] + body[:-1], "moved")
# <<< BLANK


def place_food(body, rng):
    free = [(x, y) for x in range(N) for y in range(N) if (x, y) not in body]
    return rng.choice(free)


def new_game(rng):
    body = [(5, N // 2), (4, N // 2), (3, N // 2)]
    return body, (1, 0), place_food(body, rng)


def draw(screen, font, body, food, dead):
    screen.fill(BACKGROUND)
    pygame.draw.rect(screen, FOOD, (food[0] * CELL, food[1] * CELL, CELL, CELL))
    for i, (x, y) in enumerate(body):
        colour = HEAD if i == 0 else SNAKE
        pygame.draw.rect(screen, colour, (x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2))
    score = font.render(f"length {len(body)}", True, TEXT)
    screen.blit(score, (10, 10))
    if dead:
        over = font.render("Game over - press R to play again", True, TEXT)
        screen.blit(over, (SIZE // 2 - over.get_width() // 2, SIZE // 2))
    pygame.display.flip()


def main():
    pygame.init()
    screen = pygame.display.set_mode((SIZE, SIZE))
    pygame.display.set_caption("Snake")
    clock = pygame.time.Clock()
    font = pygame.font.Font(None, 32)
    rng = random.Random(SEED)
    body, direction, food = new_game(rng)
    turn, dead, timer = direction, False, 0.0
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key in KEYS:
                wanted = KEYS[event.key]
# >>> BLANK id=no-reverse level=2 hint="只有一个 if 头：wanted 与「当前方向反过来」不相等时才接受这次转向（用 !=，wanted 写在左边）；「反过来」写成一个元组，两个分量各取负 || 反方向就是 (-direction[0], -direction[1])——直接掉头，新头就落在脖子上" hintEn="Just the if line: accept the turn only when wanted is not equal to 'the current direction reversed' (use !=, wanted on the left); write 'reversed' as a tuple with both components negated || The reverse is (-direction[0], -direction[1]) - turning straight back would put the new head on the snake's neck"
                if wanted != (-direction[0], -direction[1]):
# <<< BLANK
                    turn = wanted
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_r and dead:
                body, direction, food = new_game(rng)
                turn, dead, timer = direction, False, 0.0
        timer += dt
        if timer >= STEP_TIME and not dead:
            timer -= STEP_TIME
            direction = turn
            body, state = snake_step(body, direction, food, N)
            if state == "ate":
                food = place_food(body, rng)
            dead = state == "dead"
        draw(screen, font, body, food, dead)
    pygame.quit()


if __name__ == "__main__":
    main()
