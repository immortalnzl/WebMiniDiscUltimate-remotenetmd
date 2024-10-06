import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { ArrowDropDown, ArrowDropUp, Description, Folder } from '@mui/icons-material';
import { defaultSorter, dirSorter, FileType } from './utils';
import './browser.css';

export interface File {
    name: string;
    type: FileType;
    props?: {[key: string]: any};
}

export interface Action {
    name: string;
    icon?: ReactElement;
    handler: (selectedFiles: File[]) => (void | boolean);
    actionPossible: (selectedFiles: File[]) => boolean;
}

export interface FileBrowserProps {
    onFileSelectionChanged?: (filePath: File[]) => void;
    onFileDoubleClick?: (filePath: File) => void;
    fileTree: File[];
    allowMultifileSelection?: boolean;
    actions?: Action[],
    sorter?: (a: File, b: File, by: string, asc: boolean) => number;
    additionalColumns?: { name: string, overrideName?: string, sortable: boolean, class?: string }[];
    classes?: {
        root?: string;
        row?: string;
        mainBody?: string;
        icon?: string;
        colHeader?: string;
        actionButton?: string;
        actions?: string;
    };
    manualName?: boolean;
    columnNotFoundPlaceholder?: string;
    iconGenerator?: (file: File) => ReactElement;
    defaultSorting?: { by: string, asc: boolean };
}

export function FileBrowser({ classes, fileTree, additionalColumns, columnNotFoundPlaceholder, allowMultifileSelection, manualName, defaultSorting, onFileSelectionChanged, sorter, actions, onFileDoubleClick, iconGenerator }: FileBrowserProps) {
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [currentSortingValue, setCurrentSortingValue] = useState<{ by: string, asc: boolean } | null>(defaultSorting ?? null);
    const [sortedFileTree, setSortedFileTree] = useState(fileTree);
    const [visibleActions, setVisibleActions] = useState<number[]>([]);

    useEffect(() => {
        const currentSorter = sorter ?? defaultSorter;
        if(!currentSortingValue) {
            setSortedFileTree([...fileTree].sort((a, b) => dirSorter(a, b, '', false)));
            return;
        }
        const sortedFiles = [...fileTree].sort((a, b) => currentSorter(a, b, currentSortingValue.by, currentSortingValue.asc));
        setSortedFileTree(sortedFiles);
    }, [fileTree, currentSortingValue, sorter]);

    const handleRowClick = useCallback((row: number) => {
        if(allowMultifileSelection) {
            if(selectedRows.includes(row)) {
                setSelectedRows(selectedRows.filter(e => e !== row));
            } else {
                setSelectedRows([...selectedRows, row]);
            }
        } else {
            if(selectedRows.includes(row)) setSelectedRows([]);
            else setSelectedRows([ row ]);
        }
    }, [allowMultifileSelection, selectedRows]);

    const sortingClicked = useCallback((fieldName: string) => {
        if(fieldName === currentSortingValue?.by) {
            if(!currentSortingValue.asc) {
                setCurrentSortingValue({ by: currentSortingValue.by, asc: true });
                return;
            } else {
                // Already at asc - clear sorting
                setCurrentSortingValue(null);
                return;
            }
        }
        setCurrentSortingValue({ by: fieldName, asc: false });
    }, [currentSortingValue]);

    useEffect(() => {
        onFileSelectionChanged?.(selectedRows.map(e => sortedFileTree[e]));
    }, [selectedRows, onFileSelectionChanged, sortedFileTree]);

    useEffect(() => {
        if(!actions) {
            setVisibleActions([]);
            return;
        }
        const selectedFiles = selectedRows.map(e => sortedFileTree[e]);
        const actionsPossible = [];
        for(let i = 0; i<actions.length; i++){
            if(actions[i].actionPossible(selectedFiles)){
                actionsPossible.push(i);
            }
        }
        setVisibleActions(actionsPossible);
    }, [selectedRows, sortedFileTree, actions]);

    useEffect(() => {
        setSelectedRows([])
    }, [fileTree, setSelectedRows]);

    const _iconGenerator = iconGenerator ?? ((e: File) => e.type === FileType.Directory ? <Folder /> : <Description />);

    const columns: [string, string | undefined][] = [];
    if(!manualName){
        columns.push(['name', undefined])
    }
    columns.push(...(additionalColumns ?? []).map<[string, string | undefined]>(e => [e.name, e.overrideName]));

    return <div className={clsx('filebrowser-root')}>
        <div className={clsx('filebrowser-actions', classes?.actions)}>
            {actions?.map((e, i) => (
                <div
                    key={i}
                    className={clsx({'filebrowser-action-disabled': !visibleActions.includes(i)}, 'filebrowser-action', classes?.actionButton)}
                    onClick={() => e.handler(selectedRows.map(e => sortedFileTree[e])) && setSelectedRows([])}
                >
                    {e.icon} {e.name}
                </div>
            ))}
        </div>
        <table className={clsx('filebrowser-root-table', classes?.root)}>
            <colgroup>
                <col className={clsx('filebrowser-icon', classes?.icon)} />
                {!manualName && <col className={clsx('filebrowser-col')} />}
                {additionalColumns?.map((e, i) => <col key={i} className={clsx('filebrowser-col', e.class)} />)}
            </colgroup>

            <thead>
                <tr className={clsx('filebrowser-row', 'filebrowser-header', classes?.row)}>
                    <th>{allowMultifileSelection && (
                        <input
                            type="checkbox"
                            onChange={_ => setSelectedRows(selectedRows.length === fileTree.length ? [] : Array(fileTree.length).fill(0).map((_, i) => i))}
                            checked={selectedRows.length === fileTree.length}
                        />
                    )}</th>
                    {columns.map((e, i) => 
                        <th 
                            className={clsx('filebrowser-col-header', classes?.colHeader)}
                            key={i}
                            onClick={() => sortingClicked(e[0]!)}
                        >
                            {e[1] ?? e[0]} {currentSortingValue?.by === e[0]! && (currentSortingValue.asc ? <ArrowDropUp /> : <ArrowDropDown />)}
                        </th>
                    )}
                </tr>
            </thead>
            <tbody className={clsx('filebrowser-mainbody', classes?.mainBody)}>
                {sortedFileTree.map((e, i) => (
                    <tr
                        key={i}
                        className={clsx('filebrowser-row', classes?.row, {'filebrowser-row-selected': selectedRows.includes(i)})}
                        onClick={() => handleRowClick(i)}
                        onDoubleClick={() => onFileDoubleClick?.(sortedFileTree[i])}
                    >
                        <td className={clsx('filebrowser-icon', classes?.icon)}>{_iconGenerator(e)}</td>
                        {!manualName && <td>{e.name}</td>}
                        {additionalColumns?.map((col, i) => <td key={i}>{(manualName && col.name === 'name') ? e.name : ((e.props ?? {})[col.name] ?? (columnNotFoundPlaceholder ?? '<No Data>'))}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
}
