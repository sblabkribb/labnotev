import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MantineProvider } from '@mantine/core';
import { SampleInputDialog } from '../components/SampleInputDialog';

// Wrapper component with MantineProvider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('SampleInputDialog', () => {
  const defaultProps = {
    isOpen: true,
    sampleType: 'DNA',
    sampleId: 'DNA-1737123456789',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('렌더링', () => {
    it('should render dialog when isOpen is true', () => {
      render(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText(/샘플 정보 입력/i)).toBeInTheDocument();
    });

    it('should not render dialog when isOpen is false', () => {
      render(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      expect(screen.queryByText(/샘플 정보 입력/i)).not.toBeInTheDocument();
    });

    it('should display sample ID in dialog', () => {
      render(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText(/DNA-1737123456789/)).toBeInTheDocument();
    });

    it('should have alias input field', () => {
      render(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/별칭/i)).toBeInTheDocument();
    });

    it('should have description input field', () => {
      render(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/설명/i)).toBeInTheDocument();
    });
  });

  describe('사용자 입력', () => {
    it('should update alias input value', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} />
        </TestWrapper>
      );

      const aliasInput = screen.getByLabelText(/별칭/i);
      await user.type(aliasInput, '테스트 샘플');

      expect(aliasInput).toHaveValue('테스트 샘플');
    });

    it('should update description input value', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} />
        </TestWrapper>
      );

      const descInput = screen.getByLabelText(/설명/i);
      await user.type(descInput, '이것은 테스트 설명입니다');

      expect(descInput).toHaveValue('이것은 테스트 설명입니다');
    });
  });

  describe('확인/취소', () => {
    it('should call onConfirm with alias and description when confirm button clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      
      render(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} onConfirm={onConfirm} />
        </TestWrapper>
      );

      const aliasInput = screen.getByLabelText(/별칭/i);
      const descInput = screen.getByLabelText(/설명/i);
      
      await user.type(aliasInput, '샘플A');
      await user.type(descInput, '설명 텍스트');
      
      const confirmButton = screen.getByRole('button', { name: /확인/i });
      await user.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledWith({
        alias: '샘플A',
        description: '설명 텍스트',
      });
    });

    it('should call onConfirm with null values when fields are empty', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      
      render(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} onConfirm={onConfirm} />
        </TestWrapper>
      );

      const confirmButton = screen.getByRole('button', { name: /확인/i });
      await user.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledWith({
        alias: null,
        description: null,
      });
    });

    it('should call onCancel when cancel button clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      
      render(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} onCancel={onCancel} />
        </TestWrapper>
      );

      const cancelButton = screen.getByRole('button', { name: /취소/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });

    it('should call onCancel when X button clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      
      render(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} onCancel={onCancel} />
        </TestWrapper>
      );

      // Mantine Modal's close button has class mantine-Modal-close
      const closeButton = document.querySelector('.mantine-Modal-close');
      expect(closeButton).not.toBeNull();
      await user.click(closeButton!);

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('필드 초기화', () => {
    it('should reset fields when dialog closes and reopens', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} />
        </TestWrapper>
      );

      // Type something
      const aliasInput = screen.getByLabelText(/별칭/i);
      await user.type(aliasInput, '테스트');
      
      // Close dialog
      rerender(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      // Reopen dialog with new sample
      rerender(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} sampleId="DNA-NEW" />
        </TestWrapper>
      );

      // Field should be empty
      const newAliasInput = screen.getByLabelText(/별칭/i);
      expect(newAliasInput).toHaveValue('');
    });
  });

  describe('건너뛰기 옵션', () => {
    it('should have skip button to insert ID without info', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      
      render(
        <TestWrapper>
          <SampleInputDialog {...defaultProps} onConfirm={onConfirm} />
        </TestWrapper>
      );

      const skipButton = screen.getByRole('button', { name: /건너뛰기|ID만 삽입/i });
      await user.click(skipButton);

      expect(onConfirm).toHaveBeenCalledWith({
        alias: null,
        description: null,
        skipSave: true,
      });
    });
  });
});
