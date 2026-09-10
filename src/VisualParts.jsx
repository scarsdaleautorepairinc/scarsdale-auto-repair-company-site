import React, { useMemo, useState, useEffect } from 'react';
import { Images, Camera, Video, Send, X, Minus, Plus, Replace, ScanSearch, CircleCheck, Hand, CarFront, MapPinOff, CheckCheck } from 'lucide-react';
import catalog from './parts-catalog.json';

export const partCatalog = catalog;
export const locations = ['Not location specific','Left front','Right front','Left rear','Right rear','Front','Rear'];
export const newSelection = () => ({part_id:null,location:'Not location specific',quantity:1,action:'Inspect further'});
const groups=['Brakes / wheels','Engine / electrical','Cooling / air / fuel','Suspension / drivetrain'];
const actions=[['Replace',Replace],['Inspect further',ScanSearch],['No issue found',CircleCheck],['Need help',Hand]];

export function PartPicture({ id, small=false }) {
  const part=catalog.find(p=>p.id===Number(id));
  return part ? <img className={`part-picture ${small?'small':''}`} src={`${import.meta.env.BASE_URL}parts/${part.file}`} alt={part.name} loading="lazy"/> : <Hand className="part-picture small" aria-label="Part not listed"/>;
}

export function PartPicker({ value, onChange }) {
  const [group,setGroup]=useState(value?Math.floor((value-1)/25):0);
  return <section className="visual-catalog"><p className="part-reference-note">Illustrations only. Confirm the actual component; not for fitment or ordering.</p><div className="part-categories">{groups.map((g,i)=><button type="button" key={g} aria-pressed={group===i} onClick={()=>setGroup(i)}><PartPicture id={i*25+1} small/><span>{g}</span></button>)}</div>
    <div className="part-library">{catalog.slice(group*25,group*25+25).map(p=><button type="button" className="part-tile" key={p.id} aria-pressed={p.id===value} onClick={()=>onChange(p.id)}><PartPicture id={p.id}/><span>{p.name}</span></button>)}</div><button type="button" className="button outline" onClick={()=>onChange(null)}><Hand size={24}/>Part not listed</button>
  </section>;
}

export function VisualSelection({ value, onChange, instruction=false }) {
  const [open,setOpen]=useState(false);
  const update=patch=>onChange({...value,...patch});
  return <section className="visual-selection"><div className="visual-selected"><PartPicture id={value.part_id} small/><strong>{catalog.find(p=>p.id===value.part_id)?.name||'Part not listed'}</strong><button type="button" className="button outline" onClick={()=>setOpen(!open)}><Images size={22}/>{open?'Close parts':'Choose Part Picture'}</button></div>
    {open&&<PartPicker value={value.part_id} onChange={part_id=>{update({part_id});setOpen(false);}}/>}
    <h4>Location</h4><div className="vehicle-location"><span className="vehicle-front">Front of vehicle</span><button type="button" aria-pressed={value.location==='Left front'} onClick={()=>update({location:'Left front'})}>Left front</button><div className="vehicle-map"><CarFront size={48}/></div><button type="button" aria-pressed={value.location==='Right front'} onClick={()=>update({location:'Right front'})}>Right front</button><button type="button" aria-pressed={value.location==='Left rear'} onClick={()=>update({location:'Left rear'})}>Left rear</button><button type="button" aria-pressed={value.location==='Right rear'} onClick={()=>update({location:'Right rear'})}>Right rear</button></div>
    <div className="visual-options">{['Not location specific','Front','Rear'].map(location=><button type="button" key={location} aria-pressed={value.location===location} onClick={()=>update({location})}><MapPinOff size={18}/>{location}</button>)}</div>
    {!instruction&&<><h4>Action</h4><div className="visual-action-grid">{actions.map(([action,Icon])=><button type="button" key={action} aria-pressed={value.action===action} onClick={()=>update({action})}><Icon size={32}/>{action}</button>)}</div><h4>Quantity</h4><div className="visual-quantity"><button type="button" aria-label="Decrease part quantity" disabled={value.quantity<=1} onClick={()=>update({quantity:value.quantity-1})}><Minus/></button><output>{value.quantity}</output><button type="button" aria-label="Increase part quantity" disabled={value.quantity>=100} onClick={()=>update({quantity:value.quantity+1})}><Plus/></button></div></>}
  </section>;
}

export function VisualFinding({ finding }) {
  if(!finding.visual_selection)return null;
  let s;try{s=JSON.parse(finding.visual_selection);}catch{return null;}
  const Icon=actions.find(([a])=>a===s.action)?.[1]||Hand;
  return <div className="visual-finding"><PartPicture id={s.part_id} small/><div><strong>{catalog.find(p=>p.id===s.part_id)?.name||'Part not listed'}</strong><p>{s.location} | Qty {s.quantity}</p><span><Icon size={22}/> {s.action}</span></div></div>;
}

export function ASLAttachments({ media, fileUrl }) {
  return <div className="asl-attachments">{media.map(m=><figure key={m.id}><video controls playsInline preload="metadata" src={fileUrl(m.stored_path)} aria-label="ASL message"/><figcaption>ASL message (not automatically translated)</figcaption><a href={`${fileUrl(m.stored_path)}?download=true`}>Download video</a></figure>)}</div>;
}

export function VisualInstructions({ order, api, fileUrl, onChange, office=false, onSelect }) {
  const [selection,setSelection]=useState(newSelection),[notes,setNotes]=useState(''),[files,setFiles]=useState([]),[video,setVideo]=useState(null),[reviewed,setReviewed]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[key,setKey]=useState(()=>crypto.randomUUID());
  const [composing,setComposing]=useState(false);
  const previews=useMemo(()=>files.map(file=>URL.createObjectURL(file)),[files]);
  const videoPreview=useMemo(()=>video?URL.createObjectURL(video):null,[video]);
  useEffect(()=>()=>{if(videoPreview)URL.revokeObjectURL(videoPreview);},[videoPreview]);
  useEffect(()=>()=>previews.forEach(url=>URL.revokeObjectURL(url)),[previews]);
  const change=fn=>{fn();setKey(crypto.randomUUID());setError('');};
  async function submit(e){
    e.preventDefault();setBusy(true);setError('');setNotice('');
    const body=new FormData();body.append('selection',JSON.stringify({...selection,action:'Inspect further'}));body.append('notes',notes);body.append('request_key',key);body.append('asl_reviewed',String(reviewed));files.forEach(f=>body.append('photos',f));if(video)body.append('videos',video);
    try{await api(`/api/orders/${order.id}/visual-instructions`,{method:'POST',body});setFiles([]);setVideo(null);setReviewed(false);setNotes('');setKey(crypto.randomUUID());setComposing(false);setNotice('Inspection request sent.');await onChange('',order.id);}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  function attach(e,isVideo){const added=Array.from(e.target.files||[]);e.target.value='';const next=isVideo?files:[...files,...added];const clip=isVideo?added[0]:video;if(next.length>5||next.reduce((n,f)=>n+f.size,clip?.size||0)>24*1024*1024){setError('Use up to 5 photos and one video, 24 MB total.');return;}change(()=>{setFiles(next);setVideo(clip);if(isVideo)setReviewed(false);});}
  return <section className="visual-instructions"><h3>Visual Inspection Requests</h3>{(order.visual_instructions||[]).map(i=>{const s=JSON.parse(i.selection);const media=order.media.filter(m=>m.instruction_id===i.id);return <article key={i.id} className="visual-instruction"><VisualFinding finding={{visual_selection:i.selection}}/>{onSelect&&<button type="button" className="button outline" onClick={()=>onSelect(s)}><PartPicture id={s.part_id} small/><ScanSearch size={24}/>Report This Part</button>}<p>{i.notes}</p><small>{i.actor_name} | {new Date(i.created_at).toLocaleString()}</small><div className="mechanic-photos">{media.filter(m=>m.kind==='instruction_photo').map(m=><a key={m.id} href={fileUrl(m.stored_path)} target="_blank" rel="noreferrer"><img src={fileUrl(m.stored_path)} alt={m.original_name}/></a>)}</div><ASLAttachments media={media.filter(m=>m.kind==='asl_instruction')} fileUrl={fileUrl}/><span className="visual-status"><ScanSearch size={20}/>Inspection only</span></article>;})}
    {office&&order.work_state!=='complete'&&!order.paid_at&&<><button type="button" className="button outline" onClick={()=>setComposing(!composing)}><Images size={22}/>{composing?'Close request':'Add Visual Inspection Request'}</button>{composing&&<form onSubmit={submit}><fieldset disabled={busy} className="visual-instruction-form"><VisualSelection value={selection} onChange={s=>change(()=>setSelection(s))} instruction/><label>Office notes (optional)<textarea rows={3} value={notes} maxLength={5000} onChange={e=>change(()=>setNotes(e.target.value))}/></label><div className="mechanic-photo-actions"><label className="file-button"><Camera/>Take / Add Photos<input type="file" aria-label="Inspection request photos" accept="image/jpeg,image/png,image/webp,image/gif" multiple capture="environment" onChange={e=>attach(e,false)}/></label><label className="file-button"><Video/>ASL Instruction Video<input aria-label="ASL instruction video" type="file" accept="video/mp4,video/webm" capture="user" onChange={e=>attach(e,true)}/></label></div><div className="mechanic-photos">{previews.map((url,index)=><figure key={url}><img src={url} alt="Inspection request attachment"/><button type="button" aria-label={`Remove request photo ${index+1}`} onClick={()=>change(()=>setFiles(files.filter((_,i)=>i!==index)))}><X/></button></figure>)}</div>{video&&<div><p>{video.name}<button type="button" aria-label="Remove instruction video" onClick={()=>change(()=>setVideo(null))}><X/></button></p><label><input type="checkbox" checked={reviewed} onChange={e=>change(()=>setReviewed(e.target.checked))}/>I confirm this ASL instruction was reviewed by an ASL-fluent person.</label></div>}<button className="button primary" disabled={busy||Boolean(video&&!reviewed)}><Send/>{busy?'Sending...':'Send Inspection Request'}</button></fieldset></form>}</>}
    {composing&&videoPreview&&<video className="asl-draft" src={videoPreview} controls playsInline aria-label="ASL instruction preview"/>}
    {error&&<p role="alert" className="form-error">{error}</p>}{notice&&<p role="status" className="form-success">{notice}</p>}
  </section>;
}

export function ApprovedPart({ item }){return <div className="visual-finding">{item.part_id&&<PartPicture id={item.part_id} small/>}<div><span className="visual-status"><CheckCheck size={24}/>Customer approved</span><strong>{item.description}</strong><p>{item.part_location} | {item.qty} {item.kind==='labor'?'hours':'qty'}</p></div></div>;}
