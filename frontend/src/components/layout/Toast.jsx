import React from 'react';

export const Toast = ({ message }) => {
  if (!message) return null;

return (
  <div
    className={`fixed bottom-6 right-6 bg-card border rounded-lg p-4 shadow-2xl z-2000 min-w-75 animate-slide-in transition-colors ${
      message.type === 'error' 
        ? 'border-l-4 border-l-[rgb(var(--toast-error-border))] border-r border-t border-b border-card' 
        : 'border-l-4 border-l-[rgb(var(--toast-success-border))] border-r border-t border-b border-card'
    }`}
  >
    <div className="font-semibold mb-1 text-foreground">
      {message.type === 'error' ? '❌ Error' : '✅ Success'}
    </div>
    <div className="text-sm text-secondary">{message.text}</div>
  </div>
);
};