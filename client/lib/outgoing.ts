import { merge } from "rxjs/observable/merge";
import { getFormInputStream } from "./outgoing.form-inputs";
import { getClickStream } from "./outgoing.clicks";
import { getScrollStream } from "./outgoing.scroll";

export function initOutgoing(window: Window, document: Document, socket$) {
    const merged$ = merge(
        getScrollStream(window, document, socket$),
        getClickStream(document, socket$),
        getFormInputStream(document, socket$)
    );

    return merged$;
}
