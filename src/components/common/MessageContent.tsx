import React from 'react';
import { EnhancedChatMessage } from './EnhancedChatMessage';

export interface MessageContentProps {
  text: string;
}

export const MessageContent: React.FC<MessageContentProps> = ({ text }) => {
  return <EnhancedChatMessage text={text} />;
};

export { EnhancedChatMessage };
