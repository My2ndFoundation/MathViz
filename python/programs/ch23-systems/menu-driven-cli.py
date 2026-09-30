"""A menu-driven program: show the options, check the choice, and dispatch it to a function."""


def add_task(tasks):
    tasks.append(input("Task: "))
    print("Added.")


def list_tasks(tasks):
    if not tasks:
        print("No tasks.")
    for number, text in enumerate(tasks, start=1):
        print(f"{number}. {text}")


def remove_task(tasks):
    choice = input("Number to remove: ")
# >>> BLANK id=valid-number level=3 hint="一个 if 的头：choice 全是数字、而且换成整数后落在 1 到任务个数之间（两端都算）——两个条件用 and 连起来，先判全是数字；判数字用字符串方法 isdecimal()，不用 isdigit()（² 这类上标数字 isdigit() 认、int() 却不认）；范围写成一个连写的比较，不拆成两个比较再用 and 连 || 先判数字是为了让 int() 不会出错：and 左边为假时右边根本不算 || 连写比较里 1 在最左、len(tasks) 在最右，两处都用小于等于" hintEn="The head of an if: choice is all digits and, as a whole number, lies from 1 to the number of tasks (both ends included) - join the two conditions with and, testing for digits first; test for digits with the string method isdecimal(), not isdigit() (isdigit() accepts superscripts such as ², which int() rejects); write the range as one chained comparison, not two comparisons joined by and || Testing for digits first keeps int() from failing: when the left of and is false, the right is never worked out || In the chained comparison 1 is on the far left and len(tasks) on the far right, with less-than-or-equal at both places"
    if choice.isdecimal() and 1 <= int(choice) <= len(tasks):
# <<< BLANK
        print("Removed:", tasks.pop(int(choice) - 1))
    else:
        print("No such task.")


ACTIONS = {"1": add_task, "2": list_tasks, "3": remove_task}


def main():
    tasks = []
    while True:
        print("1 Add | 2 List | 3 Remove | 4 Quit")
        choice = input("Choice: ").strip()
        if choice == "4":
            print("Goodbye.")
            break
# >>> BLANK id=look-up level=2 hint="在分派字典里找这个选项对应的函数，存进 action；找不到时要得到 None 而不是抛错——不写默认值那个实参，缺省本来就是 None || 用字典的 get 方法，只给一个实参 choice" hintEn="Find the function for this choice in the dispatch dictionary and keep it in action; when the choice is not there you want None, not an exception - leave out the default-value argument, since the default is None already || Use the dictionary's get method with choice as its only argument"
        action = ACTIONS.get(choice)
# <<< BLANK
        if action is None:
            print("Please choose 1, 2, 3 or 4.")
            continue
# >>> BLANK id=dispatch level=1 hint="调用找到的那个函数，把任务列表交给它——三个菜单函数都只收这一个实参" hintEn="Call the function that was found, handing it the task list - all three menu functions take just that one argument"
        action(tasks)
# <<< BLANK


if __name__ == "__main__":
    main()
