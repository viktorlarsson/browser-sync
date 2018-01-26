import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Inputs } from "./index";
import { reload } from "../vendor/Reloader";
import { of } from "rxjs/observable/of";
import { async } from "rxjs/scheduler/async";
import { concat } from "rxjs/observable/concat";
import {SocketNS} from "./SocketNS";
import {getScrollSpace} from "./browser.utils";

export enum EffectNames {
    FileReload = "@@FileReload",
    PreBrowserReload = "@@PreBrowserReload",
    BrowserReload = "@@BrowserReload",
    BrowserSetLocation = "@@BrowserSetLocation",
    BrowserSetScroll = "@@BrowserSetScroll",
    SetOptions = "@@SetOptions"
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
                    return window.location = window.location.protocol + "//" + window.location.host + event.path;
                }
                if (event.url) {
                    return window.location = event.url;
                }
            })
            .ignoreElements()
    },
    [EffectNames.BrowserSetScroll]: (xs, inputs: Inputs) => {
        return xs
            .withLatestFrom(inputs.window$, inputs.document$, inputs.option$.pluck('scrollProportionally'))
            .do((incoming) => {
                const event: SocketNS.ScrollPayload = incoming[0];
                const window: Window = incoming[1];
                const document: Document = incoming[2];
                const scrollProportionally: boolean = incoming[3];

                const scrollSpace = getScrollSpace(document);

                if (scrollProportionally) {
                    return window.scrollTo(0, scrollSpace.y * event.position.proportional); // % of y axis of scroll to px
                } else {
                    return window.scrollTo(0, event.position.raw.y);
                }
            })
            .ignoreElements();
    }
});
