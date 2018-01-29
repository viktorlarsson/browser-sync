import {Observable} from 'rxjs/Observable';
import {merge} from 'rxjs/observable/merge';
import {ScrollEvent} from "./SocketNS";
import {getScrollPosition} from "./browser.utils";
const eventManager = require('./events').manager;

export function initOutgoing(window: Window, document: Document, resume$) {
    const merged$ = merge(
        scrollObservable(window)
            .withLatestFrom(resume$)
            .filter(([, canSync]) => canSync)
            .map(() => {
                return ScrollEvent.outgoing(getScrollPosition(window, document));
            })
    );

    return merged$;
}

function scrollObservable(window) {
    return Observable.create(obs => {
        eventManager.addEvent(window, 'scroll', function() {
            obs.next('scroll');
        });
    }).share();

}