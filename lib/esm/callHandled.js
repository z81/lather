"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callHandled = void 0;
const callHandled = (fn, args, success, error) => {
    try {
        // @ts-expect-error
        const value = fn(...args);
        return value instanceof Promise
            ? value.then(success).catch(error)
            : success(value);
    }
    catch (e) {
        return error(e);
    }
};
exports.callHandled = callHandled;
