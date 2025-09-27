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
    return (
      <div className="validation-loading">
        <p>Validating data integrity...</p>
      </div>
    );
  }

  if (!validationResult) {
    return (
      <div className="validation-error">
        <p>Unable to load validation results.</p>
        <button onClick={handleRevalidate} className="retry-button">
          Retry Validation
        </button>
      </div>
    );
  }

  return (
    <div className="validation-section">
      <h3>Data Verification</h3>
      <p>Check the integrity and health of your stored data.</p>

      <div className="verification-grid">
        <div className="score-circle">
          <span className="score">{validationResult.stats.dataIntegrityScore}</span>
          <span className="score-label">Integrity</span>
        </div>

        <div className="verification-stats">
          <div className="verification-stat">
            <span className="verification-label">Total Sessions</span>
            <span className="verification-value">
              {validationResult.stats.totalMeals}
            </span>
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
            <span className="verification-value">
              Just now
            </span>
          </div>
        </div>
      </div>

      <div className="verification-status">
        <p>
          <strong>
            {validationResult.valid
              ? 'All systems operational.'
              : 'Issues detected in your data.'
            }
          </strong>{' '}
          {validationResult.valid
            ? 'Your training data is secure and backed up regularly.'
            : 'Review the issues below and consider running a data repair.'}
        </p>
      </div>

      {validationResult.errors.length > 0 && (
        <div className="validation-errors">
          <h4>Issues Found:</h4>
          <ul>
            {validationResult.errors.map((error, index) => (
              <li key={index} className={`error-item ${error.type}`}>
                <strong>{error.type}:</strong> {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {validationResult.warnings.length > 0 && (
        <div className="validation-warnings">
          <h4>Warnings:</h4>
          <ul>
            {validationResult.warnings.map((warning, index) => (
              <li key={index} className="warning-item">
                <strong>{warning.type}:</strong> {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="validation-actions">
        <button onClick={handleRevalidate} className="revalidate-button secondary">
          Run Validation Again
        </button>
      </div>
    </div>
  );
}