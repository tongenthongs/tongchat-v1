import React from 'react';
import { FormattedChatMessage, FormattedChatMessageProps, ChatMessageRenderer, ChatMessageRendererProps } from './ChatMessageRenderer';

export type EnhancedChatMessageProps = FormattedChatMessageProps;
export const EnhancedChatMessage = FormattedChatMessage;
export { ChatMessageRenderer, FormattedChatMessage };
export type { ChatMessageRendererProps, FormattedChatMessageProps };
