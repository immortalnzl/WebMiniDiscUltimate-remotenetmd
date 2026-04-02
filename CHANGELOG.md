# Changelog

All notable changes to WebMiniDiscPro will be documented in this file.

## [Unreleased]

### Added

#### Library & Music Management
- **Music Library Integration with MD Burning UI**
  - Fixed broken file flow from library sidebar to MiniDisc burning interface
  - Files from library now properly appear in burning queue
  - Side-by-side layout maintained: Library browser (75%) ↔ MD Burning UI (25%)

- **Visual Burn Queue Indicator**
  - New "Burn Queue" section showing queued files count
  - Animated badge displaying number of files ready to burn
  - Prominent "Send to Burner" button to open conversion dialog
  - Only displays when files are queued

- **Enhanced Audio Playback**
  - Pause/Resume functionality (previously only had stop)
  - Seek/Skip to any point in track
  - Real-time playback progress tracking with callbacks
  - Improved playback state management
  - Track duration and current time display in library player

- **Persistent Playlist System**
  - Create multiple named playlists
  - Add tracks to playlists from library browser
  - Reorder tracks within playlists
  - Rename playlists on the fly
  - Delete unwanted playlists
  - Auto-save playlists to browser localStorage
  - Playlists persist across app restarts

- **Playlist Management UI**
  - New "Playlists" button in library header
  - Full-screen playlist dialog with dual-pane layout
    - Left pane: Playlist list with create/delete controls
    - Right pane: Track list with artwork, artist, album info
  - "Burn to MD" button to send entire playlist to conversion dialog
  - Track removal from playlists
  - Inline playlist renaming

### Technical Changes

#### Redux State Management
- **New Redux Slice**: `src/redux/playlist-feature.ts`
  - Playlist creation, deletion, renaming
  - Track management (add, remove, reorder)
  - Playlist persistence actions
  - Integrated with Redux store

#### Audio Player Service Enhancement
- **New Methods**:
  - `pause()` - Pause at current position
  - `resume()` - Resume from paused position
  - `seek(time)` - Jump to specific time
  - `setOnTimeUpdate(callback)` - Time update callbacks
  - `getDuration()` - Get track duration
  - `getCurrentTime()` - Get current playback position

- **Improved State Tracking**:
  - Playback state management (playing/paused/stopped)
  - Pause time tracking for resume functionality
  - Animation frame-based time updates for smooth progress

#### Component Updates
- **Library Sidebar** (`src/components/library-sidebar.tsx`):
  - Fixed file dispatch to burning UI
  - Added "Burn Queue" section with visual indicators
  - Added "Playlists" button to header
  - Updated play/pause logic to use new service methods
  - Integrated seek functionality

- **New Component**: `src/components/playlist-dialog.tsx`
  - Full playlist management UI
  - Playlist creation form
  - Track display with metadata
  - Drag-friendly layout with Material-UI components
  - Integration with Redux playlist state

### Workflow Improvements

**Before:**
- Select songs from library → Nothing happened in MD burning UI
- No way to organize tracks before burning
- Audio player was basic (play/stop only)

**After:**
```
1. Browse library and select songs
2. Click "Add to Burn List" or "+" button
3. See files in "Burn Queue" with count badge
4. Create playlists to organize songs
5. Preview songs (pause/resume/seek works!)
6. Open playlist and click "Burn to MD"
7. Songs populate burning queue with proper formatting
8. Proceed to format selection and burn
```

### Bug Fixes

- **Fixed Missing Dialog Visibility Dispatch**
  - Library sidebar now properly opens burning dialog when adding files
  - Files no longer silently added to Redux state without opening dialog

- **Improved Playback State Handling**
  - Pause now properly remembers position instead of stopping
  - Resume works correctly without re-decoding audio
  - Seek properly maintains playback state

### Files Changed

| File | Status | Change |
|------|--------|--------|
| `src/components/library-sidebar.tsx` | Modified | Fixed file dispatch, added queue UI, pause/resume, playlists |
| `src/services/player/audio-player-service.ts` | Modified | Added pause/resume/seek/time tracking |
| `src/redux/playlist-feature.ts` | Created | New Redux slice for playlist management |
| `src/components/playlist-dialog.tsx` | Created | New UI for playlist creation and management |
| `src/redux/store.ts` | Modified | Registered playlist reducer |

### Breaking Changes

None

### Migration Guide

For users upgrading:
- Playlists are stored in browser localStorage automatically
- No manual migration needed
- Library sidebar behavior improved but maintains same UX
- All existing files in burn queue work as before

### Known Limitations

- Playlists stored in localStorage only (per-browser, not cloud-synced)
- Playlist artwork from first track in playlist (could be enhanced)
- No playlist sharing or export yet
- No drag-and-drop track reordering in playlist UI yet
- Audio player still uses FFmpeg Web Worker (can take time to decode)

### Future Enhancements

- [ ] Add "Add to Playlist" context menu in library browser
- [ ] Implement drag-to-reorder tracks in playlist
- [ ] Playlist cover art customization
- [ ] Export/import playlists as JSON
- [ ] Cloud sync playlists (with authentication)
- [ ] Playlist descriptions and tags
- [ ] Favorite/pin playlists
- [ ] Collaborative playlists
- [ ] Search within playlists
- [ ] Playlist duplication

### Credits

Implemented by Claude Code (Anthropic)

---

## Previous Releases

See git history for prior releases.
