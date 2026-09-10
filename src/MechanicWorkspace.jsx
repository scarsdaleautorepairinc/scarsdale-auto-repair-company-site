import React, { useEffect, useMemo, useState } from 'react';
import { CheckInRecord } from './CheckIn.jsx';
import { Camera, ImagePlus, Send, RefreshCw, X, Images, Type, Video, Play, Package, CircleCheck } from 'lucide-react';
import { VisualSelection, VisualFinding, VisualInstructions, ASLAttachments, ApprovedPart, newSelection } from './VisualParts.jsx';

const drafts = new Map();
const emptyDraft = () => ({ notes: '', required_parts: '', labor_notes: '', photos: [], video:null, visual:newSelection(), request_key: crypto.randomUUID() });

export function MechanicJobs({ orders, session, onSelect, workLabels }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');
  const jobs = orders.filter(o => `${o.plate} ${o.vin} ${o.customer_name} ${o.concern}`.toLowerCase().includes(query.toLowerCase()) &&
    (filter === 'all' || (o.work_state !== 'complete' && (filter !== 'mine' || o.assigned_to === session.id))))
    .sort((a,b) => Number(b.assigned_to === session.id) - Number(a.assigned_to === session.id));
  return <section className="mechanic-jobs"><h2>My Jobs</h2><div className="work-toolbar">
    <label>Find vehicle<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Plate, VIN, customer, or concern"/></label>
    <label>Jobs<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="active">Active jobs</option><option value="mine">Assigned to me</option><option value="all">All jobs</option></select></label>
  </div>{jobs.map(o=><button key={o.id} className="mechanic-job" onClick={()=>onSelect(o.id)}>
    <span><strong>{o.plate || 'No plate'} | #{o.id}</strong><span>{[o.year,o.make,o.model].filter(Boolean).join(' ')}</span><span>{o.customer_name}</span></span>
    <span>{o.concern}</span><span>{workLabels[o.work_state]}{o.assigned_to===session.id&&<small>Assigned to you</small>}</span>
  </button>)}{!jobs.length&&<p>No matching jobs.</p>}</section>;
}

export default function MechanicWorkspace({ order, session, api, fileUrl, onChange, workLabels }) {
  const key = `${session.id}:${order.id}`;
  const [draft,setDraft] = useState(()=>drafts.get(key)||emptyDraft());
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [visualMode,setVisualMode] = useState(()=>localStorage.getItem('shop-visual-mode')!=='text');
  useEffect(()=>{drafts.set(key,draft);},[key,draft]);
  const previews = useMemo(()=>draft.photos.map(file=>({file,url:URL.createObjectURL(file)})),[draft.photos]);
  const videoPreview=useMemo(()=>draft.video?URL.createObjectURL(draft.video):null,[draft.video]);
  useEffect(()=>()=>{if(videoPreview)URL.revokeObjectURL(videoPreview);},[videoPreview]);
  useEffect(()=>()=>previews.forEach(p=>URL.revokeObjectURL(p.url)),[previews]);
  const edit = change => { setNotice('');setDraft(d=>({...d,...change,request_key:crypto.randomUUID()})); };
  const approved = order.estimate_items.filter(i=>i.decision==='approved');
  const closed = order.work_state==='complete'||Boolean(order.paid_at);
  function choosePhotos(e) {
    const files=[...draft.photos,...Array.from(e.target.files||[])]; e.target.value='';setError('');
    if(files.length>10 || files.some(f=>f.size>20*1024*1024) || files.reduce((n,f)=>n+f.size,draft.video?.size||0)>24*1024*1024) {setError('Use up to 10 photos, 20 MB each and 24 MB total including video.');return;}
    if(files.some(f=>! /\.(jpe?g|png|webp|gif)$/i.test(f.name))) {setError('Use JPG, PNG, WebP, or GIF photos.');return;}
    edit({photos:files});
  }
  async function sendFinding(e) {
    e.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
    const body=new FormData();
    for(const field of ['notes','required_parts','labor_notes','request_key'])body.append(field,draft[field]);
    draft.photos.forEach(file=>body.append('photos',file));
    if(visualMode)body.append('visual_selection',JSON.stringify(draft.visual));
    if(draft.video)body.append('videos',draft.video);
    try {
      await api(`/api/orders/${order.id}/findings`,{method:'POST',body});
      setDraft(emptyDraft());setNotice('Sent to office.');
      try {await onChange('',order.id);} catch {setError('Sent successfully. Refresh to load the saved finding.');}
    } catch(e) {setError(`${e.message} Your draft and photos are still here.`);}
    finally {setBusy(false);}
  }
  async function status(value) {
    setBusy(true);setError('');
    try {if(value)await api(`/api/orders/${order.id}/status`,{method:'PATCH',body:JSON.stringify({status:value,revision:order.revision})});await onChange('',order.id);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <article className="mechanic-workspace">
    <header className="mechanic-heading"><div><h2>{order.plate || 'No plate'} | #{order.id}</h2><p>{[order.year,order.make,order.model].filter(Boolean).join(' ')} | {order.mileage || '-'} miles</p></div>
      <span>{workLabels[order.work_state]}</span><button className="icon-action" title="Refresh job" aria-label="Refresh job" disabled={busy} onClick={()=>status()}><RefreshCw size={20}/></button></header>
    <section className="mechanic-concern"><h3>Customer Concern</h3><p>{order.concern}</p><small>{order.customer_name} | VIN {order.vin || 'Not recorded'}</small></section>
    <CheckInRecord order={order} fileUrl={fileUrl} showAuthorization={false}/>
    <VisualInstructions order={order} api={api} fileUrl={fileUrl} onChange={onChange} onSelect={!closed&&!busy?s=>{setVisualMode(true);edit({visual:s});}:undefined}/>
    {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="form-success" role="status">{notice}</p>}
    {!closed&&<form onSubmit={sendFinding}><fieldset disabled={busy} className="mechanic-form"><legend>Add Finding</legend>
      <div className="visual-options">{[[true,'Pictures',Images],[false,'Text',Type]].map(([value,label,Icon])=><button type="button" key={label} aria-pressed={visualMode===value} onClick={()=>{setVisualMode(value);localStorage.setItem('shop-visual-mode',value?'pictures':'text');edit({});}}><Icon size={24}/>{label}</button>)}</div>
      {visualMode?<VisualSelection value={draft.visual} onChange={visual=>edit({visual})}/>:<>
      <label>What did you find?<textarea required={!draft.video} maxLength={10000} rows={5} value={draft.notes} onChange={e=>edit({notes:e.target.value})}/></label>
      <div className="mechanic-fields"><label>Parts needed<textarea maxLength={5000} rows={3} value={draft.required_parts} onChange={e=>edit({required_parts:e.target.value})}/></label>
      <label>Recommended work (optional)<textarea maxLength={5000} rows={3} value={draft.labor_notes} onChange={e=>edit({labor_notes:e.target.value})}/></label></div>
      </>}
      <div className="mechanic-photo-actions"><label className="file-button"><Camera size={22}/>Take Photo<input aria-label="Take photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" onChange={choosePhotos}/></label>
      <label className="file-button"><ImagePlus size={22}/>Add Photos<input aria-label="Add photos" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={choosePhotos}/></label><span>{draft.photos.length}/10 photos</span></div>
      <label className="file-button"><Video size={24}/>Record / Add ASL Message<input type="file" aria-label="ASL message video" accept="video/mp4,video/webm" capture="user" onChange={e=>{const video=e.target.files?.[0];e.target.value='';if(video&&video.size+draft.photos.reduce((n,f)=>n+f.size,0)>24*1024*1024){setError('Limit photos and video together to 24 MB.');return;}edit({video});}}/></label>
      {draft.video&&<p>{draft.video.name}<button type="button" className="icon-action" aria-label="Remove ASL video" onClick={()=>edit({video:null})}><X/></button></p>}
      {videoPreview&&<video className="asl-draft" src={videoPreview} controls playsInline aria-label="ASL message preview"/>}
      <div className="mechanic-photos">{previews.map((p,index)=><figure key={p.url}><img src={p.url} alt={p.file.name}/><figcaption>{p.file.name}</figcaption><button type="button" className="icon-action" aria-label={`Remove photo ${index+1}`} title="Remove photo" onClick={()=>edit({photos:draft.photos.filter((_,i)=>i!==index)})}><X size={18}/></button></figure>)}</div>
      <button className="button primary mechanic-send" type="submit"><Send size={20}/>{busy?'Sending...':'Send to Office'}</button>
    </fieldset></form>}
    <section className="mechanic-approved"><h3>Customer-Approved Work</h3>{approved.length?<div>{approved.map(i=><ApprovedPart key={i.id} item={i}/>)}</div>:<p>No approved work yet.</p>}
      {order.pending_items>0&&<p>Waiting for the office to confirm customer decisions.</p>}
      {!closed&&<div className="mechanic-photo-actions">{[['in_progress','Start Work',Play],['waiting_parts','Waiting for Parts',Package],['complete','Vehicle Ready',CircleCheck]].map(([value,label,Icon])=><button className="button outline" key={value} disabled={busy||Boolean(order.pending_items)||(!approved.length&&!(value==='complete'&&order.estimate_items.length))||order.work_state===value} onClick={()=>status(value)}><Icon size={28}/>{label}</button>)}</div>}
    </section>
    <section className="mechanic-history"><h3>Previous Findings</h3>{!order.inspections.length&&<p>No findings sent yet.</p>}
      {[...order.inspections].reverse().map((f,index)=><article className="mechanic-finding" key={f.id}><header><strong>Finding {index+1} | {f.technician}</strong><span>{f.office_reviewed?'Office reviewed':'New'}</span></header><time>{new Date(f.created_at).toLocaleString()}</time><p>{f.notes}</p>{f.required_parts&&<p><strong>Parts needed</strong><br/>{f.required_parts}</p>}{f.labor_notes&&<p><strong>Recommended work</strong><br/>{f.labor_notes}</p>}
        <VisualFinding finding={f}/><ASLAttachments media={order.media.filter(m=>m.kind==='asl_video'&&m.inspection_id===f.id)} fileUrl={fileUrl}/>
        <div className="mechanic-photos">{order.media.filter(m=>m.kind==='photo'&&m.inspection_id===f.id).map(m=><a key={m.id} href={fileUrl(m.stored_path)} target="_blank" rel="noreferrer"><img loading="lazy" src={fileUrl(m.stored_path)} alt={m.original_name}/><span>{m.original_name}</span></a>)}</div></article>)}
      {order.media.some(m=>m.kind==='photo'&&!m.inspection_id)&&<div><h4>Earlier Attachments</h4>{order.media.filter(m=>m.kind==='photo'&&!m.inspection_id).map(m=><p key={m.id}><a href={fileUrl(m.stored_path)} target="_blank" rel="noreferrer">{m.original_name}</a></p>)}</div>}
    </section>
  </article>;
}
