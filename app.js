TASKYA AI — ROOT app.js — ANSWER UI v3
========================================

DEPLOY:
GitHub: taskyaofficial-byte/taskya-frontend
File: ROOT/app.js
Production: Vercel

IMPORTANT:
This is ONLY the answer-rendering block.
Do NOT replace the whole app.js.
Keep send(), history(), login(), web, voice, upload and API code unchanged.

Replace the current block beginning with:
function esc(x){

through the end of:
function typeText(el,text){ ... }

with this block.

------------------------------------------------------------
PASTE THIS COMPLETE BLOCK
------------------------------------------------------------

function esc(x){
 return String(x).replace(/[&<>"']/g,m=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#039;'
 }[m]))
}

function inlineMarkdown(x){
 let s=esc(x);

 s=s.replace(/`([^`]+)`/g,'<code>$1</code>');
 s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
 s=s.replace(/__([^_]+)__/g,'<strong>$1</strong>');
 s=s.replace(/\*([^*]+)\*/g,'<em>$1</em>');

 return s;
}

function renderMarkdown(text){

 const lines=String(text||'')
  .replace(/\r\n/g,'\n')
  .split('\n');

 let html='';
 let inUl=false;
 let inOl=false;

 const closeLists=()=>{
  if(inUl){html+='</ul>';inUl=false}
  if(inOl){html+='</ol>';inOl=false}
 };

 const isTableSeparator=(s)=>{
  return /^\|?\s*:?-{2,}\s*(\|\s*:?-{2,}\s*)+\|?$/.test(s);
 };

 for(let i=0;i<lines.length;i++){

  const line=lines[i].trim();

  if(!line){
   closeLists();
   continue;
  }

  /* TABLE */
  if(
   line.includes('|') &&
   i+1<lines.length &&
   isTableSeparator(lines[i+1].trim())
  ){

   closeLists();

   const head=line
    .replace(/^\||\|$/g,'')
    .split('|')
    .map(x=>x.trim());

   html+='<div class="answer-table-wrap">';
   html+='<table class="answer-table">';
   html+='<thead><tr>';

   head.forEach(c=>{
    html+='<th>'+inlineMarkdown(c)+'</th>';
   });

   html+='</tr></thead><tbody>';

   i+=2;

   while(i<lines.length){

    const row=lines[i].trim();

    if(!row || !row.includes('|')) break;

    const cells=row
     .replace(/^\||\|$/g,'')
     .split('|')
     .map(x=>x.trim());

    html+='<tr>';

    cells.forEach(c=>{
     html+='<td>'+inlineMarkdown(c)+'</td>';
    });

    html+='</tr>';
    i++;
   }

   html+='</tbody></table></div>';
   i--;
   continue;
  }

  /* HEADINGS */
  if(/^###\s+/.test(line)){
   closeLists();
   html+='<h3>'+inlineMarkdown(
    line.replace(/^###\s+/,'')
   )+'</h3>';
   continue;
  }

  if(/^##\s+/.test(line)){
   closeLists();
   html+='<h2>'+inlineMarkdown(
    line.replace(/^##\s+/,'')
   )+'</h2>';
   continue;
  }

  if(/^#\s+/.test(line)){
   closeLists();
   html+='<h2>'+inlineMarkdown(
    line.replace(/^#\s+/,'')
   )+'</h2>';
   continue;
  }

  /* BULLETS */
  if(/^[-•*]\s+/.test(line)){

   if(!inUl){
    closeLists();
    html+='<ul>';
    inUl=true;
   }

   html+='<li>'+inlineMarkdown(
    line.replace(/^[-•*]\s+/,'')
   )+'</li>';

   continue;
  }

  /* NUMBERED LIST */
  if(/^\d+[.)]\s+/.test(line)){

   if(!inOl){
    closeLists();
    html+='<ol>';
    inOl=true;
   }

   html+='<li>'+inlineMarkdown(
    line.replace(/^\d+[.)]\s+/,'')
   )+'</li>';

   continue;
  }

  /* NORMAL PARAGRAPH */
  closeLists();

  html+='<p>'+inlineMarkdown(line)+'</p>';
 }

 closeLists();

 return html || '<p></p>';
}

function msg(role,t){

 $('#welcome').classList.add('hidden');

 let d=document.createElement('div');

 d.className=`msg ${role}`;

 d.innerHTML=
  `<div class="bubble">${renderMarkdown(t)}</div>`;

 $('#chat').append(d);

 d.scrollIntoView({
  behavior:'smooth',
  block:'nearest'
 });

 return d;
}

function thinking(el){

 el.querySelector('.bubble').innerHTML=
  '<span class="shimmer" aria-label="Taskya is thinking">'+
  '<i></i><i></i><i></i>'+
  '<span>Taskya is thinking…</span>'+
  '</span>';

 $('#agentState').textContent='Thinking…';
 $('#agentState').className='agent-state thinking';
}

function typeText(el,text){

 return new Promise(resolve=>{

  let b=el.querySelector('.bubble');
  let i=0;

  b.textContent='';

  let cursor=document.createElement('span');
  cursor.className='typing-cursor';

  b.append(cursor);

  const step=()=>{

   if(i<text.length){

    cursor.before(
     document.createTextNode(
      text.slice(
       i,
       i+Math.max(
        1,
        Math.min(3,text.length-i)
       )
      )
     )
    );

    i=Math.min(text.length,i+3);

    el.scrollIntoView({
     behavior:'smooth',
     block:'nearest'
    });

    setTimeout(step,10);

   }else{

    cursor.remove();

    b.innerHTML=renderMarkdown(text);

    resolve();
   }
  };

  step();
 });
}

------------------------------------------------------------
IMPORTANT
------------------------------------------------------------
DO NOT change send(), history(), login(), API_BASE,
web_enabled, microphone, attachment or search code.
