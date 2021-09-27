export declare class TaskRuntimeHookError<E> {
    readonly error: E;
    readonly _tag = "TaskRuntimeHookError";
    constructor(error: E);
}
export declare enum TaskBranches {
    Success = "Success",
    Fail = "Fail"
}
export declare enum Triggers {
    Step = "Step",
    Cycle = "Cycle",
    End = "End"
}
export declare type TaskCallback<T, R> = {
    name: string;
    fn: (value: T) => R;
    branch?: TaskBranches;
};
declare type Hook<T> = (branchId: TaskBranches, rejectPosition: number | undefined, value: T) => void;
export declare class TaskRuntime<T = undefined> {
    protected id: number;
    callbacks: TaskCallback<T, unknown>[];
    position: number;
    branchId: TaskBranches;
    rejectPosition?: number;
    branches: Record<keyof typeof TaskBranches, unknown>;
    protected triggerMap: {
        Step: Map<string | number, Function>;
        Cycle: Map<string | number, Function>;
        End: Map<string | number, Function>;
    };
    then<R>(fn: TaskCallback<T, R>, last?: boolean): TaskRuntime<R extends Promise<infer U> ? U : R>;
    addHook(type: Triggers, fn: Hook<T>, id?: string | number): void;
    protected handleError<E>(e: E): void;
    protected runStepHooks(): void;
    run(): any;
    protected get callback(): TaskCallback<T, unknown>;
    protected get value(): any;
    protected set value(value: any);
}
export {};
