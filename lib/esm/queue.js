"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Queue = void 0;
class Queue {
    queue = [];
    resolvers = new Map();
    thisResolver = 0;
    add = (value) => {
        this.queue.push(value);
        const resolver = this.resolvers.get(this.thisResolver);
        if (!resolver) {
            return;
        }
        resolver();
        this.thisResolver++;
        if (this.thisResolver >= this.resolvers.size) {
            this.thisResolver = 0;
        }
    };
    clear = () => {
        this.queue = [];
        this.resolvers.forEach((r) => r());
        this.resolvers.clear();
        this.thisResolver = 0;
    };
    makeResolver = (id) => new Promise((resolve) => {
        this.resolvers.set(id, resolve);
    });
    async *[Symbol.asyncIterator]() {
        let resolverIdx = this.resolvers.size;
        let waitData = this.makeResolver(resolverIdx);
        while (true) {
            await waitData;
            if (this.queue.length === 0) {
                return;
            }
            yield this.queue.pop();
            waitData = this.makeResolver(resolverIdx);
        }
    }
}
exports.Queue = Queue;
