import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DataQuality from '../DataQuality';

describe('DataQuality Form Validation', () => {
  it('shows error messages when required fields are empty', () => {
    render(<DataQuality />);
    
    // Clear all the default values first
    const nameInput = screen.getByPlaceholderText('Name');
    const dobInput = screen.getByPlaceholderText('DOB (YYYY-MM-DD)');
    
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.change(dobInput, { target: { value: '' } });
    
    const submitButton = screen.getByRole('button', { name: /run assessment/i });
    fireEvent.click(submitButton);
    
    expect(screen.getByText('Name is required.')).toBeDefined();
    expect(screen.getByText('DOB is required.')).toBeDefined();
  });

  it('validates date format for DOB', () => {
    render(<DataQuality />);
    
    const dobInput = screen.getByPlaceholderText('DOB (YYYY-MM-DD)');
    fireEvent.change(dobInput, { target: { value: 'invalid-date' } });
    
    const submitButton = screen.getByRole('button', { name: /run assessment/i });
    fireEvent.click(submitButton);
    
    expect(screen.getByText('Invalid Date Format (YYYY-MM-DD expected).')).toBeDefined();
  });
});
