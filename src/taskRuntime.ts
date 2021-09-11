import { callHandled } from "./callHandled";

export enum TaskBranches {
  Success = "Success",
  Fail = "Fail",
}

export enum Triggers {
  Step = "Step",
  End = "End",
}

export type TaskCallback<T, R> = {
  name: string;
  fn: (value: T) => R;
  branch?: TaskBranches;
};

type Hook = (branchId: TaskBranches, rejectPosition?: number) => void;

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
    [Triggers.Step]: new Map<number, Function>(),
    [Triggers.End]: new Map<number, Function>(),
  };

  public then<R>(fn: TaskCallback<T, R>, last = true) {
    this.callbacks[last ? "push" : "unshift"](fn);
    return this as any as TaskRuntime<R extends Promise<infer U> ? U : R>;
  }

  public addHook(type: Triggers, fn: Hook) {
    this.triggerMap[type].set(this.position, fn);
  }

  public run(): T {
    if (this.position >= this.callbacks.length) {
      this.triggerMap[Triggers.End].forEach((cb) =>
        cb(this.branchId, this.rejectPosition)
      );

      if (this.position >= this.callbacks.length) {
        return this.branchValue as any;
      } else {
        return this.run();
      }
    }

    if (this.position > 0) {
      this.triggerMap[Triggers.Step].forEach((cb) => cb(this.branchValue));
    }

    if (
      this.callback.branch !== undefined &&
      this.callback.branch !== this.branchId
    ) {
      this.position++;
      return this.run();
    }

    return callHandled(
      this.callback.fn as any,
      [this.branchValue],
      (v) => {
        this.branches[this.branchId] = v as any;
        this.position++;
        return this.run();
      },
      (err) => {
        this.rejectPosition = this.position;
        this.branchId = TaskBranches.Fail;
        this.branches[TaskBranches.Fail] = err;
        this.position++;
        return this.run();
      }
    ) as any;
  }

  protected get callback() {
    return this.callbacks[this.position];
  }

  protected get branchValue() {
    return this.branches[this.branchId];
  }
}
