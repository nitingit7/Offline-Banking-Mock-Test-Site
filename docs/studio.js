'use strict';
const main = document.querySelector('#main');
const dialog = document.querySelector('#config');
const named = {overview:'Overview',practice:'Practice library',papers:'Previous papers',progress:'My progress',history:'Attempt history'};
const modes = {
  drill:{name:'Speed drill',icon:'bolt',color:'orange',desc:'Choose your topics and race the clock.'},
  sectional:{name:'Sectional mock',icon:'layers',color:'purple',desc:'Focus on one section at a time.'},
  full:{name:'Full mock',icon:'bank',color:'blue',desc:'Practise a complete prelims test.'},
  pyp:{name:'Previous papers',icon:'papers',color:'green',desc:'Sit a timed previous-year paper.'}
};
const paths = {
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  bank:'<path d="m3 9 9-6 9 6H3zm1 11h16M6 11v6m4-6v6m4-6v6m4-6v6M3 22h18"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  papers:'<rect x="6" y="5" width="13" height="16" rx="2"/><path d="M15 5V3H4a1 1 0 0 0-1 1v13m6-7h7m-7 4h7m-7 3h4"/>',
  chart:'<path d="M3 3v17h18M7 15l4-5 4 2 5-7"/>',
  history:'<path d="M3 10a9 9 0 1 1 2 8M3 5v5h5m4-3v5l3 2"/>',
  bolt:'<path d="m14 2-11 12h8l-1 8 11-13h-8l1-7z"/>',
  user:'<circle cx="12" cy="8" r="3.5"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  checks:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2m-7 9 3 3 5-6"/>',
  play:'<path d="m8 4 12 8-12 8V4z"/>',close:'<path d="m6 6 12 12m0-12L6 18"/>',book:'<path d="M3 5q4-2 9 1 5-3 9-1v15q-5-2-9 0-4-2-9 0V5zm9 1v14"/>',
  trend:'<path d="m2 17 7-7 4 4 8-9m-6 0h6v6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>'
};
const icon = key => '<svg class="ico" aria-hidden="true" viewBox="0 0 24 24">'+(paths[key]||'')+'</svg>';
const esc = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const bank = [...(window.CORE_BANK||[]),...(window.TOPIC_BANK||[])];
const papers = window.PAPERS||[];
const seconds = s => s>=3600 ? Math.floor(s/3600)+'h '+Math.round(s%3600/60)+'m' : s>=60 ? Math.floor(s/60)+'m '+Math.floor(s%60)+'s' : Math.floor(s||0)+'s';
const dateFmt = new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric'});
const pct = (n,d) => d ? Math.round(n/d*100) : null;
const per = n => n==null?'—':n+'%';
const delta = (a,b) => a==null||b==null?'—':(a-b>0?'+':'')+(a-b)+' pp';
const sections = [...new Set(bank.map(q=>q.section))];
const allTopics = [...new Set(bank.map(q=>q.topic))].sort();
const kinds = Object.keys(modes);
const count = t => t.sections.reduce((sum,s)=>sum+s.questions.length,0);
const getMode = a => a.testData?.meta?.practiceMode || a.state?.testData?.meta?.practiceMode || (a.sectionResults?.length>1?'full':'sectional');
const modeIcon = kind => '<span class="iconbox '+modes[kind].color+'">'+icon(modes[kind].icon)+'</span>';
const box = (key,color) => '<span class="mini-icon '+color+'">'+icon(key)+'</span>';
const heading = (title,sub) => '<div class="heading"><h1>'+title+'</h1><p>'+sub+'</p></div>';
const empty = (key,title,sub) => '<div class="empty">'+box(key,'')+'<div><strong>'+title+'</strong><p>'+sub+'</p></div></div>';
let attempts = [], page = 'overview', modeFilter='', topicFilter='', testFilter='', yearFilter='';
function closeMenu(){document.querySelector('#sidebar').classList.remove('open');document.querySelector('#shade').hidden=true;document.querySelector('#menu').setAttribute('aria-expanded','false');}
document.querySelector('#menu').onclick=()=>{document.querySelector('#sidebar').classList.add('open');document.querySelector('#shade').hidden=false;document.querySelector('#menu').setAttribute('aria-expanded','true');};
document.querySelector('#shade').onclick=closeMenu;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
document.querySelectorAll('[data-icon]').forEach(el=>el.insertAdjacentHTML('afterbegin',icon(el.dataset.icon)));
document.querySelector('#today').innerHTML=icon('calendar')+new Intl.DateTimeFormat('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date());
function go(){page=location.hash.slice(1);if(!Object.hasOwn(named,page))page='overview';closeMenu();dialog.close();document.querySelector('#current').textContent=named[page];document.title=named[page]+' · Practice Desk';document.querySelectorAll('nav a').forEach(a=>{if(a.hash==='#'+page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});render();window.scrollTo(0,0);}
function render(){attempts=Storage.loadAttempts();main.innerHTML=({overview,practice,papers:paperPage,progress,history})[page]();}
function modeCards(){return '<div class="mode-grid">'+kinds.map(k=>'<button class="mode-card" data-mode="'+k+'">'+modeIcon(k)+'<h3>'+modes[k].name+'</h3><p>'+modes[k].desc+'</p></button>').join('')+'</div>';}
function stats(rows){
  const attempted=rows.reduce((a,b)=>a+b.totalAttempted,0), correct=rows.reduce((a,b)=>a+b.totalCorrect,0), time=rows.reduce((a,b)=>a+b.totalTime,0);
  const metrics=[['checks','green',rows.length,'Tests completed'],['target','purple',per(pct(correct,attempted)),'Overall accuracy'],['clock','orange',time?seconds(time):'0m','Practice time']];
  return '<div class="metrics">'+metrics.map(([key,color,value,label])=>'<div class="metric">'+box(key,color)+'<div><div class="metric-value">'+value+'</div><small>'+label+'</small></div></div>').join('')+'</div>';
}
function resume(){const a=Storage.loadActiveAttempt();return a&&!a.submitted?'<div class="resume"><span><strong>Test in progress</strong><br><small>'+esc(a.testData?.meta?.testName)+'</small></span><a class="secondary" href="exam.html">Resume test</a></div>':'';}
function overview(){return heading('Preparation overview','Your banking exam practice, scores and progress in one place.')+resume()+
  '<section class="hero"><div class="hero-copy"><span class="overline">'+icon('bolt')+' 10 QUESTIONS · 5 MINUTES</span><h2>Speed maths workout</h2><p>Train with simplification, approximation, number series and quadratic equations.</p><button class="hero-btn" data-mode="drill">'+icon('play')+' Set up a speed drill</button></div><div class="hero-art" aria-hidden="true"><div class="orbit"></div><div class="motion"></div><div class="watch"><div class="dial"></div><div class="face"><i>60</i><i>15</i><i>30</i><i>45</i><b class="needle"></b></div></div></div></section>'+
 stats(attempts)+'<div class="section-head"><h2>Practice modes</h2><a class="text-btn" href="#practice">View library</a></div>'+modeCards()+
 '<div class="bottom-grid"><section class="panel"><div class="section-head"><h2>Recent attempts</h2><a class="text-btn" href="#history">View all</a></div>'+recent()+'</section><section class="panel"><div class="section-head"><h2>Topic accuracy</h2><a class="text-btn" href="#progress">View progress</a></div>'+topicPreview()+'</section></div>';}
function recent(){return attempts.length?attempts.slice(-3).reverse().map(a=>'<a class="attempt-row" href="result.html?attempt='+encodeURIComponent(a.attemptId)+'">'+modeIcon(getMode(a))+'<div><strong>'+esc(a.testName)+'</strong><small>'+dateFmt.format(a.submittedAt)+'</small></div><div class="tail"><strong>'+a.totalScore+' / '+a.totalMarks+'</strong><small>marks</small></div></a>').join(''):empty('history','Your first attempt starts here','Complete a test to see your score and review your answers.');}
function topicPreview(){const topics=topicSummary(attempts).filter(t=>t.answered).sort((a,b)=>b.answered-a.answered).slice(0,3);return topics.length?topics.map(t=>'<div class="topic-line"><div><span>'+esc(t.name)+'</span><strong>'+per(pct(t.correct,t.answered))+'</strong></div><span class="bar"><i style="width:'+pct(t.correct,t.answered)+'%"></i></span></div>').join(''):empty('chart','See where you stand','Answer questions to track accuracy by topic.');}
function practice(){return heading('Practice library','Build a timed session from your banking exam question bank.')+resume()+'<div class="section-head"><h2>Choose a practice mode</h2></div>'+modeCards()+'<div class="section-head"><h2>Question bank</h2><span class="dim">'+bank.length+' questions · '+allTopics.length+' topics</span></div><div class="stack">'+sections.map(s=>{const qs=bank.filter(q=>q.section===s);return '<section class="panel"><div class="subhead"><h2>'+esc(s)+'</h2><button class="text-btn" data-section="'+esc(s)+'">Configure mock</button></div><p>'+qs.length+' questions</p><details><summary>Browse topics and sources</summary><ul>'+[...new Set(qs.map(q=>q.topic))].sort().map(t=>'<li>'+esc(t)+' · '+qs.filter(q=>q.topic===t).length+'</li>').join('')+'</ul><p>'+esc([...new Set(qs.map(q=>q.source?.replace(/\s*·\s*Q\d+.*$/i,'')).filter(Boolean))].join(' · '))+'</p></details></section>';}).join('')+'</div>';}
function options(items,first,selected){return '<option value="">'+first+'</option>'+items.map(x=>'<option value="'+esc(x)+'"'+(x===selected?' selected':'')+'>'+esc(x)+'</option>').join('');}
function paperPage(){const years=[...new Set(papers.map(p=>String(p.meta.year)))].sort().reverse();return heading('Previous-year papers','Take a scored memory-based paper in its original question order.')+resume()+'<div class="filters"><label class="field">Exam year<select data-filter="year">'+options(years,'All years',yearFilter)+'</select></label></div><div class="paper-grid">'+papers.map((p,i)=>({p,i})).filter(({p})=>!yearFilter||String(p.meta.year)===yearFilter).sort((a,b)=>b.p.meta.year-a.p.meta.year).map(({p,i})=>'<article class="paper-card">'+modeIcon('pyp')+'<span class="tag">'+esc(p.meta.year)+' · Memory-based</span><h3>'+esc(p.meta.testName)+'</h3><p>'+esc(p.meta.examName)+'</p><p>'+count(p)+' questions · '+p.meta.durationMinutes+' minutes</p><p>'+esc(p.sections.map(s=>s.name).join(' · '))+'</p><button class="secondary" data-paper="'+i+'">Open paper</button></article>').join('')+'</div>';}
function filtered(){return attempts.filter(a=>(!modeFilter||getMode(a)===modeFilter)&&(!testFilter||a.testName===testFilter));}
function filterHtml(withTopics){const names=[...new Set(attempts.filter(a=>!modeFilter||getMode(a)===modeFilter).map(a=>a.testName))].sort();return '<div class="filters"><label class="field">Practice mode<select data-filter="mode"><option value="">All modes</option>'+kinds.map(k=>'<option value="'+k+'"'+(modeFilter===k?' selected':'')+'>'+modes[k].name+'</option>').join('')+'</select></label><label class="field">Test<select data-filter="test">'+options(names,'All tests',testFilter)+'</select></label>'+(withTopics?'<label class="field">Topic breakdown<select data-filter="topic">'+options(topicSummary(filtered()).map(t=>t.name),'All topics',topicFilter)+'</select></label>':'')+'</div>';}
function history(){const rows=filtered();return heading('Attempt history','Reopen any scorecard or review the questions from a completed test.')+resume()+filterHtml(false)+'<section class="panel"><div class="section-head"><h2>Saved attempts</h2>'+(rows.length?'<button class="text-btn" data-export>'+icon('download')+' Export CSV</button>':'')+'</div>'+(rows.length?'<div class="table-wrap"><table><thead><tr><th>Test</th><th>Date</th><th>Score</th><th>Accuracy</th><th>Time</th><th>Review</th></tr></thead><tbody>'+rows.slice().reverse().map(a=>'<tr><td><strong>'+esc(a.testName)+'</strong><br><span class="dim">'+modes[getMode(a)].name+'</span></td><td>'+dateFmt.format(a.submittedAt)+'</td><td>'+a.totalScore+' / '+a.totalMarks+'</td><td>'+per(pct(a.totalCorrect,a.totalAttempted))+'</td><td>'+seconds(a.totalTime)+'</td><td><a href="result.html?attempt='+encodeURIComponent(a.attemptId)+'">Scorecard</a></td></tr>').join('')+'</tbody></table></div>':empty('history','No attempts in this view','Finish a test or select another filter.'))+'</section>'+backupPanel();}
function topicSummary(rows){
 const topics=new Map();
 for(const a of rows){const grouped=new Map();const test=a.state?.testData||a.testData;
  for(const state of a.state?.questions||[]){const sec=test?.sections[state.sectionIndex], q=sec?.questions[state.questionIndex];if(!q)continue;
   const name=q.topic||sec.name, t=grouped.get(name)||{name,answered:0,correct:0,net:0,max:0,seconds:0,timeAnswered:0};
   t.max+=q.marks??1;
   if(['answered','answered-marked'].includes(state.status)){t.answered++;const hit=state.selectedOption===q.correct;t.correct+=Number(hit);t.net+=hit?(q.marks??1):-(q.negative??0.25);t.timeAnswered+=state.timeSpent||0;}
   t.seconds+=state.timeSpent||0;grouped.set(name,t);
  }
  for(const t of grouped.values()){const sum=topics.get(t.name)||{name:t.name,answered:0,correct:0,net:0,max:0,timeAnswered:0,visits:[]};
   for(const k of ['answered','correct','net','max','timeAnswered'])sum[k]+=t[k];sum.visits.push(t);topics.set(t.name,sum);}
 }return [...topics.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function scoreTrend(rows){if(rows.length<2)return empty('trend','Two attempts show a trend','Complete two tests in this view to compare your scores.');
 const recent=rows.slice(-12),scores=recent.map(a=>pct(a.totalScore,a.totalMarks)??0), min=Math.min(0,...scores),x=i=>30+i*540/(scores.length-1),y=v=>130-(v-min)/(100-min)*110;
 return '<svg class="chart-svg" role="img" aria-label="Recent scores as a percentage of available marks" viewBox="0 0 600 155">'+[100,50,0].map(v=>'<path d="M30 '+y(v)+'h540" stroke="#d8e2e5" stroke-dasharray="3 5"/><text x="0" y="'+(y(v)+4)+'" font-size="11" fill="#556875">'+v+'%</text>').join('')+'<polyline fill="none" stroke="#208274" stroke-width="3" points="'+scores.map((v,i)=>x(i)+','+y(v)).join(' ')+'"/>'+scores.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="4" fill="#218474"><title>'+esc(recent[i].testName)+' · '+v+'%</title></circle>').join('')+'</svg><div class="trend-labels"><span>'+dateFmt.format(recent[0].submittedAt)+'</span><span>'+dateFmt.format(recent.at(-1).submittedAt)+'</span></div><p class="fine">Latest score '+scores.at(-1)+'% · Change from previous '+delta(scores.at(-1),scores.at(-2))+'</p>';
}
function modeComparison(rows){
 const groups=kinds.map(k=>({k,rows:rows.filter(a=>getMode(a)===k)})).filter(g=>g.rows.length);
 if(!groups.length)return '';
 const pace=a=>a.totalTime>0?(a.totalAttempted*60/a.totalTime).toFixed(2):'—';
 return '<section class="panel"><h2>Performance by mode</h2><p>Compare the last two scores in each mode. Pace counts answers per minute of practice.</p><div class="table-wrap"><table><thead><tr><th>Mode</th><th>Attempts</th><th>Latest marks</th><th>Score change</th><th>Latest pace</th><th>Previous pace</th></tr></thead><tbody>'+
 groups.map(({k,rows:list})=>{const last=list.at(-1), previous=list.at(-2);
 return '<tr><td>'+modes[k].name+'</td><td>'+list.length+'</td><td>'+last.totalScore+' / '+last.totalMarks+'</td><td>'+delta(pct(last.totalScore,last.totalMarks),previous?pct(previous.totalScore,previous.totalMarks):null)+'</td><td>'+pace(last)+'</td><td>'+(previous?pace(previous):'—')+'</td></tr>';}).join('')+'</tbody></table></div></section>';
}


function progress(){const rows=filtered(), topics=topicSummary(rows).filter(t=>!topicFilter||t.name===topicFilter);return heading('My progress','Compare scores, accuracy and answering speed across your attempts.')+filterHtml(true)+stats(rows)+'<section class="panel"><h2>Score trend</h2><p>Percentage of available marks across your latest 12 attempts in this view.</p>'+scoreTrend(rows)+'</section>'+modeComparison(rows)+'<section class="panel"><h2>Topic performance</h2><p>Accuracy change compares your latest two attempts with answers in that topic.</p>'+(topics.length?'<div class="table-wrap"><table><thead><tr><th>Topic</th><th>Answered</th><th>Net marks</th><th>Accuracy</th><th>Change</th><th>Time / answer</th></tr></thead><tbody>'+topics.map(t=>{const rates=t.visits.filter(v=>v.answered).map(v=>pct(v.correct,v.answered));return '<tr><td>'+esc(t.name)+'</td><td>'+t.answered+'</td><td>'+Number(t.net.toFixed(2))+' / '+t.max+'</td><td>'+per(pct(t.correct,t.answered))+'</td><td>'+delta(rates.at(-1),rates.at(-2))+'</td><td>'+(t.answered?seconds(Math.round(t.timeAnswered/t.answered)):'—')+'</td></tr>';}).join('')+'</tbody></table></div>':empty('target','No topic scores yet','Complete a drill, mock or previous paper to see the breakdown.'))+'</section>';}

