import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {options} from "./code-sync";
import {AnyStream, Inputs} from "./index";
import {reload} from "../vendor/Reloader";

export enum EffectNames {
    FileReload = "@@FileReload",
    BrowserReload = "@@BrowserReload",
    SetOptions = "@@SetOptions"
}

type EffectStreamMapped = {
    [name in EffectNames]: (xs, inputs?: any) => AnyStream
};

export type EffectEvent = [EffectNames] | [EffectNames, any] | EffectNames[];

export const outputHandlers$ = new BehaviorSubject<EffectStreamMapped>({
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
    [EffectNames.BrowserReload]: (xs, inputs: Inputs) =>
        xs
            .withLatestFrom(inputs.window$)
            .do(([, window]) => window.location.reload(true))
});
