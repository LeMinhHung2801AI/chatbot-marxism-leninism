const express = require('express');
const cors = require('cors');
import { Request, Response } from 'express';

const { ChromaClient } = require('chromadb-client');
const { pipeline } = require('@xenova/transformers');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

interface Message {
    sender: 'user' | 'model';
    text: string;
}
interface ChatRequestBody {
    query: string;
    chatHistory: Message[];
}

// --- PROMPT HỆ THỐNG CHO CHATBOT ---
const SYSTEM_PROMPT = `
Bạn là một hướng dẫn viên triết học Mác - Lênin, có kiến thức sâu sắc và khả năng sư phạm tuyệt vời.
**Mục tiêu của bạn:** Hướng dẫn người dùng, đặc biệt là người trẻ, khám phá sự khác biệt giữa "SỐNG" (phát triển toàn diện bản thân) và "TỒN TẠI" (mưu sinh đơn thuần) qua lăng kính của triết học Mác.
**Phong cách tương tác của bạn:**
1.  **Kiến tạo & Gợi mở:** Luôn bắt đầu và dẫn dắt cuộc trò chuyện bằng những câu hỏi lớn, sâu sắc.
2.  **Phương pháp Socratic:** Thay vì trả lời trực tiếp, hãy đặt những câu hỏi dẫn dắt để người dùng tự suy ngẫm và kết nối với trải nghiệm của chính họ.
3.  **Ngắn gọn, Dễ hiểu:** Diễn giải các khái niệm phức tạp (lao động, tha hóa, bản chất con người) một cách ngắn gọn, súc tích, sử dụng ví dụ đời thường. Tránh dùng biệt ngữ học thuật quá nhiều.
4.  **Tương tác liên tục:** Sau mỗi phần giải thích ngắn (khoảng 2-3 câu), hãy kết thúc bằng một câu hỏi tương tác để kiểm tra sự hiểu biết hoặc khơi gợi suy nghĩ của người dùng.
5.  **Tích hợp Mini-Interaction:** Thỉnh thoảng, sau khi giải thích một khái niệm quan trọng, hãy tạo ra một câu hỏi trắc nghiệm nhỏ (quiz) hoặc một tình huống giả định (ví dụ: "Nếu bạn là một công nhân trong xưởng A, bạn sẽ cảm thấy thế nào?") để tăng sự tham gia.
6.  **Ghi nhớ bối cảnh:** Luôn dựa vào lịch sử trò chuyện để các câu hỏi và câu trả lời của bạn có tính liên tục, liền mạch và sâu sắc hơn.
`;

// --- CẤU HÌNH ---
const PORT = 3001;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const CHROMA_URL = 'http://localhost:8000';
const COLLECTION_NAME = 'philosophy_docs';

if (!GEMINI_API_KEY) {
    throw new Error("VITE_GEMINI_API_KEY not found in environment variables. Please check your .env.local file.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const client = new ChromaClient({ path: CHROMA_URL });

// --- SINGLETON CHO MODEL EMBEDDING ---
class EmbeddingPipelineSingleton {
    static task = 'feature-extraction';
    static model = 'Xenova/all-MiniLM-L6-v2';
    static instance: any = null;

    static async getInstance() {
        if (this.instance === null) {
            console.log("Loading local embedding model for the first time on server...");
            this.instance = await pipeline(this.task, this.model, { quantized: true });
            console.log("Local embedding model loaded successfully on server.");
        }
        return this.instance;
    }
}

// --- KHỞI TẠO SERVER API ---
const app = express();
app.use(cors());
app.use(express.json());

// --- ENDPOINT /api/chat ---
app.post('/api/chat', async (req: Request<{}, {}, ChatRequestBody>, res: Response) => {
    try {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const { query, chatHistory } = req.body;
        console.log(`Received query for Marxist Guide: "${query}"`);

        const collection = await client.getCollection({ name: COLLECTION_NAME });
        const extractor = await EmbeddingPipelineSingleton.getInstance();
        const queryEmbedding = await extractor(query, { pooling: 'mean', normalize: true });
        
        const results = await collection.query({
            queryEmbeddings: [Array.from(queryEmbedding.data)],
            nResults: 2,
        });

        const context = results.documents[0].length > 0 
            ? results.documents[0]
                .map((doc: string, i: number) => `Trích đoạn ${i + 1}:\n"${doc}"`)
                .join('\n\n---\n')
            : "Không tìm thấy thông tin liên quan trong tài liệu.";

        const historyString = chatHistory
            .map(msg => `${msg.sender === 'user' ? 'Người dùng' : 'Model'}: ${msg.text}`)
            .join('\n');

        const augmentedPrompt = `
${SYSTEM_PROMPT}

**BỐI CẢNH TỪ TÀI LIỆU (CONTEXT):**
${context}

**LỊCH SỬ TRÒ CHUYỆN (CHAT HISTORY):**
${historyString}

**CÂU HỎI / PHẢN HỒI HIỆN TẠI TỪ NGƯỜI DÙNG:**
${query}

**NHIỆM VỤ CỦA BẠN:**
Với vai trò đã được định sẵn, hãy tiếp tục cuộc đối thoại một cách tự nhiên.
`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        
        const resultStream = await model.generateContentStream(augmentedPrompt);

        for await (const chunk of resultStream.stream) {
            const chunkText = chunk.text();
            res.write(chunkText); 
        }

        console.log("Stream finished for the request.");
        res.end();

    } catch (error) {
        console.error("Error in /api/chat streaming endpoint:", error);
        res.write("\n\n[LỖI]: Đã có sự cố xảy ra phía máy chủ.");
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`Backend server is running at http://localhost:${PORT}`);
    EmbeddingPipelineSingleton.getInstance();
});