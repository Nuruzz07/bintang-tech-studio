/**
 * Bintang Tech Studio — Telegram Mini App Integration Boundary.
 * Baseline: Milestone M11 Telegram Engine.
 *
 * Provides configuration-driven WebApp URL generation.
 * Never hardcodes storefront domains in business logic.
 * Deep-link parameters cannot override Store Context or authorization.
 */

import { TelegramInlineButton } from './types.js';

export interface MiniAppConfig {
  readonly baseUrl: string; // e.g. "https://store.bintang.tech" or "https://bintanggstore.web.id"
}

export class TelegramMiniAppHelper {
  constructor(private readonly config?: MiniAppConfig) {}

  /**
   * Builds the customer storefront launch URL for the current store.
   * Can accept optional deep-link target (e.g. specific product or tab).
   */
  public buildStoreUrl(
    storeBaseUrl?: string,
    params?: { readonly path?: string | undefined; readonly startParam?: string | undefined },
  ): string | null {
    const base = storeBaseUrl || this.config?.baseUrl;
    if (!base) {
      return null;
    }

    if (!params?.path && !params?.startParam) {
      return base;
    }

    try {
      const url = new URL(base);
      if (params?.path) {
        url.pathname = params.path.startsWith('/') ? params.path : `/${params.path}`;
      }
      if (params?.startParam) {
        // Sanitize start parameter: only alphanumeric, underscore, hyphen
        const clean = params.startParam.replace(/[^a-zA-Z0-9_-]/g, '');
        if (clean) {
          url.searchParams.set('startapp', clean);
        }
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  /**
   * Generates a Telegram inline keyboard button that opens the Customer Mini App.
   */
  public createOpenStoreButton(
    storeBaseUrl?: string,
    buttonText: string = '🛍️ Buka Toko',
    startParam?: string,
  ): TelegramInlineButton | null {
    const url = this.buildStoreUrl(storeBaseUrl, startParam ? { startParam } : undefined);
    if (!url) {
      return null;
    }

    return {
      text: buttonText,
      webAppUrl: url,
    };
  }
}
