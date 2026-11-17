import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({error:"Gemini is not configured. Add GEMINI_API_KEY to your environment variables."},{status:503});
    const form = await req.formData();
    const image = form.get("image");
    if (!(image instanceof File)) return NextResponse.json({error:"Image file is required."},{status:400});
    if (image.size > 15*1024*1024) return NextResponse.json({error:"AI analysis supports images up to 15 MB."},{status:413});
    const mime = image.type || "image/jpeg";
    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const prompt = `Analyze this image and return ONLY valid JSON with this exact shape:
{"title":"short factual title","description":"detailed objective description","altText":"accessible alt text","scene":"scene or setting","mood":"visual mood, if reasonably inferable","dominantColors":["color 1","color 2"],"objects":["visible object 1"],"tags":["keyword 1","keyword 2"]}
Only describe visible content. Do not guess identity, location, camera details, date, ownership, or copyright. Use empty strings or arrays when uncertain. Tags should be useful for image search.`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({contents:[{parts:[{text:prompt},{inline_data:{mime_type:mime,data:base64}}]}],generationConfig:{responseMimeType:"application/json",temperature:0.2}})
    });
    const data:any = await response.json();
    if(!response.ok) return NextResponse.json({error:data.error?.message || "Gemini request failed."},{status:502});
    const text = data.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("") || "{}";
    return NextResponse.json({analysis:JSON.parse(text)});
  } catch(e:any) {
    return NextResponse.json({error:e.message || "AI analysis failed."},{status:500});
  }
}
