import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { options } from "./code-sync";
import { Inputs } from "./index";
import { reload } from "../vendor/Reloader";
import {of} from "rxjs/observable/of";
import {async} from "rxjs/scheduler/async";
import {concat} from "rxjs/observable/concat";

export enum EffectNames {
    FileReload = "@@FileReload",
    PreBrowserReload = "@@PreBrowserReload",
    BrowserReload = "@@BrowserReload",
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
    )
}

export type EffectEvent = [EffectNames] | [EffectNames, any] | EffectNames[];

export const outputHandlers$ = new BehaviorSubject({
    /**
     * Set the local client options
     * @param xs
     */
    [EffectNames.SetOptions]: (xs, inputs: Inputs) =>
        xs.do(x => inputs.option$.next(x)).ignoreElements(),
    /**
     * Attempt to reload files in place
     * @param xs
     * @param inputs
     */
    [EffectNames.FileReload]: (xs, inputs: Inputs) =>
        xs
            .withLatestFrom(inputs.document$, inputs.navigator$)
            .flatMap(([event, document, navigator]) => {
                return reload(document, navigator)(event, {
                    ...options,
                    liveCSS: true,
                    liveImg: true
                });
            }),
    /**
     * Hard reload the browser
     */
    [EffectNames.BrowserReload]: (xs, inputs: Inputs) => {
        return xs
            .withLatestFrom(inputs.window$)
            .do(([, window]) => window.location.reload(true))
    }
});
