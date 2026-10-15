import { Buffer } from 'node:buffer';

export interface TelegramNotificationConfig {
  botToken?: string | undefined;
  chatId?: string | undefined;
}

export function getTelegramConfig(): TelegramNotificationConfig {
  const env = typeof process !== 'undefined' ? process.env : {};
  return {
    botToken: env?.['TELEGRAM_BOT_TOKEN'],
    chatId: env?.['TELEGRAM_CHAT_ID'],
  };
}

export async function sendTelegramPhoto(photoBase64OrUrl: string, caption?: string): Promise<boolean> {
  const { botToken, chatId } = getTelegramConfig();
  if (!botToken || !chatId) {
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
    
    // If it's a base64 data url, convert to FormData or send directly
    if (photoBase64OrUrl.startsWith('data:image/')) {
      const base64Data = photoBase64OrUrl.split(',')[1];
      if (!base64Data) return false;
      const buffer = Buffer.from(base64Data, 'base64');
      const uint8 = new Uint8Array(buffer);
      const blob = new Blob([uint8], { type: 'image/png' });
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', blob, 'whatsapp_qr.png');
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
      }

      const res = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      return res.ok;
    } else {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoBase64OrUrl,
          caption,
          parse_mode: 'HTML',
        }),
      });
      return res.ok;
    }
  } catch (err) {
    console.warn('[TelegramNotifier] sendPhoto error:', err);
    return false;
  }
}

export async function sendTelegramMessage(text: string, parseMode = 'HTML'): Promise<boolean> {
  const { botToken, chatId } = getTelegramConfig();
  if (!botToken || !chatId) {
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn('[TelegramNotifier] sendMessage failed:', res.status, errBody);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[TelegramNotifier] network error:', err);
    return false;
  }
}

export async function notifyNewOrder(params: {
  orderId: string;
  customerName: string;
  customerContact?: string | undefined;
  amount: number | string;
  paymentUrl?: string | null | undefined;
  itemsDescription?: string | undefined;
}): Promise<boolean> {
  const formattedAmount =
    typeof params.amount === 'number'
      ? `Rp ${params.amount.toLocaleString('id-ID')}`
      : `Rp ${params.amount}`;

  const message =
    `🔔 <b>[PESANAN BARU MASUK — QRIS]</b>\n\n` +
    `🆔 <b>ID Pesanan:</b> <code>${params.orderId}</code>\n` +
    `👤 <b>Pelanggan:</b> ${params.customerName || 'Customer'}\n` +
    (params.customerContact ? `📱 <b>Kontak:</b> ${params.customerContact}\n` : '') +
    (params.itemsDescription ? `📦 <b>Produk:</b> ${params.itemsDescription}\n` : '') +
    `💰 <b>Total Tagihan:</b> <b>${formattedAmount}</b>\n` +
    `🔄 <b>Status:</b> <i>Menunggu Pembayaran QRIS</i>\n\n` +
    (params.paymentUrl ? `🔗 <a href="${params.paymentUrl}">Link Tagihan Tipzy</a>\n\n` : '') +
    `⚡ <i>Sistem otomatis memantau mutasi dan akan mengirim akun/lisensi seketika setelah lunas.</i>`;

  return sendTelegramMessage(message);
}

export async function notifySupportRequest(params: {
  customerName: string;
  customerContact: string;
  messageText: string;
  channel?: string;
}): Promise<boolean> {
  const cleanPhone = params.customerContact.replace(/[^0-9]/g, '');
  const waDirectLink = `https://wa.me/${cleanPhone}`;

  const message =
    `🚨 <b>[BANTUAN CS & HUMAN TAKEOVER]</b>\n\n` +
    `Ada pembeli yang membutuhkan bantuan CS / admin:\n\n` +
    `👤 <b>Nama:</b> ${params.customerName}\n` +
    `📱 <b>Kontak:</b> <code>${params.customerContact}</code>\n` +
    `💬 <b>Pesan:</b> <i>"${params.messageText}"</i>\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `👉 <b>Tindakan Cepat:</b>\n` +
    `• <a href="${waDirectLink}">Chat Langsung Pembeli di WhatsApp</a>\n` +
    `• Bot WhatsApp otomatis menahan balasan otomatis selama 15 menit agar kamu bisa mengobrol santai dengan pembeli tanpa disela bot!`;

  return sendTelegramMessage(message);
}

export async function notifyPaymentSuccess(params: {
  orderId: string;
  amount: number | string;
  transactionId?: string | undefined;
  productName?: string | undefined;
  fulfillmentType?: string | undefined;
  fulfillmentSnippet?: string | undefined;
}): Promise<boolean> {
  const formattedAmount =
    typeof params.amount === 'number'
      ? `Rp ${params.amount.toLocaleString('id-ID')}`
      : `Rp ${params.amount}`;

  const message =
    `🎉 <b>[PEMBAYARAN DITERIMA & LUNAS]</b> ⚡\n\n` +
    `🆔 <b>ID Pesanan:</b> <code>${params.orderId}</code>\n` +
    (params.transactionId ? `🧾 <b>Tx Ref:</b> <code>${params.transactionId}</code>\n` : '') +
    `💰 <b>Total Masuk:</b> <b>${formattedAmount}</b>\n` +
    (params.productName ? `📦 <b>Produk:</b> ${params.productName}\n` : '') +
    `✅ <b>Status:</b> <b>PAID & FULFILLED</b>\n\n` +
    (params.fulfillmentSnippet
      ? `🔐 <b>Kredensial Terkirim:</b>\n<code>${params.fulfillmentSnippet}</code>\n\n`
      : '') +
    `🌟 <i>Produk digital telah otomatis diserahkan ke layar pembeli tanpa perlu kirim manual!</i>`;

  return sendTelegramMessage(message);
}
