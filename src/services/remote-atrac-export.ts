import { createWorker, setLogging } from '@ffmpeg/ffmpeg';
import { getATRACWAVEncoding, getPublicPathFor } from '../utils';
import { AudioExportService, LogPayload } from './audio-export';

export class RemoteAtracExportService implements AudioExportService {
    public ffmpegProcess: any;
    public loglines: { action: string; message: string }[] = [];
    public inFileName: string = ``;
    public outFileNameNoExt: string = ``;
    public address: string;

    constructor({ address }: { address: string }) {
        this.address = address;
    }

    async init() {
        setLogging(true);
    }

    async prepare(file: File) {
        this.loglines = [];
        this.ffmpegProcess = createWorker({
            logger: (payload: LogPayload) => {
                this.loglines.push(payload);
                console.log(payload.action, payload.message);
            },
            corePath: getPublicPathFor('ffmpeg-core.js'),
            workerPath: getPublicPathFor('worker.min.js'),
        });
        await this.ffmpegProcess.load();

        let ext = file.name.split('.').slice(-1);
        if (ext.length === 0) {
            throw new Error(`Unrecognized file format: ${file.name}`);
        }

        this.inFileName = `inAudioFile.${ext[0]}`;
        this.outFileNameNoExt = `outAudioFile`;

        await this.ffmpegProcess.write(this.inFileName, file);
    }

    async info() {
        await this.ffmpegProcess.transcode(this.inFileName, `${this.outFileNameNoExt}.metadata`, `-f ffmetadata`);

        let audioFormatRegex = /Audio:\s(.*?),/; // Actual content
        let inputFormatRegex = /Input #0,\s(.*?),/; // Container
        let format: string | null = null;
        let input: string | null = null;

        for (let line of this.loglines) {
            let match = line.message.match(audioFormatRegex);
            if (match !== null) {
                format = match[1];
                continue;
            }
            match = line.message.match(inputFormatRegex);
            if (match !== null) {
                input = match[1];
                continue;
            }
            if (format !== null && input !== null) {
                break;
            }
        }

        return { format, input };
    }

    async export({ format, loudnessTarget }: { format: string; loudnessTarget?: number }) {
        let result: ArrayBuffer;
        let additionalCommands = '';
        if (loudnessTarget !== undefined && loudnessTarget <= -5 && loudnessTarget >= -70) {
            additionalCommands += `-filter_complex loudnorm=I=${loudnessTarget}`;
        }
        if (format === `SP`) {
            const outFileName = `${this.outFileNameNoExt}.raw`;
            await this.ffmpegProcess.transcode(this.inFileName, outFileName, `${additionalCommands} -ac 2 -ar 44100 -f s16be`);
            let { data } = await this.ffmpegProcess.read(outFileName);
            result = data.buffer;
        } else {
            const outFileName = `${this.outFileNameNoExt}.wav`;
            await this.ffmpegProcess.transcode(this.inFileName, outFileName, `${additionalCommands} -f wav -ar 44100 -ac 2`);
            let { data } = await this.ffmpegProcess.read(outFileName);

            const payload = new FormData();
            payload.append('file', new Blob([data.buffer]), `${this.outFileNameNoExt}.wav`);
            const encodingURL = new URL(this.address);
            encodingURL.pathname = '/encode';
            encodingURL.searchParams.set('type', format);
            let response = await fetch(encodingURL.href, {
                method: 'POST',
                body: payload,
            });
            const source = await response.arrayBuffer();
            const content = new Uint8Array(source);
            const file = new File([content], 'test.at3');
            let headerLength = (await getATRACWAVEncoding(file))!.headerLength;
            result = source.slice(headerLength);
        }
        this.ffmpegProcess.worker.terminate();
        return result;
    }
}
