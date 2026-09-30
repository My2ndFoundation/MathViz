"""Two circles touch when the gap between their centres is at most the sum of their radii."""
import pygame

WIDTH = 480
HEIGHT = 320
BACKGROUND = (16, 20, 36)


def circles_touch(c1, r1, c2, r2):
    dx = c2[0] - c1[0]
    dy = c2[1] - c1[1]
    reach = r1 + r2
# >>> BLANK id=compare level=2 hint="不开方：两边都是平方，而且都用乘法写、不用 **；距离的平方写在比较号左边，dx 那一项在前，不加括号 || 刚好相切（距离等于半径和）也算碰，所以比较号带等号" hintEn="No square root: compare squares on both sides, written with multiplication rather than **; the squared distance goes on the left of the comparison, with the dx term first and no brackets || Exactly touching (distance equal to the sum of the radii) counts as a hit, so the comparison includes equals"
    return dx * dx + dy * dy <= reach * reach
# <<< BLANK


def make_ball(centre, radius, colour):
    ball = pygame.sprite.Sprite()
    ball.image = pygame.Surface((2 * radius, 2 * radius), pygame.SRCALPHA)
    pygame.draw.circle(ball.image, colour, (radius, radius), radius)
    ball.rect = ball.image.get_rect(center=centre)
# >>> BLANK id=radius level=1 hint="collide_circle 会先找精灵身上一个叫 radius 的属性；把实参 radius 存到 ball 身上" hintEn="collide_circle first looks for an attribute called radius on each sprite; store the argument radius on ball"
    ball.radius = radius
# <<< BLANK
    return ball


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    fixed = make_ball((240, 160), 50, (120, 120, 140))
    moving = make_ball((80, 80), 30, (90, 220, 120))
    balls = pygame.sprite.Group(fixed, moving)
    running = True
    while running:
        clock.tick(60)
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.MOUSEMOTION:
                moving.rect.center = event.pos
        mine = circles_touch(fixed.rect.center, fixed.radius, moving.rect.center, moving.radius)
# >>> BLANK id=theirs level=2 hint="pygame 自带的同一种判断，拿来对照：fixed 在前、moving 在后，结果存进 theirs || 它在 pygame.sprite 模块里，名字是 collide 加下划线再加 circle" hintEn="pygame's own version of the same test, for comparison: fixed first, moving second, stored in theirs || It lives in the pygame.sprite module and is called collide, underscore, circle"
        theirs = pygame.sprite.collide_circle(fixed, moving)
# <<< BLANK
        pygame.display.set_caption(f"circles_touch: {mine}   collide_circle: {theirs}")
        screen.fill((60, 20, 30) if mine else BACKGROUND)
        balls.draw(screen)
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
