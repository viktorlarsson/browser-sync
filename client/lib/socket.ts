import socket = require("socket.io-client");
import {Observable} from 'rxjs';
import {BehaviorSubject} from "rxjs/BehaviorSubject";



/**
 * Alias for socket.emit
 * @param name
 * @param data
 */
// export function emit(name, data) {
//     if (io && io.emit) {
//         // send relative path of where the event is sent
//         data.url = window.location.pathname;
//         io.emit(name, data);
//     }
// }
//
// /**
//  * Alias for socket.on
//  * @param name
//  * @param func
//  */
// export function on(name, func) {
//     io.on(name, func);
// }

export function initWindow() {
    return Observable.of(window);
}

export function initDocument() {
    return Observable.of(document);
}

export function initOptions() {
    return new BehaviorSubject(window.___browserSync___.options);
}

export function initSocket() {

    // return Observable

    /**
     * @type {{emit: emit, on: on}}
     */

    const socketConfig = window.___browserSync___.socketConfig;
    const socketUrl = window.___browserSync___.socketUrl;
    const io = socket(socketUrl, socketConfig);
    const onevent = io.onevent;

    const on$ = Observable.create(obs => {
        io.onevent = function (packet) {
            onevent.call (this, packet);
            obs.next(packet.data);
        };
    }).share();

    /**
     * *****BACK-COMPAT*******
     * Scripts that come after Browsersync may rely on the previous window.___browserSync___.socket
     */
    window.___browserSync___.socket = io;

    return on$;
}
