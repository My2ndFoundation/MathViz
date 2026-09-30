"""Steer a box with the arrow keys; it turns red while it overlaps the wall (four strict comparisons)."""
import pygame

WIDTH = 480
HEIGHT = 320
BACKGROUND = (16, 20, 36)
SPEED = 200
WALL = pygame.Rect(260, 100, 80, 120)


def overlaps(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
# >>> BLANK id=across level=2 hint="和下一行 down 一模一样的结构：把 y 换成 x、h 换成 w，存进 across；两处都是严格的小于号 || 横向有重叠：a 的左边在 b 的右边之左，而且 b 的左边在 a 的右边之左" hintEn="Exactly the same shape as the down line below: swap y for x and h for w, and store it in across; both comparisons are a strict less-than || They overlap across when a's left edge is left of b's right edge and b's left edge is left of a's right edge"
    across = ax < bx + bw and bx < ax + aw
# <<< BLANK
    down = ay < by + bh and by < ay + ah
# >>> BLANK id=both level=1 hint="横向和纵向都重叠才算碰；across 写在 and 的左边，不加括号" hintEn="It is only a hit when they overlap both across and down; across goes on the left of the and, with no brackets"
    return across and down
# <<< BLANK


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Overlap test: four comparisons")
    clock = pygame.time.Clock()
    pos = pygame.Vector2(80, 140)
    player = pygame.Rect(0, 0, 40, 40)
    running = True
    while running:
        dt = clock.tick(60) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        keys = pygame.key.get_pressed()
        pos.x += (keys[pygame.K_RIGHT] - keys[pygame.K_LEFT]) * SPEED * dt
        pos.y += (keys[pygame.K_DOWN] - keys[pygame.K_UP]) * SPEED * dt
        player.topleft = (round(pos.x), round(pos.y))
# >>> BLANK id=hit level=1 hint="拿本程序自己写的判重叠函数比 player 和墙 WALL，player 在前；结果存进 hit" hintEn="Use this program's own overlap function on player and the wall WALL, player first; store the answer in hit"
        hit = overlaps(player, WALL)
# <<< BLANK
        colour = (255, 80, 80) if hit else (90, 220, 120)
        screen.fill(BACKGROUND)
        pygame.draw.rect(screen, (120, 120, 140), WALL)
        pygame.draw.rect(screen, colour, player)
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
