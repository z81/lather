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
    End = "End"
}
export declare type TaskCallback<T, R> = {
    name: string;
    fn: (value: T) => R;
    branch?: TaskBranches;
};
declare type Hook = (branchId: TaskBranches, rejectPosition?: number) => void;
export declare class TaskRuntime<T = undefined> {
    protected id: number;
    callbacks: TaskCallback<T, unknown>[];
    position: number;
    branchId: TaskBranches;
    rejectPosition?: number;
    branches: Record<keyof typeof TaskBranches, unknown>;
    protected triggerMap: {
        Step: Map<number, Function>;
        End: Map<number, Function>;
    };
    then<R>(fn: TaskCallback<T, R>, last?: boolean): TaskRuntime<R extends Promise<infer U> ? U : R>;
    addHook(type: Triggers, fn: Hook): void;
    run(): T;
    protected get callback(): TaskCallback<T, unknown>;
    protected get branchValue(): unknown;
}
export {};