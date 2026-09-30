"""Steer a box with the arrow keys; it turns red while it overlaps the wall (Rect.colliderect)."""
import pygame

WIDTH = 480
HEIGHT = 320
BACKGROUND = (16, 20, 36)
SPEED = 200
WALL = pygame.Rect(260, 100, 80, 120)


def overlaps(a, b):
# >>> BLANK id=collide level=2 hint="两个实参都先各自包成 pygame.Rect；在 a 包出来的那个矩形上调用方法，b 包出来的当实参 || 判断两个矩形有没有重叠的那个 Rect 方法，名字里有 collide 和 rect；直接 return 它的结果" hintEn="Wrap each argument in its own pygame.Rect first; call the method on the one made from a, with the one made from b as the argument || The Rect method that tells whether two rectangles overlap has collide and rect in its name; return its result directly"
    return pygame.Rect(a).colliderect(pygame.Rect(b))
# <<< BLANK


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Overlap test: Rect.colliderect")
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
# >>> BLANK id=topleft level=2 hint="浮点位置 pos 只在画之前交给矩形：给 player 的左上角赋一个带圆括号的二元组，两个坐标各自用内置 round 取整 || 左上角的属性名是 topleft；先 pos.x、后 pos.y" hintEn="The float position pos is handed to the rectangle only just before drawing: assign a bracketed 2-tuple to player's top-left corner, rounding each coordinate with the built-in round || The top-left attribute is topleft; pos.x first, then pos.y"
        player.topleft = (round(pos.x), round(pos.y))
# <<< BLANK
        hit = overlaps(player, WALL)
        colour = (255, 80, 80) if hit else (90, 220, 120)
        screen.fill(BACKGROUND)
        pygame.draw.rect(screen, (120, 120, 140), WALL)
        pygame.draw.rect(screen, colour, player)
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
