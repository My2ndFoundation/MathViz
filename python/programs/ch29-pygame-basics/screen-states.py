"""Switch between title, playing, paused and game-over screens with a table."""
import pygame

WIDTH = 480
HEIGHT = 320
FPS = 60
SPEED = 160
TRANSITIONS = {
    ("title", "enter"): "playing",
    ("playing", "p"): "paused",
    ("paused", "p"): "playing",
    ("playing", "crash"): "over",
    ("over", "enter"): "title",
}
MESSAGES = {
    "title": "Press Enter to start",
    "playing": "P to pause",
    "paused": "Paused - P to go on",
    "over": "Game over - Enter",
}
KEY_EVENTS = {pygame.K_RETURN: "enter", pygame.K_p: "p"}
BACKGROUND = pygame.Color(20, 20, 32)
TEXT_COLOUR = pygame.Color(235, 235, 245)
BALL_COLOUR = pygame.Color(255, 120, 90)


def next_state(state, event):
# >>> BLANK id=lookup level=2 hint="一行 return：用字典的 get 查表，键是 (state, event) 这个元组；表里没有这一对时，状态不变——第二个实参就是当前状态 || TRANSITIONS.get(…, …)：先是键，再是查不到时交回的缺省值" hintEn="One return: look the table up with the dictionary's get, the key being the tuple (state, event); when the pair is not in the table the state stays the same - so the second argument is the current state || TRANSITIONS.get(…, …): the key first, then the default returned when it is missing"
    return TRANSITIONS.get((state, event), state)
# <<< BLANK


def run_events(state, events):
    for event in events:
        state = next_state(state, event)
    return state


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Screen states")
    clock = pygame.time.Clock()
    font = pygame.font.Font(None, 40)
    state = "title"
    x = 0.0
    running = True
    while running:
        dt = clock.tick(FPS) / 1000
        events = []
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
# >>> BLANK id=keymap level=2 hint="两行：一个 elif（接在上面判 QUIT 的 if 后面，不另起一个 if）加一行 append；两个条件用 and 连起来，先判事件类型是 pygame.KEYDOWN，再判 event.key 在不在 KEY_EVENTS 里（直接 in 字典，不写 .keys()）；追加时用方括号查表（不用 get） || 按下的键在表里，就把表里它对应的事件名追加进 events" hintEn="Two lines: an elif (following the if that checks for QUIT above, not a new if) and an append; join two conditions with and, first that the event type is pygame.KEYDOWN, then whether event.key is in KEY_EVENTS (in straight on the dictionary, no .keys()); look it up with square brackets when appending (not get) || If the key pressed is in the table, append the event name it maps to onto events"
            elif event.type == pygame.KEYDOWN and event.key in KEY_EVENTS:
                events.append(KEY_EVENTS[event.key])
# <<< BLANK
        if state == "playing":
            x += SPEED * dt
            if x > WIDTH:
                x = 0.0
                events.append("crash")
        state = run_events(state, events)
        screen.fill(BACKGROUND)
        if state in ("playing", "paused"):
            pygame.draw.circle(screen, BALL_COLOUR, (round(x), HEIGHT // 2), 15)
        text = font.render(MESSAGES[state], True, TEXT_COLOUR)
        screen.blit(text, text.get_rect(center=(WIDTH // 2, 60)))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
