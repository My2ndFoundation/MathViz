"""A dot chases the mouse at a fixed speed and stops exactly on it."""
import pygame

WIDTH, HEIGHT = 640, 480
SPEED = 250
BACKGROUND = (20, 24, 36)
CHASER = (120, 230, 160)
CURSOR = (90, 90, 120)


def step_toward(pos, target, speed, dt):
    current = pygame.Vector2(pos)
    if target is not None:
# >>> BLANK id=towards level=2 hint="一行赋值：调用 current 的 move_towards（交回新向量的那个，不是 move_towards_ip），把结果赋回 current；第一个实参直接用 target，第二个实参写成 speed * dt || move_towards 的第二个实参是「这一步最多走多远」：够得着目标就正好停在目标上，够不着就朝它走这么远" hintEn="One assignment: call move_towards on current (the one that returns a new vector, not move_towards_ip) and assign the result back to current; pass target itself as the first argument and write the second as speed * dt || The second argument of move_towards is the most it may move this step: if the target is within reach it stops exactly on it, otherwise it moves that far towards it"
        current = current.move_towards(target, speed * dt)
# <<< BLANK
    return (round(current.x, 9), round(current.y, 9))


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    pos = (WIDTH / 2, HEIGHT / 2)
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        target = None
        if pygame.mouse.get_focused():
            target = pygame.mouse.get_pos()
# >>> BLANK id=call level=1 hint="一行：调用 step_toward，把交回的新位置赋回 pos；四个实参都按位置传（不写 形参名=），顺序照 step_toward 的形参，速率用本程序顶上的那个常量" hintEn="One line: call step_toward and assign the new position it returns back to pos; pass all four arguments by position (no name=), in the order of step_toward's parameters, with the constant at the top of this program as the speed"
        pos = step_toward(pos, target, SPEED, dt)
# <<< BLANK
        screen.fill(BACKGROUND)
        if target is not None:
            pygame.draw.circle(screen, CURSOR, target, 14, 2)
        pygame.draw.circle(screen, CHASER, pos, 10)
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
