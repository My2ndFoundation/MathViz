"""Rebuild whole lines from the arbitrary chunks a UART hands over."""
from machine import Pin, UART
from micropython import const
import time

NEWLINE = const(10)
MAX_LEN = 32


class LineAssembler:
    def __init__(self, max_len):
        self.max_len = max_len
        self.buf = bytearray()
        self.skipping = False
        self.dropped = 0

    def feed(self, chunk):
        """Take one chunk of bytes; return the complete lines it finished."""
        lines = []
        for byte in chunk:
            if byte == NEWLINE:
                if self.skipping:
                    self.skipping = False
# >>> BLANK id=dropped level=1 hint="一行：换行到了，说明被跳过的那一整行结束了——把丢弃计数 self.dropped 加一，用增量赋值" hintEn="One line: the newline has arrived, so the whole line being skipped is over - add one to the dropped count self.dropped, with an augmented assignment"
                    self.dropped += 1
# <<< BLANK
                else:
# >>> BLANK id=hand-over level=2 hint="一行：用 append 把攒好的这一行加到 lines 末尾；不直接放 self.buf，而是先用 bytes() 复制成一份不可变的字节串 || 交出去的是 bytes，不是那个还会被改动的 bytearray" hintEn="One line: append the line gathered so far to the end of lines; not self.buf itself, but a copy made with bytes() that cannot change || What is handed over is a bytes object, not the bytearray that will keep changing"
                    lines.append(bytes(self.buf))
# <<< BLANK
                self.buf = bytearray()
            elif not self.skipping:
# >>> BLANK id=too-long level=2 hint="一个 if 头：缓冲里已经攒满 self.max_len 个字节时，这个新字节就让这一行超长了；len(self.buf) 写在比较号左边，用 == 不用 >= || 恰好 max_len 个字节的行照样保留，多出第一个字节才开始跳过" hintEn="One if header: when the buffer already holds self.max_len bytes, this new byte makes the line too long; len(self.buf) on the left of the comparison, with == rather than >= || A line of exactly max_len bytes is still kept; skipping starts only with the first byte beyond that"
                if len(self.buf) == self.max_len:
# <<< BLANK
                    self.skipping = True
                    self.buf = bytearray()
                else:
                    self.buf.append(byte)
        return lines


def assemble(chunks, max_len):
    """Feed every chunk in turn; return (complete lines, dropped line count)."""
    assembler = LineAssembler(max_len)
    lines = []
    for chunk in chunks:
        lines.extend(assembler.feed(chunk))
    return lines, assembler.dropped


def main():
    uart = UART(1, baudrate=9600, tx=Pin(4), rx=Pin(5))
    assembler = LineAssembler(MAX_LEN)
    while True:
        if uart.any():
            chunk = uart.read()
            if chunk:
                for line in assembler.feed(chunk):
                    uart.write(b"got " + line + b"\n")
        time.sleep_ms(10)


if __name__ == "__main__":
    main()
