"""Draw a ship in code, save it as a PNG file, load it back and make its background see-through."""
import pygame

WIDTH = 480
HEIGHT = 320
BACKGROUND = (16, 20, 36)
KEY_COLOUR = (255, 0, 255)
FILENAME = "ship.png"


def make_ship():
    ship = pygame.Surface((40, 30))
    ship.fill(KEY_COLOUR)
    pygame.draw.polygon(ship, (80, 200, 255), [(0, 29), (20, 0), (39, 29)])
    pygame.draw.circle(ship, (255, 255, 255), (20, 18), 5)
    return ship


def load_ship(path):
# >>> BLANK id=load level=2 hint="一行连写两步：先按路径 path 读进文件，紧接着在同一个表达式上转换成屏幕的像素格式、带透明通道的那一种 || pygame.image 模块里读文件的函数，后面直接接 .convert_alpha()，结果存进 image" hintEn="Two steps chained on one line: read the file at path, then straight away convert it on the same expression to the screen's pixel format, the kind with an alpha channel || The file-reading function in the pygame.image module, followed directly by .convert_alpha(), stored in image"
    image = pygame.image.load(path).convert_alpha()
# <<< BLANK
# >>> BLANK id=colorkey level=1 hint="把画船时铺底的那种颜色设成透明色：用常量 KEY_COLOUR，不要把三个数字重写一遍" hintEn="Make the colour the ship was painted on transparent: use the constant KEY_COLOUR rather than writing the three numbers again"
    image.set_colorkey(KEY_COLOUR)
# <<< BLANK
    return image


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Saved, then loaded")
    clock = pygame.time.Clock()
# >>> BLANK id=save level=2 hint="把刚画好的船存成文件：直接把 make_ship() 的结果当第一个实参，文件名用常量 FILENAME || pygame.image 模块里写文件的函数；先给图，再给文件名" hintEn="Save the freshly drawn ship to a file: pass the result of make_ship() straight in as the first argument, and use the constant FILENAME for the name || The file-writing function in the pygame.image module; the picture first, then the file name"
    pygame.image.save(make_ship(), FILENAME)
# <<< BLANK
    plain = pygame.image.load(FILENAME).convert()
    ship = load_ship(FILENAME)
    left = plain.get_rect(center=(WIDTH // 3, HEIGHT // 2))
    right = ship.get_rect(center=(2 * WIDTH // 3, HEIGHT // 2))
    running = True
    while running:
        clock.tick(60)
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        screen.fill(BACKGROUND)
        screen.blit(plain, left)
        screen.blit(ship, right)
        pygame.display.flip()
    pygame.quit()


if __name__ == "__main__":
    main()
