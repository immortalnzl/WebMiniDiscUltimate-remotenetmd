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
import json

from typing import Dict, Any, Union, Optional, List
from pathlib import Path
from datetime import datetime

import requests
import time
import copy
from urllib.parse import quote, unquote

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
FILE_EXTENSIONS = [ext.strip().lower() for ext in os.getenv("FILE_EXTENSIONS", ".mp3,.flac,.wav,.m4a,.ogg").split(",") if ext.strip()]
EXCLUDE_PATTERNS = [p.strip() for p in os.getenv("EXCLUDE_PATTERNS", "@eaDir,#recycle,.DS_Store").split(",") if p.strip()]
ENABLE_SCRAPING = os.getenv("ENABLE_SCRAPING", "false").lower() == "true"

# Global cache and status
DB_CACHE_PATH = os.getenv("DB_CACHE_PATH", "/app/backend/data/library.json")
_db_cache: Dict[str, Any] = {}
_artist_dirs: Dict[str, List[str]] = {}
_artist_fallback_file: Dict[str, str] = {}
_artist_art_miss_until: Dict[str, float] = {}
_year_lookup_cache: Dict[str, Optional[str]] = {}
_status = {
    "scanning": False,
    "files_found": 0,
    "albums_found": 0,
    "artists_found": 0,
    "current_activity": "Idle",
    "last_error": None
}
_log_buffer: List[str] = []
SCAN_CHECKPOINT_EVERY_FILES = int(os.getenv("SCAN_CHECKPOINT_EVERY_FILES", "25"))
SCAN_CHECKPOINT_MIN_INTERVAL_SEC = float(os.getenv("SCAN_CHECKPOINT_MIN_INTERVAL_SEC", "5"))
ARTIST_ART_MISS_CACHE_TTL_SEC = int(os.getenv("ARTIST_ART_MISS_CACHE_TTL_SEC", "900"))

def _resolve_data_root() -> Path:
    # Preferred override for container/host deployments.
    env_root = os.getenv("BACKEND_DATA_DIR", "").strip()
    if env_root:
        return Path(env_root)

    base = Path(__file__).resolve().parent
    # In some images main.py is at /app/main.py while writable data is /app/backend/data.
    backend_data = base / "backend" / "data"
    if backend_data.exists():
        return backend_data
    return base / "data"

def _ensure_writable_dir(path: Path) -> Path:
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".write_probe"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return path
    except Exception:
        fallback = Path("/tmp") / "webminidisc_data" / path.name
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback

DATA_ROOT = _ensure_writable_dir(_resolve_data_root())
ARTWORK_CACHE_DIR = _ensure_writable_dir(DATA_ROOT / "artwork_cache")
PREVIEW_CACHE_DIR = _ensure_writable_dir(DATA_ROOT / "preview_cache")
AUTO_SCAN_ON_START = os.getenv("AUTO_SCAN_ON_START", "auto").strip().lower()
AUTO_SCAN_INTERVAL_MINUTES = int(os.getenv("AUTO_SCAN_INTERVAL_MINUTES", "0"))

def add_log(msg: str):
    print(msg, flush=True)
    _log_buffer.append(f"{datetime.now().strftime('%H:%M:%S')} - {msg}")
    if len(_log_buffer) > 100:
        _log_buffer.pop(0)

def load_db_cache_from_disk():
    global _db_cache
    try:
        if os.path.exists(DB_CACHE_PATH):
            with open(DB_CACHE_PATH, "r", encoding="utf-8") as f:
                _db_cache = json.load(f)
            migrate_legacy_artwork_urls(_db_cache)
            add_log(f"Loaded cached library from {DB_CACHE_PATH}")
    except Exception as e:
        add_log(f"Failed to load cached library: {e}")

def save_db_cache_to_disk(data: Dict[str, Any]):
    try:
        os.makedirs(os.path.dirname(DB_CACHE_PATH), exist_ok=True)
        with open(DB_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f)
        add_log(f"Saved cached library to {DB_CACHE_PATH}")
    except Exception as e:
        add_log(f"Failed to save cached library: {e}")

def rebuild_artist_indexes_from_db(db: Dict[str, Any]):
    global _artist_dirs, _artist_fallback_file, _artist_art_miss_until
    _artist_dirs = {}
    _artist_fallback_file = {}
    _artist_art_miss_until = {}

    def add_artist_dir(artist: str, rel_dir: str):
        if not artist:
            return
        rel_dir = rel_dir.replace("\\", "/").strip("/")
        if artist not in _artist_dirs:
            _artist_dirs[artist] = []
        if rel_dir and rel_dir not in _artist_dirs[artist]:
            _artist_dirs[artist].append(rel_dir)
        if rel_dir and "/" in rel_dir:
            parent = rel_dir.rsplit("/", 1)[0]
            if parent and parent not in _artist_dirs[artist]:
                _artist_dirs[artist].append(parent)

    def walk(node: Dict[str, Any], parts: List[str]):
        for key, value in node.items():
            if isinstance(value, dict):
                if "artist" in value:
                    rel_file = "/".join(parts + [key])
                    rel_dir = "/".join(parts)
                    artist = value.get("artist", "")
                    add_artist_dir(artist, rel_dir)
                    if artist and artist not in _artist_fallback_file:
                        _artist_fallback_file[artist] = rel_file
                else:
                    walk(value, parts + [key])

    walk(db or {}, [])

def compute_library_totals(db: Dict[str, Any]) -> Dict[str, int]:
    total_files = 0
    artists = set()
    albums = set()

    def walk(node: Dict[str, Any]):
        nonlocal total_files
        for _, value in (node or {}).items():
            if not isinstance(value, dict):
                continue
            if "artist" in value:
                total_files += 1
                artist = (value.get("artist") or "").strip()
                album = (value.get("album") or "").strip()
                if artist:
                    artists.add(artist)
                if artist and album:
                    albums.add(f"{artist}::{album}")
            else:
                walk(value)

    walk(db or {})
    return {
        "files_found": total_files,
        "artists_found": len(artists),
        "albums_found": len(albums),
    }

def migrate_legacy_artwork_urls(db: Dict[str, Any]):
    def walk(node: Dict[str, Any], parts: List[str]):
        for key, value in node.items():
            if not isinstance(value, dict):
                continue
            if "artist" in value:
                artwork = str(value.get("artwork") or "")
                if "get_artwork_cached" in artwork:
                    rel_path = "/".join(parts + [key]).replace("\\", "/")
                    value["artwork"] = f"api/get_artwork?file_name={quote(rel_path, safe='/')}"
                elif "api/get_artwork?file_name=" in artwork:
                    try:
                        raw_file = artwork.split("file_name=", 1)[1].split("&", 1)[0]
                        decoded = unquote(raw_file)
                        encoded = quote(decoded, safe="/")
                        value["artwork"] = artwork.replace(raw_file, encoded, 1)
                    except Exception:
                        pass
            else:
                walk(value, parts + [key])

    walk(db or {}, [])

def find_rel_path_for_cached_artwork_key(db: Dict[str, Any], key: str) -> Optional[str]:
    needle = f"get_artwork_cached?key={key}"

    def walk(node: Dict[str, Any], parts: List[str]) -> Optional[str]:
        for entry_name, value in node.items():
            if not isinstance(value, dict):
                continue
            if "artist" in value:
                art = str(value.get("artwork") or "")
                if needle in art:
                    return "/".join(parts + [entry_name]).replace("\\", "/")
            else:
                found = walk(value, parts + [entry_name])
                if found:
                    return found
        return None

    return walk(db or {}, [])

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

@app.get("/api/lookup_year")
def lookup_year(artist: str = Query(""), album: str = Query(""), title: str = Query("")):
    year = lookup_year_from_musicbrainz(artist=artist, album=album, title=title)
    return {"year": year}

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
async def trigger_scan(background_tasks: BackgroundTasks, mode: str = Query("incremental")):
    """Manually trigger a background scan."""
    global _status
    if _status["scanning"]:
        return {"status": "scanning", "message": "Scan already in progress"}

    normalized_mode = (mode or "incremental").strip().lower()
    if normalized_mode not in ("incremental", "full", "refresh_metadata"):
        raise HTTPException(status_code=400, detail="Invalid scan mode")

    background_tasks.add_task(run_full_scan, normalized_mode)
    return {"status": "success", "message": f"{normalized_mode} scan started in background"}

def run_full_scan(mode: str = "incremental"):
    global _db_cache, _status
    mode = (mode or "incremental").strip().lower()
    full_rebuild = mode == "full"
    refresh_metadata = mode == "refresh_metadata"
    incremental_only = mode == "incremental"

    _status["scanning"] = True
    _status["last_error"] = None
    add_log(f"Starting {mode} scan for {MUSIC_DIR}")

    new_db = {} if full_rebuild else (copy.deepcopy(_db_cache) if isinstance(_db_cache, dict) else {})
    found_artists = set()
    found_albums = set()
    last_checkpoint_at = 0.0
    
    _status["files_found"] = 0
    _status["artists_found"] = 0
    _status["albums_found"] = 0
    found_artists.clear()
    found_albums.clear()

    def checkpoint(force: bool = False):
        global _db_cache
        nonlocal last_checkpoint_at
        now = time.time()
        if not force and (now - last_checkpoint_at) < SCAN_CHECKPOINT_MIN_INTERVAL_SEC:
            return
        _db_cache = new_db
        save_db_cache_to_disk(new_db)
        last_checkpoint_at = now

    def scan_rec(path: str, current_level_db: Dict[str, Any]):
        nonlocal found_artists, found_albums
        global _db_cache
        if not os.path.exists(path):
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
                existing_sub = current_level_db.get(entry.name) if isinstance(current_level_db.get(entry.name), dict) else {}
                sub_db = {} if full_rebuild else copy.deepcopy(existing_sub)
                scan_rec(entry.path, sub_db)
                if sub_db:
                    current_level_db[entry.name] = sub_db
                elif entry.name in current_level_db and full_rebuild:
                    current_level_db.pop(entry.name, None)
            elif entry.is_file():
                matches_ext = any(entry.name.lower().endswith(ext) for ext in FILE_EXTENSIONS)
                if not matches_ext:
                    continue

                try:
                    existing_track = current_level_db.get(entry.name)
                    if incremental_only and isinstance(existing_track, dict) and "artist" in existing_track:
                        continue

                    meta = get_metadata(entry.path)
                    rel_path = os.path.relpath(entry.path, MUSIC_DIR).replace("\\", "/")
                    
                    artwork = None
                    if meta.get("artwork"): 
                        artwork = meta["artwork"]
                    elif meta.get("has_artwork"): 
                        artwork = f"api/get_artwork?file_name={quote(rel_path, safe='/')}"

                    current_level_db[entry.name] = {
                        "artist": meta["artist"],
                        "album": meta["album"],
                        "title": meta["title"],
                        "duration": meta["duration"],
                        "year": meta.get("year"),
                        "artwork": artwork
                    }

                    _status["files_found"] += 1
                    found_artists.add(meta["artist"])
                    found_albums.add(f"{meta['artist']} - {meta['album']}")
                    _status["artists_found"] = len(found_artists)
                    _status["albums_found"] = len(found_albums)
                    
                    if incremental_only and not existing_track:
                        add_log(f"Indexed new: {meta['artist']} - {meta['title']}")
                    elif refresh_metadata:
                        add_log(f"Updated metadata: {meta['artist']} - {meta['title']}")
                    else:
                        add_log(f"Indexed: {meta['artist']} - {meta['title']}")

                    # Update global cache for live feedback - Every 5 files for 'live' feel
                    if _status["files_found"] % 5 == 0:
                        _db_cache = new_db
                    # Persist checkpoints to disk during scan so interrupted scans keep progress.
                    if _status["files_found"] % max(1, SCAN_CHECKPOINT_EVERY_FILES) == 0:
                        checkpoint()

                except Exception as e:
                    add_log(f"Error processing {entry.name}: {e}")

    try:
        scan_rec(MUSIC_DIR, new_db)
        _db_cache = new_db
        rebuild_artist_indexes_from_db(new_db)
        save_db_cache_to_disk(new_db)
        totals = compute_library_totals(new_db)
        _status["files_found"] = totals["files_found"]
        _status["artists_found"] = totals["artists_found"]
        _status["albums_found"] = totals["albums_found"]
        add_log(f"Background {mode} scan complete. Library has {_status['files_found']} tracks across {_status['artists_found']} artists.")
    except Exception as e:
        _status["last_error"] = str(e)
        add_log(f"ERROR: Background scan failed: {e}")
    finally:
        checkpoint(force=True)
        _status["scanning"] = False
        _status["current_activity"] = "Idle"

@app.on_event("startup")
async def startup_event():
    load_db_cache_from_disk()
    rebuild_artist_indexes_from_db(_db_cache)
    totals = compute_library_totals(_db_cache)
    _status["files_found"] = totals["files_found"]
    _status["artists_found"] = totals["artists_found"]
    _status["albums_found"] = totals["albums_found"]
    should_scan = False
    if AUTO_SCAN_ON_START in ("1", "true", "yes", "always"):
        should_scan = True
    elif AUTO_SCAN_ON_START in ("0", "false", "no", "never"):
        should_scan = False
    else:
        should_scan = not bool(_db_cache)

    if should_scan:
        add_log("Startup scan enabled, launching background scan")
        import threading
        threading.Thread(target=run_full_scan, args=("incremental",), daemon=True).start()
    else:
        add_log("Startup scan skipped (using cached library). Trigger /api/scan for refresh.")

    if AUTO_SCAN_INTERVAL_MINUTES > 0:
        def scheduled_scan_loop():
            while True:
                time.sleep(max(60, AUTO_SCAN_INTERVAL_MINUTES * 60))
                if _status["scanning"]:
                    continue
                try:
                    run_full_scan("incremental")
                except Exception as exc:
                    add_log(f"Scheduled incremental scan failed: {exc}")
        import threading
        threading.Thread(target=scheduled_scan_loop, daemon=True).start()
        add_log(f"Scheduled incremental scan enabled every {AUTO_SCAN_INTERVAL_MINUTES} minute(s).")

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

def lookup_year_from_musicbrainz(artist: str, album: str, title: str) -> Optional[str]:
    cache_key = f"{artist}|{album}|{title}".lower()
    if cache_key in _year_lookup_cache:
        return _year_lookup_cache[cache_key]
    try:
        query_parts = []
        if title:
            query_parts.append(f'recording:"{title}"')
        if artist:
            query_parts.append(f'artist:"{artist}"')
        if album:
            query_parts.append(f'release:"{album}"')
        if not query_parts:
            _year_lookup_cache[cache_key] = None
            return None

        query = " AND ".join(query_parts)
        headers = {"User-Agent": USER_AGENT}
        params = {"query": query, "fmt": "json", "limit": 1}
        response = requests.get(f"{MUSICBRAINZ_API}/recording", params=params, headers=headers, timeout=3)
        if response.status_code != 200:
            _year_lookup_cache[cache_key] = None
            return None
        data = response.json()
        recordings = data.get("recordings") or []
        if not recordings:
            _year_lookup_cache[cache_key] = None
            return None
        rec = recordings[0]
        releases = rec.get("releases") or []
        for rel in releases:
            year_src = rel.get("date") or rel.get("first-release-date")
            if year_src:
                year = str(year_src)[:4]
                if len(year) == 4 and year.isdigit():
                    _year_lookup_cache[cache_key] = year
                    return year
    except Exception:
        pass
    _year_lookup_cache[cache_key] = None
    return None

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
            "year": None,
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
            year_tag = audio.get("TDRC") or audio.get("TYER")
            if year_tag:
                year_str = str(year_tag[0])
                meta["year"] = year_str[:4] if len(year_str) >= 4 else year_str
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
            date_tag = (audio.get("date", [None])[0] or audio.get("year", [None])[0])
            if date_tag:
                date_str = str(date_tag)
                meta["year"] = date_str[:4] if len(date_str) >= 4 else date_str
        
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
        "year": None,
        "has_artwork": False
    }

# Compatibility alias for /database is handled above

@app.get("/api/get_local")
def get_local(file_name: str = Query(...)):
    full_path = os.path.join(MUSIC_DIR, file_name)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(full_path)

@app.get("/api/get_local_preview")
def get_local_preview(file_name: str = Query(...)):
    full_path = os.path.join(MUSIC_DIR, file_name)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    ext = os.path.splitext(full_path)[1].lower()
    if ext in [".mp3", ".wav", ".ogg", ".m4a", ".aac"]:
        return FileResponse(full_path)

    try:
        stat = os.stat(full_path)
        key = hashlib.sha1(f"{full_path}:{stat.st_mtime}:{stat.st_size}".encode()).hexdigest()
        cached = PREVIEW_CACHE_DIR / f"{key}.mp3"
        if cached.exists():
            return FileResponse(str(cached), media_type="audio/mpeg")
    except Exception:
        pass

    cmd_stream = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        full_path,
        "-vn",
        "-map",
        "0:a:0?",
        "-c:a",
        "libmp3lame",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-b:a",
        "192k",
        "-write_xing",
        "0",
        "-flush_packets",
        "1",
        "-f",
        "mp3",
        "pipe:1",
    ]
    process = subprocess.Popen(cmd_stream, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if process.stdout is None:
        raise HTTPException(status_code=500, detail="Failed to create preview stream")
    return StreamingResponse(process.stdout, media_type="audio/mpeg")

def resize_image_bytes(data: bytes, size: int) -> bytes:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-vf",
        f"scale={size}:-1",
        "-vframes",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "pipe:1",
    ]
    proc = subprocess.run(cmd, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0 or not proc.stdout:
        raise Exception(f"ffmpeg resize failed: {proc.stderr.decode(errors='ignore')}")
    return proc.stdout

def resize_image_file(path: str, size: int) -> bytes:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        path,
        "-vf",
        f"scale={size}:-1",
        "-vframes",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "pipe:1",
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0 or not proc.stdout:
        raise Exception(f"ffmpeg resize failed: {proc.stderr.decode(errors='ignore')}")
    return proc.stdout

def file_response_with_optional_resize(path: str, size: Optional[int], key_hint: str):
    if not size:
        return FileResponse(path)
    key = hashlib.sha1(f"{key_hint}:{size}".encode()).hexdigest()
    cache_path = ARTWORK_CACHE_DIR / f"{key}.jpg"
    if cache_path.exists():
        return FileResponse(str(cache_path))
    try:
        resized = resize_image_file(path, size)
        with open(cache_path, "wb") as f:
            f.write(resized)
        return FileResponse(str(cache_path))
    except Exception:
        return FileResponse(path)

@app.get("/api/get_artwork")
def get_artwork(file_name: str = Query(...), size: Optional[int] = Query(None)):
    full_path = os.path.join(MUSIC_DIR, file_name)
    parent_dir = os.path.dirname(full_path)
    
    # 1. Check folder art
    for art_name in ["cover.jpg", "cover.png", "folder.jpg", "folder.png"]:
        art_path = os.path.join(parent_dir, art_name)
        if os.path.exists(art_path):
            return file_response_with_optional_resize(art_path, size, art_path)
    
    # 2. Extract from tags
    try:
        tag_bytes = None
        tag_mime = None
        if full_path.lower().endswith(".mp3"):
            audio = ID3(full_path)
            for tag in audio.values():
                if isinstance(tag, APIC):
                    tag_bytes = tag.data
                    tag_mime = tag.mime
                    break
        elif full_path.lower().endswith(".flac"):
            audio = FLAC(full_path)
            if audio.pictures:
                pic = audio.pictures[0]
                tag_bytes = pic.data
                tag_mime = pic.mime
        if tag_bytes:
            if not size:
                return StreamingResponse(io.BytesIO(tag_bytes), media_type=tag_mime or "image/jpeg")
            key = hashlib.sha1(f"{full_path}:{size}:tag".encode()).hexdigest()
            cache_path = ARTWORK_CACHE_DIR / f"{key}.jpg"
            if cache_path.exists():
                return FileResponse(str(cache_path))
            try:
                resized = resize_image_bytes(tag_bytes, size)
                with open(cache_path, "wb") as f:
                    f.write(resized)
                return FileResponse(str(cache_path))
            except Exception:
                return StreamingResponse(io.BytesIO(tag_bytes), media_type=tag_mime or "image/jpeg")
    except Exception:
        pass
        
    raise HTTPException(status_code=404, detail="Artwork not found")

@app.get("/api/get_artwork_cached")
def get_artwork_cached(key: str = Query(...), size: Optional[int] = Query(None)):
    safe_key = "".join(ch for ch in key if ch.isalnum())
    if not safe_key:
        raise HTTPException(status_code=400, detail="Invalid artwork key")

    candidates = [
        ARTWORK_CACHE_DIR / f"{safe_key}.jpg",
        ARTWORK_CACHE_DIR / f"{safe_key}.jpeg",
        ARTWORK_CACHE_DIR / f"{safe_key}.png",
        ARTWORK_CACHE_DIR / f"{safe_key}.webp",
    ]
    src = next((p for p in candidates if p.exists()), None)
    if not src:
        rel_path = find_rel_path_for_cached_artwork_key(_db_cache, safe_key)
        if rel_path:
            return get_artwork(file_name=rel_path, size=size)
        raise HTTPException(status_code=404, detail="Cached artwork not found")

    return file_response_with_optional_resize(str(src), size, f"cached:{safe_key}:{src}")

@app.get("/api/get_artist_art")
def get_artist_art(
    artist: str = Query(...),
    size: Optional[int] = Query(None),
    fallback_album: bool = Query(False),
):
    miss_key = f"{artist}|{1 if fallback_album else 0}"
    now = time.time()
    miss_until = _artist_art_miss_until.get(miss_key)
    if miss_until and miss_until > now:
        raise HTTPException(status_code=404, detail="Artist artwork not found")

    candidates = sorted(_artist_dirs.get(artist, []), key=lambda p: p.count("/"))
    for rel_dir in candidates:
        abs_dir = os.path.normpath(os.path.join(MUSIC_DIR, rel_dir))
        if not abs_dir.startswith(os.path.normpath(MUSIC_DIR)):
            continue
        if not os.path.isdir(abs_dir):
            continue

        preferred_files = ["artist.jpg", "artist.png", "folder.jpg", "folder.png", "cover.jpg", "cover.png"]
        for file_name in preferred_files:
            art_path = os.path.join(abs_dir, file_name)
            if os.path.exists(art_path):
                _artist_art_miss_until.pop(miss_key, None)
                return file_response_with_optional_resize(art_path, size, f"artist:{artist}:{art_path}")

    if fallback_album:
        fallback_track = _artist_fallback_file.get(artist)
        if fallback_track:
            _artist_art_miss_until.pop(miss_key, None)
            return get_artwork(file_name=fallback_track, size=size)

    _artist_art_miss_until[miss_key] = now + max(60, ARTIST_ART_MISS_CACHE_TTL_SEC)
    raise HTTPException(status_code=404, detail="Artist artwork not found")

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
    
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if process.stdout is None:
         raise HTTPException(status_code=500, detail="FFmpeg failed")
    return StreamingResponse(process.stdout, media_type="audio/wav")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
