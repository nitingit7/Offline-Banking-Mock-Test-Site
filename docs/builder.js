'use strict';
const patterns = [
 {name:'Three-section prelims',parts:[['English Language',30,20],['Reasoning Ability',35,20],['Quantitative Aptitude',35,20]]},
 {name:'RRB PO-style prelims',parts:[['Reasoning Ability',40,25],['Quantitative Aptitude',40,20]]}
];
let setup = null;
function shuffle(array){const items=array.slice();for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;}
function drawQuestions(pool,n){
 const groups=new Map();for(const q of pool){if(!groups.has(q.topic))groups.set(q.topic,[]);groups.get(q.topic).push(q);}
 let queues=shuffle([...groups.values()].map(shuffle)), chosen=[];
 while(chosen.length<n&&queues.length){for(const bucket of queues){if(chosen.length===n)break;chosen.push(bucket.pop());}queues=queues.filter(bucket=>bucket.length);}
 // Keep questions using a shared passage together, in their original order.
 const shared=new Map();for(const q of chosen){const key=q.passage||q.groupImage||q;const group=shared.get(key)||[];group.push(q);shared.set(key,group);}
 return [...shared.values()].flatMap(group=>group.sort((a,b)=>pool.indexOf(a)-pool.indexOf(b)));
}
function startTest(test,kind){
 const validation=Validator.validate(test);
 if(!validation.valid)throw Error(validation.errors.slice(0,2).join(' '));
 const active=Storage.loadActiveAttempt();if(active&&!active.submitted&&!window.confirm('Starting this test replaces your unfinished attempt. Continue?'))return;
 const data=Validator.normalise(test);data.meta.practiceMode=kind;
 data.sections.forEach(s=>{s.cutoff=0;s._cutoffScaled=false;});
 if(!Storage.saveTestData(data))throw Error('Your browser could not save this test. Free some device storage and try again.');
 Storage.clearActiveAttempt();location.href='exam.html';
}
function mockTest(title,sections,kind,examName='Banking prelims practice'){
 let id=0;const total=sections.reduce((n,s)=>n+s.durationMinutes,0);
 return {meta:{testName:title,examName,testType:sections.length===1?'sectional':'full',sectionTimed:sections.length>1,durationMinutes:total,marksPerQuestion:1,negativeMarking:.25,practiceMode:kind},sections:sections.map(s=>({...s,cutoff:0,questions:s.questions.map(q=>({...q,id:++id}))}))};
}
const speedTopics = ['Simplification','Approximation','Missing number series','Wrong number series','Quadratic equations'];
function drillPanel(){
 const quantitative=bank.filter(q=>q.section==='Quantitative Aptitude');
 const arithmetic=[...new Set(quantitative.map(q=>q.topic))].filter(t=>!speedTopics.includes(t)).sort();
 const tags=items=>'<div class="choices">'+items.map(t=>'<label class="choice"><input type="checkbox" name="topic" value="'+esc(t)+'"'+(speedTopics.includes(t)?' checked':'')+'><span>'+esc(t)+'</span></label>').join('')+'</div>';
 return '<fieldset class="topic-picker"><legend>Drill topics</legend><div class="speed-set"><div class="group-label">'+icon('bolt')+' Speed maths</div>'+tags(speedTopics.filter(t=>allTopics.includes(t)))+'</div>'+
 '<details class="topic-fold"><summary>Arithmetic & data interpretation</summary>'+tags(arithmetic)+'</details>'+
 sections.filter(s=>s!=='Quantitative Aptitude').map(s=>'<details class="topic-fold"><summary>'+esc(s)+'</summary>'+tags([...new Set(bank.filter(q=>q.section===s).map(q=>q.topic))].sort())+'</details>').join('')+
 '<button type="button" class="text-btn" data-clear-topics>Clear selection</button></fieldset>'+numberFields(10,5)+
 '<small class="fine">Each selected topic appears at least once.</small>';
}

function configure(kind,section=null,paper=null){
 if(kind==='pyp'&&paper==null){location.hash='papers';return;}
 setup={kind,section:section||sections.find(x=>x==='Quantitative Aptitude')||sections[0],paper,template:0};
 const title=kind==='pyp'?'Paper details':({drill:'Create a speed drill',sectional:'Configure a sectional mock',full:'Configure a full mock'})[kind];
 dialog.innerHTML='<form id="setup-form"><div class="dialog-head">'+modeIcon(kind)+'<h2 id="dialog-title">'+title+'</h2><button type="button" class="close-btn" aria-label="Close" data-close>'+icon('close')+'</button></div><div id="setup-body" class="dialog-body"></div><div class="dialog-foot"><small id="availability"></small><button type="submit" class="primary">'+icon('play')+' Open test instructions</button></div></form>';
 const body=dialog.querySelector('#setup-body');
 if(kind==='drill'){
  body.innerHTML=drillPanel();
  body.querySelector('[data-clear-topics]').onclick=()=>{body.querySelectorAll('[name=topic]').forEach(el=>el.checked=false);updateSetup();};
 } else if(kind==='sectional'){
  body.innerHTML='<label class="field">Section<select id="pick-section">'+sections.map(s=>'<option'+(s===setup.section?' selected':'')+'>'+esc(s)+'</option>').join('')+'</select></label>'+numberFields(30,20);
 } else if(kind==='full'){
  body.innerHTML='<label class="field">Practice format<select id="pattern">'+patterns.map((p,i)=>'<option value="'+i+'">'+p.name+'</option>').join('')+'</select></label><div id="pattern-details"></div><p class="fine">Each section has its own timer. A fresh set of questions is drawn for each mock.</p>';
 } else {
  const p=papers[paper];body.innerHTML='<h3>'+esc(p.meta.testName)+'</h3>'+p.sections.map(s=>'<div class="list-row"><b>'+esc(s.name)+'</b><span>'+s.questions.length+' questions</span></div>').join('')+'<p class="fine">'+(p.meta.sectionTimed?'Section timers':'One shared timer')+' · '+p.meta.durationMinutes+' minutes</p><p class="fine">Source · '+esc(p.meta.source||'Your previous-year paper collection')+'</p>';
 }
 body.insertAdjacentHTML('beforeend','<p class="err" role="alert" id="setup-error"></p>');
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.querySelector('form').oninput=()=>{dialog.querySelector('#setup-error').textContent='';updateSetup();};
 dialog.querySelector('form').onsubmit=e=>{e.preventDefault();try{launchSetup();}catch(ex){dialog.querySelector('#setup-error').textContent=ex.message;}};
 updateSetup();dialog.showModal();
}
function numberFields(n,m){return '<div class="fields2"><label class="field">Questions<input id="q-count" type="number" min="1" max="500" step="1" required value="'+n+'"></label><label class="field">Time (minutes)<input id="q-mins" type="number" min="1" max="300" step="1" required value="'+m+'"></label></div>';}
function selectedTopics(){return [...dialog.querySelectorAll('[name=topic]:checked')].map(el=>el.value);}
function poolForSetup(){if(setup.kind==='sectional')return bank.filter(q=>q.section===dialog.querySelector('#pick-section').value);const topics=new Set(selectedTopics());return bank.filter(q=>topics.has(q.topic));}
function updateSetup(){const foot=dialog.querySelector('#availability');
 if(setup.kind==='full'){const p=patterns[Number(dialog.querySelector('#pattern').value)];
 dialog.querySelector('#pattern-details').innerHTML=p.parts.map(([s,n,m])=>'<div class="list-row"><strong>'+s+'</strong><span>'+n+' Q · '+m+' min</span></div>').join('');
 foot.textContent=p.parts.reduce((v,a)=>v+a[1],0)+' questions · '+p.parts.reduce((v,a)=>v+a[2],0)+' minutes';
 }else if(setup.kind==='pyp'){const p=papers[setup.paper];foot.textContent=count(p)+' questions · '+p.meta.durationMinutes+' minutes';}
 else{const pool=poolForSetup();foot.textContent=pool.length+' questions available';}
}
function launchSetup(){const {kind}=setup;
 if(kind==='pyp'){const p=papers[setup.paper];startTest(p,kind);return;}
 if(kind==='full'){const p=patterns[Number(dialog.querySelector('#pattern').value)], assembled=p.parts.map(([name,n,durationMinutes])=>{const pool=bank.filter(q=>q.section===name);if(pool.length<n)throw Error('This test needs '+n+' questions in '+name+'.');return {name,durationMinutes,questions:drawQuestions(pool,n)};});
 startTest(mockTest(p.name,assembled,kind),kind);return;}
 const topics=selectedTopics(),pool=poolForSetup(), n=Number(dialog.querySelector('#q-count').value),durationMinutes=Number(dialog.querySelector('#q-mins').value);
 if(kind==='drill'&&!topics.length)throw Error('Choose at least one topic for this drill.');
 if(n<topics.length)throw Error('Choose at least '+topics.length+' questions to include every selected topic.');
 if(n>pool.length)throw Error('Your selection has '+pool.length+' questions. Reduce the count or choose more topics.');
 const section=kind==='drill'?'Speed drill':dialog.querySelector('#pick-section').value;
 const isSpeedMix=topics.length===speedTopics.length && speedTopics.every(t=>topics.includes(t));
 const title=kind==='drill'?(isSpeedMix?'Speed maths mix':'Drill · '+topics.join(' + ')):section+' sectional';
 startTest(mockTest(title+' · '+n+'Q / '+durationMinutes+' min',[{name:section,durationMinutes,questions:drawQuestions(pool,n)}],kind),kind);
}
function exportCsv(){
 const lines=[['Test','Mode','Submitted','Score','Maximum marks','Correct','Wrong','Unattempted','Time (seconds)'],...filtered().map(a=>[a.testName,modes[getMode(a)].name,new Date(a.submittedAt).toISOString(),a.totalScore,a.totalMarks,a.totalCorrect,a.totalWrong,a.totalUnattempted,a.totalTime])];
 const data=lines.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+data],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='practice-desk-attempts.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
main.addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;if(btn.dataset.mode)configure(btn.dataset.mode);else if(btn.dataset.section)configure('sectional',btn.dataset.section);else if(btn.hasAttribute('data-paper'))configure('pyp',null,Number(btn.dataset.paper));else if(btn.hasAttribute('data-export'))exportCsv();});
main.addEventListener('change',e=>{switch(e.target.dataset.filter){case 'mode':modeFilter=e.target.value;testFilter='';topicFilter='';break;case 'test':testFilter=e.target.value;topicFilter='';break;case 'topic':topicFilter=e.target.value;break;case 'year':yearFilter=e.target.value;break;default:return;}render();});
dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
Storage.ready.then(()=>{window.addEventListener('hashchange',go);go();});

