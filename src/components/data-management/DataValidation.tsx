import { useState, useEffect } from 'react';
import { DataValidator, type ValidationResult } from '@/lib/data-validator';

export default function DataValidation() {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    performDataValidation();
  }, []);

  const performDataValidation = async () => {
    setValidating(true);
    try {
      const result = await DataValidator.validateAllData();
      setValidationResult(result);
    } catch (error) {
      console.error('Failed to validate data:', error);
    } finally {
      setValidating(false);
    }
  };

  const handleRevalidate = () => {
    performDataValidation();
  };

  if (validating) {
    return <div className="loading">Validating data integrity...</div>;
  }

  if (!validationResult) {
    return (
      <>
        <div className="message-card error">
          <p>Unable to load validation results.</p>
        </div>
        <div className="action-group">
          <button onClick={handleRevalidate} className="primary-button">
            Retry Validation
          </button>
        </div>
      </>
    );
  }

  const statusPrefix = validationResult.valid ? 'All systems operational.' : 'Issues detected in your data.';
  const statusSuffix = validationResult.valid
    ? 'Your training data is secure and backed up regularly.'
    : 'Review the issues below and consider running a data repair.';

  return (
    <div>
      <div className="verification-grid">
        <div className="score-circle">
          <span className="score">{validationResult.stats.dataIntegrityScore}</span>
          <span className="score-label">Integrity</span>
        </div>

        <div className="verification-stats">
          <div className="verification-stat">
            <span className="verification-label">Total Sessions</span>
            <span className="verification-value">{validationResult.stats.totalMeals}</span>
          </div>
          <div className="verification-stat">
            <span className="verification-label">Issues Found</span>
            <span className={`verification-value ${validationResult.errors.length > 0 ? 'warning' : ''}`}>
              {validationResult.errors.length}
            </span>
          </div>
          <div className="verification-stat">
            <span className="verification-label">Data Status</span>
            <span className={`verification-badge ${validationResult.valid ? 'healthy' : 'attention'}`}>
              {validationResult.valid ? '✓ Healthy' : '⚠ Needs attention'}
            </span>
          </div>
          <div className="verification-stat">
            <span className="verification-label">Last Check</span>
            <span className="verification-value">Just now</span>
          </div>
        </div>
      </div>

      <div className="verification-status">
        <p>
          <strong>{statusPrefix}</strong> {statusSuffix}
        </p>
      </div>

      {validationResult.errors.length > 0 && (
        <div className="message-card error">
          <p>
            <strong>Issues Found:</strong>
          </p>
          <ul>
            {validationResult.errors.map((error, index) => (
              <li key={index}>
                <strong>{error.type}:</strong> {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {validationResult.warnings.length > 0 && (
        <div className="message-card info">
          <p>
            <strong>Warnings:</strong>
          </p>
          <ul>
            {validationResult.warnings.map((warning, index) => (
              <li key={index}>
                <strong>{warning.type}:</strong> {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="action-group">
        <button onClick={handleRevalidate} className="secondary-button">
          Run Validation Again
        </button>
      </div>
    </div>
  );
}