"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskRuntime = exports.Triggers = exports.TaskBranches = exports.TaskRuntimeHookError = void 0;
class TaskRuntimeHookError {
    error;
    _tag = 'TaskRuntimeHookError';
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
    Triggers["Cycle"] = "Cycle";
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
        [Triggers.Cycle]: new Map(),
        [Triggers.End]: new Map(),
    };
    then(fn, last = true) {
        this.callbacks[last ? 'push' : 'unshift'](fn);
        return this;
    }
    addHook(type, fn, id = this.position) {
        this.triggerMap[type].set(id, fn);
    }
    handleError(e) {
        this.rejectPosition = this.position - 1;
        this.branches[TaskBranches.Fail] = e;
        this.branchId = TaskBranches.Fail;
    }
    runStepHooks() {
        if (this.position > 0) {
            this.triggerMap[Triggers.Step].forEach((cb) => cb(this.value));
        }
    }
    run() {
        for (; this.position < this.callbacks.length; this.position++) {
            if (this.callback.branch !== undefined && this.callback.branch !== this.branchId) {
                continue;
            }
            try {
                const res = this.callback.fn(this.value);
                if (res instanceof Promise) {
                    this.position++;
                    return res
                        .then((value) => {
                        this.value = value;
                        this.runStepHooks();
                        return this.run();
                    })
                        .catch((e) => {
                        this.handleError(e);
                        this.runStepHooks();
                        return this.run();
                    });
                }
                this.value = res;
            }
            catch (e) {
                this.handleError(e);
            }
            this.runStepHooks();
        }
        if (this.position >= this.callbacks.length && this.position !== Infinity) {
            this.position = Infinity;
            const promises = [];
            const val = this.value;
            this.triggerMap[Triggers.Cycle].forEach((cb) => {
                const res = cb(this.branchId, this.rejectPosition, val);
                if (res instanceof Promise) {
                    promises.push(res);
                }
            });
            if (promises.length > 0) {
                return Promise.all(promises).then(() => this.run());
            }
            else {
                return this.run();
            }
        }
        this.triggerMap[Triggers.End].forEach((_) => _(this.branchId, this.rejectPosition));
        return this.value;
    }
    get callback() {
        return this.callbacks[this.position];
    }
    get value() {
        return this.branches[this.branchId];
    }
    set value(value) {
        this.branches[this.branchId] = value;
    }
}
exports.TaskRuntime = TaskRuntime;
