export enum FiberStatus {
  Pending = "Pending",
  Success = "Success",
  Error = "Error",
}

export class Fiber<T> {
  #status = FiberStatus.Pending;
  #error: unknown = undefined;

  constructor(private result: T) {}

  public get value() {
    return this.result;
  }

  public get status() {
    return this.#status;
  }

  #castThis<R>() {
    return this as any as Fiber<R>;
  }

  public then<R>(fn: (value: T) => R) {
    if (this.result instanceof Promise) {
      this.#status = FiberStatus.Pending;
      this.result = this.result.then(fn, (err) => {
        //
      }) as any;
    } else {
      try {
        this.#status = FiberStatus.Success;
        this.result = fn(this.result) as any;
      } catch (e) {
        this.#error = e;
        this.#status = FiberStatus.Error;
      }
    }

    return this.#castThis<R extends Promise<infer P> ? P : R>();
  }

  public catch<R>(fn: (value: unknown) => R) {
    if (this.#error instanceof Promise) {
      this.#error = this.#error.catch(fn) as any;
    } else if (this.#status !== FiberStatus.Error) {
      this.#error = fn(this.result) as any;
    }

    return this;
  }

  static resolve<T>(value: T) {
    return new Fiber(value);
  }
}
