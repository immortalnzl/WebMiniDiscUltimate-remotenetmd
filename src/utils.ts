import { Disc, formatTimeFromFrames, Encoding, Group } from 'netmd-js';
import { useSelector, shallowEqual } from 'react-redux';
import { RootState } from './redux/store';
import { Mutex } from 'async-mutex';
import { Theme } from '@material-ui/core';
import * as mm from 'music-metadata-browser';


export function sleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export function debounce<T extends Function>(func: T, timeout = 300): T {
    let timer: ReturnType<typeof setTimeout>;
    const debouncedFn = (...args: any) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func(...args);
        }, timeout);
    };
    return (debouncedFn as any) as T;
}

export function removeExtension(filename: string) {
    const extStartIndex = filename.lastIndexOf('.');
    if (extStartIndex > 0) {
        filename = filename.substring(0, extStartIndex);
    }
    return filename;
}

export type TitledFile = {
    file: File;
    title: string;
    fullWidthTitle: string;
};

export async function getMetadataFromFile(file: File) {
    try {
        const fileData = await file.arrayBuffer();
        const blob = new Blob([new Uint8Array(fileData)]);
        let metadata = await mm.parseBlob(blob, { duration: true });
        let duration = metadata.format.duration ?? 0;
        const title = metadata.common.title ?? removeExtension(file.name); //Fallback to file name if there's no title in the metadata.
        const artist = metadata.common.artist ?? 'Unknown Artist';
        const album = metadata.common.album ?? 'Unknown Album';
        return { title, artist, album, duration };
    } catch (ex) {
        console.log(ex);
        return {
            title: removeExtension(file.name),
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            duration: 0,
        };
    }
}

export async function sleepWithProgressCallback(ms: number, cb: (perc: number) => void) {
    let elapsedSecs = 1;
    let interval = setInterval(() => {
        elapsedSecs++;
        cb(Math.min(100, ((elapsedSecs * 1000) / ms) * 100));
    }, 1000);
    await sleep(ms);
    window.clearInterval(interval);
}

export function useShallowEqualSelector<TState = RootState, TSelected = unknown>(selector: (state: TState) => TSelected): TSelected {
    return useSelector(selector, shallowEqual);
}

export function debugEnabled() {
    return process.env.NODE_ENV === 'development';
}

export function getPublicPathFor(script: string) {
    return `${process.env.PUBLIC_URL}/${script}`;
}

export function savePreference(key: string, value: unknown) {
    localStorage.setItem(key, JSON.stringify(value));
}

export function loadPreference<T>(key: string, defaultValue: T): T {
    let res = localStorage.getItem(key);
    if (res === null) {
        return defaultValue;
    } else {
        try {
            return JSON.parse(res) as T;
        } catch (e) {
            return defaultValue;
        }
    }
}


export function framesToSec(frames: number) {
    return frames / 512;
}

export function timeToSeekArgs(timeInSecs: number): number[] {
    let value = Math.round(timeInSecs); // ignore frames

    let s = value % 60;
    value = (value - s) / 60; // min

    let m = value % 60;
    value = (value - m) / 60; // hour

    let h = value;

    return [h, m, s, 0];
}

export function secondsToNormal(time: number): string {
    const [h, m, s] = timeToSeekArgs(time);
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const EncodingName: { [k: number]: string } = {
    [Encoding.sp]: 'SP',
    [Encoding.lp2]: 'LP2',
    [Encoding.lp4]: 'LP4',
};

export type DisplayTrack = {
    index: number;
    title: string;
    fullWidthTitle: string;
    group: string | null;
    duration: string;
    encoding: string;
    durationInSecs: number;
};

export function getSortedTracks(disc: Disc | null) {
    let tracks: DisplayTrack[] = [];
    if (disc !== null) {
        for (let group of disc.groups) {
            for (let track of group.tracks) {
                tracks.push({
                    index: track.index,
                    title: track.title ?? `Unknown Title`,
                    fullWidthTitle: track.fullWidthTitle ?? ``,
                    group: group.title ?? null,
                    encoding: EncodingName[track.encoding],
                    duration: formatTimeFromFrames(track.duration, false),
                    durationInSecs: track.duration / 512, // CAVEAT: 1s = 512 frames
                });
            }
        }
    }
    tracks.sort((l, r) => l.index - r.index);
    return tracks;
}

export function getGroupedTracks(disc: Disc | null) {
    if (!disc) {
        return [];
    }
    let groupedList: Group[] = [];
    let ungroupedTracks = [...(disc.groups.find(n => n.title === null)?.tracks ?? [])];

    let lastIndex = 0;

    for (let group of disc.groups) {
        if (group.title === null) {
            continue; // Ungrouped tracks
        }
        let toCopy = group.tracks[0].index - lastIndex;
        groupedList.push({
            index: -1,
            title: null,
            fullWidthTitle: null,
            tracks: toCopy === 0 ? [] : ungroupedTracks.splice(0, toCopy),
        });
        lastIndex = group.tracks[group.tracks.length - 1].index + 1;
        groupedList.push(group);
    }
    groupedList.push({
        index: -1,
        title: null,
        fullWidthTitle: null,
        tracks: ungroupedTracks,
    });
    return groupedList;
}

export function recomputeGroupsAfterTrackMove(disc: Disc, trackIndex: number, targetIndex: number) {
    // Used for moving tracks in netmd-mock and deleting
    let offset = trackIndex > targetIndex ? 1 : -1;
    let deleteMode = targetIndex === -1;

    if (deleteMode) {
        offset = -1;
        targetIndex = disc.trackCount;
    }

    let boundsStart = Math.min(trackIndex, targetIndex);
    let boundsEnd = Math.max(trackIndex, targetIndex);

    let allTracks = disc.groups
        .map(n => n.tracks)
        .reduce((a, b) => a.concat(b), [])
        .sort((a, b) => a.index - b.index)
        .filter(n => !deleteMode || n.index !== trackIndex);

    let groupBoundaries: {
        name: string | null;
        fullWidthName: string | null;
        start: number;
        end: number;
    }[] = disc.groups
        .filter(n => n.title !== null)
        .map(group => ({
            name: group.title,
            fullWidthName: group.fullWidthTitle,
            start: group.tracks[0].index,
            end: group.tracks[0].index + group.tracks.length - 1,
        })); // Convert to a format better for shifting

    let anyChanges = false;

    for (let group of groupBoundaries) {
        if (group.start > boundsStart && group.start <= boundsEnd) {
            group.start += offset;
            anyChanges = true;
        }
        if (group.end >= boundsStart && group.end < boundsEnd) {
            group.end += offset;
            anyChanges = true;
        }
    }

    if (!anyChanges) return disc;

    let newDisc: Disc = { ...disc };

    // Convert back
    newDisc.groups = groupBoundaries
        .map(n => ({
            title: n.name,
            fullWidthTitle: n.fullWidthName,
            index: n.start,
            tracks: allTracks.slice(n.start, n.end + 1),
        }))
        .filter(n => n.tracks.length > 0);

    // Convert ungrouped tracks
    let allGrouped = newDisc.groups.map(n => n.tracks).reduce((a, b) => a.concat(b), []);
    let ungrouped = allTracks.filter(n => !allGrouped.includes(n));

    // Fix all the track indexes
    if (deleteMode) {
        for (let i = 0; i < allTracks.length; i++) {
            allTracks[i].index = i;
        }
    }

    if (ungrouped.length) newDisc.groups.unshift({ title: null, fullWidthTitle: null, index: 0, tracks: ungrouped });

    return newDisc;
}

export function isSequential(numbers: number[]) {
    if (numbers.length === 0) return true;
    let last = numbers[0];
    for (let num of numbers) {
        if (num === last) {
            ++last;
        } else return false;
    }
    return true;
}

export function asyncMutex(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // This is meant to be used only with classes having a "mutex" instance property
    const oldValue = descriptor.value;
    descriptor.value = async function(...args: any) {
        const mutex = (this as any).mutex as Mutex;
        const release = await mutex.acquire();
        try {
            return await oldValue.apply(this, args);
        } finally {
            release();
        }
    };
    return descriptor;
}

export function forAnyDesktop(theme: Theme) {
    return theme.breakpoints.up(600 + theme.spacing(2) * 2);
}

export function belowDesktop(theme: Theme) {
    return theme.breakpoints.down(600 + theme.spacing(2) * 2);
}

export function forWideDesktop(theme: Theme) {
    return theme.breakpoints.up(700 + theme.spacing(2) * 2) + ` and (min-height: 750px)`;
}

export function askNotificationPermission(): Promise<NotificationPermission> {
    // Adapted from: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API
    function checkNotificationPromise() {
        try {
            Notification.requestPermission().then();
        } catch (e) {
            return false;
        }
        return true;
    }

    if (checkNotificationPromise()) {
        return Notification.requestPermission();
    } else {
        return new Promise(resolve => Notification.requestPermission(resolve));
    }
}

export function downloadBlob(buffer: Blob, fileName: string){
    let url = URL.createObjectURL(buffer);
    let a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

declare let process: any;
