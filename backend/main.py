from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import subprocess
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
from mutagen.id3 import ID3, APIC
import io
import hashlib

from typing import Dict, Any, Union, Optional, List
from pathlib import Path
from datetime import datetime
import json
from dotenv import load_dotenv

import requests
import time

# Load environment variables from .env file
# Try current dir first, then parent dir (project root)
if os.path.exists(".env"):
    load_dotenv(".env")
elif os.path.exists("../.env"):
    load_dotenv("../.env")

app = FastAPI()

# Allow CORS for the web interface
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MUSIC_DIR = os.getenv("MUSIC_PATH", os.getenv("MUSIC_DIR", "/music"))
DOTENV_PATH = os.getenv("DOTENV_PATH", "../.env" if os.path.exists("../.env") else ".env")
FILE_EXTENSIONS = [ext.strip().lower() for ext in os.getenv("FILE_EXTENSIONS", ".mp3,.flac,.wav,.m4a,.ogg").split(",") if ext.strip()]
EXCLUDE_PATTERNS = [p.strip() for p in os.getenv("EXCLUDE_PATTERNS", "@eaDir,#recycle,.DS_Store").split(",") if p.strip()]
ENABLE_SCRAPING = os.getenv("ENABLE_SCRAPING", "false").lower() == "true"

# Global cache and status
_db_cache: Dict[str, Any] = {}
_status = {
    "scanning": False,
    "files_found": 0,
    "albums_found": 0,
    "artists_found": 0,
    "current_activity": "Idle",
    "last_error": None
}
_log_buffer: List[str] = []
found_artists = set()
found_albums = set()
ARTWORK_CACHE = "data/artwork_cache"
os.makedirs(ARTWORK_CACHE, exist_ok=True)

def add_log(msg: str):
    print(msg, flush=True)
    _log_buffer.append(f"{datetime.now().strftime('%H:%M:%S')} - {msg}")
    if len(_log_buffer) > 100:
        _log_buffer.pop(0)

@app.get("/api/status")
def get_status():
    return _status

@app.get("/api/logs")
def get_logs():
    return {"logs": _log_buffer}

@app.get("/api/artists")
def get_artists():
    artists = set()
    def collect(d):
        for k, v in d.items():
            if isinstance(v, dict):
                if "artist" in v:
                    artists.add(v["artist"])
                else:
                    collect(v)
    collect(_db_cache)
    return sorted(list(artists))

@app.get("/api/albums")
def get_albums():
    # Returns list of {artist, album, artwork}
    albums = {}
    def collect(d):
        for k, v in d.items():
            if isinstance(v, dict):
                if "album" in v:
                    key = f"{v['artist']} - {v['album']}"
                    if key not in albums:
                        albums[key] = {
                            "artist": v["artist"],
                            "album": v["album"],
                            "artwork": v.get("artwork")
                        }
                else:
                    collect(v)
    collect(_db_cache)
    return sorted(list(albums.values()), key=lambda x: (x["artist"], x["album"]))

@app.get("/api/database")
@app.get("/database")
def get_database():
    global _db_cache
    return _db_cache
VOLUME_TYPE = os.getenv("VOLUME_TYPE", "none")
VOLUME_OPTIONS = os.getenv("VOLUME_OPTIONS", "bind")

@app.get("/api/list_dirs")
def list_dirs(path: str = "/"):
    print(f"DEBUG: list_dirs called for path: {path}", flush=True)
    try:
        if not os.path.exists(path):
            print(f"DEBUG: Path does not exist: {path}", flush=True)
            return []
        if not os.path.isdir(path):
            print(f"DEBUG: Path is not a directory: {path}", flush=True)
            return []
        
        dirs = sorted([
            d.name for d in os.scandir(path) 
            if d.is_dir() and not d.name.startswith(".") and not any(p in d.name for p in EXCLUDE_PATTERNS)
        ])
        print(f"DEBUG: Found {len(dirs)} subdirectories", flush=True)
        return dirs
    except Exception as e:
        print(f"Error listing dirs at {path}: {e}", flush=True)
        return []

@app.post("/api/scan")
async def trigger_scan(background_tasks: BackgroundTasks):
    """Manually trigger a background scan."""
    global _status
    if _status["scanning"]:
        return {"status": "scanning", "message": "Scan already in progress"}
    
    background_tasks.add_task(run_full_scan)
    return {"status": "success", "message": "Scan started in background"}

def run_full_scan():
    global _db_cache, _status, found_artists, found_albums
    _status["scanning"] = True
    add_log(f"Starting background scan for {MUSIC_DIR}")
    
    new_db = {}
    
    _status["files_found"] = 0
    _status["artists_found"] = 0
    _status["albums_found"] = 0
    found_artists.clear()
    found_albums.clear()

    def scan_rec(path: str, current_level_db: Dict[str, Any]):
        global _db_cache, found_artists, found_albums
        if not os.path.exists(path):
            return
        
    new_db = {}
    db_path = "data/library.json"
    
    # Pre-initialize with existing DB if possible
    if os.path.exists(db_path):
        try:
            with open(db_path, "r") as f:
                new_db = json.load(f)
                _db_cache = new_db.copy()
                add_log("Loaded existing library from disk.")
                # Basic recount for status
                def count_rec(d, st):
                    for k, v in d.items():
                        if isinstance(v, dict):
                            if "artist" in v:
                                st["files_found"] += 1
                                found_artists.add(v["artist"])
                                found_albums.add(f"{v['artist']} - {v['album']}")
                            else:
                                count_rec(v, st)
                count_rec(new_db, _status)
                _status["artists_found"] = len(found_artists)
                _status["albums_found"] = len(found_albums)
        except Exception as e:
            add_log(f"Error loading existing library: {e}")

    def scan_rec(path, current_level_db):
        global _db_cache
        if not os.path.exists(path):
            add_log(f"Path not found: {path}")
            return
        
        try:
            entries = list(os.scandir(path))
        except Exception as e:
            add_log(f"Error accessing {path}: {e}")
            return

        for entry in entries:
            if entry.is_dir():
                if any(p in entry.name for p in EXCLUDE_PATTERNS):
                    continue
                _status["current_activity"] = f"Scanning {entry.name}..."
                sub_db = {}
                current_level_db[entry.name] = sub_db 
                scan_rec(entry.path, sub_db)
                if not sub_db:
                    del current_level_db[entry.name]
            elif entry.is_file():
                matches_ext = any(entry.name.lower().endswith(ext) for ext in FILE_EXTENSIONS)
                if not matches_ext:
                    continue
                
                try:
                    meta = get_metadata(entry.path)
                    rel_path = os.path.relpath(entry.path, MUSIC_DIR).replace("\\", "/")
                    
                    artwork = None
                    if meta.get("artwork"): 
                        artwork = meta["artwork"]
                    elif meta.get("has_artwork"): 
                        # Use cached artwork if possible
                        cache_key = hashlib.md5(entry.path.encode()).hexdigest()
                        if extract_and_cache_artwork(rel_path, cache_key):
                            artwork = f"api/get_artwork_cached?key={cache_key}"
                        else:
                            artwork = f"api/get_artwork?file_name={rel_path}"

                    current_level_db[entry.name] = {
                        "artist": meta["artist"],
                        "album": meta["album"],
                        "title": meta["title"],
                        "duration": meta["duration"],
                        "artwork": artwork
                    }

                    _status["files_found"] += 1
                    found_artists.add(meta["artist"])
                    found_albums.add(f"{meta['artist']} - {meta['album']}")
                    _status["artists_found"] = len(found_artists)
                    _status["albums_found"] = len(found_albums)
                    
                    # Log progress instead of every file to avoid I/O bottlenecks
                    if _status["files_found"] % 50 == 0:
                        add_log(f"Indexing progress: {_status['files_found']} files...")
                    
                    _db_cache = new_db.copy()

                    # Save intermediate progress periodically
                    if _status["files_found"] % 100 == 0:
                        save_db(new_db)

                except Exception as e:
                    add_log(f"Error processing {entry.name}: {e}")

    try:
        scan_rec(MUSIC_DIR, new_db)
        _db_cache = new_db
        save_db(new_db)
        add_log(f"Background scan complete. Found {_status['files_found']} tracks.")
    except Exception as e:
        _status["last_error"] = str(e)
        add_log(f"ERROR: Background scan failed: {e}")
    finally:
        _status["scanning"] = False
        _status["current_activity"] = "Idle"

def save_db(db):
    try:
        os.makedirs("data", exist_ok=True)
        with open("data/library.json", "w") as f:
            json.dump(db, f)
    except Exception as e:
        add_log(f"Failed to save library: {e}")

@app.on_event("startup")
async def startup_event():
    # Start initial scan on startup
    from fastapi import BackgroundTasks
    # We can't easily use background_tasks here, so we'll just run it in a thread
    import threading
    threading.Thread(target=run_full_scan, daemon=True).start()

@app.get("/api/storage")
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

@app.post("/api/storage")
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

@app.post("/api/restart")
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

# MusicBrainz API settings
MUSICBRAINZ_API = "https://musicbrainz.org/ws/2"
USER_AGENT = "WebMiniDiscProBurningStation/1.0.0 ( mailto:utsnik@github.com )"

def scrape_metadata(artist: str, album: str, title: str) -> Dict[str, Any]:
    """Scrapes metadata from MusicBrainz if local tags are missing info."""
    try:
        if artist == "Unknown Artist" and title == os.path.basename(title):
            return {}

        query = f'recording:"{title}" AND artist:"{artist}"'
        if album != "Unknown Album":
            query += f' AND release:"{album}"'
        
        headers = {"User-Agent": USER_AGENT}
        params = {"query": query, "fmt": "json", "limit": 1}
        
        response = requests.get(f"{MUSICBRAINZ_API}/recording", params=params, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("recordings"):
                rec = data["recordings"][0]
                new_meta = {
                    "artist": rec.get("artist-credit", [{}])[0].get("name", artist),
                    "title": rec.get("title", title),
                }
                if rec.get("releases"):
                    rel = rec["releases"][0]
                    new_meta["album"] = rel.get("title", album)
                    # Try to get release ID for cover art
                    release_id = rel.get("id")
                    if release_id:
                        new_meta["mbid"] = release_id
                return new_meta
    except Exception as e:
        print(f"Scraping error: {e}")
    return {}

def get_metadata(filepath: str) -> Dict[str, Any]:
    try:
        has_artwork = False
        artwork_url = None
        # Check for folder art first
        parent_dir = os.path.dirname(filepath)
        for art_name in ["cover.jpg", "cover.png", "folder.jpg", "folder.png"]:
            if os.path.exists(os.path.join(parent_dir, art_name)):
                has_artwork = True
                break

        meta = {
            "artist": "Unknown Artist",
            "album": "Unknown Album",
            "title": os.path.basename(filepath),
            "duration": 0,
            "has_artwork": has_artwork
        }

        if filepath.lower().endswith(".mp3"):
            audio = MP3(filepath)
            if not has_artwork and audio.tags:
                for tag in audio.tags.values():
                    if isinstance(tag, APIC):
                        has_artwork = True
                        break
            meta.update({
                "artist": str(audio.get("TPE1", ["Unknown Artist"])[0]),
                "album": str(audio.get("TALB", ["Unknown Album"])[0]),
                "title": str(audio.get("TIT2", [os.path.basename(filepath)])[0]),
                "duration": audio.info.length,
            })
        elif filepath.lower().endswith(".flac"):
            audio = FLAC(filepath)
            if not has_artwork:
                has_artwork = len(audio.pictures) > 0
            meta.update({
                "artist": audio.get("artist", ["Unknown Artist"])[0],
                "album": audio.get("album", ["Unknown Album"])[0],
                "title": audio.get("title", [os.path.basename(filepath)])[0],
                "duration": audio.info.length,
            })
        
        # Scrape if missing info and enabled
        if ENABLE_SCRAPING and (meta["artist"] == "Unknown Artist" or meta["album"] == "Unknown Album"):
            scraped = scrape_metadata(meta["artist"], meta["album"], meta["title"])
            if scraped:
                meta.update(scraped)
                if "mbid" in scraped and not has_artwork:
                    meta["artwork"] = f"https://coverartarchive.org/release/{scraped['mbid']}/front"
        
        meta["has_artwork"] = has_artwork or "artwork" in meta
        return meta

    except Exception as e:
        print(f"Error reading metadata for {filepath}: {e}")
    
    return {
        "artist": "Unknown Artist",
        "album": "Unknown Album",
        "title": os.path.basename(filepath),
        "duration": 0,
        "has_artwork": False
    }

def extract_and_cache_artwork(rel_path: str, cache_key: str):
    """Extracts artwork from tags and saves to cache."""
    full_path = os.path.join(MUSIC_DIR, rel_path)
    cache_path = os.path.join(ARTWORK_CACHE, f"{cache_key}.png")
    
    if os.path.exists(cache_path):
        return True

    # 1. Check folder art first (though we might prefer embedded for "snappiness" if requested)
    parent_dir = os.path.dirname(full_path)
    for art_name in ["cover.jpg", "cover.png", "folder.jpg", "folder.png"]:
        art_path = os.path.join(parent_dir, art_name)
        if os.path.exists(art_path):
            try:
                import shutil
                shutil.copy(art_path, cache_path)
                return True
            except Exception:
                pass

    # 2. Extract from tags
    try:
        data = None
        if full_path.lower().endswith(".mp3"):
            audio = ID3(full_path)
            for tag in audio.values():
                if isinstance(tag, APIC):
                    data = tag.data
                    break
        elif full_path.lower().endswith(".flac"):
            audio = FLAC(full_path)
            if audio.pictures:
                data = audio.pictures[0].data
        
        if data:
            with open(cache_path, "wb") as f:
                f.write(data)
            return True
    except Exception as e:
        print(f"Extraction failed for {rel_path}: {e}")
    
    return False

# Compatibility alias for /database is handled above

@app.get("/api/get_local")
def get_local(file_name: str = Query(...)):
    full_path = os.path.join(MUSIC_DIR, file_name)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(full_path)

    raise HTTPException(status_code=404, detail="Artwork not found")

@app.get("/api/get_artwork_cached")
def get_artwork_cached(key: str = Query(...)):
    cache_path = os.path.join(ARTWORK_CACHE, f"{key}.png")
    if os.path.exists(cache_path):
        return FileResponse(cache_path)
    raise HTTPException(status_code=404, detail="Cached artwork not found")

@app.get("/api/preview")
def get_preview(file_name: str = Query(...)):
    print(f"Preview request for: {file_name}", flush=True)
    full_path = os.path.join(MUSIC_DIR, file_name)
    if not os.path.exists(full_path):
        print(f"File NOT found: {full_path}", flush=True)
        raise HTTPException(status_code=404, detail="File not found")
    
    # Optimization: Faster probing, immediate output, and AUDIO ONLY
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", full_path,
        "-vn", "-sn", # Disable video and subtitles (prevents cover art issues)
        "-acodec", "libmp3lame", "-ab", "128k", 
        "-ar", "44100", "-ac", "2",
        "-map_metadata", "-1",
        "-f", "mp3", "pipe:1"
    ]
    
    print(f"Starting ffmpeg for preview: {' '.join(cmd)}", flush=True)
    # Using DEVNULL for stderr by default to avoid deadlock; 
    # we'll check for return codes and process life instead.
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    
    if process.stdout is None:
        raise HTTPException(status_code=500, detail="FFmpeg pipe error")

    def iterfile():
        try:
            # smaller first chunk for faster "first byte" response
            first_chunk = process.stdout.read(4096)
            if not first_chunk:
                print(f"FFmpeg produced no output for {file_name}", flush=True)
                return

            yield first_chunk
            
            while True:
                chunk = process.stdout.read(16384)
                if not chunk:
                    break
                yield chunk
        except Exception as e:
            print(f"Streaming error: {e}", flush=True)
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=0.5)
                except:
                    process.kill()
            
    # Removing Accept-Ranges as live transcode doesn't support seeking without complex server-side logic
    # Adding nosniff to prevent browsers from misinterpreting the stream
    return StreamingResponse(iterfile(), media_type="audio/mpeg", headers={
        "Connection": "keep-alive",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Pragma": "no-cache",
        "Expires": "0",
        "Content-Disposition": f'inline; filename="{os.path.basename(file_name)}.mp3"'
    })

@app.get("/api/transcode_local")
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
    
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    if process.stdout is None:
         raise HTTPException(status_code=500, detail="FFmpeg failed")
    return StreamingResponse(process.stdout, media_type="audio/wav")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
