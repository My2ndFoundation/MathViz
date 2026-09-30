"""Work out a note's frequency from its name, then play it on the micro:bit."""
from microbit import *
import music

# How many semitones each note sits above C in the same octave.
SEMITONES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
SCALE = ["C", "D", "E", "F", "G", "A", "B"]


def frequency(name, octave):
    # A4 is 440 Hz; every semitone up multiplies by the 12th root of 2.
# >>> BLANK id=steps level=3 hint="一行赋值给 steps：这个音离 A4 有几个半音（往下是负数）。三项按这个顺序相加减：SEMITONES 里用方括号查到的数（不用 .get）、八度带来的半音数、最后减一个常数；八度那一项把 12 写在乘号左边、右边的因数加一对括号 || 每差一个八度差 12 个半音——看 octave 比 4 多几；A 在 C 之上 9 个半音，所以最后减 9 || A4 本身算出来是 0，C4 是 -9，C5 是 3" hintEn="One assignment to steps: how many semitones this note is from A4 (negative below it). Three terms in this order: the number looked up in SEMITONES with square brackets (not .get), the semitones the octave adds, and a constant taken off at the end; in the octave term 12 goes on the left of the times sign and the factor on its right is in brackets || Every octave of difference is 12 semitones - look at how far octave is above 4; A is 9 semitones above C, so take off 9 at the end || A4 itself comes out as 0, C4 as -9, C5 as 3"
    steps = SEMITONES[name] + 12 * (octave - 4) - 9
# <<< BLANK
# >>> BLANK id=hz level=2 hint="一行 return：440 乘以 2 的（steps 除以 12）次方，外面套 round() 取到整数赫兹；用 **，不用 pow()，不用 int()，不在 2 的乘方外面再包一层括号 || music.pitch 要整数频率；2 的 steps/12 次方就是把 12 次根乘 steps 次" hintEn="One return line: 440 times 2 to the power (steps divided by 12), wrapped in round() to get whole hertz; use **, not pow() and not int(), and no extra brackets around the power of 2 || music.pitch wants a whole-number frequency; 2 to the power steps/12 is the 12th root multiplied in steps times"
    return round(440 * 2 ** (steps / 12))
# <<< BLANK


def main():
    while True:
        if button_a.was_pressed():
            # The C major scale in octave 4, each note for 300 milliseconds.
            for name in SCALE:
# >>> BLANK id=play level=2 hint="一行 music.pitch：先频率、后时长（毫秒）；这一行里所有的实参都按位置写（不写 duration=，也不写别的 名字=） || 频率交给本程序的函数去算：音名是循环变量，八度和时长都照上面那行注释" hintEn="One music.pitch line: the frequency first and then the duration in milliseconds; every argument on the line goes by position (no duration=, and no other name=) || Let this program's own function work out the frequency: the note name is the loop variable, and the octave and the duration are the ones in the comment just above"
                music.pitch(frequency(name, 4), 300)
# <<< BLANK
        if button_b.was_pressed():
            # The same kind of notes by name: C4 for 2 ticks, then E, G, C5.
            music.play(["C4:2", "E", "G", "C5:4"])
        sleep(20)


if __name__ == "__main__":
    main()
