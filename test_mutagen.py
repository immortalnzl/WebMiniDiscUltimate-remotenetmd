import os
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
import sys

def test(path):
    print(f"Testing {path}")
    if not os.path.exists(path):
        print("Path does not exist")
        return
    
    try:
        if path.lower().endswith(".mp3"):
            audio = MP3(path)
            print("Successfully loaded MP3")
            print(f"Artist: {audio.get('TPE1')}")
            print(f"Album: {audio.get('TALB')}")
        elif path.lower().endswith(".flac"):
            audio = FLAC(path)
            print("Successfully loaded FLAC")
            print(f"Artist: {audio.get('artist')}")
            print(f"Album: {audio.get('album')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test(sys.argv[1])
