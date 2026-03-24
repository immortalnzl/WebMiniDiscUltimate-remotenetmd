# WebMiniDisc Pro - Self-Hosted with Music Library

This setup allows you to host WebMiniDisc Pro locally and access your music collection (e.g., from a NAS or server) directly within the web interface.

## Quick Start

1.  **Configure Music Source**:
    Open the `.env` file. You can use a local folder or a network share (SMB/NFS).
    
    **For SMB (Network Share):**
    ```env
    MUSIC_PATH=//10.1.4.10/Music
    VOLUME_TYPE=cifs
    VOLUME_OPTIONS=username=YOUR_USER,password=YOUR_PASS,vers=3.0
    ```
    
    **For Local Folder:**
    ```env
    MUSIC_PATH=Z:/media/Music
    VOLUME_TYPE=none
    VOLUME_OPTIONS=bind
    ```

2.  **Launch Containers**:
    Run the following command in your terminal:
    ```bash
    docker compose up -d
    ```

3.  **Access the App**:
    Open your browser and go to `http://<YOUR_SERVER_IP>:8443`.

4.  **Configure the Library**:
    *   In WebMiniDisc Pro, click the **Settings** (gear icon).
    *   Scroll down to the **Library** section.
    *   Set **Library to use** to `Remote Library`.
    *   Set **Server Address** to `http://<YOUR_SERVER_IP>:8000/`.
    *   Click **Save and Reload**.

5.  **Browse your Music**:
    Click the **Music Library** icon in the app. You can now browse your folders, see **Album Art**, and select tracks to send to your MiniDisc player!

## Features Added
*   **Remote Library Support**: Fully integrated with the WebMiniDisc Pro frontend.
*   **Album Art**: Automatically extracts cover art from ID3/FLAC tags or looks for `cover.jpg` in folders.
*   **Server-Side Transcoding**: High-quality ATRAC encoding is handled by the backend server using FFmpeg.

## Important Note: WebUSB & HTTPS
WebUSB (required to talk to your MiniDisc player) is only available in **secure contexts**.
*   **Localhost**: works normally (`http://localhost:8443`).
*   **IP Address**: If accessing via a server IP (e.g., `http://192.168.1.10:8443`), you must enable the `unsafely-treat-insecure-origin-as-secure` flag in Chrome/Edge:
    1.  Go to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
    2.  Add `http://<YOUR_SERVER_IP>:8443` to the list.
    3.  Relaunch the browser.
