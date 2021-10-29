import React from 'react';
import { Button, WindowHeader } from 'react95';
import { DialogOverlay, DialogWindow, DialogFooter, DialogWindowContent, WindowCloseIcon, FooterButton } from './common';

export const W95ChangelogDialog = (props: { visible: boolean; handleClose: () => void; content: JSX.Element }) => {
    return props.visible ? (
        <DialogOverlay>
            <DialogWindow>
                <WindowHeader style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ flex: '1 1 auto' }}>Changelog for version {(window as any).wmdVersion}</span>
                    <Button onClick={props.handleClose}>
                        <WindowCloseIcon />
                    </Button>
                </WindowHeader>
                <DialogWindowContent>
                    {props.content}
                    <DialogFooter>
                        <FooterButton onClick={props.handleClose}>Close</FooterButton>
                    </DialogFooter>
                </DialogWindowContent>
            </DialogWindow>
        </DialogOverlay>
    ) : null;
};
