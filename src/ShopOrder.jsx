import React, { useEffect, useState } from 'react';
import { Check, Download, Eye, Pencil, Plus, Trash2, RefreshCw, Upload } from 'lucide-react';

export const workLabels = { authorized: 'Awaiting inspection', inspection_complete: 'Inspection complete', estimate_ready: 'Estimate ready', approved: 'Approved', in_progress: 'Working', waiting_parts: 'Waiting for parts', complete: 'Ready', needs_review: 'Review legacy status' };
const dollars = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((value || 0) / 100);
const date = value => value ? new Date(value).toLocaleString() : 'Not recorded';

export function WorkOrders({ orders, staff, session, onSelect }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');
  const [mine, setMine] = useState(false);
  const filtered = orders.filter(o => `${o.customer_name} ${o.plate} ${o.vin} ${o.id}`.toLowerCase().includes(query.toLowerCase()) &&
    (filter === 'all' || filter === 'active' ? filter === 'all' || o.work_state !== 'complete' || o.payment_state !== 'paid' : filter === 'approval' ? o.pending_items > 0 : filter === 'updates' ? o.unread_updates > 0 : o.work_state === filter) && (!mine || o.assigned_to === session.id));
  return <section className="work-orders"><div className="work-toolbar">
    <label>Search<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Customer, plate, VIN, or order #" /></label>
    <label>Status<select value={filter} onChange={e => setFilter(e.target.value)}>{Object.entries({ active: 'Active visits', all: 'All visits', approval: 'Awaiting approval', updates: 'New updates', ...workLabels }).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    <label className="check-label"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} />Assigned to me</label>
  </div><div className="report-table-wrap"><table className="report-table"><thead><tr><th>Order / Customer</th><th>Vehicle</th><th>Technician</th><th>Repair</th><th>Promised</th><th>Payment / Balance</th></tr></thead><tbody>
    {filtered.map(o => <tr key={o.id}><td><button className="text-action" onClick={() => onSelect(o.id)}>#{o.id} {o.customer_name}</button>{o.unread_updates > 0 && <span className="update-badge">{o.unread_updates} new</span>}</td><td>{o.plate}<br />{[o.year,o.make,o.model].filter(Boolean).join(' ')}</td><td>{staff.find(s => s.id === o.assigned_to)?.name || 'Unassigned'}</td><td>{workLabels[o.work_state]}{o.pending_items > 0 && <small>Awaiting approval</small>}</td><td>{o.promised_at ? date(o.promised_at) : '-'}</td><td>{o.payment_state}<br />{dollars(o.balance_cents)}</td></tr>)}
  </tbody></table>{filtered.length === 0 && <p>No matching work orders.</p>}</div></section>;
}

export function BackupPanel({ api, apiBase }) {
  const [files, setFiles] = useState([]), [error, setError] = useState(''), [busy,setBusy] = useState(false);
  const load = () => api('/api/backups').then(setFiles);
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  return <section className="workspace-section"><h2>Recovery Backups</h2><p>Verified database and attachment archives. Local copies do not protect against server loss; store a downloaded copy securely offsite.</p>
    {error && <p className="form-error">{error}</p>}<button className="button primary" disabled={busy} onClick={async () => { setBusy(true);setError('');try { await api('/api/backups',{method:'POST'});await load(); } catch(e) { setError(e.message); } finally {setBusy(false);} }}><Plus size={18} />{busy ? 'Verifying backup...' : 'Create Verified Backup'}</button>
    {files.length === 0 && <p>No verified backup available.</p>}{files.map(f => <p key={f.name}><a href={`${apiBase}/api/backups/${encodeURIComponent(f.name)}`}><Download size={16} /> {f.name}</a> ({Math.ceil(f.size/1024)} KB)</p>)}
  </section>;
}

export default function ShopOrder({ order, view, session, staff, api, fileUrl, Findings, onChange, onError }) {
  const [panel,setPanel] = useState(view === 'tech' ? 'inspection' : 'estimate');
  const [busy,setBusy] = useState(false);
  const [editing,setEditing] = useState(null);
  const [chosen,setChosen] = useState([]);
  const [paymentKey,setPaymentKey] = useState(() => crypto.randomUUID());
  const isOffice = session.role !== 'SHOP_MECHANIC';
  const locked = Boolean(order.received_cents || order.paid_at);
  const hasApproved = order.estimate_items.some(i => i.decision === 'approved');
  const path = `/api/orders/${order.id}`;
  const photos = order.media.filter(m => m.kind === 'photo');
  const invoices = order.media.filter(m => m.kind === 'invoice');
  useEffect(() => { setPanel(view === 'tech' ? 'inspection' : 'estimate');setEditing(null);setChosen([]);setPaymentKey(crypto.randomUUID()); },[order.id,view]);
  async function execute(task, message) {
    if (busy) return false;
    setBusy(true);
    try { await task(); await onChange(message,order.id);return true; }
    catch(e) { onError(e.message);return false; }
    finally { setBusy(false); }
  }
  const send = (suffix, payload, method='POST') => api(path+suffix, {method,body:JSON.stringify({revision:order.revision,...payload})});
  async function upload(e,kind,findingId) {
    const input=e.target, file=input.files?.[0]; if(!file)return;
    const body=new FormData();body.append('file',file);body.append('kind',kind);if(findingId)body.append('inspection_id',findingId);
    if(await execute(() => api(path+'/upload',{method:'POST',body}),'Attachment saved.')) input.value='';
  }
  const next = order.work_state === 'needs_review' ? 'Verify the legacy repair status' : !order.estimate_items.length ? 'Inspect vehicle and prepare estimate' : order.pending_items ? 'Record customer decisions' : order.work_state !== 'complete' ? hasApproved ? 'Complete approved repairs' : 'Mark vehicle ready for pickup' : !invoices.length ? 'Upload invoice' : order.invoice_total_cents == null ? 'Verify invoice total' : order.balance_cents > 0 ? 'Record payment' : !order.paid_at ? 'Close no-charge visit' : 'Visit paid and ready';
  return <article className="shop-order">
    <header className="order-summary"><div><h2>#{order.id} {order.customer_name}</h2><p>{order.plate || 'No plate'} | {[order.year,order.make,order.model].filter(Boolean).join(' ')} | {order.mileage || '-'} miles</p></div><div className="status-pills"><span>{workLabels[order.work_state]}</span><span>{order.pending_items ? 'Approval pending' : order.approved_cents ? 'Work approved' : 'No approved work'}</span><span>{order.payment_state} | Balance {dollars(order.balance_cents)}</span></div></header>
    <div className="next-action"><strong>{next}</strong><button className="icon-action" title="Refresh ticket" aria-label="Refresh ticket" disabled={busy} onClick={() => execute(() => Promise.resolve(),'Ticket refreshed.')}><RefreshCw size={18} /></button></div>
    <details className="customer-summary"><summary>Customer, vehicle, and intake authorization</summary><p>{order.phone} | {order.email} | {order.address}</p><p>VIN {order.vin || '-'} | Ticket code {order.access_code}</p><p>Authorization recorded for {order.authorization_name}, {date(order.authorized_at)}. Diagnostic fee quoted: {dollars(order.diagnostic_fee*100)}.</p></details>
    <p className="customer-concern"><strong>Customer concern:</strong> {order.concern}</p>
    <div className="order-tabs" role="tablist" aria-label="Selected work order">{['inspection',...(isOffice?['estimate','checkout']:[]),'activity'].map(key => <button key={key} role="tab" aria-selected={key===panel} className={key===panel?'is-active':''} onClick={() => setPanel(key)}>{({inspection:'Inspection',estimate:'Estimate & Approval',checkout:'Checkout',activity:'Activity'})[key]}</button>)}</div>
    <fieldset className="order-content" disabled={busy}>
    {panel==='inspection' && <section className="workspace-section">
      {isOffice && order.unread_updates > 0 && <button className="button outline" disabled={busy} onClick={() => execute(() => send('/acknowledge',{}),'Updates reviewed.')}><Check size={18}/>Acknowledge {order.unread_updates} Updates</button>}
      {isOffice && <form className="compact-form" key={`assignment-${order.id}`} onSubmit={async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));await execute(()=>send('/assignment',{assigned_to:values.assigned_to||null,promised_at:values.promised_at?new Date(values.promised_at).toISOString():null},'PUT'),'Assignment saved.');}}>
        <label>Assigned technician<select name="assigned_to" defaultValue={order.assigned_to||''}><option value="">Unassigned</option>{staff.filter(s=>['SHOP_MECHANIC','SHOP_ADMIN'].includes(s.role)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Promised completion<input type="datetime-local" name="promised_at" defaultValue={order.promised_at ? new Date(new Date(order.promised_at).getTime()-new Date(order.promised_at).getTimezoneOffset()*60000).toISOString().slice(0,16):''}/></label><button className="button outline" disabled={busy}>Save Assignment</button>
      </form>}
      {!locked && order.work_state!=='complete' && <form className="compact-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const data=Object.fromEntries(new FormData(form));if(await execute(()=>send('/inspection',data),'Finding saved.'))form.reset();}}>
        <label>Finding<textarea name="notes" required rows="3"/></label><label>Part / area<input name="required_parts" required/></label><label>Recommended work<textarea name="labor_notes" required rows="3"/></label><label>Priority<select name="urgency"><option value="attention">Attention</option><option value="urgent">Urgent</option><option value="good">Good / checked</option></select></label><button className="button primary" disabled={busy}><Plus size={18}/>Save Finding</button>
      </form>}
      <Findings inspections={order.inspections} photos={photos} onUpload={order.work_state!=='complete'&&!locked ? upload : undefined}/>
      {order.work_state!=='complete' && <div className="work-toolbar">{[['waiting_parts','Waiting for Parts'],['in_progress','Start Work'],['complete','Vehicle Ready']].map(([status,label])=><button key={status} className="button outline" disabled={busy||Boolean(order.pending_items)||(!hasApproved && !(status==='complete' && order.estimate_items.length))} onClick={()=>execute(()=>send('/status',{status},'PATCH'),label)}>{label}</button>)}</div>}
    </section>}
    {panel==='estimate' && <section className="workspace-section">
      <div className="report-table-wrap"><table className="report-table estimate-table"><thead><tr><th>Select</th><th>Part / Service</th><th>Type</th><th>Qty / Hours</th><th>Unit / Rate</th><th>Total</th><th>Decision</th><th>Actions</th></tr></thead><tbody>{order.estimate_items.map(item=><tr key={item.id}>
        <td><input aria-label={`Select ${item.description}`} type="checkbox" disabled={locked||busy} checked={chosen.includes(item.id)} onChange={e=>setChosen(e.target.checked?[...chosen,item.id]:chosen.filter(id=>id!==item.id))}/></td><td>{item.description}</td><td>{item.kind}</td><td>{item.qty}</td><td>{dollars(item.unit_price*100)}</td><td>{dollars(item.line_total_cents)}</td><td>{item.decision}</td><td><button className="icon-action" disabled={locked||busy} aria-label={`Edit ${item.description}`} title="Edit line (requires renewed approval)" onClick={()=>setEditing(item)}><Pencil size={17}/></button><button className="icon-action" disabled={locked||busy} aria-label={`Remove ${item.description}`} title="Remove line" onClick={()=>{if(window.confirm(`Remove ${item.description}?`))execute(()=>send(`/lines/${item.id}`,{},'DELETE'),'Line removed.');}}><Trash2 size={17}/></button></td>
      </tr>)}</tbody></table></div>
      {!locked && <form className="compact-form line-editor" key={`${order.id}-${editing?.id||'new'}`} onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const data=Object.fromEntries(new FormData(form));if(await execute(()=>send(editing?`/lines/${editing.id}`:'/lines',data,editing?'PUT':'POST'),'Estimate saved.')){setEditing(null);form.reset();}}}>
        <label>Description<input name="description" required defaultValue={editing?.description||''}/></label><label>Type<select name="kind" defaultValue={editing?.kind||'part'}>{['part','labor','service','fee'].map(k=><option key={k} value={k}>{k}</option>)}</select></label><label>Quantity / Hours<input name="qty" type="number" min="0.001" step="0.001" defaultValue={editing?.qty||1} required/></label><label>Unit Price / Hourly Rate<input name="unit_price" type="number" min="0" step="0.01" defaultValue={editing?.unit_price??0} required/></label><button className="button primary" disabled={busy}><Plus size={18}/>{editing?'Save Revision':'Add Line'}</button>{editing&&<button type="button" className="button outline" onClick={()=>setEditing(null)}>Cancel</button>}
      </form>}
      <div className="financial-summary">{Object.entries(order.totals).map(([kind,value])=><p key={kind}>{kind}<strong>{dollars(value)}</strong></p>)}<p>Proposed total<strong>{dollars(order.proposed_cents)}</strong></p><p>Approved work<strong>{dollars(order.approved_cents)}</strong></p><p>Diagnostic fee quoted<strong>{dollars(order.diagnostic_fee*100)}</strong></p></div>
      {!locked && order.diagnostic_fee>0 && <button className="button outline" disabled={busy||order.estimate_items.some(i=>i.description==='Diagnostic fee')} onClick={()=>execute(()=>send('/lines',{description:'Diagnostic fee',kind:'fee',qty:1,unit_price:order.diagnostic_fee}),'Diagnostic fee added for approval.')}>Add Diagnostic Fee to Estimate</button>}
      {!locked && <form className="compact-form" onSubmit={async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));if(await execute(()=>send('/decisions',{...data,item_ids:chosen}),'Customer decision recorded.'))setChosen([]);}}>
        <label>Customer confirming decision<input name="customer_name" required defaultValue={order.customer_name}/></label><label>Decision<select name="decision"><option value="approved">Approve selected work</option><option value="declined">Decline selected work</option></select></label><label>Method<select name="method"><option value="in_person">In person</option><option value="phone">Phone</option><option value="written">Written</option></select></label><label>Approval evidence / conversation note<textarea name="note" required/></label><button className="button primary" disabled={busy||chosen.length===0}><Check size={18}/>Record Decision ({chosen.length})</button>
      </form>}
      {order.approvals.map(a=>{const snapshot=JSON.parse(a.snapshot);return <details key={a.id}><summary>{a.customer_name} | {a.method.replaceAll('_',' ')} | {date(a.created_at)}</summary><p>{a.note}</p><strong>{snapshot.decision}</strong><ul>{snapshot.lines.map(i=><li key={i.id}>{i.description} | {i.qty} x {dollars(i.unit_price*100)} = {dollars(i.line_total_cents)}</li>)}</ul></details>;})}
    </section>}
    {panel==='checkout' && <section className="workspace-section">
      <div className="financial-summary"><p>Approved work<strong>{dollars(order.approved_cents)}</strong></p><p>Verified invoice<strong>{order.invoice_total_cents==null?'Not verified':dollars(order.invoice_total_cents)}</strong></p><p>Received<strong>{dollars(order.received_cents)}</strong></p><p>Balance<strong>{dollars(order.balance_cents)}</strong></p></div>
      {!locked && <label className="file-button"><Upload size={18}/>Upload Invoice<input type="file" accept=".pdf,image/*" disabled={busy} onChange={e=>upload(e,'invoice')}/></label>}
      {invoices.map((invoice,index)=><div className="invoice-entry" key={invoice.id}><strong>{invoice.original_name}{index===0?' (latest)':''}</strong><a className="button outline" href={fileUrl(invoice.stored_path)} target="_blank" rel="noreferrer"><Eye size={18}/>View</a><a className="button outline" href={`${fileUrl(invoice.stored_path)}?download=true`}><Download size={18}/>Download</a></div>)}
      {invoices[0]&&/\.pdf$/i.test(invoices[0].original_name)&&<iframe className="invoice-preview" title="Latest uploaded invoice" src={fileUrl(invoices[0].stored_path)}/>}
      {!locked&&invoices.length>0&&<form className="compact-form" onSubmit={e=>{e.preventDefault();execute(()=>send('/invoice-total',Object.fromEntries(new FormData(e.currentTarget)),'PUT'),'Invoice total verified.');}}><label>Total on uploaded invoice<input name="amount" type="number" required min="0" step="0.01" defaultValue={(order.invoice_total_cents??order.approved_cents)/100}/></label><label>Verification note<textarea name="note" required placeholder="Include any tax, fee, or difference from approved work"/></label><button className="button primary" disabled={busy}>Verify Invoice Total</button></form>}
      {order.balance_cents>0&&order.invoice_total_cents!=null&&<form className="compact-form" onSubmit={async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));if(await execute(()=>send('/payments',{...data,request_key:paymentKey}),'Payment recorded.'))setPaymentKey(crypto.randomUUID());}}><label>Amount received<input name="amount" type="number" min="0.01" step="0.01" required max={order.balance_cents/100} defaultValue={order.balance_cents/100}/></label><label>Payment method<select name="method">{['cash','card','check','other'].map(k=><option key={k}>{k}</option>)}</select></label><label>Receipt reference<input name="reference" placeholder="No card numbers"/></label><button className="button primary" disabled={busy||order.work_state!=='complete'||Boolean(order.pending_items)}>Record Payment</button></form>}
      {order.payments.map(p=><p key={p.id}>{date(p.created_at)} | {p.method} | {dollars(p.amount_cents)} | {p.reference}</p>)}
      {order.invoice_total_cents===0&&!order.paid_at&&<button className="button primary" disabled={busy||order.work_state!=='complete'||Boolean(order.pending_items)} onClick={()=>execute(()=>send('/close-no-charge',{}),'No-charge visit closed.')}>Close No-Charge Visit</button>}
      {!order.payments.length&&order.paid_at&&<p>Recorded closeout: {dollars(order.received_cents)} | {date(order.paid_at)}</p>}
    </section>}
    {panel==='activity'&&<section className="workspace-section"><ol className="activity-list">{order.activity.map(a=><li key={a.id}><strong>{a.action}</strong><span>{a.actor_name} | {date(a.created_at)}</span><details><summary>Details</summary><pre>{JSON.stringify(JSON.parse(a.detail),null,2)}</pre></details></li>)}</ol>{!order.activity.length&&<p>No activity recorded before this upgrade.</p>}</section>}
    </fieldset>
  </article>;
}
