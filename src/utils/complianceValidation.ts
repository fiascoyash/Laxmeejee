// Sanitization and validation for compliance fields.
// Each field has its own rules defined in complianceValidation (types.ts).
import { ComplianceFieldKey, complianceValidation } from '../types';

/**
 * Sanitize a compliance field value according to its field-specific rules.
 * - Strips leading/trailing whitespace
 * - Applies uppercase when required
 * - Filters to allowed characters only
 * - Caps at maxLength (no silent truncation of valid chars beyond exactLength)
 */
export const sanitizeComplianceValue = (key: ComplianceFieldKey, raw: string): string => {
  const config = complianceValidation[key];
  if (!config) return raw.trim();

  let value = raw.trim();

  if (config.digitsOnly) {
    value = value.replace(/\D/g, '');
  } else if (config.allowedChars) {
    const regex = new RegExp(`[^${config.allowedChars}]`, 'g');
    value = value.replace(regex, '');
  }

  if (config.uppercase) {
    value = value.toUpperCase();
  }

  // Cap at maxLength — never exceed the field's maximum
  value = value.slice(0, config.maxLength);

  return value;
};

/**
 * Validate a compliance field value.
 * Returns null if valid (or empty), or an error message string.
 */
export const validateComplianceValue = (key: ComplianceFieldKey, value: string): string | null => {
  const config = complianceValidation[key];
  if (!value || !value.trim()) return null;
  if (!config) return null;

  if (config.exactLength && value.length !== config.exactLength) {
    return `Must be exactly ${config.exactLength} characters`;
  }

  if (config.digitsOnly && !/^\d+$/.test(value)) {
    return 'Numbers only';
  }

  return null;
};

/**
 * Character count indicator for the input's help text.
 */
export const getComplianceHelpText = (key: ComplianceFieldKey, value: string): string => {
  const config = complianceValidation[key];
  if (!config) return '';

  if (config.helpText) {
    if (config.exactLength) {
      const remaining = config.exactLength - value.length;
      if (value.length === 0) return config.helpText;
      if (remaining === 0) return `${config.helpText} — complete`;
      return `${config.helpText} (${remaining} ${remaining === 1 ? 'character' : 'characters'} left)`;
    }
    return config.helpText;
  }
  return '';
};
