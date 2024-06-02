import { CustomParameterInfo, CustomParameters } from '../custom-parameters';
import { AtracdencAudioExportService } from './audio/atracdenc-export';
import { AudioExportService } from './audio/audio-export';
import { LocalAtracExportService } from './audio/ewmd-local-atrac-export';
import { RemoteAtracExportService } from './audio/remote-atrac-export';

interface AudioServicePrototype<T extends AudioExportService> {
    create: new (parameters: CustomParameters) => T;
    customParameters?: CustomParameterInfo[];
    name: string;
    description?: string;
}

export const AudioServices: AudioServicePrototype<AudioExportService>[] = [
    {
        name: 'Atracdenc',
        create: AtracdencAudioExportService,
        description: 'The standard open-source ATRAC encoder. Its ATRAC3 support is incomplete',
    },
    {
        name: 'Remote ATRAC Encoder',
        create: RemoteAtracExportService,
        customParameters: [
            {
                userFriendlyName: 'Server Address',
                varName: 'address',
                type: 'string',
                defaultValue: 'https://atrac.minidisc.wiki/',
                validator: content => {
                    try {
                        new URL(content);
                        return true;
                    } catch (e) {
                        return false;
                    }
                },
            },
        ],
        description:
            'A separate high-quality ATRAC encoder hosted on another server (as defined by https://github.com/thinkbrown/atrac-api)',
    },
];

if(window.native?.invokeLocalEncoder) {
    AudioServices.push({
        name: 'Local ATRAC Encoder',
        create: LocalAtracExportService,
        description: 'A local copy of the high-quality Sony encoder. Warning: Requires FFMPEG to be present in $PATH!',
        customParameters: [
            {
                userFriendlyName: 'Windows Executable Path',
                type: 'hostFilePath',
                varName: 'exe',
                defaultValue: '',
                validator: content => !!content,
            },
        ]
    });
}
