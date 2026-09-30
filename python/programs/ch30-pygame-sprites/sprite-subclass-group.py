"""A Sprite subclass: every ball keeps its own position, one Group moves and draws them all."""
import pygame

WIDTH = 480
HEIGHT = 320
BACKGROUND = (16, 20, 36)


class Ball(pygame.sprite.Sprite):
    def __init__(self, start, velocity, colour):
# >>> BLANK id=super level=2 hint="父类 Sprite 自己也有初始化要做，第一件事就让它做完；用不写出父类名字、super 的括号里也不填东西的那种写法 || 内置的 super 交回父类那一层；在它身上调用初始化方法，不传实参（self 也不用传）" hintEn="The parent class Sprite has its own setting up to do, so let it finish first; use the form that neither spells out the parent's name nor puts anything inside super's brackets || The built-in super hands back the parent layer; call the initialiser on it with no arguments (not even self)"
        super().__init__()
# <<< BLANK
        self.image = pygame.Surface((20, 20))
        self.image.fill(colour)
        self.rect = self.image.get_rect()
        self.pos = pygame.Vector2(start)
        self.vel = pygame.Vector2(velocity)
        self.rect.center = (round(self.pos.x), round(self.pos.y))

    def update(self, dt):
# >>> BLANK id=move level=2 hint="用 += 把这一帧的位移就地加到 self.pos 上；乘法里速度写在前面、dt 写在后面 || 这一帧走过的位移 = 速度（像素 / 秒）乘以这一帧用掉的秒数" hintEn="Use += to add this frame's step onto self.pos in place; in the product the velocity comes first and dt second || This frame's step = velocity (pixels per second) times the seconds this frame took"
        self.pos += self.vel * dt
# <<< BLANK
        self.rect.center = (round(self.pos.x), round(self.pos.y))


def positions_after(starts, vels, steps, dt):
    balls = pygame.sprite.Group()
    for start, vel in zip(starts, vels):
        balls.add(Ball(start, vel, (255, 255, 255)))
    for _ in range(steps):
        balls.update(dt)
    return [(round(b.pos.x, 9), round(b.pos.y, 9)) for b in balls]


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Three balls, one Group")
    clock = pygame.time.Clock()
    balls = pygame.sprite.Group()
    balls.add(Ball((0, 80), (60, 0), (255, 90, 90)))
    balls.add(Ball((0, 160), (120, 0), (90, 220, 120)))
    balls.add(Ball((0, 240), (180, 0), (80, 160, 255)))
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        balls.update(dt)
        for ball in balls:
            if ball.pos.x > WIDTH + 10:
                ball.pos.x = -10
        screen.fill(BACKGROUND)
# >>> BLANK id=draw level=1 hint="一个调用、不写循环：让 Group 把组里每个精灵的 image 画在它自己的 rect 上，画到 screen 上" hintEn="One call, no loop: ask the Group to draw every sprite's image at that sprite's own rect, onto screen"
        balls.draw(screen)
# <<< BLANK
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
