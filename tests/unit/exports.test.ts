import { describe, expectTypeOf, it } from 'vitest';
import type { JwtRefreshOptions } from '../../src/auth';
import type {
  ValidationErrorInfo,
  ValifetchErrorOptions,
} from '../../src/error';
import type { MockCall, MockHandler, ValifetchMock } from '../../src/mock';
import type * as PublicTypes from '../../src/types';

/**
 * `valifetch/types` must be a superset of every public type exported from
 * `.`, `./error`, `./auth`, and `./mock`. This test fails to typecheck
 * (not at runtime) if a type is added to one of those entry points without
 * also being re-exported from `src/types.ts`.
 */
describe('valifetch/types re-exports every public type', () => {
  it('includes error detail types', () => {
    expectTypeOf<PublicTypes.ValidationErrorInfo>().toEqualTypeOf<ValidationErrorInfo>();
    expectTypeOf<PublicTypes.ValifetchErrorOptions>().toEqualTypeOf<ValifetchErrorOptions>();
  });

  it('includes auth option types', () => {
    expectTypeOf<PublicTypes.JwtRefreshOptions>().toEqualTypeOf<JwtRefreshOptions>();
  });

  it('includes mock types', () => {
    expectTypeOf<PublicTypes.MockCall>().toEqualTypeOf<MockCall>();
    expectTypeOf<PublicTypes.MockHandler>().toEqualTypeOf<MockHandler>();
    expectTypeOf<PublicTypes.ValifetchMock>().toEqualTypeOf<ValifetchMock>();
  });
});
