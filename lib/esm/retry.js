"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Retry = void 0;
exports.Retry = {
    always: () => true,
    times: (count) => count-- > 0,
};
