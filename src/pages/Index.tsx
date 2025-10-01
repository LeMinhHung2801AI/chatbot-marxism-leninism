import { ChatWindow } from "@/components/ChatWindow";
import { useState } from "react";

// Trang chính bây giờ chỉ còn là một khung chứa cho ChatWindow
export default function IndexPage() {
  // Bạn vẫn có thể giữ lại state cho dark mode hoặc các cài đặt toàn cục khác nếu muốn
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    // Sử dụng Tailwind CSS để làm cho component chính chiếm toàn bộ chiều cao và chiều rộng của màn hình
    <main className="h-screen w-screen bg-background text-foreground">
      {/* 
        Giao diện giờ đây chỉ cần hiển thị duy nhất component ChatWindow.
        Mọi logic về persona, tin nhắn mở đầu... đã được chuyển vào bên trong ChatWindow.
      */}
      <ChatWindow isDarkMode={isDarkMode} />
    </main>
  );
}