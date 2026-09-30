"""One snake step with the body in a deque: appendleft and pop are both quick at the two ends."""
from collections import deque

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
    tail = snake.pop()
    if not (0 <= head[0] < n and 0 <= head[1] < n) or head in snake:
        snake.append(tail)
        return "dead"
# >>> BLANK id=new-head level=1 hint="一行：用 deque 的 appendleft 方法把 head 放到最左端（蛇身最前面）" hintEn="One line: use the deque's appendleft method to put head at the left-hand end (the very front of the body)"
    snake.appendleft(head)
# <<< BLANK
    if head == food:
        snake.append(tail)
        return "ate"
    return "moved"


def snake_step(body, direction, food, n):
# >>> BLANK id=wrap level=1 hint="一行：用 body 新建一个 deque，存进 snake——调用 deque() 本身就会复制一份，调用者手里的 body 不会被改掉" hintEn="One line: build a new deque from body and keep it in snake - calling deque() makes a copy, so the caller's body is left alone"
    snake = deque(body)
# <<< BLANK
    state = advance(snake, direction, food, n)
# >>> BLANK id=back-to-list level=2 hint="一行 return：外层带括号的元组，第一项把 snake 转回列表（调用内置的 list()），第二项是 state || 检查器拿返回值与一个只用列表的参照逐项比，类型也要相同：deque 与 list 是两种类型，所以要转回去" hintEn="One return line: a tuple in outer brackets whose first item turns snake back into a list (a call to the built-in list()) and whose second item is state || The checker compares the result item by item with a reference that uses only lists, types included: a deque and a list are different types, so turn it back"
    return (list(snake), state)
# <<< BLANK


def main():
    pygame.init()
    screen = pygame.display.set_mode((SIZE, SIZE))
    clock = pygame.time.Clock()
    snake = deque(START)
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
                snake, direction = deque(START), (1, 0)
        screen.fill(BACKGROUND)
        pygame.draw.rect(screen, FOOD, (food[0] * CELL, food[1] * CELL, CELL, CELL))
        for x, y in snake:
            pygame.draw.rect(screen, SNAKE, (x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
