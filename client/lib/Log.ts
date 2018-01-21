import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { timer } from "rxjs/observable/timer";
import OverlayInfoPayload = Log.OverlayInfoPayload;
import { Observable } from "rxjs/Observable";
import ConsolePayload = Log.ConsolePayload;

const nanlogger = require("nanologger");
const log = nanlogger("Browsersync", { colors: { magenta: "#0F2634" } });

export enum LogNames {
    Log = "@@Log",
    Info = "@@Log.info",
    Debug = "@@Log.debug"
}

export enum Overlay {
    Info = "@@Overlay.info"
}

export namespace Log {
    export type ConsolePayload = [LogNames, any[]];
    export function consoleInfo(...args): [LogNames.Log, ConsolePayload] {
        return [LogNames.Log, [LogNames.Info, args]];
    }
    export function consoleDebug(...args): [LogNames.Log, ConsolePayload] {
        return [LogNames.Log, [LogNames.Debug, args]];
    }
    export type OverlayInfoPayload = [string, number];
    export function overlayInfo(
        message: string,
        timeout = 2000
    ): [Overlay.Info, OverlayInfoPayload] {
        return [Overlay.Info, [message, timeout]];
    }
}

export const logHandler$ = new BehaviorSubject({
    [LogNames.Log]: (xs, inputs) => {
        return (
            xs
                /**
                 * access injectNotification from the options stream
                 */
                .withLatestFrom(inputs.option$.pluck("injectNotification"))
                /**
                 * only accept messages if injectNotification !== console
                 */
                .filter(
                    ([, injectNotification]) => injectNotification === "console"
                )
                .pluck(0)
                .do((event: ConsolePayload) => {
                    switch (event[0]) {
                        case LogNames.Info: {
                            return log.info.apply(log, event[1]);
                        }
                        case LogNames.Debug: {
                            return log.debug.apply(log, event[1]);
                        }
                    }
                })
        );
    },
    [Overlay.Info]: (xs: Observable<any>, inputs) => {
        return (
            xs
                .withLatestFrom(
                    inputs.option$,
                    inputs.notifyElement$,
                    inputs.document$
                )
                /**
                 * Reject all notifications if notify: false
                 */
                .filter(([, options]) => options.notify)
                /**
                 * Set the HTML of the notify element
                 */
                .do(([event, options, element, document]) => {
                    element.innerHTML = event[0];
                    element.style.display = "block";
                    document.body.appendChild(element);
                })
                /**
                 * Now remove the element after the given timeout
                 */
                .switchMap(([event, options, element, document]) => {
                    return timer(event[1] || 2000).do(() => {
                        element.style.display = "none";
                        if (element.parentNode) {
                            document.body.removeChild(element);
                        }
                    });
                })
        );
    }
});
