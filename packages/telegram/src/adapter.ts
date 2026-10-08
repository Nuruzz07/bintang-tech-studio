/**
 * Bintang Tech Studio — Telegram Transport Adapter Boundary.
 * Baseline: Milestone M11 Telegram Engine.
 *
 * Keeps transport provider-specific code strictly behind an interface.
 * Downstream services never import concrete Telegram SDKs.
 */

import { TelegramMessagePayload, TelegramCallbackAnswer } from './types.js';
import { TelegramAdapterError } from './errors.js';

export interface TelegramAdapter {
  sendMessage(
    botId: string,
    payload: TelegramMessagePayload,
  ): Promise<{ readonly messageId: number }>;

  editMessage(botId: string, messageId: number, payload: TelegramMessagePayload): Promise<void>;

  answerCallbackQuery(botId: string, answer: TelegramCallbackAnswer): Promise<void>;

  sendPhoto?(
    botId: string,
    chatId: string,
    photoUrl: string,
    caption?: string,
  ): Promise<{ readonly messageId: number }>;

  setWebhook?(botId: string, webhookUrl: string): Promise<boolean>;
}

export interface SentMessageRecord extends TelegramMessagePayload {
  readonly botId: string;
  readonly messageId: number;
  readonly sentAt: string;
}

export interface AnsweredCallbackRecord extends TelegramCallbackAnswer {
  readonly botId: string;
  readonly answeredAt: string;
}

export interface EditedMessageRecord {
  readonly botId: string;
  readonly messageId: number;
  readonly payload: TelegramMessagePayload;
  readonly editedAt: string;
}

/**
 * In-memory test double of TelegramAdapter for hermetic unit and security testing.
 * Provides rich inspection of outbound messages without calling Telegram servers.
 */
export class MockTelegramAdapter implements TelegramAdapter {
  private nextMessageId = 1000;
  public readonly sentMessages: SentMessageRecord[] = [];
  public readonly answeredCallbacks: AnsweredCallbackRecord[] = [];
  public readonly editedMessages: EditedMessageRecord[] = [];
  private shouldFailNextSend: Error | null = null;
  private shouldFailNextAnswer: Error | null = null;

  public async sendMessage(
    botId: string,
    payload: TelegramMessagePayload,
  ): Promise<{ readonly messageId: number }> {
    if (this.shouldFailNextSend) {
      const err = this.shouldFailNextSend;
      this.shouldFailNextSend = null;
      throw err;
    }

    const messageId = ++this.nextMessageId;
    this.sentMessages.push({
      ...payload,
      botId,
      messageId,
      sentAt: new Date().toISOString(),
    });

    return { messageId };
  }

  public async editMessage(
    botId: string,
    messageId: number,
    payload: TelegramMessagePayload,
  ): Promise<void> {
    this.editedMessages.push({
      botId,
      messageId,
      payload,
      editedAt: new Date().toISOString(),
    });
  }

  public async answerCallbackQuery(botId: string, answer: TelegramCallbackAnswer): Promise<void> {
    if (this.shouldFailNextAnswer) {
      const err = this.shouldFailNextAnswer;
      this.shouldFailNextAnswer = null;
      throw err;
    }

    this.answeredCallbacks.push({
      ...answer,
      botId,
      answeredAt: new Date().toISOString(),
    });
  }

  public async sendPhoto(
    botId: string,
    chatId: string,
    photoUrl: string,
    caption?: string,
  ): Promise<{ readonly messageId: number }> {
    return this.sendMessage(botId, {
      chatId,
      text: `[PHOTO: ${photoUrl}] ${caption ?? ''}`,
    });
  }

  public async setWebhook(_botId: string, _webhookUrl: string): Promise<boolean> {
    return true;
  }

  public simulateSendFailure(
    error: Error = new TelegramAdapterError('Network connection timeout'),
  ): void {
    this.shouldFailNextSend = error;
  }

  public simulateAnswerFailure(
    error: Error = new TelegramAdapterError('Callback answer timeout'),
  ): void {
    this.shouldFailNextAnswer = error;
  }

  public reset(): void {
    this.sentMessages.length = 0;
    this.answeredCallbacks.length = 0;
    this.editedMessages.length = 0;
    this.shouldFailNextSend = null;
    this.shouldFailNextAnswer = null;
    this.nextMessageId = 1000;
  }
}
