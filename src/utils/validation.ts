import { z } from 'zod';
import DOMPurify from 'dompurify';

// Input sanitization
export function sanitizeString(input: string): string {
  return DOMPurify.sanitize(input.trim(), { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}

// Validation schemas
export const MealSchema = z.object({
  mealName: z
    .string()
    .min(1, 'Meal name is required')
    .max(100, 'Meal name must be 100 characters or less')
    .refine(
      (name) => name.trim().length > 0,
      'Meal name cannot be empty or just spaces'
    ),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine(
      (date) => {
        const parsedDate = new Date(date);
        const now = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(now.getFullYear() + 1);
        
        return parsedDate >= oneYearAgo && parsedDate <= oneYearFromNow;
      },
      'Date must be within one year of today'
    ),
});

export const EmailSchema = z
  .string()
  .email('Invalid email address')
  .max(254, 'Email address too long'); // RFC 5321 limit

export const PasswordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password must be 128 characters or less');

// Validation result types
export type ValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  errors: string[];
};

// Validation helpers
export function validateMeal(data: unknown): ValidationResult<{ mealName: string; date: string }> {
  try {
    const result = MealSchema.parse(data);
    return {
      success: true,
      data: {
        mealName: sanitizeString(result.mealName),
        date: result.date
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map((issue) => issue.message)
      };
    }
    return {
      success: false,
      errors: ['Invalid input data']
    };
  }
}

export function validateEmail(email: unknown): ValidationResult<string> {
  try {
    const result = EmailSchema.parse(email);
    return {
      success: true,
      data: sanitizeString(result)
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map((issue) => issue.message)
      };
    }
    return {
      success: false,
      errors: ['Invalid email']
    };
  }
}

export function validatePassword(password: unknown): ValidationResult<string> {
  try {
    const result = PasswordSchema.parse(password);
    return {
      success: true,
      data: result // Don't sanitize passwords, just validate
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map((issue) => issue.message)
      };
    }
    return {
      success: false,
      errors: ['Invalid password']
    };
  }
}