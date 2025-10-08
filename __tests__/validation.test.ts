import {
  sanitizeString,
  validateMeal,
  validateEmail,
  validatePassword,
  MealSchema,
  EmailSchema,
  PasswordSchema,
} from '@/utils/validation';

describe('validation utils', () => {
  describe('sanitizeString', () => {
    test('removes HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = sanitizeString(input);

      expect(result).toBe('Hello');
      expect(result).not.toContain('<script>');
    });

    test('removes dangerous attributes', () => {
      const input = '<div onclick="alert()">Test</div>';
      const result = sanitizeString(input);

      expect(result).toBe('Test');
      expect(result).not.toContain('onclick');
    });

    test('trims whitespace', () => {
      const input = '   Hello World   ';
      const result = sanitizeString(input);

      expect(result).toBe('Hello World');
    });

    test('handles empty string', () => {
      const result = sanitizeString('');

      expect(result).toBe('');
    });

    test('preserves regular text', () => {
      const input = 'Just regular text';
      const result = sanitizeString(input);

      expect(result).toBe('Just regular text');
    });

    test('handles special characters', () => {
      const input = 'Test & < > " \'';
      const result = sanitizeString(input);

      expect(result).toContain('&');
    });
  });

  describe('MealSchema', () => {
    test('validates correct meal data', () => {
      const today = new Date().toISOString().split('T')[0];
      const validMeal = {
        mealName: 'Pizza',
        date: today,
      };

      const result = MealSchema.safeParse(validMeal);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validMeal);
      }
    });

    test('rejects empty meal name', () => {
      const invalidMeal = {
        mealName: '',
        date: '2024-03-15',
      };

      const result = MealSchema.safeParse(invalidMeal);

      expect(result.success).toBe(false);
    });

    test('rejects meal name with only spaces', () => {
      const invalidMeal = {
        mealName: '   ',
        date: '2024-03-15',
      };

      const result = MealSchema.safeParse(invalidMeal);

      expect(result.success).toBe(false);
    });

    test('rejects meal name longer than 100 characters', () => {
      const invalidMeal = {
        mealName: 'a'.repeat(101),
        date: '2024-03-15',
      };

      const result = MealSchema.safeParse(invalidMeal);

      expect(result.success).toBe(false);
    });

    test('accepts meal name exactly 100 characters', () => {
      const today = new Date().toISOString().split('T')[0];
      const validMeal = {
        mealName: 'a'.repeat(100),
        date: today,
      };

      const result = MealSchema.safeParse(validMeal);

      expect(result.success).toBe(true);
    });

    test('rejects invalid date format', () => {
      const invalidMeal = {
        mealName: 'Pizza',
        date: '03/15/2024',
      };

      const result = MealSchema.safeParse(invalidMeal);

      expect(result.success).toBe(false);
    });

    test('rejects date more than one year in the past', () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const dateString = twoYearsAgo.toISOString().split('T')[0];

      const invalidMeal = {
        mealName: 'Pizza',
        date: dateString,
      };

      const result = MealSchema.safeParse(invalidMeal);

      expect(result.success).toBe(false);
    });

    test('rejects date more than one year in the future', () => {
      const twoYearsFromNow = new Date();
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
      const dateString = twoYearsFromNow.toISOString().split('T')[0];

      const invalidMeal = {
        mealName: 'Pizza',
        date: dateString,
      };

      const result = MealSchema.safeParse(invalidMeal);

      expect(result.success).toBe(false);
    });

    test('accepts date within one year range', () => {
      const today = new Date();
      const dateString = today.toISOString().split('T')[0];

      const validMeal = {
        mealName: 'Pizza',
        date: dateString,
      };

      const result = MealSchema.safeParse(validMeal);

      expect(result.success).toBe(true);
    });
  });

  describe('EmailSchema', () => {
    test('validates correct email', () => {
      const result = EmailSchema.safeParse('test@example.com');

      expect(result.success).toBe(true);
    });

    test('rejects invalid email format', () => {
      const result = EmailSchema.safeParse('not-an-email');

      expect(result.success).toBe(false);
    });

    test('rejects email without domain', () => {
      const result = EmailSchema.safeParse('test@');

      expect(result.success).toBe(false);
    });

    test('rejects email without @', () => {
      const result = EmailSchema.safeParse('testexample.com');

      expect(result.success).toBe(false);
    });

    test('rejects email longer than 254 characters', () => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      const result = EmailSchema.safeParse(longEmail);

      expect(result.success).toBe(false);
    });

    test('accepts various valid email formats', () => {
      const validEmails = [
        'simple@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user_name@example.com',
      ];

      validEmails.forEach(email => {
        const result = EmailSchema.safeParse(email);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('PasswordSchema', () => {
    test('validates correct password', () => {
      const result = PasswordSchema.safeParse('password123');

      expect(result.success).toBe(true);
    });

    test('rejects password shorter than 6 characters', () => {
      const result = PasswordSchema.safeParse('12345');

      expect(result.success).toBe(false);
    });

    test('accepts password exactly 6 characters', () => {
      const result = PasswordSchema.safeParse('123456');

      expect(result.success).toBe(true);
    });

    test('rejects password longer than 128 characters', () => {
      const result = PasswordSchema.safeParse('a'.repeat(129));

      expect(result.success).toBe(false);
    });

    test('accepts password exactly 128 characters', () => {
      const result = PasswordSchema.safeParse('a'.repeat(128));

      expect(result.success).toBe(true);
    });

    test('accepts special characters in password', () => {
      const result = PasswordSchema.safeParse('P@ssw0rd!#$%');

      expect(result.success).toBe(true);
    });
  });

  describe('validateMeal', () => {
    test('returns success for valid meal data', () => {
      const today = new Date().toISOString().split('T')[0];
      const data = {
        mealName: 'Pizza',
        date: today,
      };

      const result = validateMeal(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mealName).toBe('Pizza');
        expect(result.data.date).toBe(today);
      }
    });

    test('sanitizes meal name', () => {
      const today = new Date().toISOString().split('T')[0];
      const data = {
        mealName: '<script>alert("xss")</script>Pizza',
        date: today,
      };

      const result = validateMeal(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mealName).toBe('Pizza');
        expect(result.data.mealName).not.toContain('<script>');
      }
    });

    test('returns errors for invalid meal data', () => {
      const data = {
        mealName: '',
        date: 'invalid-date',
      };

      const result = validateMeal(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    test('handles non-object input', () => {
      const result = validateMeal('not an object');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    test('handles null input', () => {
      const result = validateMeal(null);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    test('handles undefined input', () => {
      const result = validateMeal(undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    test('includes all validation errors', () => {
      const data = {
        mealName: '',
        date: 'invalid',
      };

      const result = validateMeal(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(1);
      }
    });
  });

  describe('validateEmail', () => {
    test('returns success for valid email', () => {
      const result = validateEmail('test@example.com');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test@example.com');
      }
    });

    test('returns error for email with HTML', () => {
      // Email with HTML tags will fail email validation
      const result = validateEmail('<script>test@example.com</script>');

      // This should fail because it's not a valid email format
      expect(result.success).toBe(false);
    });

    test('returns errors for invalid email', () => {
      const result = validateEmail('not-an-email');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('email');
      }
    });

    test('handles non-string input', () => {
      const result = validateEmail(123);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    test('handles null input', () => {
      const result = validateEmail(null);

      expect(result.success).toBe(false);
    });
  });

  describe('validatePassword', () => {
    test('returns success for valid password', () => {
      const result = validatePassword('password123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('password123');
      }
    });

    test('does not sanitize password', () => {
      const password = 'P@ssw0rd!<>';
      const result = validatePassword(password);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(password);
      }
    });

    test('returns errors for short password', () => {
      const result = validatePassword('123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('6 characters');
      }
    });

    test('returns errors for long password', () => {
      const result = validatePassword('a'.repeat(129));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('128 characters');
      }
    });

    test('handles non-string input', () => {
      const result = validatePassword(123);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    test('handles null input', () => {
      const result = validatePassword(null);

      expect(result.success).toBe(false);
    });
  });
});
