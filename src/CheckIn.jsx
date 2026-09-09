import React, { useEffect, useMemo, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Camera, ImagePlus, X, RotateCcw, Download, Check } from 'lucide-react';

const areas = { front:'Front', rear:'Rear', left:'Left', right:'Right', dashboard:'Dashboard / mileage', existing_damage:'Existing damage', other:'Other' };

function Signature({ padRef, disabled, onSigned }) {
  const canvas = useRef(null);
  const onSignedRef = useRef(onSigned);
  onSignedRef.current = onSigned;
  const [notice,setNotice] = useState('');
  useEffect(()=>{
    const element=canvas.current;
    const pad=new SignaturePad(element,{backgroundColor:'rgb(255,255,255)',penColor:'#172026'});
    pad.addEventListener('endStroke',()=>onSignedRef.current?.());
    padRef.current=pad;
    let width=0;
    const observer=new ResizeObserver(()=>{
      const rect=element.getBoundingClientRect();
      if(!rect.width||rect.width===width)return;
      if(!pad.isEmpty())setNotice('Signature area resized. Please sign again.');
      width=rect.width;
      const ratio=Math.min(window.devicePixelRatio||1,2);
      element.width=rect.width*ratio;element.height=rect.height*ratio;
      element.getContext('2d').scale(ratio,ratio);pad.clear();
    });
    observer.observe(element);
    return()=>{observer.disconnect();pad.off();padRef.current=null;};
  },[padRef]);
  useEffect(()=>{if(padRef.current){if(disabled)padRef.current.off();else padRef.current.on();}},[disabled,padRef]);
  return <div className="checkin-signature"><h3>Customer Signature</h3><canvas ref={canvas} aria-label="Customer signature" role="img"/>
    <button type="button" className="button outline" disabled={disabled} onClick={()=>{padRef.current.clear();setNotice('');}}><RotateCcw size={18}/>Clear / Sign Again</button>{notice&&<p role="status">{notice}</p>}</div>;
}

export default function SignedIntakeForm({ api, serviceOptions, onCreated, onError }) {
  const form=useRef(null),pad=useRef(null);
  const [terms,setTerms]=useState(null),[services,setServices]=useState(['Diagnostic']);
  const [photos,setPhotos]=useState([]),[kind,setKind]=useState('arrival'),[area,setArea]=useState('front');
  const [review,setReview]=useState(null),[accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[lookup,setLookup]=useState('');
  const [error,setError]=useState('');
  const previews=useMemo(()=>photos.map(p=>({...p,url:URL.createObjectURL(p.file)})),[photos]);
  useEffect(()=>()=>previews.forEach(p=>URL.revokeObjectURL(p.url)),[previews]);
  useEffect(()=>{api('/api/intake-terms').then(setTerms).catch(e=>setError(e.message));},[api]);
  function addPhotos(e) {
    const added=Array.from(e.target.files||[]);e.target.value='';setError('');
    const next=[...photos,...added.map(file=>({file,kind,area,caption:'',id:crypto.randomUUID()}))];
    if(next.length>10||next.some(p=>p.file.size>20*1024*1024)||next.reduce((n,p)=>n+p.file.size,0)>24*1024*1024){setError('Use up to 10 photos, 20 MB each and 24 MB total.');return;}
    if(added.some(f=>! /\.(png|jpe?g|webp|gif)$/i.test(f.name))){setError('Use JPG, PNG, WebP, or GIF photos.');return;}
    setPhotos(next);
  }
  async function lookupVehicle(type) {
    const fields=form.current.elements;
    const value=(type==='vin'?fields.vin.value:fields.plate.value).trim();
    if(!value){setLookup(`Enter the ${type==='vin'?'VIN':'plate'} first.`);return;}
    setBusy(true);
    try {
      const vehicle=await api(type==='vin'?`/api/vin/${encodeURIComponent(value)}`:`/api/plate/${encodeURIComponent(fields.plate_state.value||'NY')}/${encodeURIComponent(value)}`);
      for(const key of ['year','make','model',...(type==='vin'?[]:['vin','mileage'])])fields[key].value=vehicle[key]||'';
      setLookup('Vehicle information loaded.');
    } catch(e){setLookup(e.message);}finally{setBusy(false);}
  }
  function beginReview(e) {
    e.preventDefault();setError('');
    if(review)return;
    const values=Object.fromEntries(new FormData(form.current));
    setReview({...values,diagnostic_fee:Number(values.diagnostic_fee||0),requested_services:services,terms_version:terms.version,request_key:crypto.randomUUID()});setAccepted(false);
  }
  async function save() {
    setError('');
    if(!accepted||!pad.current||pad.current.isEmpty()){setError('The customer must accept the authorization and sign before saving.');return;}
    const body=new FormData();
    body.append('payload',JSON.stringify({...review,accepted:true}));body.append('signature',pad.current.toDataURL());body.append('request_key',review.request_key);
    body.append('metadata',JSON.stringify(photos.map(({kind,area,caption})=>({kind,area,caption}))));photos.forEach(p=>body.append('photos',p.file));
    setBusy(true);
    try {const result=await api('/api/check-in',{method:'POST',body});form.current.reset();setPhotos([]);setServices(['Diagnostic']);setReview(null);onCreated(result);}
    catch(e){setError(e.message+' Your signature, photos, and details are still here.');onError(e.message);}
    finally{setBusy(false);}
  }
  return <form ref={form} className="signed-intake" onSubmit={beginReview}>
    <h2>New Visit</h2>
    {!review&&<fieldset disabled={busy} className="checkin-fields"><legend>Customer and Vehicle</legend>
      {['customer_name','phone','email','address','plate','plate_state','vin','year','make','model','mileage'].map(name=><label key={name}>{({customer_name:'Customer name',plate_state:'Plate state',vin:'VIN'})[name]||name[0].toUpperCase()+name.slice(1)}<input name={name} required={['customer_name','phone'].includes(name)} maxLength={300} type={name==='email'?'email':'text'} defaultValue={name==='plate_state'?'NY':''}/></label>)}
      <div className="lookup-actions"><button type="button" className="button outline" onClick={()=>lookupVehicle('plate')}>Lookup Plate</button><button type="button" className="button outline" onClick={()=>lookupVehicle('vin')}>Decode VIN</button></div>
      {lookup&&<p role="status">{lookup}</p>}
      <label className="form-wide">Customer complaint / concern<textarea name="concern" required maxLength={10000} rows={4}/></label>
      <fieldset className="form-wide checkbox-grid"><legend>Requested Services / Areas</legend>{serviceOptions.map(service=><label key={service}><input type="checkbox" checked={services.includes(service)} onChange={e=>setServices(e.target.checked?[...services,service]:services.filter(s=>s!==service))}/>{service}</label>)}</fieldset>
      <label>Diagnostic fee<input name="diagnostic_fee" type="number" required min="0" max="100000" step="0.01" defaultValue="130"/></label>
      <label>Customer signing authorization<input name="authorization_name" required maxLength={300}/></label>
    </fieldset>}
    {!review&&<fieldset className="checkin-photo-section" disabled={busy}><legend>Check-In Photos (Optional)</legend>
      <div className="arrival-checklist">{Object.entries(areas).filter(([key])=>key!=='other').map(([key,label])=><span key={key}>{photos.some(p=>p.kind==='arrival'&&p.area===key)&&<Check size={16}/>} {label}</span>)}</div>
      <div className="work-toolbar"><label>Photo category<select value={kind} onChange={e=>setKind(e.target.value)}><option value="arrival">Arrival Condition</option><option value="concern">Customer Concern</option></select></label><label>Vehicle area<select value={area} onChange={e=>setArea(e.target.value)}>{Object.entries(areas).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label className="file-button"><Camera size={20}/>Take Photo<input aria-label="Take check-in photo" type="file" capture="environment" accept="image/jpeg,image/png,image/webp,image/gif" onChange={addPhotos}/></label><label className="file-button"><ImagePlus size={20}/>Add Photos<input aria-label="Add check-in photos" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={addPhotos}/></label></div>
    </fieldset>}
    <div className="checkin-photo-grid">{previews.map(p=><figure key={p.id}><img src={p.url} alt={p.file.name}/><figcaption>{p.kind==='arrival'?'Arrival Condition':'Customer Concern'} | {areas[p.area]}</figcaption>{review?<p>{p.caption}</p>:<><label>Caption<input maxLength={500} value={p.caption} disabled={busy} onChange={e=>setPhotos(items=>items.map(item=>item.id===p.id?{...item,caption:e.target.value}:item))}/></label><button className="icon-action" type="button" disabled={busy} aria-label={`Remove ${p.file.name}`} title="Remove photo" onClick={()=>setPhotos(items=>items.filter(item=>item.id!==p.id))}><X size={18}/></button></>}</figure>)}</div>
    {review&&<section className="checkin-review"><h2>Review & Sign</h2><dl>{[['Customer',review.customer_name],['Phone',review.phone],['Email',review.email],['Address',review.address],['Vehicle',[review.year,review.make,review.model].filter(Boolean).join(' ')],['Plate',review.plate],['Plate state',review.plate_state],['VIN',review.vin],['Mileage',review.mileage],['Concern',review.concern],['Requested areas / services',review.requested_services.join(', ')],['Diagnostic fee',`$${review.diagnostic_fee.toFixed(2)}`],['Signing customer',review.authorization_name]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Not provided'}</dd></div>)}</dl>
      <h3>Inspection / Diagnostic Authorization</h3><p>{terms.text}</p><label className="checkin-accept"><input type="checkbox" checked={accepted} disabled={busy} onChange={e=>{setAccepted(e.target.checked);setError('');}}/>I have reviewed these details and agree to this authorization.</label>
      <Signature padRef={pad} disabled={busy} onSigned={()=>setError('')}/>
      <div className="work-toolbar"><button type="button" className="button outline" disabled={busy} onClick={()=>{setReview(null);setAccepted(false);setTimeout(()=>{for(const [key,value]of Object.entries(review)){if(form.current?.elements[key])form.current.elements[key].value=value;}},0);}}>Edit Details</button><button type="button" className="button primary" disabled={busy||!accepted} onClick={save}>{busy?'Saving...':'Save Signed Visit'}</button></div>
    </section>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {!review&&<button className="button primary" type="submit" disabled={busy||!terms}>Review & Sign</button>}
  </form>;
}

export function CheckInRecord({ order, fileUrl, showAuthorization=true }) {
  const photos=(order.media||[]).filter(m=>['arrival','concern'].includes(m.kind));
  if(!photos.length&&!order.authorization)return null;
  return <section className="checkin-record"><h3>Check-In Record</h3>{showAuthorization&&order.authorization&&<a className="button outline" href={`${fileUrl(order.authorization.pdf_path)}?download=true`}><Download size={18}/>Download Signed Authorization</a>}
    {['concern','arrival'].map(kind=>photos.some(p=>p.kind===kind)&&<section key={kind}><h4>{kind==='concern'?'Customer Concern Photos':'Arrival Condition Photos'}</h4><div className="checkin-photo-grid">{photos.filter(p=>p.kind===kind).map(p=><figure key={p.id}><a href={fileUrl(p.stored_path)} target="_blank" rel="noreferrer"><img loading="lazy" src={fileUrl(p.stored_path)} alt={p.caption||p.original_name}/></a><figcaption>{areas[p.area]||p.area} | {new Date(p.uploaded_at).toLocaleString()}<p>{p.caption}</p></figcaption></figure>)}</div></section>)}
  </section>;
}
