/**
 * 表单验证 Hook
 */

import { useState, useCallback } from 'react';
import type { z } from 'zod';

interface UseFormValidationOptions<TData> {
  schema: z.ZodSchema<TData>;
  onSubmit: (data: TData) => void | Promise<void>;
}

interface UseFormValidationReturn {
  errors: Record<string, string>;
  validate: (data: unknown) => boolean;
  handleSubmit: (data: unknown) => Promise<void>;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
}

export function useFormValidation<TData>({
  schema,
  onSubmit,
}: UseFormValidationOptions<TData>): UseFormValidationReturn {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback((data: unknown): boolean => {
    const result = schema.safeParse(data);
    if (result.success) {
      setErrors({});
      return true;
    }

    const formattedErrors: Record<string, string> = {};
    for (const err of result.error.issues) {
      const path = err.path.join('.');
      if (!formattedErrors[path]) {
        formattedErrors[path] = err.message;
      }
    }
    setErrors(formattedErrors);
    return false;
  }, [schema]);

  const handleSubmit = useCallback(async (data: unknown) => {
    if (validate(data)) {
      const result = schema.safeParse(data);
      if (result.success) {
        await onSubmit(result.data);
      }
    }
  }, [schema, validate, onSubmit]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  return {
    errors,
    validate,
    handleSubmit,
    clearErrors,
    clearFieldError,
  };
}

export default useFormValidation;
