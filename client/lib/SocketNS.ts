import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Observable } from "rxjs/Rx";
import { FileReloadEventPayload } from "../types/socket";
import { Inputs } from "./index";
import { isBlacklisted } from "./utils";
import { of } from "rxjs/observable/of";
import { empty } from "rxjs/observable/empty";
import { EffectEvent, EffectNames, reloadBrowserSafe } from "./Effects";
import { Log } from "./Log";

export namespace ScrollEvent {
    export interface ICoords {
        x: number, y: number
    }
    export interface Data {
        raw: ICoords,
        proportional: number
    }
    export interface OutgoingPayload {
        position: Data
        tagName: string,
        index: number
    }
    export interface IncomingPayload {
        position: Data,
        tagName: string,
        index: number,
        override?: boolean
    }
    export function outgoing(data: Data, tagName: string, index: number): [OutgoingSocketEvents.Scroll, OutgoingPayload] {
        return [OutgoingSocketEvents.Scroll, {position: data, tagName, index}];
    }
}

export namespace ClickEvent {
    export interface ElementData {
        tagName: string,
        index: number
    }
    export type OutgoingPayload = ElementData;
    export type IncomingPayload = ElementData;
    export function outgoing(data: ElementData): [OutgoingSocketEvents.Click, ElementData] {
        return [OutgoingSocketEvents.Click, data];
    }
}

export enum IncomingSocketNames {
    Connection = "connection",
    Disconnect = "disconnect",
    FileReload = "file:reload",
    BrowserReload = "browser:reload",
    BrowserLocation = "browser:location",
    Scroll = "scroll",
    Click = "click",
}

export enum OutgoingSocketEvents {
    Scroll = '@@outgoing/scroll',
    Click = '@@outgoing/click',
}

export type SocketEvent = [IncomingSocketNames, any];

export const socketHandlers$ = new BehaviorSubject({
    [IncomingSocketNames.Connection]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$.pluck("logPrefix"))
            .flatMap(([x, logPrefix], index) => {
                if (index === 0) {
                    return of(
                        [EffectNames.SetOptions, x],
                        Log.overlayInfo(`${logPrefix}: connected`)
                    );
                }
                return of(reloadBrowserSafe());
            });
    },
    [IncomingSocketNames.Disconnect]: (xs, inputs: Inputs) => {
        return xs.do(x => console.log(x)).ignoreElements();
    },
    [IncomingSocketNames.FileReload]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$)
            .filter(([event, options]) => options.codeSync)
            .flatMap(([event, options]): Observable<EffectEvent> => {
                const data: FileReloadEventPayload = event;
                if (data.url || !options.injectChanges) {
                    return reloadBrowserSafe();
                }
                if (data.basename && data.ext && isBlacklisted(data)) {
                    return empty();
                }
                return of([EffectNames.FileReload, event]);
            });
    },
    [IncomingSocketNames.BrowserReload]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$)
            .filter(([event, options]) => options.codeSync)
            .flatMap(reloadBrowserSafe);
    },
    [IncomingSocketNames.BrowserLocation]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$.pluck('ghostMode', 'location'))
            .filter(([, canSyncLocation]) => canSyncLocation)
            .map(([event]) => {
                return [EffectNames.BrowserSetLocation, event];
            });
    },
    [IncomingSocketNames.Scroll]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$.pluck('ghostMode', 'scroll'))
            .filter(([, canScroll]) => canScroll)
            .map(([event]) => {
                return [EffectNames.BrowserSetScroll, event];
            });
    },
    [IncomingSocketNames.Click]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$.pluck('ghostMode', 'clicks'))
            .do(x => x)
            .filter(([, canClick]) => canClick)
            .map(([event]) => {
                return [EffectNames.SimulateClick, event];
            });
    },
    [OutgoingSocketEvents.Scroll]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.io$)
            .do(([event, io]) => io.emit(IncomingSocketNames.Scroll, event))
            .ignoreElements();
    },
    [OutgoingSocketEvents.Click]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.io$)
            .do(([event, io]) => io.emit(IncomingSocketNames.Click, event))
            .ignoreElements();
    }
});
