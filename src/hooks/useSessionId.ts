import { useState, useEffect } from 'react';

export const useSessionId = () => {
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    let id = sessionStorage.getItem('kiosk_session_id');

    if (!id) {
      id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('kiosk_session_id', id);
    }

    setSessionId(id);
  }, []);

  return sessionId;
};
