"""Open a file that may not exist: look first with pathlib.Path.exists()."""

from pathlib import Path

DEFAULTS = ["volume=5", "theme=dark"]


def read_settings(path):
# >>> BLANK id=exists-check level=2 hint="先看再做：路径不存在就走默认值——把字符串 path 包成 Path 对象、当场问它存不存在，用 not 取反（不写 == False） || not 后面紧跟 Path(path) 上那个不带实参的方法调用" hintEn="Look before you leap: if the path does not exist, fall back to the defaults - wrap the string path in a Path object, ask it on the spot whether it exists, and negate that with not (not == False) || not, followed straight away by the no-argument method call on Path(path)"
    if not Path(path).exists():
# <<< BLANK
        print(f"{path} not found, using defaults")
        return DEFAULTS
# >>> BLANK id=open-read level=1 hint="走到这里文件已经确认存在：用内置的 open 以读模式打开 path，文件对象叫 f——读是默认模式，不写模式实参" hintEn="By this point the file is known to exist: open path for reading with the built-in open and call the file object f - reading is the default mode, so pass no mode argument"
    with open(path) as f:
# <<< BLANK
        return f.read().splitlines()


if __name__ == "__main__":
    print(read_settings("_fixtures/settings.txt"))
    print(read_settings("no_such_file.txt"))
    folder = Path("_fixtures")
    print(folder.exists(), folder.is_file(), folder.is_dir())
