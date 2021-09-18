"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskRuntime = exports.Triggers = exports.TaskBranches = exports.TaskRuntimeHookError = void 0;
const callHandled_1 = require("./callHandled");
class TaskRuntimeHookError {
    error;
    _tag = "TaskRuntimeHookError";
    constructor(error) {
        this.error = error;
    }
}
exports.TaskRuntimeHookError = TaskRuntimeHookError;
var TaskBranches;
(function (TaskBranches) {
    TaskBranches["Success"] = "Success";
    TaskBranches["Fail"] = "Fail";
})(TaskBranches = exports.TaskBranches || (exports.TaskBranches = {}));
var Triggers;
(function (Triggers) {
    Triggers["Step"] = "Step";
    Triggers["End"] = "End";
})(Triggers = exports.Triggers || (exports.Triggers = {}));
let taskInstancesCount = 0;
class TaskRuntime {
    id = taskInstancesCount++;
    callbacks = [];
    position = 0;
    branchId = TaskBranches.Success;
    rejectPosition;
    branches = {
        [TaskBranches.Success]: undefined,
        [TaskBranches.Fail]: undefined,
    };
    triggerMap = {
        [Triggers.Step]: new Map(),
        [Triggers.End]: new Map(),
    };
    then(fn, last = true) {
        this.callbacks[last ? "push" : "unshift"](fn);
        return this;
    }
    addHook(type, fn) {
        this.triggerMap[type].set(this.position, fn);
    }
    run() {
        if (this.position >= this.callbacks.length) {
            const promises = [];
            this.triggerMap[Triggers.End].forEach((cb) => {
                const res = cb(this.branchId, this.rejectPosition);
                if (res instanceof Promise) {
                    promises.push(res);
                }
            });
            return (0, callHandled_1.callHandled)(() => (promises.length > 0 ? Promise.all(promises) : undefined), [], () => {
                if (this.position >= this.callbacks.length) {
                    return this.branchValue;
                }
                else {
                    return this.run();
                }
            }, (e) => {
                this.branches[TaskBranches.Fail] = new TaskRuntimeHookError(e);
                this.branchId = TaskBranches.Fail;
            });
        }
        if (this.position > 0) {
            this.triggerMap[Triggers.Step].forEach((cb) => cb(this.branchValue));
        }
        if (this.callback.branch !== undefined &&
            this.callback.branch !== this.branchId) {
            this.position++;
            return this.run();
        }
        return (0, callHandled_1.callHandled)(this.callback.fn, [this.branchValue], (v) => {
            this.branches[this.branchId] = v;
            this.position++;
            return this.run();
        }, (err) => {
            this.rejectPosition = this.position;
            this.branchId = TaskBranches.Fail;
            this.branches[TaskBranches.Fail] = err;
            this.position++;
            return this.run();
        });
    }
    get callback() {
        return this.callbacks[this.position];
    }
    get branchValue() {
        return this.branches[this.branchId];
    }
}
exports.TaskRuntime = TaskRuntime;
