"""Pixel-perfect collision with masks: two discs whose boxes overlap while their pixels do not."""
import pygame

WIDTH = 480
HEIGHT = 320
BACKGROUND = (16, 20, 36)
BOX_COLOUR = (70, 70, 90)
RADIUS = 40


def make_disc(colour):
    disc = pygame.Surface((2 * RADIUS, 2 * RADIUS), pygame.SRCALPHA)
    pygame.draw.circle(disc, colour, (RADIUS, RADIUS), RADIUS)
    return disc


def pixel_hit(mask_a, rect_a, mask_b, rect_b):
# >>> BLANK id=offset level=2 hint="带圆括号的二元组，b 的位置减去 a 的位置：先 x 后 y，用两个矩形的 .x 和 .y 属性 || 这是 b 的左上角相对 a 的左上角挪开了多少，存进 offset" hintEn="A bracketed 2-tuple, b's position minus a's: x first then y, using the .x and .y attributes of the two rectangles || It is how far b's top-left corner sits from a's top-left corner; store it in offset"
    offset = (rect_b.x - rect_a.x, rect_b.y - rect_a.y)
# <<< BLANK
# >>> BLANK id=overlap level=2 hint="在 mask_a 上调用方法，给它 mask_b 和 offset；写成 is not None 的比较，不用 bool(…) || 这个方法叫 overlap：两张掩码有重叠时交回第一个重叠像素的坐标，没有时交回 None" hintEn="Call a method on mask_a, giving it mask_b and offset; write it as an is not None comparison, not bool(...) || The method is overlap: it hands back the first overlapping pixel's coordinates, or None when there is no overlap"
    return mask_a.overlap(mask_b, offset) is not None
# <<< BLANK


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    still = make_disc((120, 120, 140))
    mover = make_disc((90, 220, 120))
    still_mask = pygame.mask.from_surface(still)
    mover_mask = pygame.mask.from_surface(mover)
    still_rect = still.get_rect(center=(200, 160))
    mover_rect = mover.get_rect(center=(260, 220))
    running = True
    while running:
        clock.tick(60)
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.MOUSEMOTION:
                mover_rect.center = event.pos
# >>> BLANK id=boxes level=1 hint="先用外接矩形粗查一次：still_rect 在前，调用它判重叠的方法，结果存进 box" hintEn="First a rough check with the bounding boxes: still_rect first, call its overlap-test method, and store the answer in box"
        box = still_rect.colliderect(mover_rect)
# <<< BLANK
        pixels = pixel_hit(still_mask, still_rect, mover_mask, mover_rect)
        pygame.display.set_caption(f"boxes overlap: {box}   pixels overlap: {pixels}")
        screen.fill((60, 20, 30) if pixels else BACKGROUND)
        pygame.draw.rect(screen, BOX_COLOUR, still_rect, 1)
        pygame.draw.rect(screen, BOX_COLOUR, mover_rect, 1)
        screen.blit(still, still_rect)
        screen.blit(mover, mover_rect)
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
