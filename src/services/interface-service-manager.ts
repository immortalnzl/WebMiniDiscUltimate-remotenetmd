import React, { ReactHTMLElement } from 'react';
import { CustomParameterInfo, CustomParameters } from '../custom-parameters';
import { HiMDFullService, HiMDRestrictedService, HiMDSpec } from './interfaces/himd';
import { DefaultMinidiscSpec, MinidiscSpec, NetMDService, NetMDUSBService } from './interfaces/netmd';
import { NetMDMockService } from './interfaces/netmd-mock';
import { NetMDRemoteService } from './interfaces/remote-netmd';

interface ServicePrototype {
    create: (parameters?: CustomParameters) => NetMDService | null;
    spec: MinidiscSpec;
    getConnectName: (parameters?: CustomParameters) => string;
    name: string;
    customParameters?: CustomParameterInfo[];
    description?: ReactHTMLElement<any>;
    requiresChrome: boolean;
}

export interface ServiceConstructionInfo {
    name: string;
    parameters?: CustomParameters;
}

export const Services: ServicePrototype[] = [
    {
        name: 'USB NetMD',
        getConnectName: () => 'Connect',
        create: () => window.native?.interface ?? new NetMDUSBService({ debug: true }),
        spec: new DefaultMinidiscSpec(),
        requiresChrome: true,
    },
    {
        name: 'HiMD (Restricted)',
        getConnectName: () => 'Connect to HiMD (Restricted)',
        create: () => new HiMDRestrictedService({ debug: true }),
        spec: new HiMDSpec(false),
        requiresChrome: true,
    },
    {
        name: 'HiMD (Full)',
        getConnectName: () => 'Connect to HiMD (Full)',
        create: () => {
            if (window.native?.himdFullInterface) {
                return window.native?.himdFullInterface;
            }
            if (!confirm('Warning: For Full HiMD mode, it is recommended to use ElectronWMD instead! Continue?')) {
                return null;
            }
            return new HiMDFullService({ debug: true });
        },
        spec: new HiMDSpec(true),
        requiresChrome: true,
    },
    {
        name: 'Remote NetMD',
        getConnectName: (parameters) => `Connect to ${parameters!.friendlyName || parameters!.serverAddress}`,
        description: React.createElement(
            'p',
            null,
            'Connect to a remote NetMD device with the help of ',
            React.createElement('a', { href: 'https://github.com/asivery/remote-netmd-server' }, 'Remote NetMD')
        ),
        create: (parameters) => new NetMDRemoteService({ debug: true, ...parameters } as any),
        spec: new DefaultMinidiscSpec(),
        requiresChrome: false,
        customParameters: [
            {
                userFriendlyName: 'Server Address',
                varName: 'serverAddress',
                type: 'string',
                validator: (content) => {
                    try {
                        const asURL = new URL(content);
                        return asURL.pathname === '/';
                    } catch (e) {
                        return false;
                    }
                },
            },
            {
                userFriendlyName: 'Friendly Name',
                varName: 'friendlyName',
                type: 'string',
            },
        ],
    },
    {
        name: 'MockMD',
        getConnectName: () => 'Connect to MockMD',
        description: React.createElement('p', null, 'Test NetMD interface. It does nothing'),
        create: (parameters) => {
            console.log(`Given parameters: ${JSON.stringify(parameters)}`);
            return new NetMDMockService(parameters);
        },
        spec: new DefaultMinidiscSpec(),
        requiresChrome: false,
        customParameters: [
            {
                userFriendlyName: 'Test Number',
                type: 'number',
                varName: 'number',
            },
            {
                userFriendlyName: 'Override disc title',
                type: 'string',
                varName: 'overrideTitle',
            },
            {
                userFriendlyName: 'Override full-width disc title',
                type: 'string',
                varName: 'overrideFWTitle',
            },
            {
                userFriendlyName: 'capabilityContentList',
                type: 'boolean',
                varName: 'capabilityContentList',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityPlaybackControl',
                type: 'boolean',
                varName: 'capabilityPlaybackControl',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityMetadataEdit',
                type: 'boolean',
                varName: 'capabilityMetadataEdit',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityTrackUpload',
                type: 'boolean',
                varName: 'capabilityTrackUpload',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityTrackDownload',
                type: 'boolean',
                varName: 'capabilityTrackDownload',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityDiscEject',
                type: 'boolean',
                varName: 'capabilityDiscEject',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityFactoryMode',
                type: 'boolean',
                varName: 'capabilityFactoryMode',
                defaultValue: true,
            },
        ],
    },
];

export function getSimpleServices() {
    return Services.filter((n) => !n.customParameters).map((n) => ({
        name: n.name,
    }));
}

function getPrototypeByName(name: string) {
    return Services.find((n) => n.name === name) || null;
}

export function filterOutCorrupted(savedCustomServices: ServiceConstructionInfo[]) {
    const legalCustomServices: ServiceConstructionInfo[] = [];
    for (const info of savedCustomServices) {
        const prototype = getPrototypeByName(info.name);
        if (!prototype) continue; // No such service - remove.
        const requiredParameters = prototype.customParameters;
        const parameterKeys = Object.keys(info.parameters!);
        if (!requiredParameters) continue; // The service cannot be a custom service - no props to set.
        if (requiredParameters.length !== parameterKeys.length) continue; // Invalid config.
        if (
            requiredParameters.filter((n) => parameterKeys.includes(n.varName) && typeof info.parameters![n.varName] === n.type).length !==
            requiredParameters.length
        )
            continue; // The service's parameters differ from the prototype's declaration.
        legalCustomServices.push(info);
    }
    return legalCustomServices;
}

export function createService(info: ServiceConstructionInfo) {
    return getPrototypeByName(info.name)?.create(info.parameters) ?? null;
}

export function getServiceSpec(info: ServiceConstructionInfo) {
    return getPrototypeByName(info.name)?.spec;
}

export function getConnectButtonName(service: ServiceConstructionInfo) {
    return getPrototypeByName(service.name)!.getConnectName(service.parameters);
}

export function doesServiceRequireChrome(info: ServiceConstructionInfo) {
    return getPrototypeByName(info.name)?.requiresChrome ?? false;
}
