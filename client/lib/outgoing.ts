import { merge } from "rxjs/observable/merge";
import { getFormInputStream } from "./outgoing.form-inputs";
import { getClickStream } from "./outgoing.clicks";
import { getScrollStream } from "./outgoing.scroll";
import { getFormTogglesStream } from "./outgoing.form-toggles";
import { OutgoingSocketEvent } from "./SocketNS";
import { Observable } from "rxjs/Observable";

export function initOutgoing(
    window: Window,
    document: Document,
    socket$
): Observable<OutgoingSocketEvent> {
    const merged$ = merge(
        getScrollStream(window, document, socket$),
        getClickStream(document, socket$),
        getFormInputStream(document, socket$),
        getFormTogglesStream(document, socket$)
    );

    return merged$;
}
