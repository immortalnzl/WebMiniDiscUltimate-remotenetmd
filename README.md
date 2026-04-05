# WebMiniDisc Pro - Self-Hosted with Music Library

This setup lets you host WebMiniDisc Pro locally and browse your music collection (NAS/server/local folder) directly in the web UI.

## Credits
This project is built on top of the excellent work by [Asivery](https://github.com/asivery/) and the original Web MiniDisc Pro contributors.  
Huge thanks to Asivery for creating and maintaining the core project that made this build possible.

## Quick Start

1. **Configure Music Source** in `.env`.

For SMB (network share):
```env
MUSIC_PATH=//10.1.4.10/Music
VOLUME_TYPE=cifs
VOLUME_OPTIONS=username=YOUR_USER,password=YOUR_PASS,vers=3.0
```

For local folder:
```env
MUSIC_PATH=Z:/media/Music
VOLUME_TYPE=none
VOLUME_OPTIONS=bind
```

2. **Launch Containers**
```bash
docker compose up -d
```

3. **Access the App** at `https://<YOUR_SERVER_IP>:8443`.

4. **Configure Library in UI**
- Open **Settings**.
- In **Library**, set **Library to use** = `Remote Library`.
- Set **Server Address** = `http://<YOUR_SERVER_IP>:8000/`.
- Click **Save and Reload**.

5. **Browse Music**
- Open the music library and browse folders/artists/albums.

6. **Optional: Bundled Self-Hosted ATRAC API (HQ path)**
- The compose files include optional sidecar profile `hq-atrac`.
- Start with:
```bash
docker compose --profile hq-atrac up -d
```
- In **Settings -> Encoding**, use `Remote ATRAC Encoder` and set **Server Address** to `/atrac/` (or `https://<YOUR_SERVER_IP>:8443/atrac/`).
- On ARM64 (Pi), enable Docker x86 emulation:
```bash
docker run --privileged --rm tonistiigi/binfmt --install amd64
docker run --privileged --rm tonistiigi/binfmt --install i386
```
- Pi deploy scripts (`deploy-bpi.ps1` / `deploy_bpi.ps1`) now auto-enable this profile and binfmt handlers.

## Features Added
- Remote library support integrated with WebMiniDisc Pro frontend.
- Album art from embedded tags and local folder art (`cover.jpg`, `folder.jpg`, etc.).
- Optional self-hosted ATRAC sidecar reverse-proxied behind `/atrac/`.

## Important Note: WebUSB and HTTPS
WebUSB (required for NetMD device access) works only in secure contexts.
- `localhost` works directly.
- For LAN IP access, trust your HTTPS cert or use browser secure-origin override flags for your host.
