import {FormToggleEvent, IncomingSocketNames, OutgoingSocketEvent, OutgoingSocketEvents} from "./SocketNS";
import { getElementData } from "./browser.utils";
import { Observable } from "rxjs/Observable";
import { createTimedBooleanSwitch } from "./utils";

export function getFormTogglesStream(document: Document, socket$): Observable<OutgoingSocketEvent> {
    const canSync$ = createTimedBooleanSwitch(
        socket$.filter(([name]) => name === IncomingSocketNames.Toggle)
    );
    return inputObservable(document)
        .withLatestFrom(canSync$)
        .filter(([, canSync]) => canSync)
        .map((incoming): OutgoingSocketEvent => {

            const keyupEvent: { target: HTMLInputElement } = incoming[0];
            const {target} = keyupEvent;
            const data = getElementData(target);

            return FormToggleEvent.outgoing(data, {
                type: target.type,
                checked: target.checked,
                value: target.value,
            });
        })
}

function inputObservable(document: Document) {
    return Observable.create(obs => {
        document.body.addEventListener(
            "change",
            function(event) {
                const elem = <HTMLInputElement>(event.target || event.srcElement);
                // todo(Shane): which other elements emit a change event that needs to be propagated
                if (elem.tagName === "SELECT") {
                    obs.next({ target: event.target });
                }
            },
            true
        );
    }).share();
}
