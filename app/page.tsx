"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Aperture, ArrowDownToLine, ArrowUpFromLine, BadgeInfo, Check, ChevronDown,
  CircleHelp, Code2, Copy, Download, FileImage, FileJson, Fingerprint, FolderOpen,
  Globe2, Image as ImageIcon, Layers3, Loader2, MapPin, Moon, Pencil, Plus,
  RotateCcw, Save, Search, Settings2, ShieldCheck, Sparkles, Sun, Tag, Trash2,
  WandSparkles, X
} from "lucide-react";

type Field = { key: string; value: string; group: string; source?: "original"|"ai"|"user" };
type Snapshot = { fields: Field[]; tags: string[] };
const groups = ["Overview","EXIF","IPTC","XMP","AI insights","Custom"];
const initialAI = ["photography","visual storytelling","image composition"];

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file,setFile] = useState<File|null>(null);
  const [preview,setPreview] = useState("");
  const [metadata,setMetadata] = useState<Record<string,any>>({});
  const [fields,setFields] = useState<Field[]>([]);
  const [active,setActive] = useState("Overview");
  const [query,setQuery] = useState("");
  const [dark,setDark] = useState(true);
  const [busy,setBusy] = useState(false);
  const [aiBusy,setAiBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [tags,setTags] = useState<string[]>([]);
  const [tagInput,setTagInput] = useState("");
  const [dirty,setDirty] = useState(false);
  const [history,setHistory] = useState<Snapshot[]>([]);
  const [showRaw,setShowRaw] = useState(false);
  const [showDiff,setShowDiff] = useState(false);
  const [batch,setBatch] = useState<{name:string;size:number;type:string;fields:number;status:string}[]>([]);
  const [batchFiles,setBatchFiles] = useState<File[]>([]);
  const [stripMetadata,setStripMetadata] = useState(false);
  const [templates,setTemplates] = useState<{name:string;fields:Field[];tags:string[]}[]>([]);
  const [templateName,setTemplateName] = useState("");
  const [showTemplates,setShowTemplates] = useState(false);
  const [redoStack,setRedoStack] = useState<Snapshot[]>([]);

  useEffect(()=>{ document.documentElement.dataset.theme = dark ? "dark" : "light"; },[dark]);
  useEffect(()=>{ try { setTemplates(JSON.parse(localStorage.getItem("meta-view-templates")||"[]")); } catch {} },[]);
  useEffect(()=>()=>{ if(preview) URL.revokeObjectURL(preview); },[preview]);

  const pretty = (v:any) => {
    if (v === undefined || v === null || v === "") return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };
  const checkpoint = () => { setHistory(h=>[...h,{fields,tags}]); setRedoStack([]); };
  const setValue = (key:string,value:string) => {
    checkpoint();
    setFields(prev=>prev.some(f=>f.key===key)?prev.map(f=>f.key===key?{...f,value,source:"user"}:f):[...prev,{key,value,group:inferGroup(key),source:"user"}]);
    setDirty(true);
  };
  const upload = async (f?:File) => {
    if(!f) return;
    if(!f.type.startsWith("image/")) { setMessage("Please select a valid image file."); return; }
    if(f.size > 30*1024*1024) { setMessage("Maximum upload size is 30 MB."); return; }
    setFile(f); setPreview(URL.createObjectURL(f)); setMessage(""); setBusy(true); setDirty(false);
    try {
      const fd=new FormData(); fd.append("image",f);
      const res=await fetch("/api/metadata",{method:"POST",body:fd});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Could not read metadata.");
      setMetadata(data.metadata||{});
      const m=data.metadata||{};
      const next:Field[]=[
        {key:"FileName",value:f.name,group:"Overview",source:"original"},
        {key:"FileType",value:m.FileType||f.type||"Unknown",group:"Overview",source:"original"},
        {key:"FileSize",value:`${(f.size/1024/1024).toFixed(2)} MB`,group:"Overview",source:"original"},
        {key:"ImageWidth",value:pretty(m.ImageWidth),group:"Overview",source:"original"},
        {key:"ImageHeight",value:pretty(m.ImageHeight),group:"Overview",source:"original"},
        {key:"MIMEType",value:pretty(m.MIMEType),group:"Overview",source:"original"},
        ...Object.entries(m).filter(([k,v])=>!["SourceFile","FileName","FileType","FileSize","ImageWidth","ImageHeight","MIMEType","Error","Warning"].includes(k)&&v!==undefined&&v!==null&&typeof v!=="object")
          .map(([k,v])=>({key:k,value:String(v),group: inferGroup(k),source:"original" as const}))
      ];
      setFields(next);
      setTags(Array.isArray(m.Subject)?m.Subject.map(String):Array.isArray(m.Keywords)?m.Keywords.map(String):[]);
      setActive("Overview");
      setMessage(`Loaded ${next.length} metadata fields.`);
    } catch(e:any) { setMessage(e.message); setFields([]); }
    finally { setBusy(false); }
  };
  const inferGroup=(k:string)=> {
    if(/GPS|Latitude|Longitude|Altitude/i.test(k)) return "EXIF";
    if(/IPTC|By-line|Caption|Keywords|Headline|Copyright/i.test(k)) return "IPTC";
    if(/XMP|CreatorTool|Rating|Label|Subject/i.test(k)) return "XMP";
    return "EXIF";
  };
  const undo=()=>{ if(!history.length)return; setRedoStack(r=>[...r,{fields,tags}]); const previous=history[history.length-1]; setFields(previous.fields); setTags(previous.tags); setHistory(h=>h.slice(0,-1)); setDirty(true); };
  const redo=()=>{ if(!redoStack.length)return; setHistory(h=>[...h,{fields,tags}]); const next=redoStack[redoStack.length-1]; setFields(next.fields); setTags(next.tags); setRedoStack(r=>r.slice(0,-1)); setDirty(true); };
  const saveTemplate=()=>{ const name=templateName.trim()||prompt("Template name"); if(!name)return; const next=[...templates,{name,fields:fields.filter(f=>f.group!=="Overview"&&f.group!=="AI insights"),tags}]; setTemplates(next); localStorage.setItem("meta-view-templates",JSON.stringify(next)); setTemplateName(""); setShowTemplates(false); setMessage("Metadata template saved in this browser."); };
  const applyTemplate=(t:{name:string;fields:Field[];tags:string[]})=>{checkpoint();setFields(p=>[...p.filter(f=>f.group==="Overview"||f.group==="AI insights"),...t.fields]);setTags(t.tags);setDirty(true);setShowTemplates(false);};
  const inspectBatch=async(list:FileList|null)=>{ if(!list)return; const chosen=Array.from(list).slice(0,25); setBatchFiles(chosen); const rows=[] as {name:string;size:number;type:string;fields:number;status:string}[]; for(const f of chosen){ if(!f.type.startsWith("image/"))continue; try{const fd=new FormData();fd.append("image",f);const r=await fetch("/api/metadata",{method:"POST",body:fd});const d=await r.json();rows.push({name:f.name,size:f.size,type:f.type,fields:Object.keys(d.metadata||{}).length,status:r.ok?"Ready":(d.error||"Failed")});}catch{rows.push({name:f.name,size:f.size,type:f.type,fields:0,status:"Failed"});} } setBatch(rows);setMessage(`Batch scan complete: ${rows.filter(x=>x.status==="Ready").length} of ${rows.length} images inspected.`); };
  const exportBatch=async()=>{ if(!batchFiles.length)return; setBusy(true); setMessage("Applying current metadata to batch…"); let done=0; try { for(const f of batchFiles){ const fd=new FormData(); fd.append("image",f); fd.append("metadata",JSON.stringify({fields:fields.filter(x=>x.group!=="Overview").map(x=>({key:x.key,value:x.value})),customFields:fields.filter(x=>x.group==="Custom").map(x=>({key:x.key,value:x.value})),tags,stripAll:stripMetadata})); const r=await fetch("/api/write",{method:"POST",body:fd}); if(!r.ok)continue; const blob=await r.blob(); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`${f.name.replace(/\.[^.]+$/,"")}-edited${f.name.match(/\.[^.]+$/)?.[0]||".jpg"}`; a.click(); URL.revokeObjectURL(url); done++; await new Promise(resolve=>setTimeout(resolve,250)); } setMessage(`Batch export complete: ${done} of ${batchFiles.length} images exported.`); } catch(e:any){setMessage(e.message||"Batch export failed.");} finally{setBusy(false);} };
  const addField=()=>{ const key=prompt("Metadata field name"); if(!key?.trim()) return; if(fields.some(f=>f.key===key)) return setMessage("That field already exists."); checkpoint(); setFields(p=>[...p,{key:key.trim(),value:"",group:"Custom",source:"user"}]); setDirty(true); };
  const removeField=(key:string)=>{ checkpoint(); setFields(p=>p.filter(f=>f.key!==key)); setDirty(true); };
  const addTag=()=>{ const t=tagInput.trim(); if(t&&!tags.includes(t)){checkpoint();setTags(p=>[...p,t]);setDirty(true);} setTagInput(""); };
  const changeTags=(next:string[])=>{ checkpoint(); setTags(next); setDirty(true); };
  const updateGps=(key:string,value:string)=>setValue(key,value);
  const analyze=async()=>{
    if(!file) return;
    setAiBusy(true); setMessage("");
    try {
      const fd=new FormData(); fd.append("image",file);
      const r=await fetch("/api/ai",{method:"POST",body:fd}); const d=await r.json();
      if(!r.ok) throw new Error(d.error||"AI analysis failed.");
      const a=d.analysis||{};
      checkpoint();
      const aiFields:Field[]=[
        {key:"AI_Title",value:a.title||"",group:"AI insights",source:"ai"},
        {key:"AI_Description",value:a.description||"",group:"AI insights",source:"ai"},
        {key:"AI_AltText",value:a.altText||"",group:"AI insights",source:"ai"},
        {key:"AI_Scene",value:a.scene||"",group:"AI insights",source:"ai"},
        {key:"AI_Mood",value:a.mood||"",group:"AI insights",source:"ai"},
        {key:"AI_Colors",value:(a.dominantColors||[]).join(", "),group:"AI insights",source:"ai"},
        {key:"AI_Objects",value:(a.objects||[]).join(", "),group:"AI insights",source:"ai"}
      ];
      setFields(p=>[...p.filter(f=>f.group!=="AI insights"),...aiFields]);
      setTags(Array.from(new Set([...tags,...(a.tags||[])])));
      setActive("AI insights"); setDirty(true); setMessage("AI analysis added. Review and edit the results before saving.");
    } catch(e:any) { setMessage(e.message); }
    finally { setAiBusy(false); }
  };
  const saveImage=async()=>{
    if(!file) return;
    setBusy(true); setMessage("");
    try {
      const payload={fields:fields.filter(f=>f.group!=="Overview").map(f=>({key:f.key,value:f.value})),customFields:fields.filter(f=>f.group==="Custom").map(f=>({key:f.key,value:f.value})),tags};
      const fd=new FormData(); fd.append("image",file); fd.append("metadata",JSON.stringify({...payload,stripAll:stripMetadata}));
      const r=await fetch("/api/write",{method:"POST",body:fd});
      if(!r.ok){const d=await r.json();throw new Error(d.error||"Metadata write failed.");}
      const blob=await r.blob(); const url=URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url; a.download=`${file.name.replace(/\.[^.]+$/,"")}-edited${file.name.match(/\.[^.]+$/)?.[0]||".jpg"}`; a.click(); URL.revokeObjectURL(url);
      const verified=Number(r.headers.get("X-MetaView-Verified-Tags")||0);
      const expected=Number(r.headers.get("X-MetaView-Expected-Tags")||0);
      setDirty(false); setMessage(`Image exported and re-opened successfully. ${verified}/${expected} requested metadata tags were detected in verification. Check the downloaded file in another metadata reader too.`);
    } catch(e:any){setMessage(e.message);}
    finally{setBusy(false);}
  };
  const exportJSON=()=>{
    const obj={file:file?.name,exportedAt:new Date().toISOString(),metadata:Object.fromEntries(fields.map(f=>[f.key,f.value])),tags};
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="meta-view-report.json";a.click();URL.revokeObjectURL(a.href);
  };
  const visible=fields.filter(f=>(active==="Overview"?f.group==="Overview":f.group===active)&&(`${f.key} ${f.value}`).toLowerCase().includes(query.toLowerCase()));
  const count=fields.length;
  const formatInfo=(name:string)=>{const ext=name.split(".").pop()?.toLowerCase()||""; if(["jpg","jpeg","tif","tiff"].includes(ext))return "Broad EXIF, IPTC and XMP support is generally available."; if(["png","webp"].includes(ext))return "Container metadata support differs from JPEG/TIFF; some tag families may not be writable or retained."; if(["heic","heif"].includes(ext))return "Support depends on the ExifTool build and the exact HEIC/HEIF variant. Verify the exported file."; if(["gif","bmp"].includes(ext))return "Metadata writing is limited and format-dependent. Do not assume EXIF fields will be preserved."; if(["dng","cr2","cr3","nef","arw","raf","orf","rw2"].includes(ext))return "Camera RAW support is tag- and maker-note-dependent. Keep an untouched original and verify the output."; return "Unknown or less common format. ExifTool will attempt processing; verify the output manually.";};
  const validationIssues=fields.flatMap(f=>{if(!f.value.trim())return []; if(f.key.endsWith("GPSLatitude")){const n=Number(f.value);return !Number.isFinite(n)||Math.abs(n)>90?["GPS latitude must be between -90 and 90."]:[];} if(f.key.endsWith("GPSLongitude")){const n=Number(f.value);return !Number.isFinite(n)||Math.abs(n)>180?["GPS longitude must be between -180 and 180."]:[];} if(f.key.toLowerCase()==="rating"){const n=Number(f.value);return !Number.isFinite(n)||n<0||n>5?["Rating should be between 0 and 5."]:[];}return [];});
  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Fingerprint size={19}/></div><span>META<span className="brand-light">VIEW</span></span><span className="beta">STUDIO</span></div>
      <div className="top-actions"><span className="privacy"><ShieldCheck size={14}/> Temporary server processing</span><button className="icon-btn" title="Toggle theme" onClick={()=>setDark(!dark)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button><button className="avatar">MV</button></div>
    </header>
    <section className="hero">
      <div><div className="eyebrow"><Sparkles size={14}/> IMAGE METADATA WORKSPACE</div><h1>Every detail.<br/><span>Under your control.</span></h1><p>Inspect, edit and enrich image metadata — with AI assistance when you need it.</p></div>
      <div className="hero-stats"><div><strong>{file?count:"—"}</strong><span>FIELDS FOUND</span></div><div><strong>{file?tags.length:"—"}</strong><span>KEYWORDS</span></div><div><strong>{dirty?"Edited":"Ready"}</strong><span>WORKSPACE</span></div></div>
    </section>
    <section className="workspace">
      <aside className="sidebar">
        <div className="side-label">WORKSPACE</div>
        <button className={`nav-item ${!file?"selected":""}`} onClick={()=>inputRef.current?.click()}><FolderOpen size={17}/> Open image <span className="shortcut">⌘O</span></button>
        <div className="side-label section-label">METADATA</div>
        {groups.map(g=><button key={g} className={`nav-item ${active===g?"selected":""}`} onClick={()=>setActive(g)}><span className="nav-icon">{g==="Overview"?<BadgeInfo size={16}/>:g==="EXIF"?<Aperture size={16}/>:g==="IPTC"?<FileImage size={16}/>:g==="XMP"?<Code2 size={16}/>:g==="AI insights"?<Sparkles size={16}/>:<Layers3 size={16}/>}</span>{g}<span className="nav-count">{g==="Overview"&&file?fields.filter(f=>f.group===g).length:g==="AI insights"?fields.filter(f=>f.group===g).length:g==="Custom"?fields.filter(f=>f.group===g).length:""}</span></button>)}
        <div className="side-bottom"><div className="side-label">TOOLS</div><button className="nav-item" onClick={exportJSON} disabled={!file}><FileJson size={16}/> Export JSON</button><button className="nav-item" onClick={()=>setShowRaw(!showRaw)} disabled={!file}><Code2 size={16}/> {showRaw?"Hide":"View"} raw metadata</button>
        <button className="nav-item" onClick={()=>setShowDiff(!showDiff)} disabled={!file}><Pencil size={16}/> Compare changes</button><div className="privacy-card"><ShieldCheck size={17}/><div><b>Privacy by design</b><span>Images are temporarily sent to the app server for processing, then temporary files are removed.</span></div></div></div>
      </aside>
      <div className="main-panel">
        <div className="panel-head"><div><div className="panel-kicker">IMAGE / METADATA</div><h2>{file?file.name:"Start with an image"}</h2></div><div className="panel-actions"><button className="btn secondary" onClick={()=>inputRef.current?.click()}><ArrowUpFromLine size={15}/> Replace</button>
          <button className="btn secondary" onClick={undo} disabled={!history.length} title="Undo"><RotateCcw size={14}/></button>
          <button className="btn secondary" onClick={redo} disabled={!redoStack.length} title="Redo"><ArrowDownToLine size={14}/></button><button className="btn primary" onClick={saveImage} disabled={!file||busy||validationIssues.length>0}><Save size={15}/> {busy?"Processing…":"Save image"}</button></div></div>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={e=>upload(e.target.files?.[0])}/>
        <input id="batch-files" type="file" accept="image/*" multiple hidden onChange={e=>inspectBatch(e.target.files)}/>

        {batch.length>0&&<div className="batch-panel"><div className="batch-head"><b><Layers3 size={15}/> Batch inspection</b><div><button className="text-btn" onClick={exportBatch} disabled={busy||!batchFiles.length}>Apply current edits & export all</button> <button className="text-btn" onClick={()=>{setBatch([]);setBatchFiles([])}}>Clear</button></div></div><div className="batch-list">{batch.map((b,i)=><div className="batch-row" key={b.name+i}><span>{b.name}</span><small>{(b.size/1024/1024).toFixed(2)} MB · {b.fields} fields</small><em>{b.status}</em></div>)}</div></div>}
        {!file?<div className="dropzone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();upload(e.dataTransfer.files?.[0]);}} onClick={()=>inputRef.current?.click()}><div className="upload-icon"><ImageIcon size={27}/></div><h3>Drop an image to inspect</h3><p>or click to browse your files</p><div className="format-row"><span>JPG</span><span>PNG</span><span>WEBP</span><span>TIFF</span><span>HEIC*</span></div><small>Maximum 30 MB · *Format support depends on the installed ExifTool build</small></div>
        :<div className="content-grid">
          <div className="preview-column"><div className="image-preview"><img src={preview} alt="Uploaded image preview"/><div className="preview-overlay"><span><Check size={13}/> SOURCE IMAGE</span><span>{file.type||"Image"}</span></div></div>
            <div className="file-card"><div className="file-icon"><FileImage size={18}/></div><div className="file-details"><b>{file.name}</b><span>{(file.size/1024/1024).toFixed(2)} MB · {file.type||"Unknown format"}</span></div><button className="icon-btn" onClick={()=>{setFile(null);setPreview("");setFields([]);setMetadata({});setTags([]);}}><Trash2 size={16}/></button></div>
            <div className="ai-card"><div className="ai-card-head"><div className="ai-orb"><Sparkles size={16}/></div><div><b>AI image intelligence</b><span>Understand what's inside your image</span></div></div><p>Generate a title, detailed description, alt text, objects, scene, colours and searchable tags.</p><button className="btn ai-button" onClick={analyze} disabled={aiBusy}>{aiBusy?<Loader2 className="spin" size={15}/>:<WandSparkles size={15}/>} {aiBusy?"Analyzing image…":"Generate with Gemini"}</button><small>Requires GEMINI_API_KEY in your environment.</small></div>
          </div>
          <div className="editor-column">
            {showTemplates&&<div className="template-panel"><div className="batch-head"><b>Metadata templates</b><button className="text-btn" onClick={()=>setShowTemplates(false)}>Close</button></div><div className="template-save"><input value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="New template name"/><button onClick={saveTemplate}>Save current</button></div>{templates.map((t,i)=><div className="template-row" key={i}><span>{t.name}</span><button onClick={()=>applyTemplate(t)}>Apply</button><button onClick={()=>{const n=templates.filter((_,j)=>j!==i);setTemplates(n);localStorage.setItem("meta-view-templates",JSON.stringify(n));}}>Delete</button></div>)}</div>}
            <div className="editor-toolbar"><div className="tab-title">{active}<span className="field-pill">{visible.length} fields</span></div><div className="toolbar-actions"><div className="searchbox"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a field…"/></div>{active==="Custom"&&<button className="icon-btn" onClick={addField}><Plus size={17}/></button>}</div></div>
            {showRaw&&<pre className="raw-json">{JSON.stringify(metadata,null,2)}</pre>}
            {showDiff&&<div className="diff-panel"><b>Original vs current values</b>{fields.filter(f=>metadata[f.key]!==undefined&&String(metadata[f.key])!==f.value).map(f=><div className="diff-row" key={f.key}><strong>{f.key}</strong><span>Before: {String(metadata[f.key])}</span><span>After: {f.value}</span></div>)}{fields.every(f=>metadata[f.key]===undefined||String(metadata[f.key])===f.value)&&<small>No changed extracted fields detected. New custom fields and AI suggestions are not present in the original file.</small>}</div>}
            {active==="AI insights"&&<div className="ai-notice"><Sparkles size={15}/> AI-generated values are suggestions, not verified camera facts. Edit before exporting.</div>}
            <div className="field-list">
              {visible.length===0?<div className="empty-fields"><Search size={20}/><p>No fields in this section yet.</p><span>Upload an image or add custom metadata.</span></div>:visible.map((f,i)=><div className="field-row" key={f.key}><div className="field-label"><label>{f.key.replaceAll("_"," ")}</label><span className={`source ${f.source||"original"}`}>{f.source==="ai"?"AI SUGGESTED":f.source==="user"?"EDITED":"EXTRACTED"}</span></div><div className="field-input-wrap"><input value={f.value} onChange={e=>setValue(f.key,e.target.value)} placeholder="Enter a value…"/>{f.group==="Custom"&&<button className="remove-field" onClick={()=>removeField(f.key)}><Trash2 size={14}/></button>}</div></div>)}
            </div>
            <div className="gps-editor">
              <div className="gps-editor-head"><div><b><MapPin size={15}/> GPS location editor</b><span>Enter decimal coordinates. Changes are written to EXIF GPS tags on supported formats.</span></div><a href={`https://www.google.com/maps?q=${encodeURIComponent((fields.find(f=>f.key.endsWith("GPSLatitude"))?.value||"0")+","+(fields.find(f=>f.key.endsWith("GPSLongitude"))?.value||"0"))}`} target="_blank" rel="noreferrer">Preview map</a></div>
              <div className="gps-inputs"><label>Latitude<input type="number" min="-90" max="90" step="any" value={fields.find(f=>f.key.endsWith("GPSLatitude"))?.value||""} onChange={e=>updateGps("GPSLatitude",e.target.value)} placeholder="37.7749"/></label><label>Longitude<input type="number" min="-180" max="180" step="any" value={fields.find(f=>f.key.endsWith("GPSLongitude"))?.value||""} onChange={e=>updateGps("GPSLongitude",e.target.value)} placeholder="-122.4194"/></label><label>Altitude (m)<input type="number" step="any" value={fields.find(f=>f.key.endsWith("GPSAltitude"))?.value||""} onChange={e=>updateGps("GPSAltitude",e.target.value)} placeholder="Optional"/></label></div>
              {(() => { const latRaw=fields.find(f=>f.key.endsWith("GPSLatitude"))?.value||""; const lonRaw=fields.find(f=>f.key.endsWith("GPSLongitude"))?.value||""; const lat=Number(latRaw); const lon=Number(lonRaw); const valid=latRaw.trim()!==""&&lonRaw.trim()!==""&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180; return valid?<iframe className="gps-map" title="GPS location map preview" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.015},${lat-0.01},${lon+0.015},${lat+0.01}&layer=mapnik&marker=${lat},${lon}`}/>:<div className="gps-map-empty">Enter valid latitude and longitude to preview the pin on a map.</div>; })()}
              <small>GPS data is sensitive. Review it before sharing an exported image.</small>
            </div>
            <div className="format-check"><b><FileImage size={14}/> Format compatibility</b><span>{file.name.split(".").pop()?.toUpperCase()} · {formatInfo(file.name)}</span></div>
            {validationIssues.length>0&&<div className="validation-panel"><b>Metadata validation</b>{Array.from(new Set(validationIssues)).map(issue=><span key={issue}>{issue}</span>)}</div>}
            <div className="tags-section"><div className="tags-head"><div><b><Tag size={15}/> Keywords & tags</b><span>{tags.length} tags · click × to remove</span></div><button className="text-btn" onClick={()=>changeTags([])}>Clear all</button></div><div className="tag-list">{tags.map(t=><span className="tag-chip" key={t}>{t}<button onClick={()=>changeTags(tags.filter(x=>x!==t))}><X size={12}/></button></span>)}</div><div className="add-tag"><input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag()} placeholder="Add a keyword…"/><button onClick={addTag}><Plus size={15}/> Add tag</button></div></div>
            <div className="strip-option"><label><input type="checkbox" checked={stripMetadata} onChange={e=>setStripMetadata(e.target.checked)}/> Strip existing metadata on export (then write selected edits)</label></div>
            {(() => { const lat=fields.find(f=>/GPSLatitude$/i.test(f.key))?.value; const lon=fields.find(f=>/GPSLongitude$/i.test(f.key))?.value; return lat&&lon?<div className="gps-link"><MapPin size={14}/> GPS coordinates detected · <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${encodeURIComponent(lat+","+lon)}`}>Open location in map</a></div>:null; })()}
            <div className="editor-footer"><span>{dirty?<><span className="unsaved-dot"/> Unsaved changes</>:"Changes stay in this session until exported"}</span><button className="btn secondary" onClick={exportJSON}><Download size={14}/> Export report</button></div>
          </div>
        </div>}
        {message&&<div className="status-message"><span>{message}</span><button onClick={()=>setMessage("")}><X size={14}/></button></div>}
      </div>
    </section>
    <footer><span>META VIEW <span className="footer-muted">/ IMAGE METADATA STUDIO</span></span><span>Built for control, clarity and privacy.</span></footer>
  </main>;
}
