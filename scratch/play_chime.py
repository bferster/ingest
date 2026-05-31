import winsound
import time

def play_chime():
    # Frequency, Duration
    winsound.Beep(440, 250) # A4
    winsound.Beep(880, 250) # A5
    print("Task Complete!")

if __name__ == "__main__":
    play_chime()
