import { useState, useCallback } from 'react';

/**
 * Toast bildirim yönetimi
 */
export const useToast = () => {
  const [toast, setToast] = useState(null);

  const show = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const success = useCallback((message) => show(message, 'success'), [show]);
  const error = useCallback((message) => show(message, 'error'), [show]);

  const close = useCallback(() => setToast(null), []);

  return { toast, show, success, error, close };
};
