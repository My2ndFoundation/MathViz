"""Four screens - title, playing, paused, game over - switched by a table of transitions."""
import pygame

WIDTH, HEIGHT = 640, 480
SPEED = 160
BACKGROUND = (14, 17, 28)
PLAYER = (160, 140, 255)
TEXT = (230, 230, 240)
TRANSITIONS = {
    ("title", "space"): "playing",
    ("playing", "pause"): "paused",
# >>> BLANK id=unpause level=1 hint="一行，字典里的一项：键是 (状态, 事件) 元组，值是转移到的状态，行末带逗号，写法与上下几行相同；它说的是「暂停时再按一次 P，回到游戏中」" hintEn="One line, one entry of the dictionary: the key is a (state, event) tuple and the value is the state it moves to, with a comma at the end, written like the lines around it; it says 'while paused, pressing P again goes back to playing'"
    ("paused", "pause"): "playing",
# <<< BLANK
    ("playing", "died"): "game-over",
    ("game-over", "space"): "title",
}
MESSAGES = {
    "title": "Press Space to start",
    "paused": "Paused - press P to carry on",
    "game-over": "Game over - press Space",
}
KEY_EVENTS = {pygame.K_SPACE: "space", pygame.K_p: "pause"}


def next_state(state, event):
# >>> BLANK id=lookup level=2 hint="一行 return：用字典的 get 方法查 TRANSITIONS，键是 state 与 event 组成的元组；表里没有这一对时，get 的第二个实参就是交回的值 || 表里没列出的 (状态, 事件) 一律留在原状态：第二个实参写 state" hintEn="One return line: look TRANSITIONS up with the dictionary's get method, using the tuple of state and event as the key; get's second argument is what comes back when the pair is not in the table || Any (state, event) pair the table does not list leaves the state where it is: the second argument is state"
    return TRANSITIONS.get((state, event), state)
# <<< BLANK


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    font = pygame.font.Font(None, 40)
    state = "title"
    x = 0.0
    running = True
    while running:
        dt = clock.tick(60) / 1000
        events = []
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key in KEY_EVENTS:
                events.append(KEY_EVENTS[event.key])
        if state == "playing":
            x += SPEED * dt
            if x > WIDTH:
                events.append("died")
        for name in events:
            new_state = next_state(state, name)
# >>> BLANK id=restart level=2 hint="只有一个 if 头（下一行把 x 放回 0.0 的那句没挖）：条件用 and 连起两个 ==，旧的 state 是标题画面、new_state 是游戏中；先写 state 那一项，字符串用双引号 || 只有「从标题画面开局」才把方块放回左边；从暂停回到游戏中不重置，接着走" hintEn="Just the if line (the line below it, which puts x back to 0.0, is not blanked): the condition joins two == tests with and - the old state is the title screen and new_state is playing; the state test first, strings in double quotes || Only starting from the title screen puts the square back on the left; coming back from pause does not reset it, it carries on"
            if state == "title" and new_state == "playing":
# <<< BLANK
                x = 0.0
            state = new_state
        screen.fill(BACKGROUND)
        if state != "title":
            pygame.draw.rect(screen, PLAYER, (round(x), HEIGHT // 2 - 20, 40, 40))
        if state in MESSAGES:
            text = font.render(MESSAGES[state], True, TEXT)
            screen.blit(text, (WIDTH // 2 - text.get_width() // 2, 80))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
