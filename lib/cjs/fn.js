"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.delay = exports._ = void 0;
/**
 *
 */
const _ = (value) => () => value;
exports._ = _;
const delay = (time) => new Promise((r) => setTimeout(r, time));
exports.delay = delay;
