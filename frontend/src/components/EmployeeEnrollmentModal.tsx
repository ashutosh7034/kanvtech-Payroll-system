import React from 'react';
import { ManageEmployeeView } from '../pages/ManageEmployeeView';

export interface EmployeeEnrollmentModalProps {
  isOpen: boolean;
  employeeId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EmployeeEnrollmentModal: React.FC<EmployeeEnrollmentModalProps> = ({
  isOpen,
  employeeId,
  onClose,
  onSuccess
}) => {
  if (!isOpen) return null;

  return (
    <ManageEmployeeView
      employeeId={employeeId}
      onBack={onClose}
      onSuccess={onSuccess}
    />
  );
};
