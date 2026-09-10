// Local, disposable QA database only.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const office=await browser.newPage({viewport:{width:1440,height:1000}});
  const tech=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];for(const p of [office,tech])p.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:8015',url='http://127.0.0.1:5181/customer-service';
  fs.mkdirSync('data/visual-ui',{recursive:true});
  try{
    const created=await office.request.post(base+'/api/intake',{data:{customer_name:'Visual QA',phone:'2025550100',plate:'VISUALQA',concern:'Coolant loss and brakes',authorization_name:'QA',requested_services:['Diagnostic']}});
    assert.equal(created.status(),200);const ticket=await created.json();const path=`/api/orders/${ticket.id}`;
    await office.goto(url);
    const videoBytes=await office.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=240;canvas.height=160;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#257080';ctx.fillRect(0,0,240,160);
      const stream=canvas.captureStream(10),chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});
      const finished=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=resolve;});
      recorder.start();await new Promise(r=>setTimeout(r,800));recorder.stop();await finished;stream.getTracks().forEach(t=>t.stop());
      return Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));
    });
    const videoFile={name:'qa-video.webm',mimeType:'video/webm',buffer:Buffer.from(videoBytes)};
    await office.getByRole('button',{name:`#${ticket.id} Visual QA`,exact:true}).click();
    await office.getByRole('button',{name:'Add Visual Inspection Request',exact:true}).click();
    await office.getByRole('button',{name:'Choose Part Picture',exact:true}).click();
    // Every image in the 100-part library must load at desktop size.
    for(const group of ['Brakes / wheels','Engine / electrical','Cooling / air / fuel','Suspension / drivetrain']){
      await office.getByRole('button',{name:group,exact:false}).click();
      assert.equal(await office.locator('.part-tile').count(),25);
      await office.locator('.part-tile').last().scrollIntoViewIfNeeded();
      await office.waitForFunction(()=>[...document.querySelectorAll('.part-tile img')].every(i=>i.complete&&i.naturalWidth>0));
    }
    await office.getByRole('button',{name:'Cooling / air / fuel',exact:false}).click();
    await office.locator('.part-tile').filter({hasText:'Coolant reservoir'}).click();
    await office.getByLabel('Office notes (optional)',{exact:true}).fill('Inspect coolant reservoir; customer concern.');
    await office.getByLabel('Inspection request photos').setInputFiles('public/parts/052-coolant-reservoir.jpg');
    await office.getByLabel('ASL instruction video',{exact:true}).setInputFiles(videoFile);
    assert.equal(await office.getByRole('button',{name:'Send Inspection Request',exact:true}).isDisabled(),true);
    await office.getByRole('checkbox',{name:'I confirm this ASL instruction was reviewed by an ASL-fluent person.',exact:true}).check();
    await office.getByRole('button',{name:'Send Inspection Request',exact:true}).click();
    await office.getByText('Inspection request sent.',{exact:true}).waitFor();
    await tech.route('**/api/session',r=>r.fulfill({json:{id:'local',name:'QA Mechanic',role:'SHOP_MECHANIC'}}));
    await tech.goto(url);
    await tech.getByRole('button',{name:new RegExp(`VISUALQA.*#${ticket.id}`)}).click();
    await tech.locator('.visual-instruction').waitFor();
    await tech.waitForFunction(()=>document.querySelector('.visual-instruction video')?.readyState>=1);
    await tech.getByRole('button',{name:/Report This Part/}).click();
    for(const part of ['Coolant reservoir','Brake caliper']){
      await tech.getByRole('button',{name:'Choose Part Picture',exact:true}).click();
      await tech.getByRole('button',{name:part==='Brake caliper'?'Brakes / wheels':'Cooling / air / fuel',exact:false}).click();
      await tech.locator('.part-tile').filter({hasText:new RegExp(`^${part}$`)}).click();
      await tech.getByRole('button',{name:'Replace',exact:true}).click();
      if(part==='Brake caliper')await tech.getByRole('button',{name:'Left front',exact:true}).click();
      await tech.getByLabel('Add photos',{exact:true}).setInputFiles('public/parts/001-brake-caliper.jpg');
      if(part==='Coolant reservoir')await tech.getByLabel('ASL message video',{exact:true}).setInputFiles(videoFile);
      const response=tech.waitForResponse(r=>r.url().endsWith('/findings')&&r.request().method()==='POST');
      await tech.getByRole('button',{name:'Send to Office',exact:true}).click();
      assert.equal((await response).status(),200);
      await tech.getByText('Sent to office.',{exact:true}).waitFor();
      await tech.waitForFunction(n=>document.querySelectorAll('.mechanic-finding').length===n,part==='Brake caliper'?2:1);
    }
    assert.equal(await tech.getByRole('button',{name:'Start Work',exact:true}).isDisabled(),true);
    await tech.setViewportSize({width:390,height:844});
    await tech.getByRole('button',{name:'Choose Part Picture',exact:true}).click();
    await tech.locator('.part-library').scrollIntoViewIfNeeded();
    assert.equal(await tech.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await tech.screenshot({path:'data/visual-ui/mobile.png',fullPage:true});
    await tech.getByRole('button',{name:'Close parts',exact:true}).click();
    await office.getByRole('button',{name:'Refresh ticket',exact:true}).click();
    await office.getByRole('tab',{name:'Inspection',exact:true}).last().click();
    await office.waitForFunction(()=>document.querySelectorAll('.finding-entry').length===2);
    await office.waitForFunction(()=>document.querySelector('.finding-entry video')?.readyState>=1);
    await office.getByRole('tab',{name:'Estimate & Approval',exact:true}).click();
    await office.getByRole('textbox',{name:'Description',exact:true}).fill('Replace left front brake caliper');
    await office.getByRole('button',{name:'Link Part Picture',exact:true}).click();
    await office.locator('.part-tile').filter({hasText:/^Brake caliper$/}).click();
    await office.locator('select[name=part_location]').selectOption('Left front');
    await office.getByRole('button',{name:'Add Line',exact:true}).click();
    await office.getByText('Estimate saved.',{exact:true}).waitFor();
    await office.getByRole('checkbox',{name:'Select Replace left front brake caliper',exact:true}).check();
    await office.getByRole('textbox',{name:'Approval evidence / conversation note',exact:true}).fill('Fictional approval for browser QA.');
    await office.getByRole('button',{name:'Record Decision (1)',exact:true}).click();
    await office.getByText('Customer decision recorded.',{exact:true}).waitFor();
    await tech.getByRole('button',{name:'Refresh job',exact:true}).click();
    await tech.locator('.mechanic-approved img').waitFor();
    const done=tech.waitForResponse(r=>r.url().endsWith('/status')&&r.request().method()==='PATCH');
    await tech.getByRole('button',{name:'Vehicle Ready',exact:true}).click();assert.equal((await done).status(),200);
    await office.getByRole('button',{name:'Refresh ticket',exact:true}).click();
    await office.getByRole('tab',{name:'Inspection',exact:true}).last().click();
    await office.screenshot({path:'data/visual-ui/office.png',fullPage:true});
    const record=await (await office.request.get(base+path)).json();
    assert.equal(record.inspections.length,2);assert.equal(record.visual_instructions.length,1);assert.equal(record.work_state,'complete');assert.equal(record.estimate_items[0].part_id,1);
    assert.deepEqual(errors,[]);
    console.log('PASS: 100 images, office photo instructions, no-typing multiple findings, approval-gated work, linked approved picture, completion, desktop/mobile.');
  }catch(e){await office.screenshot({path:'data/visual-ui/office-failure.png',fullPage:true});await tech.screenshot({path:'data/visual-ui/tech-failure.png',fullPage:true});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
