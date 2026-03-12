import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MedicationReconciliation from '../MedicationReconciliation';

describe('MedicationReconciliation Form Validation', () => {
  it('shows error message if patient context is empty', () => {
    render(<MedicationReconciliation />);
    
    const ageInput = screen.getByPlaceholderText('Age');
    fireEvent.change(ageInput, { target: { value: '' } });
    
    const submitButton = screen.getByRole('button', { name: /run reconciliation/i });
    fireEvent.click(submitButton);
    
    expect(screen.getByText('Patient context fields are required.')).toBeDefined();
  });

  it('shows error message if source fields are empty', () => {
    render(<MedicationReconciliation />);
    
    // Clear the first source's system
    const systemInputs = screen.getAllByPlaceholderText('System (e.g. Hospital EHR)');
    fireEvent.change(systemInputs[0], { target: { value: '' } });
    
    const submitButton = screen.getByRole('button', { name: /run reconciliation/i });
    fireEvent.click(submitButton);
    
    expect(screen.getByText('Source #1 is missing required fields (system, medication, date).')).toBeDefined();
  });
});
