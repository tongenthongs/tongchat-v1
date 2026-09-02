import React from 'react';
import { AuthModal } from '../../components/auth/AuthModal';

export default function LoginPage() {
  return (
    <AuthModal 
      isStandalone={true} 
      onClose={() => {
        window.location.href = "/";
      }} 
    />
  );
}
