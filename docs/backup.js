'use strict';
// A backup contains answers and references to the bundled bank. Review screens
// rebuild question text and marking schemes from the locally installed catalog.
function identity(q){return JSON.stringify([q.source,q.question,q.passage||'',q.groupImage||'',q.options]);}
function compactAttempt(a){
 const state=a.state, test=state.testData;
 return {
  id:a.attemptId,mode:getMode(a),title:test.meta.testName,exam:test.meta.examName,paper:getMode(a)==='pyp'?test.meta.testId:null,
  minutes:test.meta.durationMinutes,timed:test.meta.sectionTimed,started:a.startedAt,ended:a.submittedAt,
  sections:test.sections.map((s,si)=>({name:s.name,minutes:s.durationMinutes,items:s.questions.map((q,qi)=>{
   const answer=state.questions.find(st=>st.sectionIndex===si&&st.questionIndex===qi);
   return {ref:getMode(a)==='pyp'?q.id:identity(q),id:q.id,choice:answer.selectedOption,status:answer.status,seconds:answer.timeSpent};
  })})),
  reviewRounds:(a.reattempts||[]).map(r=>({name:r.name,correct:r.totalCorrect,wrong:r.totalWrong,seconds:r.totalTimeSeconds??r.totalTime??0,score:r.score,improved:r.questionsImproved}))
 };
}
function saveBackup(){
 const all=Storage.loadAttempts().map(compactAttempt);
 const url=URL.createObjectURL(new Blob([JSON.stringify({format:'practice-desk-history',version:1,attempts:all})],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='practice-desk-history-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function restoreRecord(item,known){
 const bad=()=>{throw Error('An attempt in this file is invalid or uses questions from a different edition of the bank.');};
 function number(v,min,max){if(!Number.isFinite(v)||v<min||v>max)bad();return v;}
 function label(v){if(typeof v!=='string'||!v.length||v.length>1500||/[<>"\u0000-\u001f]/.test(v))bad();return v;}
 if(!/^attempt_\d{10,16}_[a-z0-9]{1,12}$/.test(item.id)||!kinds.includes(item.mode))bad();
 const original=item.paper?papers.find(p=>p.meta.testId===item.paper):null;
 if(item.mode==='pyp'&&!original)bad();
 if(!Array.isArray(item.sections)||item.sections.length<1||item.sections.length>8)bad();
 const answers=[],ids=new Set();
 const sections=item.sections.map((s,si)=>{
  if(!Array.isArray(s.items)||!s.items.length||s.items.length>1000)bad();
  return {name:label(s.name),durationMinutes:number(s.minutes,0.1,1440),cutoff:0,questions:s.items.map((a,qi)=>{
   const found=original?original.sections.flatMap(v=>v.questions).find(q=>q.id===a.ref):known.get(a.ref);
   if(!found||!Number.isInteger(a.id)||ids.has(a.id))bad();ids.add(a.id);
   if(!['answered','answered-marked','not-answered','marked','not-visited'].includes(a.status))bad();
   if(a.choice!==null&&(!Number.isInteger(a.choice)||a.choice<1||a.choice>found.options.length))bad();
   if((a.status==='answered'||a.status==='answered-marked')&&a.choice===null)bad();
   answers.push({sectionIndex:si,questionIndex:qi,questionId:a.id,selectedOption:a.choice,status:a.status,timeSpent:number(a.seconds,0,100000000),lastVisitedAt:null});return {...found,id:a.id};
  })};
 });
 const test=Validator.normalise({meta:{examName:label(item.exam),testName:label(item.title),practiceMode:item.mode,testType:sections.length===1?'sectional':'full',sectionTimed:item.timed===true,durationMinutes:number(item.minutes,0.1,1440),marksPerQuestion:1,negativeMarking:.25,...(original?{testId:original.meta.testId}:{})},sections});
 const started=number(item.started,0,8640000000000000),ended=number(item.ended,started,8640000000000000);
 const state={...State.buildFreshState(test,'Candidate',''),questions:answers,attemptId:item.id,startedAt:started,submitTime:ended,submitted:true};
 const rounds=item.reviewRounds||[];if(!Array.isArray(rounds)||rounds.length>1000)bad();
 const reattempts=rounds.map(r=>({name:label(r.name),totalCorrect:number(r.correct,0,10000),totalWrong:number(r.wrong,0,10000),totalTime:number(r.seconds,0,100000000),score:number(r.score??0,-10000,10000),questionsImproved:number(r.improved??0,0,10000)}));
 return {...State.calculateResults(state),testName:test.meta.testName,examName:test.meta.examName,state,testData:test,reattempts};
}
async function importBackup(file){
 if(!file)return;
 const msg=document.querySelector('#backup-status');
 try{
  const payload=JSON.parse(await file.text());
  if(payload.format!=='practice-desk-history'||payload.version!==1||!Array.isArray(payload.attempts))throw Error('Choose a Practice Desk history backup (.json).');
  const known=new Map(bank.map(q=>[identity(q),q]));
  const fresh=payload.attempts.filter(a=>!Storage.getAttemptById(a.id)).map(a=>restoreRecord(a,known));
  for(const record of fresh)await Storage.saveCompletedAttempt(record);
  render();document.querySelector('#backup-status').textContent=fresh.length+' attempt'+(fresh.length===1?'':'s')+' restored. Existing attempts were kept.';
 }catch(err){msg.textContent=err instanceof SyntaxError?'This file is not a valid JSON backup.':err.message;}
}
function backupPanel(){
 return '<section class="panel"><h2>Move your history</h2><p>Keep a copy of your completed attempts, or restore them when you switch browsers or move to GitHub Pages.</p><div class="backup-actions">'+(attempts.length?'<button class="secondary" data-backup>Download backup</button>':'')+'<button class="secondary" data-import>Restore backup</button><input hidden id="backup-file" type="file" accept=".json,application/json"></div><p id="backup-status" role="status"></p></section>';
}
main.addEventListener('click',e=>{if(e.target.closest('[data-backup]'))saveBackup();if(e.target.closest('[data-import]'))document.querySelector('#backup-file').click();});
main.addEventListener('change',e=>{if(e.target.id==='backup-file'){const file=e.target.files[0];e.target.value='';importBackup(file);}});

