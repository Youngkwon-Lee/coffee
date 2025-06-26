"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CustomAlertProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

export default function CustomAlert({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  onCancel,
  showCancel = false
}: CustomAlertProps) {

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'border-green-500 bg-green-900/30 backdrop-blur-md';
      case 'error':
        return 'border-red-500 bg-red-900/30 backdrop-blur-md';
      case 'warning':
        return 'border-yellow-500 bg-yellow-900/30 backdrop-blur-md';
      default:
        return 'border-coffee-gold bg-coffee-medium/80 backdrop-blur-md';
    }
  };

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className={`relative max-w-sm w-full mx-4 p-6 rounded-xl border ${getTypeStyles()} shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 아이콘 */}
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">{getIcon()}</div>
              {title && (
                <h3 className="text-lg font-semibold text-coffee-light mb-2">
                  {title}
                </h3>
              )}
            </div>

            {/* 메시지 */}
            <p className="text-center text-coffee-light opacity-90 mb-6 leading-relaxed">
              {message}
            </p>

            {/* 버튼들 */}
            <div className={`flex gap-3 ${showCancel ? 'justify-between' : 'justify-center'}`}>
              {showCancel && (
                <button
                  onClick={handleCancel}
                  className="flex-1 py-2.5 px-4 bg-coffee-medium/60 border border-coffee-gold/50 text-coffee-light rounded-lg font-medium hover:bg-coffee-medium/80 transition-all duration-200 backdrop-blur-sm"
                >
                  {cancelText}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className={`${showCancel ? 'flex-1' : 'px-8'} py-2.5 px-4 bg-coffee-gold/80 text-coffee-dark rounded-lg font-medium hover:bg-coffee-gold/90 transition-all duration-200 backdrop-blur-sm shadow-lg`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 간편 사용을 위한 Hook
export function useCustomAlert() {
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    showCancel?: boolean;
  }>({
    isOpen: false,
    message: ''
  });

  const showAlert = (params: Omit<typeof alertState, 'isOpen'>) => {
    setAlertState({ ...params, isOpen: true });
  };

  const hideAlert = () => {
    setAlertState(prev => ({ ...prev, isOpen: false }));
  };

  const AlertComponent = () => (
    <CustomAlert
      {...alertState}
      onClose={hideAlert}
    />
  );

  return {
    showAlert,
    hideAlert,
    AlertComponent
  };
} 