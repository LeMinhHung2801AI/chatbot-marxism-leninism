/**
 * Xác định người gửi tin nhắn là người dùng hay model (AI).
 */
export enum MessageAuthor {
  USER = 'user',
  MODEL = 'model',
}

/**
 * Định nghĩa cấu trúc của một tin nhắn đơn trong cuộc trò chuyện.
 */
export interface ChatMessage {
  author: MessageAuthor;
  text: string;
  timestamp?: Date;
  id?: number; // Tùy chọn: Thêm id để dễ dàng quản lý trong React
}