import { useState, useCallback } from 'react';

/**
 * Silme/Onay modali kontrolü
 */
export const useConfirmation = () => {
  const [confirmation, setConfirmation] = useState({ show: false, id: null, data: null });

  const request = useCallback((id, data = null) => {
    setConfirmation({ show: true, id, data });
  }, []);

  const confirm = useCallback((callback) => {
    if (callback) callback(confirmation.id, confirmation.data);
    setConfirmation({ show: false, id: null, data: null });
  }, [confirmation]);

  const cancel = useCallback(() => {
    setConfirmation({ show: false, id: null, data: null });
  }, []);

  return { confirmation, request, confirm, cancel };
};
