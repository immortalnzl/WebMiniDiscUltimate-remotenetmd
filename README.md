# WebMiniDisc Pro - Self-Hosted with Music Library

This fork packages WebMiniDisc Pro for self-hosted use and adds a remote music library, richer artwork support, label-making tools, transfer improvements, and advanced device backup options.

## Credits
This project is built on top of the excellent work by [Asivery](https://github.com/asivery/) and the original Web MiniDisc Pro contributors.  
Huge thanks to Asivery for creating and maintaining the core project that made this build possible.

## Features Added
- Remote music library browser for NAS, server, and local folder collections, with NFS, SMB/CIFS, and local bind-mount support.
- Album art from embedded audio tags and common folder artwork files, including `cover.jpg`, `folder.jpg`, `artist.jpg`, and similar local image files.
- Artist image support in the MD Label Maker. The **Artist Image** button can use server-side artist artwork from the music library.
- MD Label Maker dialog for designing printable MiniDisc case labels, with multiple size presets, artwork selection, save support, and label history.
- ETA and aggregate progress display during ATRAC encoding uploads, so longer transfers show clearer remaining-time feedback.
- Automatic error recovery in transfer and encoding operations, allowing supported operations to retry or continue instead of stopping at the first recoverable failure.
- EEPROM backup and restore through factory mode under **Settings -> Factory -> Backup EEPROM / Restore EEPROM**.
- Optional self-hosted HQ ATRAC encoder sidecar using the `hq-atrac` Docker profile.
- Upstream fixes cherry-picked from `asivery/webminidisc` and `utsnik/WebMiniDiscUltimate`.

## Quick Start

1. **Configure Music Source**
```bash
cp .env.example .env
```
Then edit `.env` and set `MUSIC_PATH` to your music folder. Examples are included in the file for local folders, NFS, and SMB shares.

2. **Launch Containers**
```bash
# Docker Compose v2 plugin
docker compose up -d

# Docker Compose v1 standalone
docker-compose up -d
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

## NFS Mount Setup

To use an NFS music share, configure `.env` with the local path you want Docker to mount, set the volume type to `nfs`, and provide the NFS server address and mount options:

```env
MUSIC_PATH=/mnt/fileserver/media/Music
VOLUME_TYPE=nfs
VOLUME_OPTIONS=addr=10.1.4.10,nolock,soft
```

After updating `.env`, restart the containers and select **Remote Library** in the WebMiniDisc Pro settings.

## MD Label Maker

The MD Label Maker lets you design printable MiniDisc case labels directly in the app. Open it from the label icon in the library sidebar or from the now-playing screen.

It supports multiple MiniDisc label size presets, artwork from the server library, custom uploaded artwork, saved labels, and label history. The **Artist Image** button fetches an artist photo from the music library when `artist.jpg`, `folder.jpg`, or another supported artist image is present in the artist directory.

## EEPROM Backup / Restore

EEPROM backup and restore is available for advanced users with compatible NetMD devices. Connect your NetMD device, open **Settings -> Factory Mode**, then use **Backup EEPROM** to save a `.bin` file or **Restore EEPROM** to write a saved backup back to the device.

Restoring EEPROM data can affect device behavior. Use this feature only if you understand what you are restoring and keep a known-good backup before making changes.

## Important Note: WebUSB and HTTPS
WebUSB (required for NetMD device access) works only in secure contexts.
- `localhost` works directly.
- For LAN IP access, trust your HTTPS cert or use browser secure-origin override flags for your host.
