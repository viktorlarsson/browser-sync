import { getBrowserScrollPosition, setScroll } from "./browser.utils";
import { EffectNames } from "./Effects";
import { Observable } from "rxjs/Observable";
import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Inputs } from "./index";
import { empty } from "rxjs/observable/empty";
import { of } from "rxjs/observable/of";
import { Log } from "./Log";
import { BSDOM } from "./BSDOM";

namespace ScrollRestore {
    export const PREFIX = "<<BS_START>>";
    export const SUFFIX = "<<BS_START>>";
    export const regex = new RegExp(
        ScrollRestore.PREFIX + "(.+?)" + ScrollRestore.SUFFIX
    );
}

export function initWindowName(window: Window) {
    const saved = (() => {
        /**
         * On page load, check window.name for an existing
         * BS json blob & parse it.
         */
        try {
            const json = window.name.match(ScrollRestore.regex);
            if (json) {
                return JSON.parse(json[1]);
            }
        } catch (e) {
            return {};
        }
    })();

    /**
     * Remove any existing BS json from window.name
     * to ensure we don't interfere with any other
     * libs who may be using it.
     */
    window.name = window.name.replace(ScrollRestore.regex, "");

    /**
     * If the JSON was parsed correctly, try to
     * find a scroll property and restore it.
     */
    if (saved && saved.bs && saved.bs.hardReload && saved.bs.scroll) {
        const { x, y } = saved.bs.scroll;
        return of<any>(
            BSDOM.setScroll(x, y),
            Log.consoleDebug(`[ScrollRestore] x = ${x} y = ${y}`)
        );
    }
    return empty();
}

export const scrollRestoreHandlers$ = new BehaviorSubject({
    [EffectNames.SetOptions]: (xs, inputs: Inputs) => {
        return xs
            .withLatestFrom(inputs.window$)
            .take(1)
            .flatMap(([options, window]) => {
                if (options.scrollRestoreTechnique === "window.name") {
                    return initWindowName(window);
                }
                return empty();
            });
    },
    /**
     * Save the current scroll position
     * before the browser is reloaded (via window.location.reload(true))
     * @param xs
     * @param {Inputs} inputs
     */
    [EffectNames.PreBrowserReload]: (xs: Observable<any>, inputs: Inputs) => {
        return xs
            .withLatestFrom(inputs.window$, inputs.document$)
            .map(([, window, document]) => {
                return [
                    window.name,
                    ScrollRestore.PREFIX,
                    JSON.stringify({
                        bs: {
                            hardReload: true,
                            scroll: getBrowserScrollPosition(window, document)
                        }
                    }),
                    ScrollRestore.SUFFIX
                ].join("");
            })
            .map(value => BSDOM.setWindowName(value));
    }
});
