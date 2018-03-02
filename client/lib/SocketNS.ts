import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Observable } from "rxjs/Rx";
import { FileReloadEventPayload } from "../types/socket";
import { Inputs } from "./index";
import { isBlacklisted } from "./utils";
import { of } from "rxjs/observable/of";
import { empty } from "rxjs/observable/empty";
import { EffectEvent, EffectNames, reloadBrowserSafe } from "./Effects";
import { Log } from "./Log";

export namespace BrowserNotify {
    export interface IncomingPayload {
        message: string;
        timeout: number;
        override?: boolean;
    }
}

export namespace BrowserLocation {
    export interface IncomingPayload {
        url?: string;
        path?: number;
    }
}

export namespace ScrollEvent {
    export interface ICoords {
        x: number;
        y: number;
    }
    export interface Data {
        raw: ICoords;
        proportional: number;
    }
    export interface OutgoingPayload {
        position: Data;
        tagName: string;
        index: number;
    }
    export interface IncomingPayload {
        position: Data;
        tagName: string;
        index: number;
        override?: boolean;
        pathname: string
    }
    export function outgoing(
        data: Data,
        tagName: string,
        index: number
    ): [OutgoingSocketEvents.Scroll, OutgoingPayload] {
        return [
            OutgoingSocketEvents.Scroll,
            { position: data, tagName, index }
        ];
    }
}

export namespace ClickEvent {
    export interface ElementData {
        tagName: string;
        index: number;
    }
    export type OutgoingPayload = ElementData;
    export type IncomingPayload = ElementData;
    export function outgoing(
        data: ElementData
    ): [OutgoingSocketEvents.Click, ElementData] {
        return [OutgoingSocketEvents.Click, data];
    }
}

export namespace KeyupEvent {
    export interface Payload {
        value: any;
        tagName: string;
        index: number;
    }
    export type OutgoingPayload = Payload;
    export type IncomingPayload = Payload;
    export function outgoing(
        element: ClickEvent.ElementData,
        value: any
    ): [OutgoingSocketEvents.Keyup, OutgoingPayload] {
        return [
            OutgoingSocketEvents.Keyup,
            {
                ...element,
                value
            }
        ];
    }
}

export namespace FormToggleEvent {
    export interface Payload {
        tagName: string;
        index: number;
        value: any;
        type: any;
        checked: any;
    }
    export type OutgoingPayload = Payload;
    export type IncomingPayload = Payload;
    export function outgoing(
        element: ClickEvent.ElementData,
        props: { value: string; type: string; checked: boolean }
    ): [OutgoingSocketEvents.Toggle, OutgoingPayload] {
        return [
            OutgoingSocketEvents.Toggle,
            {
                ...element,
                ...props
            }
        ];
    }
}

export enum IncomingSocketNames {
    Connection = "connection",
    Disconnect = "disconnect",
    FileReload = "file:reload",
    BrowserReload = "browser:reload",
    BrowserLocation = "browser:location",
    BrowserNotify = "browser:notify",
    Scroll = "scroll",
    Click = "click",
    Keyup = "input:text",
    Toggle = "input:toggles"
}

export enum OutgoingSocketEvents {
    Scroll = "@@outgoing/scroll",
    Click = "@@outgoing/click",
    Keyup = "@@outgoing/keyup",
    Toggle = "@@outgoing/Toggle"
}

export type SocketEvent = [IncomingSocketNames, any];
export type OutgoingSocketEvent = [OutgoingSocketEvents, any];

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
            .withLatestFrom(inputs.option$.pluck("ghostMode", "location"))
            .filter(([, canSyncLocation]) => canSyncLocation)
            .map(incoming => {
                const event: BrowserLocation.IncomingPayload = incoming[0];
                return [EffectNames.BrowserSetLocation, event];
            });
    },
    [IncomingSocketNames.BrowserNotify]: xs => {
        return xs.map((event: BrowserNotify.IncomingPayload) => {
            return Log.overlayInfo(event.message, event.timeout);
        });
    },
    [IncomingSocketNames.Scroll]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$.pluck("ghostMode", "scroll"), inputs.window$.pluck('location', 'pathname'))
            .filter(([event, canScroll, pathname]) => {
                return canScroll && event.pathname === pathname;
            })
            .map(([event]) => {
                return [EffectNames.BrowserSetScroll, event];
            });
    },
    [IncomingSocketNames.Click]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$.pluck("ghostMode", "clicks"), inputs.window$.pluck('location', 'pathname'))
            .filter(([event, canClick, pathname]) => {
                return canClick && event.pathname === pathname;
            })
            .map(([event]) => {
                return [EffectNames.SimulateClick, event];
            });
    },
    [IncomingSocketNames.Keyup]: (xs, inputs) => {
        return xs
            .withLatestFrom(
                inputs.option$.pluck("ghostMode", "forms", "inputs"),
                inputs.window$.pluck('location', 'pathname')
            )
            .filter(([event, canKeyup, pathname]) => {
                return canKeyup && event.pathname === pathname;
            })
            .map(([event]) => {
                return [EffectNames.SetElementValue, event];
            });
    },
    [IncomingSocketNames.Toggle]: (xs, inputs) => {
        return xs
            .withLatestFrom(
                inputs.option$.pluck("ghostMode", "forms", "toggles"),
                inputs.window$.pluck('location', 'pathname')
            )
            .filter(([, canClick]) => canClick)
            .map(([event]) => {
                return [EffectNames.SetElementToggleValue, event];
            });
    },
    [OutgoingSocketEvents.Scroll]: (xs, inputs) => {
        return emitWithPathname(xs, inputs, IncomingSocketNames.Scroll);
    },
    [OutgoingSocketEvents.Click]: (xs, inputs) => {
        return emitWithPathname(xs, inputs, IncomingSocketNames.Click);
    },
    [OutgoingSocketEvents.Keyup]: (xs, inputs) => {
        return emitWithPathname(xs, inputs, IncomingSocketNames.Keyup);
    },
    [OutgoingSocketEvents.Toggle]: (xs, inputs) => {
        return emitWithPathname(xs, inputs, IncomingSocketNames.Toggle);
    }
});

function emitWithPathname(xs, inputs, name) {
    return xs
        .withLatestFrom(inputs.io$, inputs.window$.pluck('location', 'pathname'))
        .do(([event, io, pathname]) => io.emit(name, {...event, pathname}))
        .ignoreElements();
}
