/**
 * Result<T, E> 类型 — 显式处理成功/失败，替代隐式 throw/catch
 */

export type Result<T, E = Error> = Ok<T, E> | Err<T, E>;

export class Ok<T, E = Error> {
    readonly ok = true as const;
    constructor(public readonly value: T) {}

    isOk(): this is Ok<T, E> {
        return true;
    }

    isErr(): this is Err<T, E> {
        return false;
    }

    unwrap(): T {
        return this.value;
    }

    unwrapOr(_fallback: T): T {
        return this.value;
    }
}

export class Err<T, E = Error> {
    readonly ok = false as const;
    constructor(public readonly error: E) {}

    isOk(): this is Ok<T, E> {
        return false;
    }

    isErr(): this is Err<T, E> {
        return true;
    }

    unwrap(): never {
        throw this.error;
    }

    unwrapOr(fallback: T): T {
        return fallback;
    }
}

export function ok<T, E = Error>(value: T): Result<T, E> {
    return new Ok(value);
}

export function err<T, E = Error>(error: E): Result<T, E> {
    return new Err(error);
}
