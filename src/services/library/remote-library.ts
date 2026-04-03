import { CustomParameters } from '../../custom-parameters';
import { getATRACWAVEncoding } from '../../utils';
import { CodecFamily } from '../interfaces/netmd';
import { DefaultFfmpegAudioExportService, ExportParams } from '../audio/audio-export';
import { LibraryService, LocalDatabase } from './library';

const MAX_TRIES = 3;

export class RemoteLibraryService extends DefaultFfmpegAudioExportService implements LibraryService {
    // These methods are required by the DefaultFFMPEGAudioExport service, but since
    // this is a library, they won't be used
    encodeATRAC3(parameters: ExportParams): Promise<ArrayBuffer> {
        throw new Error('Method not implemented.');
    }
    encodeATRAC3Plus(parameters: ExportParams): Promise<ArrayBuffer> {
        throw new Error('Method not implemented.');
    }

    public address: string;
    public originalFileName: string = '';
    public volume_type: string;
    public music_path: string;
    public volume_options: string;

    constructor(parameters: CustomParameters) {
        super();
        this.address = (parameters.address as string) || '/api/';
        this.music_path = (parameters.music_path as string) || '/music';
        this.volume_type = (parameters.volume_type as string) || 'none';
        this.volume_options = (parameters.volume_options as string) || 'bind';

        // NOTE: removed syncStorage() from constructor to avoid race conditions during init
    }

    async syncStorage() {
        try {
            const resp = await fetch('/api/storage');
            const current = await resp.json();

            const needsUpdate = 
                current.MUSIC_PATH !== this.music_path ||
                current.VOLUME_TYPE !== this.volume_type ||
                current.VOLUME_OPTIONS !== this.volume_options;

            if (needsUpdate) {
                console.log("Updating backend storage settings...");
                await fetch('/api/storage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        MUSIC_PATH: this.music_path,
                        VOLUME_TYPE: this.volume_type,
                        VOLUME_OPTIONS: this.volume_options,
                    })
                });
                
                // Trigger restart
                await fetch('/api/restart', { method: 'POST' });
            }
        } catch (e) {
            console.error("Failed to sync storage with backend:", e);
        }
    }

    getSupport(codec: CodecFamily): 'perfect' {
        return 'perfect';
    }

    async getDatabase(): Promise<LocalDatabase> {
        try {
            console.log("Fetching database from /api/database...");
            const resp = await fetch('/api/database?cache=' + Math.random());
            if (!resp.ok) {
                throw new Error(`HTTP Error: ${resp.status} ${resp.statusText}`);
            }
            const json = await resp.json() as LocalDatabase;

            // Prepend address to artwork URLs
            const process = (db: LocalDatabase) => {
                for (const key in db) {
                    const entry = db[key];
                    if (entry && typeof entry === 'object' && 'artist' in entry) {
                        const track = entry as any;
                        if (track.artwork && !track.artwork.startsWith('http')) {
                            const artURL = new URL(this.address, window.location.origin);
                            const [path, search] = track.artwork.split('?');
                            artURL.pathname = path;
                            artURL.search = search || '';
                            track.artwork = artURL.href;
                        }
                    } else if (entry && typeof entry === 'object') {
                        process(entry as LocalDatabase);
                    }
                }
            };
            process(json);

            return json;
        } catch (e) {
            console.error("RemoteLibraryService.getDatabase failed:", e);
            throw e;
        }
    }

    async getStatus(): Promise<any> {
        const resp = await fetch('/api/status?cache=' + Math.random());
        return resp.json();
    }

    async getArtists(): Promise<string[]> {
        const resp = await fetch('/api/artists?cache=' + Math.random());
        return resp.json();
    }

    async getAlbums(): Promise<any[]> {
        const resp = await fetch('/api/albums?cache=' + Math.random());
        const json = await resp.json();
        // Process artwork URLs for albums too
        return json.map((album: any) => {
            if (album.artwork && !album.artwork.startsWith('http')) {
                const artURL = new URL(this.address, window.location.origin);
                const [path, search] = album.artwork.split('?');
                artURL.pathname = path;
                artURL.search = search || '';
                return { ...album, artwork: artURL.href };
            }
            return album;
        });
    }

    async processLocalLibraryFile(filePath: string, params: ExportParams): Promise<ArrayBuffer> {
        if (params.format.codec === 'PCM' || params.format.codec === 'MP3') {
            // Use address as base, avoid double /api
            const rawURL = new URL(this.address, window.location.origin);
            const pathBase = rawURL.pathname.endsWith('/') ? rawURL.pathname : rawURL.pathname + '/';
            rawURL.pathname = pathBase + 'get_local';
            rawURL.searchParams.set('file_name', filePath);
            let response: Response | null = null;
            for(let i = 0; i<MAX_TRIES; i++){
                try{
                    response = await fetch(rawURL.href);
                    break;
                }catch(ex){
                    console.log("Error while fetching: " + ex);
                }
            }
            if(response === null) {
                throw new Error("Failed to convert audio!");
            }
            const fileTokens = filePath.split("/");
            const fileName = fileTokens[fileTokens.length - 1];
            const asFile = new File([ await response.blob() ], fileName);
            await this.prepare(asFile);
            return this.export(params);
        } else {
            const { format, enableReplayGain } = params;
            const encodingURL = new URL(this.address, window.location.origin);
            if (!encodingURL.pathname.endsWith('/')) encodingURL.pathname += '/';
            encodingURL.pathname += 'transcode_local';
            let encoderFormat: string;
            switch (format.codec) {
                case 'A3+':
                    if (![48, 64, 96, 128, 160, 192, 256, 320, 352].includes(format.bitrate ?? 0)) {
                        throw new Error('Invalid bitrate given to encoder');
                    }
                    encoderFormat = `PLUS${format.bitrate!}`;
                    break;
                case 'AT3':
                    // AT3@105kbps
                    if (format.bitrate === 105) {
                        encoderFormat = 'LP105';
                        break;
                    } else if (format.bitrate === 132) {
                        encoderFormat = 'LP2';
                        break;
                    } else if (format.bitrate === 66) {
                        encoderFormat = 'LP4';
                        break;
                    } // else fall through
                default:
                    throw new Error('Invalid format given to encoder');
            }
            encodingURL.searchParams.set('type', encoderFormat);
            encodingURL.searchParams.set('file_name', filePath);
            if (enableReplayGain !== undefined) encodingURL.searchParams.set('applyReplaygain', enableReplayGain.toString());
            let response: Response | null = null;
            for(let i = 0; i<MAX_TRIES; i++){
                try{
                    response = await fetch(encodingURL.href);
                    if(response === null) {
                        throw new Error("Failed to convert audio!");
                    }
                    const source = await response.arrayBuffer();
                    const content = new Uint8Array(source);
                    const file = new File([content], 'test.at3');
                    const headerLength = (await getATRACWAVEncoding(file))!.headerLength;
                    return source.slice(headerLength);
                }catch(ex){
                    console.log("Error while fetching: " + ex);
                }
            }

            throw new Error("Failed to transcode audio!");
        }
    }

    getAudioUrl(filePath: string): string {
        const url = new URL(this.address, window.location.origin);
        const pathBase = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
        url.pathname = pathBase + 'get_local';
        url.searchParams.set('file_name', filePath);
        return url.href;
    }

    getPreviewUrl(filePath: string): string {
        const url = new URL(this.address, window.location.origin);
        const pathBase = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
        url.pathname = pathBase + 'preview';
        url.searchParams.set('file_name', filePath);
        return url.href;
    }

    async getForEncoding(track: any, codec: any): Promise<ArrayBuffer> {
        return this.processLocalLibraryFile(track.id || track.file, {
            format: {
                bitrate: codec.bitrate,
                codec: codec.codec as any,
            },
            lastInBatch: false,
        });
    }
}
