import type { ConversationMessage, MessageRef } from "../conversation/types.js";

export type ReplyOptions = {
  allowedMentionUsers?: string[];
};

export interface DiscordAdapter {
  botUserId: string;
  fetchMessage(ref: MessageRef): Promise<ConversationMessage>;
  sendTyping(channelId: string): Promise<void>;
  sendMessage(
    channelId: string,
    content: string,
    options?: ReplyOptions,
  ): Promise<ConversationMessage>;
  sendReply(
    target: MessageRef,
    content: string,
    options?: ReplyOptions,
  ): Promise<ConversationMessage>;
}
