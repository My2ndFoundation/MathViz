"""A car has an engine: build an object out of another object and delegate to it."""


class Engine:
    def __init__(self, horsepower):
        self.horsepower = horsepower
        self.running = False

    def start(self):
        self.running = True
        return "engine started"


class Car:
    def __init__(self, model, horsepower):
        self.model = model
# >>> BLANK id=has-an-engine level=1 hint="车在自己的构造方法里造一台发动机，存进 self 上一个叫 engine 的属性；horsepower 按位置传进去，不写成关键字；Car 不继承 Engine" hintEn="The car builds an engine inside its own constructor and keeps it in an attribute on self called engine; pass horsepower by position, not as a keyword; Car does not inherit from Engine"
        self.engine = Engine(horsepower)
# <<< BLANK

    def start(self):
# >>> BLANK id=delegate-start level=2 hint="只写一行：把活转交给自己那台发动机的 start()，直接在一个双引号的 f-string 里调用它并返回，不先存进变量，不用 + 拼接 || 型号在前，接一个冒号和一个空格，后面是发动机交回来的那句话，和输出第二行对上" hintEn="One line only: pass the job on to its own engine's start(), calling it straight inside one double-quoted f-string that you return, with no temporary variable and no + concatenation || The model comes first, then a colon and a space, then whatever the engine handed back, matching the second line of output"
        return f"{self.model}: {self.engine.start()}"
# <<< BLANK

    def is_running(self):
# >>> BLANK id=delegate-query level=1 hint="这个问题 Car 自己也答不了：直接返回它那台发动机上的 running 属性，不写 if" hintEn="Car cannot answer this one by itself either: return the running attribute of its own engine directly, with no if"
        return self.engine.running
# <<< BLANK


if __name__ == "__main__":
    car = Car("Mini", 136)
    print(car.is_running())
    print(car.start())
    print(car.is_running())
    print(car.engine.horsepower)
    print(isinstance(car, Engine), isinstance(car.engine, Engine))
