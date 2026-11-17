import { NextRequest, NextResponse } from "next/server";
import { exiftool } from "exiftool-vendored";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
export const runtime = "nodejs";
export const maxDuration = 60;
const allowedBare = new Set([
  "Title","Description","ImageDescription","Artist","Creator","Copyright","CopyrightNotice",
  "Software","Make","Model","LensModel","DateTimeOriginal","CreateDate","ModifyDate",
  "Orientation","Rating","Label","Headline","Caption-Abstract","By-line","Credit",
  "Source","City","State","Country","Keywords","Subject","UserComment","XPTitle","XPComment",
  "GPSLatitude","GPSLatitudeRef","GPSLongitude","GPSLongitudeRef","GPSAltitude","GPSAltitudeRef","AllDates"
]);
const safeTag = (key:string) => /^[A-Za-z][A-Za-z0-9:_-]{0,100}$/.test(key) &&
  !key.startsWith("-") && !key.includes("__");
export async function POST(req: NextRequest) {
  let dir = "";
  try {
    const form = await req.formData();
    const image = form.get("image");
    const raw = form.get("metadata");
    if (!(image instanceof File) || typeof raw !== "string") return NextResponse.json({error:"Image and metadata are required."},{status:400});
    if (image.size > 30*1024*1024) return NextResponse.json({error:"Maximum file size is 30 MB."},{status:413});
    const payload = JSON.parse(raw);
    dir = await mkdtemp(path.join(tmpdir(),"meta-view-"));
    const ext = path.extname(image.name).replace(/[^.a-zA-Z0-9]/g,"").slice(0,12) || ".img";
    const imagePath = path.join(dir,`edited${ext}`);
    await writeFile(imagePath,Buffer.from(await image.arrayBuffer()));
    const writeTags:Record<string,any> = {};
    for (const field of (payload.fields || [])) {
      const key = String(field.key || "");
      const value = String(field.value ?? "");
      if (value.length > 10000) continue;
      const aiMap:Record<string,string> = {
        AI_Title:"XMP-dc:Title",
        AI_Description:"XMP-dc:Description",
        AI_AltText:"XMP-iptcCore:AltTextAccessibility"
      };
      if (aiMap[key]) { if(value.trim()) writeTags[aiMap[key]]=value; continue; }
      if (key.startsWith("AI_")) continue; // Remaining AI insights are added as searchable XMP subjects below.
      if (!safeTag(key)) continue;
      const bare = key.includes(":") ? key.split(":").pop()! : key;
      if (!allowedBare.has(bare) && !key.startsWith("XMP:") && !key.startsWith("XMP-") && !key.startsWith("IPTC:") && !key.startsWith("IPTC-") && !key.startsWith("EXIF:")) continue;
      writeTags[key] = value;
    }
    const aiSubjectTerms:string[]=[];
    for (const f of (payload.fields || [])) {
      const key=String(f.key||""); const value=String(f.value||"").trim();
      if (!value) continue;
      if (["AI_Scene","AI_Mood","AI_Colors","AI_Objects"].includes(key)) aiSubjectTerms.push(...value.split(/[,;]+/).map((v:string)=>v.trim()).filter(Boolean));
    }
    if (Array.isArray(payload.customFields) && payload.customFields.length) {
      const custom=Object.fromEntries(payload.customFields.slice(0,100).map((f:any)=>[String(f.key).slice(0,100),String(f.value).slice(0,2000)]));
      writeTags["UserComment"] = JSON.stringify(custom);
    }
    // ExifTool accepts signed decimal GPS coordinates and converts hemisphere references.
    for (const [coord, limit] of [["GPSLatitude",90],["GPSLongitude",180]] as const) {
      if (writeTags[coord] !== undefined && writeTags[coord] !== "") {
        const n = Number(writeTags[coord]);
        if (!Number.isFinite(n) || Math.abs(n) > limit) return NextResponse.json({error:`${coord} must be between ${-limit} and ${limit}.`},{status:400});
        writeTags[coord] = n;
      }
    }
    if (writeTags.GPSAltitude !== undefined && writeTags.GPSAltitude !== "") {
      const altitude = Number(writeTags.GPSAltitude);
      if (!Number.isFinite(altitude)) return NextResponse.json({error:"GPS altitude must be a valid number."},{status:400});
      writeTags.GPSAltitude = altitude;
    }
    if (Array.isArray(payload.tags)) {
      const safeTags = payload.tags.map((x:any)=>String(x).slice(0,100)).filter(Boolean).slice(0,100);
      const combined=Array.from(new Set([...safeTags,...aiSubjectTerms])).slice(0,150);
      writeTags["IPTC:Keywords"] = combined;
      writeTags["XMP-dc:Subject"] = combined;
    }
    if (payload.stripAll) {
      // Clear existing metadata first, then apply only explicitly selected fields.
      await exiftool.deleteAllTags(imagePath);
    }
    if (Object.keys(writeTags).length) {
      await exiftool.write(imagePath,writeTags);
    }
    // Re-open the result with ExifTool so the exported file is checked after writing.
    const verifiedTags:any = await exiftool.read(imagePath);
    const out = await readFile(imagePath);
    const safeName = image.name.replace(/["\\/\r\n]/g,"_");
    const expected = Object.keys(writeTags);
    const verifiedCount = expected.filter(tag => {
      const bare = tag.split(":").pop()!;
      return verifiedTags[tag] !== undefined || verifiedTags[bare] !== undefined;
    }).length;
    return new NextResponse(new Uint8Array(out), {headers:{
      "Content-Type":image.type || "application/octet-stream",
      "Content-Disposition":`attachment; filename="edited-${safeName}"`,
      "Cache-Control":"no-store",
      "X-MetaView-Verification":"readable",
      "X-MetaView-Verified-Tags":String(verifiedCount),
      "X-MetaView-Expected-Tags":String(expected.length)
    }});
  } catch (e:any) {
    return NextResponse.json({error:e.message || "Unable to write metadata for this format."},{status:422});
  } finally { if(dir) await rm(dir,{recursive:true,force:true}).catch(()=>{}); }
}
