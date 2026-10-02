(()=>{

const C=window.TASKYA_CONFIG||{},
$=s=>document.querySelector(s),

$$=s=>[...document.querySelectorAll(s)], 
S={  
 web:false,  
 used:+localStorage.taskya_used||0,  
 user:null,  
 model:localStorage.taskya_model||'taskya-fast-v1'  
};  
  let supabaseClient = null;

async function initAuth() {
  if (!window.supabase || !C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) return;

  supabaseClient = window.supabase.createClient(
    C.SUPABASE_URL,
    C.SUPABASE_ANON_KEY
  );

  const { data } = await supabaseClient.auth.getSession();
  S.user = data.session ? data.session.user : null;
  usage();
 supabaseClient.auth.onAuthStateChange((event, session) => {
  S.user = session ? session.user : null;
  usage();
});
}
initAuth();

const modal=(html)=>{
 $('#modalBody').innerHTML=html;  
 $('#modal').classList.remove('hidden')  
};  
  
$('.x').onclick=()=>$('#modal').classList.add('hidden');  
$('.shade').onclick=()=>$('#modal').classList.add('hidden');  
  
function usage(){  
 let n=Math.max(0,(C.FREE_TASK_LIMIT||3)-S.used);  
 $('#usage').textContent=S.user?'Workspace synced':`${n} free tasks available`  
}  
  
/* Recent Tasks */  
function getHistory(){  
 try{  
  return JSON.parse(localStorage.taskya_history||'[]')  
 }catch(e){  
  return []  
 }  
}  
  
function saveHistory(h){  
 localStorage.taskya_history=JSON.stringify(h.slice(0,12))  
}  
  
function history(){  
  
 let h=getHistory();  
  
 $('#history').innerHTML=h.map((item,index)=>{  
  
  let question=typeof item==='string'?item:(item.question||'');  
  
  return `<button class="history-item" data-history-index="${index}">${esc(question)}</button>`  
  
 }).join('');  
  
 $$('#history .history-item').forEach(btn=>{  
  btn.onclick=()=>{  
   const index=Number(btn.dataset.historyIndex);  
   openHistory(index)  
  }  
 })  
}  
  
function openHistory(index){  
  
 const h=getHistory();  
 const item=h[index];  
  
 if(!item)return;  
  
 let question='';  
 let answer='';  
  
 if(typeof item==='string'){  
  question=item;  
 }else{  
  question=item.question||'';  
  answer=item.answer||'';  
 }  
  
 document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));  
  
 const agent=$('#agent');  
 if(agent)agent.classList.remove('hidden');  
  
 $('#welcome').classList.add('hidden');  
 $('#chat').innerHTML='';  
  
 if(question)msg('user',question);  
 if(answer)msg('ai',answer);  
  
 $('#crumb').textContent='Task History';  
  
 closeMenu();  
}  
  
function esc(x){  
 return String(x).replace(/[&<>"']/g,m=>({  
  '&':'&amp;',  
  '<':'&lt;',  
  '>':'&gt;',  
  '"':'&quot;',  
  "'":'&#039;'  
 }[m]))  
}  
  
function msg(role,t){  
  
 $('#welcome').classList.add('hidden');  
  
 let d=document.createElement('div');  
  
 d.className=`msg ${role}`;  
  
 d.innerHTML=`<div class="bubble">${esc(t)}</div>`;  
  
 $('#chat').append(d);  
  
 d.scrollIntoView({  
  behavior:'smooth'  
 });  
  
 return d  
}  
  
function thinking(el){  
  
 el.querySelector('.bubble').innerHTML=  
 '<span class="shimmer" aria-label="Taskya is thinking"><i></i><i></i><i></i><span>Taskya is thinking…</span></span>';  
  
 $('#agentState').textContent='Thinking…';  
 $('#agentState').className='agent-state thinking'  
}  
  
function typeText(el,text){  
  
 return new Promise(resolve=>{  
  
  let b=el.querySelector('.bubble'),  
  i=0;  
  
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
  
    setTimeout(step,12)  
  
   }else{  
  
    cursor.remove();  
    resolve()  
  
   }  
  
  };  
  
  step()  
  
 })  
}  
  
async function send(){  
  
 let p=$('#prompt').value.trim();  
  
 if(!p||$('#send').disabled)return;  
  
 if(!S.user&&S.used>=(C.FREE_TASK_LIMIT||3)){  
  login();  
  return  
 }  
  
 $('#prompt').value='';  
 $('#prompt').style.height='auto';  
 $('#send').disabled=true;  
  
 msg('user',p);  
  
 let a=msg('ai','');  
  
 thinking(a);  
  
 /* Save the task immediately with an empty answer */  
 let h=getHistory();  
  
 h.unshift({  
  question:p,  
  answer:'',  
  createdAt:new Date().toISOString()  
 });  
  
 saveHistory(h);  
 history();  
  
 try{  
  
  let r=await fetch(  
   (C.API_BASE_URL||'').replace(/\/$/,'')+'/api/chat',  
   {  
    method:'POST',  
    headers:{  
     'Content-Type':'application/json'  
    },  
    body:JSON.stringify({  
     message:p,  
     web_enabled:S.web,  
     style:'Balanced',  
     model:S.model  
    })  
   }  
  );  
  
  if(!r.ok)throw Error('Backend '+r.status);  
  
  let d=await r.json();  
  
  let answer=  
   d.response||  
   d.answer||  
   d.message||  
   'Task completed.';  
  
  /* Save the answer into the latest task */  
  let updated=getHistory();  
  
  if(  
   updated.length&&  
   typeof updated[0]==='object'&&  
   updated[0].question===p  
  ){  
   updated[0].answer=answer;  
   updated[0].updatedAt=new Date().toISOString();  
   saveHistory(updated);  
  }  
  
  await typeText(a,answer);  
  
  S.used++;  
  
  localStorage.taskya_used=S.used;  
  
  usage();  
  
  $('#agentState').textContent='Done';  
  $('#agentState').className='agent-state done';  
  
  history();  
  
 }catch(e){  
  
  let errorMessage=  
   'Backend not connected. Put your Render URL in config.js and verify /api/chat is live.';  
  
  await typeText(a,errorMessage);  
  
  let updated=getHistory();  
  
  if(  
   updated.length&&  
   typeof updated[0]==='object'&&  
   updated[0].question===p  
  ){  
   updated[0].answer=errorMessage;  
   saveHistory(updated);  
  }  
  
  $('#agentState').textContent='Ready';  
  $('#agentState').className='agent-state';  
  
  history();  
  
 }finally{  
  
  $('#send').disabled=false  
  
 }  
}  
  
function login(){  
  
 modal(`  
 <small>WELCOME TO TASKYA</small>  
 <h2>Sign in to continue</h2>  
 <p>Save chats, sync tasks and unlock your workspace.</p>  
  
<button class="google" id="google" type="button" style="display:flex;align-items:center;justify-content:center;gap:12px;width:100%;box-sizing:border-box;padding:13px 18px;background:#fff;color:#202124;border:1px solid #dadce0;border-radius:12px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 2px 5px rgba(60,64,67,.12);transition:background .2s,border-color .2s,box-shadow .2s;">
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" style="flex-shrink:0;">
    <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15z"/>
    <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44z"/>
    <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8z"/>
    <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12z"/>
  </svg>
  <span>Continue with Google</span>
</button>
  
 <p>Or use email</p>  
  
 <input id="em" type="email" placeholder="Email address">  
  
 <input id="pw" type="password" placeholder="Password">  
  
 <div class="authgrid">  
  <button id="li">Log in</button>  
  <button id="su">Create account</button>  
 </div>  
  
 <p id="am"></p>  
 `);  
  
$('#google').onclick = async () => {
  const status = $('#am');
  const btn = $('#google');

  if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) {
    status.textContent = 'Supabase URL or public key is missing in config.js.';
    return;
  }

  btn.disabled = true;
  status.textContent = 'Connecting to Google...';

  try {
    if (!window.supabase?.createClient) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = resolve;
        script.onerror = () => reject(
          new Error('Supabase library could not load. Please try again.')
        );
        document.head.appendChild(script);
      });
    }

    if (!window.supabase?.createClient) {
      throw new Error('Supabase library did not initialize. Please refresh and try again.');
    }

    const client = window.supabase.createClient(
      C.SUPABASE_URL,
      C.SUPABASE_ANON_KEY
    );

    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) throw error;

  } catch (e) {
    status.textContent = e.message || 'Google login failed.';
    btn.disabled = false;
  }
};
  
 ['li','su'].forEach(id=>{  
  $('#'+id).onclick=()=>{  
   $('#am').textContent=  
   'Supabase Auth is ready to connect after you add the public URL and anon key in config.js.'  
  }  
 })  
}  
  
function policy(t){  
  
 let c={  
  privacy:[  
   'Privacy Policy',  
   'Taskya may process account information, prompts, files, usage data and technical logs to provide and secure the service. Replace this starter text with your finalized policy before launch.'  
  ],  
  terms:[  
   'Terms of Service',  
   'Use Taskya only for lawful purposes. AI output may contain errors and should be reviewed before important actions. Replace this starter text with your finalized terms before launch.'  
  ],  
  refund:[  
   'Refund & Cancellation Policy',  
   'Paid plans are not activated yet. Before accepting payments, replace this starter with your actual refund, cancellation and billing terms.'  
  ],  
  contact:[  
   'Contact Taskya',  
   `Support email: <a href="mailto:${C.SUPPORT_EMAIL}">${C.SUPPORT_EMAIL}</a><br><br>Website: taskya.in`  
  ]  
 }[t]||[];  
  
 modal(`  
 <small>LEGAL & SUPPORT</small>  
 <h2>${c[0]}</h2>  
 <p>${c[1]}</p>  
 `)  
}  
  
function closeMenu(){  
 $('#side').classList.remove('open');  
 $('#mobileShade').classList.remove('open')  
}  
  
function openMenu(){  
 $('#side').classList.add('open');  
 $('#mobileShade').classList.add('open')  
}  
  
$$('[data-policy]').forEach(  
 b=>b.onclick=()=>policy(b.dataset.policy)  
);  
  
$('#send').onclick=send;  
  
$('#prompt').onkeydown=e=>{  
 if(e.key==='Enter'&&!e.shiftKey){  
  e.preventDefault();  
  send()  
 }  
};  
  
$('#prompt').oninput=e=>{  
 e.target.style.height='auto';  
 e.target.style.height=Math.min(130,e.target.scrollHeight)+'px'  
};  
  
$('#web').onclick=()=>{  
 S.web=!S.web;  
 $('#web').classList.toggle('on',S.web);  
 $('#mode').textContent=S.web?'Web':'Auto'  
};  
  
$('#web2').onchange=e=>{  
 S.web=e.target.checked  
};  
  
$('#upload').onchange=e=>{  
 let f=e.target.files[0];  
  
 if(f){  
  $('#file').classList.remove('hidden');  
  $('#file').textContent=f.name  
 }  
};  
  
$('#clear').onclick=()=>{  
 localStorage.removeItem('taskya_history');  
 history()  
};  
  
$('#upgrade').onclick=$('#topUpgrade').onclick=()=>modal(`  
 <small>TASKYA PRO</small>  
 <h2>More work. Fewer limits.</h2>  
 <p>Razorpay and PayPal are intentionally not activated yet. Their connection points are prepared in config.js.</p>  
 <button class="primary" disabled>Payment gateway not configured</button>  
`);  
  
$('#login').onclick=login;  
$('#topLogin').onclick=login;  
  
$('#menu').onclick=openMenu;  
$('#sideClose').onclick=closeMenu;  
$('#mobileShade').onclick=closeMenu;  
  
$('#new').onclick=()=>{  
 document.querySelectorAll('.view').forEach(  
  x=>x.classList.add('hidden')  
 );  
  
 $('#agent').classList.remove('hidden');  
 $('#welcome').classList.remove('hidden');  
 $('#chat').innerHTML='';  
 $('#crumb').textContent='New Task';  
  
 closeMenu()  
};  
  
$$('nav button').forEach(b=>b.onclick=()=>{  
  
 let v=b.dataset.view;  
  
 document.querySelectorAll('.view').forEach(  
  x=>x.classList.add('hidden')  
 );  
  
 $('#'+v).classList.remove('hidden');  
  
 $$('nav button').forEach(  
  x=>x.classList.remove('active')  
 );  
  
 b.classList.add('active');  
  
 $('#crumb').textContent=  
  v==='agent'?  
  'New Task':  
  v[0].toUpperCase()+v.slice(1);  
  
 closeMenu()  
});  
  
$$('.prompt-chip').forEach(b=>b.onclick=()=>{  
 $('#prompt').value=b.dataset.p;  
 $('#prompt').focus();  
 $('#prompt').dispatchEvent(new Event('input'))  
});  
  
$('#modelSelect').value=S.model;  
  
$('#modelSelect').onchange=e=>{  
 S.model=e.target.value;  
 localStorage.taskya_model=S.model  
};  
  
history();  
usage()  
  
})()  
  
