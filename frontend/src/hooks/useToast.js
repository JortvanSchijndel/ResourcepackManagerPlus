import { useState } from 'react';

export const useToast = () => {
  const [message, setMessage] = useState('');

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(''), 4000);
  };

  return { message, showMessage };
};