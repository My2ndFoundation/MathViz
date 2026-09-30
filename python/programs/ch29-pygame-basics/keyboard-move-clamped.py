"""Move a square with the arrow keys and keep it inside the window."""
import pygame

WIDTH = 480
HEIGHT = 320
FPS = 60
SIZE = 40
SPEED = 240
SCREEN = pygame.Rect(0, 0, WIDTH, HEIGHT)
ARROWS = {
    "left": pygame.K_LEFT,
    "right": pygame.K_RIGHT,
    "up": pygame.K_UP,
    "down": pygame.K_DOWN,
}
COLOURS = [pygame.Color(255, 200, 60), pygame.Color(90, 220, 140)]
BACKGROUND = pygame.Color(18, 18, 28)


def step(pos, keys, pixels):
    dx = 0
    dy = 0
    if "left" in keys:
        dx -= pixels
    if "right" in keys:
        dx += pixels
    if "up" in keys:
        dy -= pixels
    if "down" in keys:
        dy += pixels
    box = pygame.Rect(pos[0] + dx, pos[1] + dy, SIZE, SIZE)
# >>> BLANK id=clamp level=2 hint="一行，给 box 重新赋值：Rect 有一个方法，交回一个挪进另一个矩形里面的新矩形（原来的不变，所以要接住它）；实参是整个窗口那个常量矩形 || 那个方法叫 clamp，接住的结果仍然叫 box" hintEn="One line reassigning box: a Rect has a method that returns a new rectangle moved inside another one (the original is unchanged, so catch the result); the argument is the constant rectangle for the whole window || The method is called clamp, and the result it hands back is still called box"
    box = box.clamp(SCREEN)
# <<< BLANK
# >>> BLANK id=corner level=1 hint="一行 return：交回 box 左上角的 (x, y)——Rect 有一个属性直接就是这个元组，写这一个属性名（不写 (box.x, box.y)）" hintEn="One return: hand back the (x, y) of box's top-left corner - a Rect has one attribute that is exactly this tuple, so write that one attribute name (not (box.x, box.y))"
    return box.topleft
# <<< BLANK


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Arrow keys")
    clock = pygame.time.Clock()
    pos = (WIDTH // 2, HEIGHT // 2)
    colour = 0
    running = True
    while running:
        dt = clock.tick(FPS) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
# >>> BLANK id=keydown level=2 hint="两行：一个 elif（接在上面判 QUIT 的 if 后面，不另起一个 if）加一行赋值；两个条件用 and 连起来，先判事件类型是 pygame.KEYDOWN，再判 event.key 是不是 pygame.K_SPACE（都写 == ，都写全名）；换色用减法，不用 % || 按下空格的那一下，colour 在 0 和 1 之间换一次：用 1 减去它自己" hintEn="Two lines: an elif (following the if that checks for QUIT above, not a new if) and one assignment; join two conditions with and, first that the event type is pygame.KEYDOWN, then whether event.key is pygame.K_SPACE (both with ==, both full names); swap the colour with a subtraction, not % || On the press of the space bar, colour swaps between 0 and 1 once: subtract it from 1"
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
                colour = 1 - colour
# <<< BLANK
        pressed = pygame.key.get_pressed()
        keys = {name for name, code in ARROWS.items() if pressed[code]}
        pos = step(pos, keys, round(SPEED * dt))
        screen.fill(BACKGROUND)
        pygame.draw.rect(screen, COLOURS[colour], (pos[0], pos[1], SIZE, SIZE))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
