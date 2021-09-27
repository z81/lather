"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.delay = exports.flow = void 0;
/**
 *
 */
const flow = (value) => () => value;
exports.flow = flow;
const delay = (time) => new Promise((r) => setTimeout(r, time));
exports.delay = delay;
