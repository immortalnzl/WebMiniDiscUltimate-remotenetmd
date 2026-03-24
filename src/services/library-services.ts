import { CustomParameterInfo, CustomParameters } from '../custom-parameters';
import { LibraryService } from './library/library';
import { RemoteLibraryService } from './library/remote-library';

interface LibraryServicePrototype<T extends LibraryService> {
    create: new (parameters: CustomParameters) => T;
    customParameters?: CustomParameterInfo[];
    name: string;
    description?: string;
}

export const LibraryServices: LibraryServicePrototype<LibraryService>[] = [
    {
        name: 'Remote Library',
        create: RemoteLibraryService,
        description:
            'A remote library with an inbuilt encoder. Lets you cut down on bandwidth usage, by having the files sent to the local Web Minidisc instance preencoded.',
        customParameters: [
            {
                userFriendlyName: 'Server Address',
                varName: 'address',
                type: 'string',
                defaultValue: '/api/',
                validator: (content: string | undefined) => {
                    try {
                        new URL(content || '', window.location.origin);
                        return true;
                    } catch (e) {
                        return false;
                    }
                },
            },
            {
                userFriendlyName: 'Storage Type',
                varName: 'volume_type',
                type: [
                    { name: 'Local Folder', value: 'none' },
                    { name: 'SMB / CIFS', value: 'cifs' },
                    { name: 'NFS', value: 'nfs' },
                ],
                defaultValue: 'none',
            },
            {
                userFriendlyName: 'Music Path / URI',
                varName: 'music_path',
                type: 'string',
                defaultValue: '/music',
            },
            {
                userFriendlyName: 'Mount Options (SMB/NFS)',
                varName: 'volume_options',
                type: 'string',
                defaultValue: 'bind',
            },
        ],
    },
];
