"""Pick the animation frame to show from the milliseconds that have passed: looping or play-once."""
import pygame

WIDTH = 480
HEIGHT = 320
BACKGROUND = (16, 20, 36)
FRAME_MS = 120


def frame_index(elapsed_ms, frame_ms, n_frames, loop):
# >>> BLANK id=step level=2 hint="用整除 //，不写 int(… / …)；被除数在左 || 到现在为止，一共走完了几个完整的帧时长？存进 step" hintEn="Use floor division //, not int(... / ...); the number being divided goes on the left || How many whole frame lengths have gone by so far? Store it in step"
    step = elapsed_ms // frame_ms
# <<< BLANK
    if loop:
# >>> BLANK id=wrap level=1 hint="循环播放：走完最后一帧又回到第 0 帧——用取余，一行 return" hintEn="Looping: after the last frame it goes back to frame 0 - use the remainder, in a single return"
        return step % n_frames
# <<< BLANK
# >>> BLANK id=hold level=2 hint="只播一次：用内置的 min，step 写在前面、最后一帧的下标写在后面 || 最后一帧的下标比帧数少 1；step 超过它就停在它上面" hintEn="Play once: use the built-in min, with step first and the last frame's index second || The last frame's index is one less than the number of frames; once step passes it, stay on it"
    return min(step, n_frames - 1)
# <<< BLANK


def make_frames(n_frames):
    frames = []
    for i in range(n_frames):
        frame = pygame.Surface((60, 60), pygame.SRCALPHA)
        pygame.draw.circle(frame, (255, 200, 80), (30, 30), 6 + 4 * i)
        frames.append(frame)
    return frames


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Looping (left) and play-once (right)")
    clock = pygame.time.Clock()
    frames = make_frames(6)
    elapsed = 0
    running = True
    while running:
        elapsed += clock.tick(60)
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                elapsed = 0
        looping = frames[frame_index(elapsed, FRAME_MS, len(frames), True)]
        once = frames[frame_index(elapsed, FRAME_MS, len(frames), False)]
        screen.fill(BACKGROUND)
        screen.blit(looping, (120, 130))
        screen.blit(once, (300, 130))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
