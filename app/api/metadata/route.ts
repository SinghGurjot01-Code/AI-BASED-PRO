import { NextRequest, NextResponse } from "next/server";
import { exiftool } from "exiftool-vendored";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(req: NextRequest) {
  let dir = "";
  try {
    const form = await req.formData();
    const image = form.get("image");
    if (!(image instanceof File)) return NextResponse.json({error:"Image file is required."},{status:400});
    if (image.size > 30*1024*1024) return NextResponse.json({error:"Maximum file size is 30 MB."},{status:413});
    dir = await mkdtemp(path.join(tmpdir(),"meta-view-"));
    const ext = path.extname(image.name).replace(/[^.a-zA-Z0-9]/g,"").slice(0,12) || ".img";
    const imagePath = path.join(dir,`upload${ext}`);
    await writeFile(imagePath,Buffer.from(await image.arrayBuffer()));
    const tags:any = await exiftool.read(imagePath);
    const safe: Record<string,any> = {};
    for (const [key,value] of Object.entries(tags)) {
      if (key === "SourceFile" || key === "errors" || key === "warnings") continue;
      if (value instanceof Date) safe[key] = value.toISOString();
      else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || Array.isArray(value)) safe[key] = value;
      else if (value && typeof value === "object") safe[key] = JSON.stringify(value);
    }
    return NextResponse.json({metadata:safe,warnings:tags.errors||tags.warnings||[]});
  } catch (e:any) {
    return NextResponse.json({error:e.message || "Unable to read image metadata."},{status:422});
  } finally { if(dir) await rm(dir,{recursive:true,force:true}).catch(()=>{}); }
}
