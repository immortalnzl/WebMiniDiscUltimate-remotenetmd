from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import subprocess
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
from mutagen.id3 import ID3, APIC
import io

from typing import Dict, Any, Union, Optional
import io
import json
from pathlib import Path

app = FastAPI()

# Allow CORS for the web interface
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MUSIC_DIR = os.getenv("MUSIC_DIR", "/music")
DOTENV_PATH = os.getenv("DOTENV_PATH", "/app/.env")

@app.get("/storage")
def get_storage():
    try:
        if not os.path.exists(DOTENV_PATH):
            return {"status": "error", "message": f".env not found at {DOTENV_PATH}"}
        
        config = {}
        with open(DOTENV_PATH, "r") as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    key, value = line.strip().split("=", 1)
                    config[key] = value
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/storage")
async def set_storage(config: Dict[str, str]):
    try:
        if not os.path.exists(DOTENV_PATH):
            # Create if doesn't exist? Or error?
            pass
            
        lines = []
        if os.path.exists(DOTENV_PATH):
            with open(DOTENV_PATH, "r") as f:
                lines = f.readlines()
        
        # Update existing or add new
        new_lines = []
        keys_handled = set()
        
        for line in lines:
            if "=" in line and not line.startswith("#"):
                key = line.split("=", 1)[0].strip()
                if key in config:
                    new_lines.append(f"{key}={config[key]}\n")
                    keys_handled.add(key)
                    continue
            new_lines.append(line)
        
        for key, value in config.items():
            if key not in keys_handled:
                new_lines.append(f"{key}={value}\n")
        
        with open(DOTENV_PATH, "w") as f:
            f.writelines(new_lines)
            
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/restart")
def restart_service():
    try:
        # This requires docker-compose to be available and /var/run/docker.sock to be mounted
        # Or just use a simple signal if we have a process manager
        # For Docker:
        subprocess.Popen(["docker", "compose", "up", "-d", "--build"], cwd="/app")
        return {"status": "restarting"}
    except Exception as e:
        print(f"Restart failed: {e}")
        # Fallback: maybe just kill the process and let Docker restart it
        os._exit(1)

def get_metadata(filepath: str) -> Dict[str, Any]:
    try:
        has_artwork = False
        # Check for folder art first
        parent_dir = os.path.dirname(filepath)
        for art_name in ["cover.jpg", "cover.png", "folder.jpg", "folder.png"]:
            if os.path.exists(os.path.join(parent_dir, art_name)):
                has_artwork = True
                break

        if filepath.lower().endswith(".mp3"):
            audio = MP3(filepath)
            if not has_artwork and audio.tags:
                for tag in audio.tags.values():
                    if isinstance(tag, APIC):
                        has_artwork = True
                        break
            return {
                "artist": str(audio.get("TPE1", ["Unknown Artist"])[0]),
                "album": str(audio.get("TALB", ["Unknown Album"])[0]),
                "title": str(audio.get("TIT2", [os.path.basename(filepath)])[0]),
                "duration": audio.info.length,
                "has_artwork": has_artwork
            }
        elif filepath.lower().endswith(".flac"):
            audio = FLAC(filepath)
            if not has_artwork:
                has_artwork = len(audio.pictures) > 0
            return {
                "artist": audio.get("artist", ["Unknown Artist"])[0],
                "album": audio.get("album", ["Unknown Album"])[0],
                "title": audio.get("title", [os.path.basename(filepath)])[0],
                "duration": audio.info.length,
                "has_artwork": has_artwork
            }
    except Exception as e:
        print(f"Error reading metadata for {filepath}: {e}")
    
    return {
        "artist": "Unknown Artist",
        "album": "Unknown Album",
        "title": os.path.basename(filepath),
        "duration": 0,
        "has_artwork": False
    }

@app.get("/database")
def get_database() -> Dict[str, Any]:
    def scan(path: str) -> Dict[str, Any]:
        db: Dict[str, Any] = {}
        try:
            for entry in os.scandir(path):
                if entry.is_dir():
                    res = scan(entry.path)
                    if res:
                        db[entry.name] = res
                elif entry.is_file() and entry.name.lower().endswith((".mp3", ".flac", ".wav", ".m4a", ".ogg")):
                    meta = get_metadata(entry.path)
                    rel_path = os.path.relpath(entry.path, MUSIC_DIR).replace("\\", "/")
                    db[entry.name] = {
                        "artist": meta["artist"],
                        "album": meta["album"],
                        "title": meta["title"],
                        "duration": meta["duration"],
                        "artwork": f"/get_artwork?file_name={rel_path}" if meta["has_artwork"] else None
                    }
        except PermissionError:
            pass
        return db
    return scan(MUSIC_DIR)

@app.get("/get_local")
def get_local(file_name: str = Query(...)):
    full_path = os.path.join(MUSIC_DIR, file_name)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(full_path)

@app.get("/get_artwork")
def get_artwork(file_name: str = Query(...)):
    full_path = os.path.join(MUSIC_DIR, file_name)
    parent_dir = os.path.dirname(full_path)
    
    # 1. Check folder art
    for art_name in ["cover.jpg", "cover.png", "folder.jpg", "folder.png"]:
        art_path = os.path.join(parent_dir, art_name)
        if os.path.exists(art_path):
            return FileResponse(art_path)
    
    # 2. Extract from tags
    try:
        if full_path.lower().endswith(".mp3"):
            audio = ID3(full_path)
            for tag in audio.values():
                if isinstance(tag, APIC):
                    return StreamingResponse(io.BytesIO(tag.data), media_type=tag.mime)
        elif full_path.lower().endswith(".flac"):
            audio = FLAC(full_path)
            if audio.pictures:
                pic = audio.pictures[0]
                return StreamingResponse(io.BytesIO(pic.data), media_type=pic.mime)
    except Exception:
        pass
        
    raise HTTPException(status_code=404, detail="Artwork not found")

@app.get("/transcode_local")
def transcode_local(file_name: str = Query(...), type: str = Query(...)):
    full_path = os.path.join(MUSIC_DIR, file_name)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    bitrate = "132k"
    codec = "atrac3"
    
    if type == "LP2":
        bitrate = "132k"
        codec = "atrac3"
    elif type == "LP4":
        bitrate = "66k"
        codec = "atrac3"
    elif type.startswith("PLUS") and len(type) > 4:
        bitrate = type[4:] + "k"
        codec = "atrac3p"
    
    cmd = [
        "ffmpeg", "-i", full_path,
        "-acodec", codec, "-ab", bitrate,
        "-f", "wav", "pipe:1"
    ]
    
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if process.stdout is None:
         raise HTTPException(status_code=500, detail="FFmpeg failed")
    return StreamingResponse(process.stdout, media_type="audio/wav")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
