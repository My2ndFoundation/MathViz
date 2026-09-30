"""Bullets and targets: groupcollide removes both on a hit, settling one bullet at a time."""
import pygame

WIDTH = 480
HEIGHT = 320
BACKGROUND = (16, 20, 36)
WHITE = (240, 240, 240)
RED = (255, 90, 90)
BULLET_SPEED = 300


class Box(pygame.sprite.Sprite):
    def __init__(self, rect, colour):
        super().__init__()
        self.rect = pygame.Rect(rect)
        self.image = pygame.Surface(self.rect.size)
        self.image.fill(colour)
        self.y = float(self.rect.y)

    def update(self, dt):
        self.y -= BULLET_SPEED * dt
        self.rect.y = round(self.y)
        if self.rect.bottom < 0:
# >>> BLANK id=kill level=1 hint="子弹飞出屏幕顶：一个不带实参的方法调用，把它从它所在的每一个组里拿掉" hintEn="The bullet has left the top of the screen: one method call with no arguments that takes it out of every group it belongs to"
            self.kill()
# <<< BLANK


def settle(shots, enemies):
# >>> BLANK id=collide level=2 hint="一次比两个组：shots 在前、enemies 在后，两个 dokill 都按位置传 True；结果存进 hits || pygame.sprite 模块里比两个组的那个函数，名字是 group 接 collide" hintEn="Compare two groups in one call: shots first, enemies second, and both dokill flags passed by position as True; store the result in hits || The pygame.sprite function that compares two groups is named group followed by collide"
    hits = pygame.sprite.groupcollide(shots, enemies, True, True)
# <<< BLANK
# >>> BLANK id=score level=2 hint="用内置 sum 加一个生成式（不用 map，也不套方括号）：每颗命中的子弹对应一个列表，加起来的是这些列表的长度；循环变量叫 hit || hits 的键是子弹，值是这颗子弹打掉的目标列表，所以遍历 hits.values()" hintEn="Use the built-in sum with a generator expression (not map, and no square brackets): each bullet that hit has a list, and you add up the lengths of those lists; the loop variable is hit || The keys of hits are bullets and each value is the list of targets that bullet destroyed, so loop over hits.values()"
    return sum(len(hit) for hit in hits.values())
# <<< BLANK


def resolve(bullets, targets):
    shots = pygame.sprite.Group([Box(r, WHITE) for r in bullets])
    enemies = pygame.sprite.Group([Box(r, RED) for r in targets])
    score = settle(shots, enemies)
    return score, [tuple(s.rect) for s in shots], [tuple(e.rect) for e in enemies]


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Space to fire, mouse to aim")
    clock = pygame.time.Clock()
    font = pygame.font.Font(None, 28)
    enemies = pygame.sprite.Group([Box((30 + 60 * i, 40, 40, 20), RED) for i in range(7)])
    shots = pygame.sprite.Group()
    gun = pygame.Rect(0, HEIGHT - 30, 20, 20)
    score = 0
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
                shots.add(Box((gun.centerx - 2, gun.top - 12, 4, 12), WHITE))
        gun.centerx = pygame.mouse.get_pos()[0]
        shots.update(dt)
        score += settle(shots, enemies)
        screen.fill(BACKGROUND)
        enemies.draw(screen)
        shots.draw(screen)
        pygame.draw.rect(screen, WHITE, gun)
        screen.blit(font.render(f"Score: {score}", True, WHITE), (10, HEIGHT - 60))
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
