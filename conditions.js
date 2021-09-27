"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Times = exports.Always = void 0;
const Always = () => true;
exports.Always = Always;
const Times = (count) => count-- > 0;
exports.Times = Times;
