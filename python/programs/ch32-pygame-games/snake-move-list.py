"""One snake step with the body in a list: a new head goes in at the front, the tail drops off."""
import pygame

CELL, N = 24, 16
SIZE = CELL * N
STEP_TIME = 0.15
START = [(4, 8), (3, 8), (2, 8)]
FOODS = [(12, 4), (3, 3), (8, 12), (13, 13), (2, 11)]
BACKGROUND = (12, 16, 24)
SNAKE = (90, 220, 140)
FOOD = (255, 110, 110)
KEYS = {pygame.K_UP: (0, -1), pygame.K_DOWN: (0, 1), pygame.K_LEFT: (-1, 0), pygame.K_RIGHT: (1, 0)}


def advance(snake, direction, food, n):
    head = (snake[0][0] + direction[0], snake[0][1] + direction[1])
# >>> BLANK id=tail-first level=2 hint="一行：用列表的 pop 方法（不带实参）取下蛇身最后一格，存进变量 tail || 先把尾巴拿下来，下面判「撞到自己」时蛇身里就已经没有它了——这一步尾巴本来就会让开" hintEn="One line: take the last cell off the body with the list's pop method (no argument) and keep it in the variable tail || Taking the tail off first means the 'hit itself' test below no longer sees it - on this step the tail moves out of the way anyway"
    tail = snake.pop()
# <<< BLANK
    if not (0 <= head[0] < n and 0 <= head[1] < n) or head in snake:
        snake.append(tail)
        return "dead"
# >>> BLANK id=new-head level=1 hint="一行：用列表的 insert 方法把 head 放到下标 0（蛇身最前面）" hintEn="One line: use the list's insert method to put head at index 0 (the very front of the body)"
    snake.insert(0, head)
# <<< BLANK
    if head == food:
        snake.append(tail)
        return "ate"
    return "moved"


def snake_step(body, direction, food, n):
# >>> BLANK id=copy level=2 hint="一行：把 body 复制一份存进 snake，写成调用内置的 list()（不用切片，不用 .copy()） || advance 会就地改它收到的列表；先复制，调用 snake_step 的人手里那份 body 就不会被改掉" hintEn="One line: make a copy of body and keep it in snake, written as a call to the built-in list() (no slice, no .copy()) || advance changes the list it is given in place; copying first means the caller's body is left alone"
    snake = list(body)
# <<< BLANK
    state = advance(snake, direction, food, n)
    return (snake, state)


def main():
    pygame.init()
    screen = pygame.display.set_mode((SIZE, SIZE))
    clock = pygame.time.Clock()
    snake = list(START)
    direction, eaten, timer = (1, 0), 0, 0.0
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key in KEYS:
                direction = KEYS[event.key]
        food = FOODS[eaten % len(FOODS)]
        timer += dt
        if timer >= STEP_TIME:
            timer -= STEP_TIME
            state = advance(snake, direction, food, N)
            if state == "ate":
                eaten += 1
            elif state == "dead":
                snake, direction = list(START), (1, 0)
        screen.fill(BACKGROUND)
        pygame.draw.rect(screen, FOOD, (food[0] * CELL, food[1] * CELL, CELL, CELL))
        for x, y in snake:
            pygame.draw.rect(screen, SNAKE, (x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
