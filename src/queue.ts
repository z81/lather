export class Queue<T> {
  private queue: T[] = [];
  private resolvers = new Map<number, Function>();
  private thisResolver = 0;

  add = (value: T) => {
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

  private makeResolver = (id: number) =>
    new Promise((resolve) => {
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

      yield this.queue.pop()!;
      waitData = this.makeResolver(resolverIdx);
    }
  }
}
