import { callHandled } from './callHandled';

export class TaskRuntimeHookError<E> {
  readonly _tag = 'TaskRuntimeHookError';

  constructor(public readonly error: E) {}
}

export enum TaskBranches {
  Success = 'Success',
  Fail = 'Fail',
}

export enum Triggers {
  Step = 'Step',
  Cycle = 'Cycle',
  End = 'End',
}

export type TaskCallback<T, R> = {
  name: string;
  fn: (value: T) => R;
  branch?: TaskBranches;
};

type Hook<T> = (branchId: TaskBranches, rejectPosition: number | undefined, value: T) => void;

let taskInstancesCount = 0;

export class TaskRuntime<T = undefined> {
  protected id = taskInstancesCount++;
  public callbacks: TaskCallback<T, unknown>[] = [];
  public position = 0;
  public branchId = TaskBranches.Success;
  public rejectPosition?: number;
  public branches: Record<keyof typeof TaskBranches, unknown> = {
    [TaskBranches.Success]: undefined,
    [TaskBranches.Fail]: undefined,
  };
  protected triggerMap = {
    [Triggers.Step]: new Map<number | string, Function>(),
    [Triggers.Cycle]: new Map<number | string, Function>(),
    [Triggers.End]: new Map<number | string, Function>(),
  };

  public then<R>(fn: TaskCallback<T, R>, last = true) {
    this.callbacks[last ? 'push' : 'unshift'](fn);
    return this as any as TaskRuntime<R extends Promise<infer U> ? U : R>;
  }

  public addHook(type: Triggers, fn: Hook<T>, id: string | number = this.position) {
    this.triggerMap[type].set(id, fn);
  }

  protected handleError<E>(e: E) {
    this.rejectPosition = this.position - 1;
    this.branches[TaskBranches.Fail] = e;
    this.branchId = TaskBranches.Fail;
  }

  protected runStepHooks() {
    if (this.position > 0) {
      this.triggerMap[Triggers.Step].forEach((cb) => cb(this.value));
    }
  }

  public run(): any {
    for (; this.position < this.callbacks.length; this.position++) {
      if (this.callback.branch !== undefined && this.callback.branch !== this.branchId) {
        continue;
      }

      try {
        const res = this.callback.fn(this.value as T);

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
      } catch (e) {
        this.handleError(e);
      }
      this.runStepHooks();
    }

    if (this.position >= this.callbacks.length && this.position !== Infinity) {
      this.position = Infinity;
      const promises: unknown[] = [];

      const val = this.value;
      this.triggerMap[Triggers.Cycle].forEach((cb) => {
        const res = cb(this.branchId, this.rejectPosition, val);
        if (res instanceof Promise) {
          promises.push(res);
        }
      });

      if (promises.length > 0) {
        return Promise.all(promises).then(() => this.run());
      } else {
        return this.run();
      }
    }

    this.triggerMap[Triggers.End].forEach((_) => _(this.branchId, this.rejectPosition));

    return this.value;
  }

  protected get callback() {
    return this.callbacks[this.position];
  }

  protected get value() {
    return this.branches[this.branchId] as T;
  }

  protected set value(value: any) {
    this.branches[this.branchId] = value;
  }
}
