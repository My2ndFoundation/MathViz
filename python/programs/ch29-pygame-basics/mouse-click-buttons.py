"""Click one of three buttons with the mouse to choose a colour."""
import pygame

WIDTH = 480
HEIGHT = 320
FPS = 30
BUTTONS = [(40, 240, 120, 50), (180, 240, 120, 50), (320, 240, 120, 50)]
COLOURS = [
    pygame.Color(220, 70, 70),
    pygame.Color(70, 190, 100),
    pygame.Color(70, 120, 230),
]
OUTLINE = pygame.Color(240, 240, 240)
BACKGROUND = pygame.Color(25, 25, 35)


def clicked(buttons, pos):
    for i, button in enumerate(buttons):
# >>> BLANK id=hit level=2 hint="两行：一个 if 加一行 return；先用 pygame.Rect(button) 把元组变成矩形，再在它上面直接调用判「点在不在里面」的方法，实参是 pos（不自己比坐标） || 点落在第 i 个按钮里，就交回 i——列表里靠前的按钮先赢" hintEn="Two lines: an if and a return; turn the tuple into a rectangle with pygame.Rect(button), then call its is-this-point-inside method on it straight away, passing pos (do not compare coordinates yourself) || If the point is inside button i, return i - earlier buttons in the list win"
        if pygame.Rect(button).collidepoint(pos):
            return i
# <<< BLANK
    return -1


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Mouse buttons")
    clock = pygame.time.Clock()
    chosen = -1
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
# >>> BLANK id=click level=2 hint="一行 elif，接在上面判 QUIT 的 if 后面（不另起一个 if）：两个条件用 and 连起来，先判事件类型是 pygame.MOUSEBUTTONDOWN，再判 event.button 是不是 1（左键）；都写 == || 鼠标键按下的事件，而且按的是左键" hintEn="One elif, following the if that checks for QUIT above (not a new if): join two conditions with and, first that the event type is pygame.MOUSEBUTTONDOWN, then whether event.button is 1 (the left button); both with == || A mouse-button-down event, and the button pressed is the left one"
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
# <<< BLANK
                hit = clicked(BUTTONS, event.pos)
                if hit != -1:
                    chosen = hit
        screen.fill(BACKGROUND)
        if chosen != -1:
            pygame.draw.circle(screen, COLOURS[chosen], (WIDTH // 2, 110), 70)
        for i, button in enumerate(BUTTONS):
            pygame.draw.rect(screen, COLOURS[i], button)
            pygame.draw.rect(screen, OUTLINE, button, 3 if i == chosen else 1)
        pygame.display.flip()
        clock.tick(FPS)
    pygame.quit()


if __name__ == "__main__":
    main()
