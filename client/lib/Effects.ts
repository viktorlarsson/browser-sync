import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Inputs } from "./index";
import { reload } from "../vendor/Reloader";
import { of } from "rxjs/observable/of";
import { async } from "rxjs/scheduler/async";
import { concat } from "rxjs/observable/concat";
import {
    ClickEvent,
    FormToggleEvent,
    KeyupEvent,
    ScrollEvent
} from "./SocketNS";
import { getDocumentScrollSpace } from "./browser.utils";
import { merge } from "rxjs/observable/merge";

export enum EffectNames {
    FileReload = "@@FileReload",
    PreBrowserReload = "@@PreBrowserReload",
    BrowserReload = "@@BrowserReload",
    BrowserSetLocation = "@@BrowserSetLocation",
    BrowserSetScroll = "@@BrowserSetScroll",
    SetOptions = "@@SetOptions",
    SimulateClick = "@@SimulateClick",
    SetElementValue = "@@SetElementValue",
    SetElementToggleValue = "@@SetElementToggleValue"
}

export function reloadBrowserSafe() {
    return concat(
        /**
         * Emit a message allow others to do some work
         */
        of([EffectNames.PreBrowserReload]),
        /**
         * On the next tick, perform the reload
         */
        of([EffectNames.BrowserReload]).subscribeOn(async)
    );
}

export type EffectEvent = [EffectNames] | [EffectNames, any] | EffectNames[];

export const outputHandlers$ = new BehaviorSubject({
    /**
     * Set the local client options
     * @param xs
     */
    [EffectNames.SetOptions]: (xs, inputs: Inputs) => {
        return xs.do(x => inputs.option$.next(x)).ignoreElements();
    },
    /**
     * Attempt to reload files in place
     * @param xs
     * @param inputs
     */
    [EffectNames.FileReload]: (xs, inputs: Inputs) => {
        return xs
            .withLatestFrom(inputs.option$, inputs.document$, inputs.navigator$)
            .flatMap(([event, options, document, navigator]) => {
                return reload(document, navigator)(event, {
                    tagNames: options.tagNames,
                    liveCSS: true,
                    liveImg: true
                });
            });
    },
    /**
     * Hard reload the browser
     */
    [EffectNames.BrowserReload]: (xs, inputs: Inputs) => {
        return xs
            .withLatestFrom(inputs.window$)
            .do(([, window]) => window.location.reload(true));
    },
    /**
     * Set the location of the browser
     */
    [EffectNames.BrowserSetLocation]: (xs, inputs: Inputs) => {
        return xs
            .withLatestFrom(inputs.window$)
            .do(([event, window]) => {
                if (event.path) {
                    return (window.location =
                        window.location.protocol +
                        "//" +
                        window.location.host +
                        event.path);
                }
                if (event.url) {
                    return (window.location = event.url);
                }
            })
            .ignoreElements();
    },
    [EffectNames.BrowserSetScroll]: (xs, inputs: Inputs) => {
        const [document$, element$] = xs
            .withLatestFrom(
                inputs.window$,
                inputs.document$,
                inputs.option$.pluck("scrollProportionally")
            )
            .partition(([event]) => event.tagName === "document");

        return merge(
            /**
             * Main window scroll
             */
            document$.do(incoming => {
                const event: ScrollEvent.IncomingPayload = incoming[0];
                const window: Window = incoming[1];
                const document: Document = incoming[2];
                const scrollProportionally: boolean = incoming[3];
                const scrollSpace = getDocumentScrollSpace(document);

                if (scrollProportionally) {
                    return window.scrollTo(
                        0,
                        scrollSpace.y * event.position.proportional
                    ); // % of y axis of scroll to px
                }
                return window.scrollTo(0, event.position.raw.y);
            }),
            /**
             * Element scrolls
             */
            element$.do(incoming => {
                const event: ScrollEvent.IncomingPayload = incoming[0];
                const document: Document = incoming[2];
                const scrollProportionally: boolean = incoming[3];

                const matchingElements = document.getElementsByTagName(
                    event.tagName
                );
                if (matchingElements && matchingElements.length) {
                    const match = matchingElements[event.index];
                    if (match) {
                        if (scrollProportionally) {
                            return match.scrollTo(
                                0,
                                match.scrollHeight * event.position.proportional
                            ); // % of y axis of scroll to px
                        }
                        return match.scrollTo(0, event.position.raw.y);
                    }
                }
            })
        ).ignoreElements();
    },
    [EffectNames.SimulateClick]: (xs, inputs: Inputs) => {
        return xs
            .withLatestFrom(inputs.window$, inputs.document$)
            .do(incoming => {
                const event: ClickEvent.IncomingPayload = incoming[0];
                const window: Window = incoming[1];
                const document: Document = incoming[2];

                const elems = document.getElementsByTagName(event.tagName);
                const match = elems[event.index];

                if (match) {
                    if (document.createEvent) {
                        window.setTimeout(function() {
                            const evObj = document.createEvent("MouseEvents");
                            evObj.initEvent("click", true, true);
                            match.dispatchEvent(evObj);
                        }, 0);
                    } else {
                        window.setTimeout(function() {
                            if ((document as any).createEventObject) {
                                const evObj = (document as any).createEventObject();
                                evObj.cancelBubble = true;
                                (match as any).fireEvent("on" + "click", evObj);
                            }
                        }, 0);
                    }
                }
            })
            .ignoreElements();
    },
    [EffectNames.SetElementValue]: (xs, inputs: Inputs) => {
        return xs.withLatestFrom(inputs.document$).do(incoming => {
            const event: KeyupEvent.IncomingPayload = incoming[0];
            const document: Document = incoming[1];
            const elems = document.getElementsByTagName(event.tagName);
            const match = elems[event.index];
            if (match) {
                (match as HTMLInputElement).value = event.value;
            }
        });
    },
    [EffectNames.SetElementToggleValue]: (xs, inputs: Inputs) => {
        return xs.withLatestFrom(inputs.document$).do(incoming => {
            const event: FormToggleEvent.IncomingPayload = incoming[0];
            const document: Document = incoming[1];
            const elems = document.getElementsByTagName(event.tagName);
            const match = <HTMLInputElement>elems[event.index];
            if (match) {
                if (event.type === "radio") {
                    match.checked = true;
                }
                if (event.type === "checkbox") {
                    match.checked = event.checked;
                }
                if (event.tagName === "SELECT") {
                    match.value = event.value;
                }
            }
        });
    }
});
