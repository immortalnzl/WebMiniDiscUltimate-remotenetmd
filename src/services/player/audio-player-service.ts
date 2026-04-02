import { createWorker, setLogging } from '@ffmpeg/ffmpeg';
import { getPublicPathFor } from '../../utils';

export class AudioPlayerService {
    private worker: ReturnType<typeof createWorker> | null = null;
    private audioContext: AudioContext | null = null;
    private sourceNode: AudioBufferSourceNode | null = null;
    private currentFile: File | null = null;
    private currentBuffer: AudioBuffer | null = null;
    private isPlaying: boolean = false;
    private pausedTime: number = 0;
    private startTime: number = 0;
    private onTimeUpdate: ((time: number, duration: number) => void) | null = null;
    private animationFrameId: number | null = null;

    constructor() {
        setLogging(false);
    }

    async init() {
        if (this.worker) return;
        
        // Fallback to CDN if local files are missing or broken
        const CORE_PATH = 'https://unpkg.com/@ffmpeg/core@0.6.1/dist/ffmpeg-core.js';
        const WORKER_PATH = 'https://unpkg.com/@ffmpeg/core@0.6.1/dist/ffmpeg-core.worker.js';

        this.worker = createWorker({
            corePath: CORE_PATH,
            workerPath: WORKER_PATH,
            logger: (m: any) => console.log('[FFMPEG]', m),
        });
        await this.worker.load();
    }

    async decode(fileOrUrl: File | string): Promise<AudioBuffer> {
        await this.init();
        if (!this.worker) throw new Error('Worker not initialized');

        let data: Uint8Array;
        let fileName: string;

        try {
            if (typeof fileOrUrl === 'string') {
                const resp = await fetch(fileOrUrl);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const blob = await resp.blob();
                data = new Uint8Array(await blob.arrayBuffer());
                fileName = fileOrUrl.split('/').pop()?.split('?')[0] || 'input.tmp';
            } else {
                data = new Uint8Array(await fileOrUrl.arrayBuffer());
                fileName = fileOrUrl.name;
            }

            const ext = fileName.split('.').pop() || 'tmp';
            const inName = `input.${ext}`;
            const outName = 'output.wav';

            await this.worker.write(inName, data);
            await this.worker.transcode(inName, outName, '-ar 44100 -ac 2');
            const readData = await this.worker.read(outName);
            
            await this.worker.remove(inName);
            await this.worker.remove(outName);

            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            return await this.audioContext.decodeAudioData(readData.data.buffer);
        } catch (err) {
            console.error('[AudioPlayerService] Decode failed:', err);
            throw err;
        }
    }

    async play(fileOrUrl: File | string) {
        try {
            // If already playing same content, just resume
            if (this.isPlaying && this.currentFile === fileOrUrl) {
                return;
            }

            const buffer = await this.decode(fileOrUrl);
            this.currentBuffer = buffer;
            this.currentFile = fileOrUrl as any;

            if (this.sourceNode) {
                try { this.sourceNode.stop(); } catch(e) {}
            }

            if (!this.audioContext) return;

            // Resume context if suspended (required by browsers)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.sourceNode = this.audioContext.createBufferSource();
            this.sourceNode.buffer = buffer;
            this.sourceNode.connect(this.audioContext.destination);

            // Handle end of playback
            this.sourceNode.onended = () => {
                this.isPlaying = false;
                this.pausedTime = 0;
                this.stopTimeUpdates();
            };

            this.startTime = this.audioContext.currentTime - this.pausedTime;
            this.sourceNode.start(0, this.pausedTime);
            this.isPlaying = true;
            this.startTimeUpdates();
        } catch (err) {
            console.error('[AudioPlayerService] Play failed:', err);
        }
    }

    pause() {
        if (this.isPlaying && this.sourceNode && this.audioContext) {
            this.pausedTime = this.audioContext.currentTime - this.startTime;
            try {
                this.sourceNode.stop();
            } catch (e) {}
            this.isPlaying = false;
            this.stopTimeUpdates();
        }
    }

    resume() {
        if (!this.isPlaying && this.currentBuffer && this.currentFile) {
            this.play(this.currentFile);
        }
    }

    seek(time: number) {
        if (this.currentBuffer) {
            this.pausedTime = Math.max(0, Math.min(time, this.currentBuffer.duration));
            const wasPlaying = this.isPlaying;
            if (wasPlaying) {
                this.pause();
                this.play(this.currentFile || '');
            }
        }
    }

    private startTimeUpdates() {
        this.stopTimeUpdates();
        const updateTime = () => {
            if (this.isPlaying && this.audioContext && this.currentBuffer && this.onTimeUpdate) {
                const currentTime = this.audioContext.currentTime - this.startTime;
                this.onTimeUpdate(Math.max(0, Math.min(currentTime, this.currentBuffer.duration)), this.currentBuffer.duration);
            }
            if (this.isPlaying) {
                this.animationFrameId = requestAnimationFrame(updateTime);
            }
        };
        this.animationFrameId = requestAnimationFrame(updateTime);
    }

    private stopTimeUpdates() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    setOnTimeUpdate(callback: ((time: number, duration: number) => void) | null) {
        this.onTimeUpdate = callback;
    }

    stop() {
        if (this.sourceNode) {
            try { this.sourceNode.stop(); } catch(e) {}
            this.sourceNode = null;
        }
        this.isPlaying = false;
        this.pausedTime = 0;
        this.stopTimeUpdates();
    }

    getDuration(): number {
        return this.currentBuffer?.duration || 0;
    }

    getCurrentTime(): number {
        if (this.isPlaying && this.audioContext) {
            return this.audioContext.currentTime - this.startTime;
        }
        return this.pausedTime;
    }

    async close() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
    }
}

const audioPlayerService = new AudioPlayerService();
export default audioPlayerService;
