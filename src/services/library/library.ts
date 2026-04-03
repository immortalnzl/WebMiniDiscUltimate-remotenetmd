import { ExportParams } from "../audio/audio-export";

export type LocalDatabase = { [filename: string]: LocalDatabase | { artist: string, album: string, title: string, duration: number, artwork?: string }};

// TODO: For now getSupport() is assumed to return 'perfect' all the time
// FIX THIS
export interface LibraryService {
    getDatabase(): Promise<LocalDatabase>;
    processLocalLibraryFile(filePath: string, params: ExportParams): Promise<ArrayBuffer>;
    getAudioUrl(filePath: string): string | null;
}
