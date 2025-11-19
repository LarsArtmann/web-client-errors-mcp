/**
 * Result Type - Railway-Oriented Programming
 *
 * Provides type-safe error handling without exceptions.
 * Makes success/failure paths explicit in the type system.
 *
 * Benefits:
 * - Impossible states are unrepresentable (can't access value on error)
 * - Compiler enforces error handling
 * - No try/catch needed for business logic
 * - Composable with map, flatMap, mapError
 * - Works seamlessly with async/await
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) {
 *     return Err('Division by zero');
 *   }
 *   return Ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.ok) {
 *   console.log(result.value); // 5
 * } else {
 *   console.error(result.error); // Type-safe error access
 * }
 * ```
 */

/**
 * Successful result containing a value
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Failed result containing an error
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result type - either Ok<T> or Err<E>
 * Discriminated union on the 'ok' field
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Creates a successful Result
 */
// eslint-disable-next-line no-redeclare
export function Ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Creates a failed Result
 */
// eslint-disable-next-line no-redeclare
export function Err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Type guard to check if Result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Type guard to check if Result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

/**
 * Maps a Result's value if Ok, otherwise passes through the error
 *
 * @example
 * ```typescript
 * const result = Ok(5);
 * const doubled = map(result, x => x * 2); // Ok(10)
 * ```
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return Ok(fn(result.value));
  }
  return result;
}

/**
 * Maps a Result's error if Err, otherwise passes through the value
 *
 * @example
 * ```typescript
 * const result = Err('Network error');
 * const mapped = mapError(result, err => new Error(err)); // Err(Error('Network error'))
 * ```
 */
export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (result.ok) {
    return result;
  }
  return Err(fn(result.error));
}

/**
 * FlatMap (bind/chain) for Result
 * Allows chaining operations that return Results
 *
 * @example
 * ```typescript
 * const result = Ok(5);
 * const chained = flatMap(result, x => Ok(x * 2)); // Ok(10)
 * const failed = flatMap(result, x => Err('Failed')); // Err('Failed')
 * ```
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * Unwraps a Result, returning the value if Ok, or throwing if Err
 * Use sparingly - prefer pattern matching with if (result.ok)
 *
 * @throws The error if Result is Err
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwraps a Result, returning the value if Ok, or a default value if Err
 *
 * @example
 * ```typescript
 * const result = Err('Failed');
 * const value = unwrapOr(result, 0); // 0
 * ```
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Unwraps a Result, returning the value if Ok, or computing a default if Err
 *
 * @example
 * ```typescript
 * const result = Err('Failed');
 * const value = unwrapOrElse(result, err => {
 *   console.error(err);
 *   return 0;
 * }); // 0
 * ```
 */
export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T {
  if (result.ok) {
    return result.value;
  }
  return fn(result.error);
}

/**
 * Combines multiple Results into a single Result
 * Returns Ok with array of values if all are Ok
 * Returns first Err if any are Err
 *
 * @example
 * ```typescript
 * const results = [Ok(1), Ok(2), Ok(3)];
 * const combined = all(results); // Ok([1, 2, 3])
 *
 * const withError = [Ok(1), Err('Failed'), Ok(3)];
 * const failed = all(withError); // Err('Failed')
 * ```
 */
export function all<T, E>(results: ReadonlyArray<Result<T, E>>): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      return result; // Return first error
    }
  }

  return Ok(values);
}

/**
 * Wraps a function that might throw into a Result
 *
 * @example
 * ```typescript
 * const result = tryCatch(
 *   () => JSON.parse('invalid json'),
 *   error => error instanceof Error ? error.message : String(error)
 * ); // Err('Unexpected token ...')
 * ```
 */
export function tryCatch<T, E>(
  fn: () => T,
  onError: (error: unknown) => E
): Result<T, E> {
  try {
    return Ok(fn());
  } catch (error) {
    return Err(onError(error));
  }
}

/**
 * Async version of tryCatch
 * Wraps an async function that might throw into a Result
 *
 * @example
 * ```typescript
 * const result = await tryCatchAsync(
 *   async () => await fetchData(),
 *   error => error instanceof Error ? error.message : String(error)
 * ); // Result<Data, string>
 * ```
 */
export async function tryCatchAsync<T, E>(
  fn: () => Promise<T>,
  onError: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return Ok(value);
  } catch (error) {
    return Err(onError(error));
  }
}

/**
 * Converts a Result to an Option type
 * Ok becomes Some, Err becomes None
 */
export function toOption<T, E>(result: Result<T, E>): T | null {
  return result.ok ? result.value : null;
}

/**
 * Pattern matching for Result
 * Provides a functional way to handle both cases
 *
 * @example
 * ```typescript
 * const result = Ok(5);
 * const message = match(result, {
 *   ok: value => `Success: ${value}`,
 *   err: error => `Error: ${error}`
 * }); // "Success: 5"
 * ```
 */
export function match<T, E, U>(
  result: Result<T, E>,
  matcher: {
    ok: (value: T) => U;
    err: (error: E) => U;
  }
): U {
  if (result.ok) {
    return matcher.ok(result.value);
  }
  return matcher.err(result.error);
}
