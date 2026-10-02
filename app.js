('.tool-svg').forEach(x=>x.innerHTML=ICONS[x.dataset.icon]||'');  
const modal=(html)=>{$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')};$('.x').onclick=()=>$('#modal').classList.add('hidden');$('.shade').onclick=()=>$('#modal').classList.add('hidden');  
function usage(){let n=Math.max(0,(C.FREE_TASK_LIMIT||3)-S.used);$('#usage').textContent=S.user?'Workspace synced':`${n} free tasks available`}  
function esc(x){return String(x).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}  
function getChats(){try{return JSON.parse(localStorage.taskya_chats||'[]')}catch{return[]}}  
function saveChats(chats){localStorage.taskya_chats=JSON.stringify(chats.slice(0,20))}  
function saveCurrent(){if(!S.chatId||!S.messages.length)return;let chats=getChats(),i=chats.findIndex(x=>x.id===S.chatId),title=(S.messages.find(x=>x.role==='user')||{}).text||'New Task';let obj={id:S.chatId,title:title.slice(0,90),messages:S.messages,updatedAt:Date.now()};if(i>=0)chats[i]=obj;else chats.unshift(obj);chats.sort((a,b)=>b.updatedAt-a.updatedAt);saveChats(chats);history()}  
function history(){let h=getChats();$('#history').innerHTML=h.map(x=>`<button class="history-item" data-id="${esc(x.id)}">${esc(x.title)}</button>`).join('');$$('.history-item').forEach(b=>b.onclick=()=>loadChat(b.dataset.id))}  
function renderMessage(role,t){let d=document.createElement('div');d.className=`msg ${role}`;d.innerHTML=`<div class="bubble">${esc(t)}</div>`;$('#chat').append(d);return d}  
function renderAll(){ $('#chat').innerHTML=''; if(S.messages.length)$('#welcome').classList.add('hidden');else $('#welcome').classList.remove('hidden'); S.messages.forEach(m=>renderMessage(m.role,m.text)); }  
function newChat(){S.chatId=crypto.randomUUID?crypto.randomUUID():String(Date.now());S.messages=[];S.attached=null;$('#file').classList.add('hidden');$('#file').textContent='';renderAll();$('#crumb').textContent='New Task';closeMenu()}  
function loadChat(id){let c=getChats().find(x=>x.id===id);if(!c)return;S.chatId=c.id;S.messages=c.messages||[];S.attached=null;$('#file').classList.add('hidden');renderAll();$('#crumb').textContent=c.title.slice(0,40);closeMenu()}  
function msg(role,t){$('#welcome').classList.add('hidden');let d=renderMessage(role,t);d.scrollIntoView({behavior:'smooth'});return d}  
function thinking(el){el.querySelector('.bubble').innerHTML='<span class="shimmer" aria-label="Taskya is thinking"><i></i><i></i><i></i><span>Taskya is thinking…</span></span>';$('#agentState').textContent='Thinking…';$('#agentState').className='agent-state thinking'}  
function typeText(el,text){return new Promise(resolve=>{let b=el.querySelector('.bubble'),i=0;b.textContent='';let cursor=document.createElement('span');cursor.className='typing-cursor';b.append(cursor);const step=()=>{if(i<text.length){cursor.before(document.createTextNode(text.slice(i,i+Math.max(1,Math.min(3,text.length-i)))));i=Math.min(text.length,i+3);setTimeout(step,8)}else{cursor.remove();resolve()}};step()})}  
async function uploadFile(file){$('#file').classList.remove('hidden');$('#file').textContent='Uploading '+file.name+'…';let fd=new FormData();fd.append('file',file);let r=await fetch(API+'/api/upload',{method:'POST',body:fd});if(!r.ok)throw Error('Upload failed: '+r.status);let d=await r.json();S.attached=d.filename;$('#file').textContent='📎 '+d.filename;}  
async function send(){let p=$('#prompt').value.trim();if(!p||$('#send').disabled)return;if(!S.user&&S.used>=(C.FREE_TASK_LIMIT||3)){login();return}if(!S.chatId)newChat();$('#prompt').value='';$('#prompt').style.height='auto';$('#send').disabled=true;let userText=S.attached?`${p}\n\n[Attached file: ${S.attached}. Use the file inspection tool on this filename when the task requires reading it.]`:p;S.messages.push({role:'user',text:userText,ts:Date.now()});msg('user',userText);saveCurrent();let a=msg('ai','');thinking(a);try{let r=await fetch(API+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:userText,web_enabled:S.web,language:'auto'})});if(!r.ok)throw Error('Backend '+r.status);let d=await r.json();let answer=d.response||d.answer||d.message||'Task completed.';await typeText(a,answer);S.messages.push({role:'ai',text:answer,ts:Date.now()});saveCurrent();S.used++;localStorage.taskya_used=S.used;usage();$('#agentState').textContent='Done';$('#agentState').className='agent-state done';S.attached=null;$('#file').classList.add('hidden');$('#file').textContent=''}catch(e){let answer='Backend connection problem. Check your Render deployment and API URL.';await typeText(a,answer);S.messages.push({role:'ai',text:answer,ts:Date.now()});saveCurrent();$('#agentState').textContent='Ready';$('#agentState').className='agent-state'}finally{$('#send').disabled=false}}  
async function login(){  
  modal(`<small>WELCOME TO TASKYA</small>  
  <h2>Sign in to continue</h2>  
  <p>Sign in securely to sync your Taskya account.</p>  
  <button class="google" id="google">  
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">  
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 3 13.3l7.8 6.1C12.5 13.5 17.8 9.5 24 9.5z"/>  
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.2-3.2-.5-4.7H24v9h12.4c-.6 2.9-2.2 5.3-4.7 6.9l7.3 5.7c4.5-4.2 7.1-10.1 7.1-16.9z"/>  
    <path fill="#FBBC05" d="M10.8 28.6a14.5 14.5 0 0 1 0-9.2L3 13.3a24 24 0 0 0 0 21.4z"/>  
    <path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-6.6l-7.3-5.7c-2 1.4-4.8 2.3-8.7 2.3-6.2 0-11.5-4-13.2-9.5L3 34.7C6.5 42.6 14.6 48 24 48z"/>  
  </svg>  
  Continue with Google  
</button>  
  <p>Or use email</p>  
  <input id="em" type="email" placeholder="Email address">  
  <input id="pw" type="password" placeholder="Password">  
  <div class="authgrid">  
    <button id="li">Log in</button>  
    <button id="su">Create account</button>  
  </div>  
  <p id="am"></p>`);  
  
  const msg = text => {  
    const el = $('#am');  
    if(el) el.textContent = text;  
  };  
  
  async function getSupabase(){  
    if(!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY){  
      throw new Error('Supabase URL or Publishable Key is missing in config.js.');  
    }  
  
    if(!window.supabase){  
      await new Promise((resolve,reject)=>{  
        const script=document.createElement('script');  
        script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';  
        script.onload=resolve;  
        script.onerror=()=>reject(new Error('Supabase library could not load. Please check your internet connection.'));  
        document.head.appendChild(script);  
      });  
    }  
  
    if(!window.taskyaSupabase){  
      window.taskyaSupabase=window.supabase.createClient(  
        C.SUPABASE_URL,  
        C.SUPABASE_ANON_KEY  
      );  
    }  
  
    return window.taskyaSupabase;  
  }  
  
  $('#google').onclick=async()=>{  
    const btn=$('#google');  
    btn.disabled=true;  
    msg('Connecting to Google...');  
  
    try{  
      const sb=await getSupabase();  
      const {error}=await sb.auth.signInWithOAuth({  
        provider:'google',  
        options:{redirectTo:window.location.origin}  
      });  
      if(error) throw error;  
    }catch(e){  
      msg(e.message || 'Google sign-in failed. Please try again.');  
      btn.disabled=false;  
    }  
  };  
  
  $('#li').onclick=async()=>{  
    const email=$('#em').value.trim();  
    const password=$('#pw').value;  
  
    if(!email || !password){  
      msg('Enter your email and password.');  
      return;  
    }  
  
    try{  
      const sb=await getSupabase();  
      const {data,error}=await sb.auth.signInWithPassword({email,password});  
      if(error) throw error;  
      S.user=data.user;  
      msg('Login successful. You can close this window.');  
    }catch(e){  
      msg(e.message || 'Login failed.');  
    }  
  };  
  
  $('#su').onclick=async()=>{  
    const email=$('#em').value.trim();  
    const password=$('#pw').value;  
  
    if(!email || !password){  
      msg('Enter your email and password.');  
      return;  
    }  
  
    if(password.length<6){  
      msg('Password must contain at least 6 characters.');  
      return;  
    }  
  
    try{  
      const sb=await getSupabase();  
      const {data,error}=await sb.auth.signUp({email,password});  
      if(error) throw error;  
      msg(data.session  
        ? 'Account created successfully.'  
        : 'Check your email to confirm your account.');  
    }catch(e){  
      msg(e.message || 'Account creation failed.');  
    }  
  };  
}  
function pay(){modal(`<small>TASKYA PRO</small><h2>Upgrade for ₹${C.PRO_PRICE_INR||19}</h2><p>Secure Razorpay checkout. The backend must have Razorpay credentials configured.</p><button class="primary" id="payNow">Pay ₹${C.PRO_PRICE_INR||19}</button><p id="payMsg"></p>`);$('#payNow').onclick=async()=>{let m=$('#payMsg');try{let r=await fetch(API+'/api/billing/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount_inr:C.PRO_PRICE_INR||19})});let d=await r.json();if(!r.ok)throw Error(d.detail||'Payment setup failed');if(!window.Razorpay){let s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.onload=()=>openRazor(d);document.head.append(s)}else openRazor(d)}catch(e){m.textContent=e.message+' — Render environment में Razorpay keys डालें.'}}}  
function openRazor(d){let r=new Razorpay({key:d.key_id,amount:d.amount,currency:d.currency,name:'Taskya AI',description:'Taskya AI Pro',order_id:d.order_id,handler:async resp=>{let v=await fetch(API+'/api/billing/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(resp)});if(v.ok){localStorage.taskya_pro='1';modal('<small>TASKYA PRO</small><h2>Payment successful</h2><p>Your payment was verified by Taskya.</p>')}else modal('<small>TASKYA PRO</small><h2>Verification failed</h2><p>Please contact support at '+esc(C.SUPPORT_EMAIL)+'</p>')}});r.open()}  
function policy(t){let c={privacy:['Privacy Policy','Taskya may process account information, prompts, files, usage data and technical logs to provide and secure the service. Replace this starter text with your finalized policy before launch.'],terms:['Terms of Service','Use Taskya only for lawful purposes. AI output may contain errors and should be reviewed before important actions.'],refund:['Refund & Cancellation Policy','Refund and cancellation terms should be finalized before launch. For support contact '+C.SUPPORT_EMAIL+'.'],contact:['Contact Taskya',`Support email: <a href="mailto:${C.SUPPORT_EMAIL}">${C.SUPPORT_EMAIL}</a><br><br>Website: taskya.in`]}[t]||[];modal(`<small>LEGAL & SUPPORT</small><h2>${c[0]}</h2><p>${c[1]}</p>`)}  
function closeMenu(){$('#side').classList.remove('open');$('#mobileShade').classList.remove('open')}function openMenu(){$('#side').classList.add('open');$('#mobileShade').classList.add('open')}  
$$('[data-policy]').forEach(b=>b.onclick=()=>policy(b.dataset.policy));$('#send').onclick=send;$('#prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};$('#prompt').oninput=e=>{e.target.style.height='auto';e.target.style.height=Math.min(130,e.target.scrollHeight)+'px'};  
$('#web').onclick=()=>{S.web=!S.web;$('#web').classList.toggle('on',S.web);$('#mode').textContent=S.web?'Web':'Auto'};$('#web2').onchange=e=>{S.web=e.target.checked};  
$('#upload').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{await uploadFile(f)}catch(err){modal('<small>FILE UPLOAD</small><h2>Upload failed</h2><p>'+esc(err.message)+'</p>')}};  
$('#voice').onclick=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){modal('<small>VOICE INPUT</small><h2>Voice input is unavailable</h2><p>Use Chrome/Edge with microphone permission enabled.</p>');return}if(S.listening){S.recognition.stop();return}let r=new SR();S.recognition=r;r.lang=navigator.language||'en-IN';r.interimResults=true;r.continuous=false;S.listening=true;$('#voice').classList.add('on');r.onresult=e=>{let t=[...e.results].map(x=>x[0].transcript).join('');$('#prompt').value=t;$('#prompt').dispatchEvent(new Event('input'))};r.onerror=()=>{S.listening=false;$('#voice').classList.remove('on')};r.onend=()=>{S.listening=false;$('#voice').classList.remove('on');$('#prompt').focus()};r.start()};  
$('#clear').onclick=()=>{localStorage.removeItem('taskya_chats');S.chatId=null;S.messages=[];renderAll();history()};$('#upgrade').onclick=$('#topUpgrade').onclick=pay;$('#login').onclick=login;$('#topLogin').onclick=login;$('#menu').onclick=openMenu;$('#sideClose').onclick=closeMenu;$('#mobileShade').onclick=closeMenu;$('#new').onclick=newChat;  
$$('nav button').forEach(b=>b.onclick=()=>{let v=b.dataset.view;document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));$('#'+v).classList.remove('hidden');$$('nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#crumb').textContent=v==='agent'?'New Task':v[0].toUpperCase()+v.slice(1);closeMenu()});  
$$('.prompt-chip').forEach(b=>b.onclick=()=>{$('#prompt').value=b.dataset.p;$('#prompt').focus();$('#prompt').dispatchEvent(new Event('input'))});  
$('#modelSelect').value=S.model;$('#modelSelect').onchange=e=>{S.model=e.target.value;localStorage.taskya_model=S.model};$('#styleSelect').value=S.style;$('#styleSelect').onchange=e=>{S.style=e.target.value;localStorage.taskya_style=S.style};  
newChat();history();usage();  
})();  
