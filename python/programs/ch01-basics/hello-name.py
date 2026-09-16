"""Read a name from the keyboard and greet it."""


def greet(name):
    return f"Hello, {name}!"


if __name__ == "__main__":
    who = input("What is your name? ")
    print(greet(who))
    print(f"Your name has {len(who)} letters.")
