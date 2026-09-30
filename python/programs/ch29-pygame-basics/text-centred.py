"""Draw text in the middle of the window with pygame's built-in font."""
import pygame

WIDTH = 480
HEIGHT = 320
FPS = 30
BACKGROUND = pygame.Color(15, 15, 25)
TEXT_COLOUR = pygame.Color(245, 235, 200)
SMALL_COLOUR = pygame.Color(150, 160, 190)


def centre_topleft(text_w, text_h, screen_w, screen_h):
    screen_rect = pygame.Rect(0, 0, screen_w, screen_h)
    box = pygame.Rect(0, 0, text_w, text_h)
# >>> BLANK id=centre level=2 hint="一行赋值：给 box 的 center 属性赋值，右边是整个屏幕矩形 screen_rect 的 center 属性（不自己算除以 2） || 两个 Rect 的 center 对齐：左边是 box 的，右边是 screen_rect 的" hintEn="One assignment: set the center attribute of box to the center attribute of the whole-screen rectangle screen_rect (do not divide by 2 yourself) || Line up the center of two Rects: box's on the left, screen_rect's on the right"
    box.center = screen_rect.center
# <<< BLANK
    return box.topleft


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Centred text")
    clock = pygame.time.Clock()
# >>> BLANK id=font level=2 hint="两行赋值，先 font 后 small：都用 pygame.font.Font，第一个实参写 None（pygame 自带的默认字体，不带任何字体文件），第二个实参是字号 || font 的字号是 64，small 的字号是 28" hintEn="Two assignments, font first and small second: both use pygame.font.Font with None as the first argument (pygame's built-in default font, no font file needed) and the size second || font has size 64 and small has size 28"
    font = pygame.font.Font(None, 64)
    small = pygame.font.Font(None, 28)
# <<< BLANK
    title = font.render("Hello, pygame!", True, TEXT_COLOUR)
    frame = 0
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        frame += 1
        screen.fill(BACKGROUND)
        text_w, text_h = title.get_size()
        screen.blit(title, centre_topleft(text_w, text_h, WIDTH, HEIGHT))
        counter = small.render(f"frame {frame}", True, SMALL_COLOUR)
# >>> BLANK id=getrect level=2 hint="一行赋值，存进 place：问 counter 这张图要它的矩形，在同一个调用里用关键字实参 center= 把它摆好（不另起一行去改 center） || center 是一个元组：横坐标是 WIDTH // 2，纵坐标是 HEIGHT - 40（离底边 40 像素）" hintEn="One assignment into place: ask the image counter for its rectangle and position it in the same call with the keyword argument center= (not by changing center on a later line) || center is a tuple: x is WIDTH // 2 and y is HEIGHT - 40 (40 pixels above the bottom)"
        place = counter.get_rect(center=(WIDTH // 2, HEIGHT - 40))
# <<< BLANK
        screen.blit(counter, place)
        pygame.display.flip()
        clock.tick(FPS)
    pygame.quit()


if __name__ == "__main__":
    main()
