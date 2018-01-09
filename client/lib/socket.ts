import socket = require("socket.io-client");

/**
 * @type {{emit: emit, on: on}}
 */
const socketConfig = window.___browserSync___.socketConfig;
const socketUrl = window.___browserSync___.socketUrl;
const io = socket(socketUrl, socketConfig);

/**
 * *****BACK-COMPAT*******
 * Scripts that come after Browsersync may rely on the previous window.___browserSync___.socket
 */
window.___browserSync___.socket = io;

/**
 * @returns {string}
 */
export function getPath() {
    return window.location.pathname;
}

/**
 * Alias for socket.emit
 * @param name
 * @param data
 */
export function emit(name, data) {
    if (io && io.emit) {
        // send relative path of where the event is sent
        data.url = getPath();
        io.emit(name, data);
    }
}

/**
 * Alias for socket.on
 * @param name
 * @param func
 */
export function on(name, func) {
    io.on(name, func);
}
