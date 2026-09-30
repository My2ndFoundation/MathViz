"""Move a square at a fixed speed in pixels per second, whatever the frame rate."""
import pygame

WIDTH = 480
HEIGHT = 200
FPS = 60
SPEED = 180
SIZE = 30
BACKGROUND = pygame.Color(15, 20, 35)
SQUARE_COLOUR = pygame.Color(120, 255, 170)


def step_x(x, speed, dt):
# >>> BLANK id=step level=2 hint="一行 return：速度的单位是像素 / 秒、dt 的单位是秒，两者相乘就是这一帧该走的像素；乘积写在加号右边、不加括号，先写 speed 再写 dt || 交回的是新位置：旧位置 x 加上这一帧走的像素" hintEn="One return: speed is in pixels per second and dt is in seconds, so their product is the pixels for this frame; put the product on the right of the plus with no brackets, speed before dt || What comes back is the new position: the old position x plus the pixels for this frame"
    return x + speed * dt
# <<< BLANK


def wrap(x):
    if x > WIDTH:
        return -SIZE
    return x


def position_after(frames_ms, speed):
    x = 0.0
    for ms in frames_ms:
# >>> BLANK id=seconds level=2 hint="一行：把这一帧的毫秒数换算成秒，存进 dt；除以整数 1000（不写 1000.0，也不乘 0.001） || dt 等于 ms 除以 1000" hintEn="One line: convert this frame's milliseconds into seconds and store them in dt; divide by the integer 1000 (not 1000.0, and not times 0.001) || dt is ms divided by 1000"
        dt = ms / 1000
# <<< BLANK
        x = step_x(x, speed, dt)
    return round(x, 9)


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Move with dt")
    clock = pygame.time.Clock()
    x = 0.0
    running = True
    while running:
# >>> BLANK id=tick level=2 hint="每帧第一行，一次赋值：tick 交回的是上一帧到现在过了多少毫秒，除以整数 1000 变成秒，存进 dt；实参写常量 FPS || dt 等于 clock.tick(FPS) 除以 1000" hintEn="The first line of each frame, one assignment: tick returns how many milliseconds have passed since the last frame; divide by the integer 1000 to get seconds and store them in dt; pass the constant FPS || dt is clock.tick(FPS) divided by 1000"
        dt = clock.tick(FPS) / 1000
# <<< BLANK
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        x = step_x(x, SPEED, dt)
        x = wrap(x)
        screen.fill(BACKGROUND)
        pygame.draw.rect(screen, SQUARE_COLOUR, (round(x), HEIGHT // 2 - SIZE // 2, SIZE, SIZE))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
