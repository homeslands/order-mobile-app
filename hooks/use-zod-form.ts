import { toNestErrors } from '@hookform/resolvers'
import {
  useForm,
  type FieldError,
  type FieldErrors,
  type FieldValues,
  type ResolverOptions,
  type ResolverResult,
  type UseFormProps,
} from 'react-hook-form'
import { type ZodError, type ZodType } from 'zod'

/**
 * Custom zodResolver compatible with Zod 4.
 *
 * `@hookform/resolvers@3.x` checks `error.errors` to detect a ZodError,
 * but Zod 4 removed `.errors` in favour of `.issues`.
 * This resolver uses `.issues` so validation errors are returned as
 * form-field errors instead of leaking as unhandled promise rejections.
 */
function zodResolver<T extends FieldValues>(schema: ZodType<T>) {
  return async (
    values: T,
    _context: unknown,
    options: ResolverOptions<T>,
  ): Promise<ResolverResult<T>> => {
    const result = schema.safeParse(values)

    if (result.success) {
      return {
        errors: {} as FieldErrors<T>,
        values: result.data,
      } as ResolverResult<T>
    }

    const zodError = result.error as ZodError
    const fieldErrors: Record<string, FieldError> = {}

    for (const issue of zodError.issues) {
      const path = issue.path.join('.')
      if (!fieldErrors[path]) {
        fieldErrors[path] = { message: issue.message, type: issue.code }
      }
    }

    return {
      values: {},
      errors: toNestErrors(fieldErrors, options),
    } as ResolverResult<T>
  }
}

export function useZodForm<T extends FieldValues>(
  schema: ZodType<T>,
  options?: Omit<UseFormProps<T>, 'resolver'>,
) {
  return useForm<T>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    ...options,
  })
}
