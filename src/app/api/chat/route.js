import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req) {
  try {
    const body = await req.json();
    const userMessage = body.message;

    const completion = await client.chat.completions.create({
      model: "deepseek/deepseek-chat",
      messages: [
        {
          role: "system",
          content: `
Bạn là Luna, nữ lễ tân ảo cao cấp của Luna Hotel & Resort.

Phong cách:
- Lịch sự
- Ấm áp
- Chuyên nghiệp
- Gọi khách là "Quý khách"
- Xưng là "Luna"

Thông tin khách sạn:
- 5 sao, view biển
- Phòng: Standard, Superior, Deluxe, Suite, Family, Executive
- Có hồ bơi vô cực, spa, buffet sáng, nhà hàng hải sản
- Thành viên giảm 5%-20%
- Nếu muốn đặt phòng: hướng dẫn vào mục "Phòng & Suite"

Trả lời ngắn gọn dưới 100 chữ.
`
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    const reply = completion.choices[0].message.content;

    return Response.json({ reply });

  } catch (error) {
    console.error("Lỗi AI:", error);

    return Response.json({
      reply: "Xin lỗi Quý khách, Luna đang tạm bận. Vui lòng thử lại sau ạ."
    });
  }
}