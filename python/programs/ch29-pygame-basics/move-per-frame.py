"""Move a square a fixed number of pixels every frame."""
import pygame

WIDTH = 480
HEIGHT = 200
FPS = 60
STEP = 3
SIZE = 30
BACKGROUND = pygame.Color(15, 20, 35)
SQUARE_COLOUR = pygame.Color(120, 200, 255)


def step_x(x, pixels):
    return x + pixels


def wrap(x):
    if x > WIDTH:
        return -SIZE
    return x


def position_after(frames, pixels):
    x = 0
# >>> BLANK id=frames level=2 hint="两行：一个 for 加一行赋值；这里用不到循环变量，就写成下划线；range 只写一个实参；每一轮都交给 step_x 去挪（不写 +=） || 循环 frames 次，每次 x 都换成 step_x(x, pixels) 的结果" hintEn="Two lines: a for and one assignment; the loop variable is not used, so call it an underscore; range gets a single argument; each pass hands the move to step_x (no +=) || Loop frames times, each time replacing x with the result of step_x(x, pixels)"
    for _ in range(frames):
        x = step_x(x, pixels)
# <<< BLANK
    return x


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Move per frame")
    clock = pygame.time.Clock()
    x = 0
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
# >>> BLANK id=move level=2 hint="两行，都是给 x 重新赋值：先按每帧固定的像素数挪，再让它从右边出去后回到左边；两步都调用上面写好的函数，步长用常量（不写数字） || 第一行用 STEP 调 step_x，第二行把 x 交给 wrap" hintEn="Two lines, both reassigning x: first move it by the fixed number of pixels per frame, then bring it back to the left once it leaves on the right; both steps call the functions defined above, with the step as a constant (not a number) || The first line calls step_x with STEP, the second hands x to wrap"
        x = step_x(x, STEP)
        x = wrap(x)
# <<< BLANK
        screen.fill(BACKGROUND)
        pygame.draw.rect(screen, SQUARE_COLOUR, (x, HEIGHT // 2 - SIZE // 2, SIZE, SIZE))
        pygame.display.flip()
# >>> BLANK id=tick level=1 hint="每帧最后一行：让时钟把这一帧拖到 1/FPS 秒——实参写常量 FPS，不写数字 60；返回值这里用不到，不赋给谁" hintEn="The last line of each frame: have the clock stretch this frame to 1/FPS of a second - pass the constant FPS, not the number 60; the return value is not needed here, so do not assign it"
        clock.tick(FPS)
# <<< BLANK
    pygame.quit()


if __name__ == "__main__":
    main()
