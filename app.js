(()=>{
'use strict';

const C = window.TASKYA_CONFIG || {};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const S = {
  web: false,
  used: Number(localStorage.getItem('taskya_used')) || 0,
  user: null,
  model: localStorage.getItem('taskya_model') || 'taskya-fast-v1',
  style: localStorage.getItem('taskya_style') || 'Balanced',
  chatId: null,
  messages: [],
  attached: null,
  listening: false,
  recognition: null,
  supabase: null,
  supabasePromise: null
};

const API = (C.API_BASE_URL || '').replace(/\/+$/, '');

const ICONS = {
  paperclip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.4 11.6 12 21a6 6 0 0 1-8.5-8.5L13.6 2.4a4 4 0 0 1 5.7 5.7L8.9 18.5a2 2 0 0 1-2.8-2.8l9.9-9.9"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>'
};

$$('.tool-svg').forEach(el => {
  el.innerHTML = ICONS[el.dataset.icon] || '';
});

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[ch]);
}

function modal(html) {
  $('#modalBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
}

function closeModal() {
  $('#modal').classList.add('hidden');
}

$('.x').onclick = closeModal;
$('.shade').onclick = closeModal;

function usage() {
  const limit = Number(C.FREE_TASK_LIMIT) || 3;
  const remaining = Math.max(0, limit - S.used);
  $('#usage').textContent = S.user
    ? 'Workspace synced'
    : `${remaining} free tasks available`;
}

function getChats() {
  try {
    const value = JSON.parse(localStorage.getItem('taskya_chats') || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveChats(chats) {
  localStorage.setItem('taskya_chats', JSON.stringify(chats.slice(0, 20)));
}

function getHistory() {
  try {
    const value = JSON.parse(localStorage.getItem('taskya_history') || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem('taskya_history', JSON.stringify(items.slice(0, 12)));
}

function renderMessage(role, text) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = String(text ?? '');

  el.append(bubble);
  $('#chat').append(el);
  return el;
}

function msg(role, text) {
  $('#welcome').classList.add('hidden');
  const el = renderMessage(role, text);
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return el;
}

function thinking(el) {
  el.querySelector('.bubble').innerHTML =
    '<span class="shimmer" aria-label="Taskya is thinking"><i></i><i></i><i></i><span>Taskya is thinking…</span></span>';

  $('#agentState').textContent = 'Thinking…';
  $('#agentState').className = 'agent-state thinking';
}

function typeText(el, text) {
  return new Promise(resolve => {
    const bubble = el.querySelector('.bubble');
    const content = String(text ?? '');
    let index = 0;

    bubble.textContent = '';
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    bubble.append(cursor);

    function step() {
      if (index < content.length) {
        const chunk = content.slice(index, index + 3);
        cursor.before(document.createTextNode(chunk));
        index += chunk.length;
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(step, 8);
      } else {
        cursor.remove();
        resolve();
      }
    }

    step();
  });
}

function history() {
  const chatItems = getChats().map(item => ({
    id: item.id,
    title: item.title || 'New Task',
    updatedAt: item.updatedAt || 0,
    type: 'chat'
  }));

  const oldItems = getHistory().map((item, index) => ({
    id: String(index),
    title: typeof item === 'string'
      ? item
      : (item.question || 'Previous task'),
    updatedAt: item.updatedAt || item.createdAt || 0,
    type: 'old'
  }));

  const items = [...chatItems, ...oldItems]
    .sort((a, b) => {
      const ta = typeof a.updatedAt === 'number'
        ? a.updatedAt
        : Date.parse(a.updatedAt) || 0;
      const tb = typeof b.updatedAt === 'number'
        ? b.updatedAt
        : Date.parse(b.updatedAt) || 0;
      return tb - ta;
    })
    .slice(0, 20);

  $('#history').innerHTML = items.map(item =>
    `<button class="history-item" data-type="${item.type}" data-id="${esc(item.id)}">${esc(item.title)}</button>`
  ).join('');

  $$('#history .history-item').forEach(button => {
    button.onclick = () => {
      if (button.dataset.type === 'chat') {
        loadChat(button.dataset.id);
      } else {
        openOldHistory(Number(button.dataset.id));
      }
    };
  });
}

function saveCurrent() {
  if (!S.chatId || !S.messages.length) return;

  const chats = getChats();
  const firstUser = S.messages.find(item => item.role === 'user');
  const title = firstUser?.text || 'New Task';

  const entry = {
    id: S.chatId,
    title: title.slice(0, 90),
    messages: S.messages,
    updatedAt: Date.now()
  };

  const index = chats.findIndex(item => item.id === S.chatId);

  if (index >= 0) chats[index] = entry;
  else chats.unshift(entry);

  chats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  saveChats(chats);
  history();
}

function renderAll() {
  $('#chat').innerHTML = '';

  if (S.messages.length) {
    $('#welcome').classList.add('hidden');
  } else {
    $('#welcome').classList.remove('hidden');
  }

  S.messages.forEach(item => renderMessage(item.role, item.text));
}

function newChat() {
  S.chatId = crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now());

  S.messages = [];
  S.attached = null;

  $('#file').classList.add('hidden');
  $('#file').textContent = '';
  $('#upload').value = '';

  renderAll();
  $('#crumb').textContent = 'New Task';
  closeMenu();
}

function loadChat(id) {
  const chat = getChats().find(item => item.id === id);
  if (!chat) return;

  S.chatId = chat.id;
  S.messages = Array.isArray(chat.messages) ? chat.messages : [];
  S.attached = null;

  $('#file').classList.add('hidden');
  $('#file').textContent = '';

  document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
  $('#agent').classList.remove('hidden');

  renderAll();
  $('#crumb').textContent = (chat.title || 'Previous task').slice(0, 40);
  closeMenu();
}

function openOldHistory(index) {
  const item = getHistory()[index];
  if (!item) return;

  const question = typeof item === 'string'
    ? item
    : item.question || '';

  const answer = typeof item === 'string'
    ? ''
    : item.answer || '';

  document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
  $('#agent').classList.remove('hidden');
  $('#welcome').classList.add('hidden');
  $('#chat').innerHTML = '';

  if (question) renderMessage('user', question);
  if (answer) renderMessage('ai', answer);

  $('#crumb').textContent = 'Task History';
  closeMenu();
}

async function uploadFile(file) {
  if (!file) return;

  $('#file').classList.remove('hidden');
  $('#file').textContent = `Uploading ${file.name}…`;

  try {
    const form = new FormData();
    form.append('file', file);

    const response = await fetch(`${API}/api/upload`, {
      method: 'POST',
      body: form
    });

    if (!response.ok) {
      throw new Error(`Upload failed (${response.status})`);
    }

    const data = await response.json();
    S.attached = data.filename || data.file_id || data.url || file.name;
    $('#file').textContent = `📎 ${file.name}`;
  } catch (error) {
    S.attached = null;
    $('#file').textContent = '';
    $('#file').classList.add('hidden');

    modal(
      '<small>FILE UPLOAD</small><h2>Upload failed</h2><p>' +
      esc(error.message) +
      '</p>'
    );
  }
}

async function send() {
  const prompt = $('#prompt').value.trim();

  if (!prompt || $('#send').disabled) return;

  const limit = Number(C.FREE_TASK_LIMIT) || 3;
  if (!S.user && S.used >= limit) {
    login();
    return;
  }

  if (!S.chatId) newChat();

  $('#prompt').value = '';
  $('#prompt').style.height = 'auto';
  $('#send').disabled = true;

  const userText = S.attached
    ? `${prompt}\n\n[Attached file: ${S.attached}]`
    : prompt;

  S.messages.push({ role: 'user', text: userText, ts: Date.now() });
  msg('user', userText);
  saveCurrent();

  const answerElement = msg('ai', '');
  thinking(answerElement);

  try {
    const response = await fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        web_enabled: S.web,
        language: 'auto',
        model: S.model,
        style: S.style
      })
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errorData = await response.json();
        detail = errorData.detail || errorData.message || '';
      } catch {}
      throw new Error(detail || `Backend error (${response.status})`);
    }

    const data = await response.json();
    const answer = data.response || data.answer || data.message || 'Task completed.';

    await typeText(answerElement, answer);

    S.messages.push({ role: 'ai', text: answer, ts: Date.now() });
    saveCurrent();

    S.used++;
    localStorage.setItem('taskya_used', String(S.used));
    usage();

    $('#agentState').textContent = 'Done';
    $('#agentState').className = 'agent-state done';
    S.attached = null;
    $('#file').classList.add('hidden');
    $('#file').textContent = '';
    $('#upload').value = '';
  } catch (error) {
    const message = `Backend connection problem: ${error.message}. Check API_BASE_URL in config.js and confirm that the Render /api/chat endpoint is running.`;

    await typeText(answerElement, message);
    S.messages.push({ role: 'ai', text: message, ts: Date.now() });
    saveCurrent();

    $('#agentState').textContent = 'Ready';
    $('#agentState').className = 'agent-state';
  } finally {
    $('#send').disabled = false;
  }
}

/* Supabase authentication */
async function getSupabase() {
  if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) {
    throw new Error('Supabase URL or Publishable/Anon Key is missing in config.js.');
  }

  if (!S.supabasePromise) {
    S.supabasePromise = new Promise((resolve, reject) => {
      if (window.supabase?.createClient) {
        resolve(window.supabase);
        return;
      }

      const existing = document.querySelector('script[data-taskya-supabase]');

      if (existing) {
        existing.addEventListener('load', () => {
          if (window.supabase?.createClient) resolve(window.supabase);
          else reject(new Error('Supabase library did not initialize.'));
        }, { once: true });

        existing.addEventListener('error', () => {
          reject(new Error('Could not load Supabase library.'));
        }, { once: true });

        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.dataset.taskyaSupabase = 'true';

      script.onload = () => {
        if (window.supabase?.createClient) resolve(window.supabase);
        else reject(new Error('Supabase library did not initialize.'));
      };

      script.onerror = () => reject(new Error('Could not load Supabase library.'));
      document.head.appendChild(script);
    }).catch(error => {
      S.supabasePromise = null;
      throw error;
    });
  }

  const library = await S.supabasePromise;

  if (!S.supabase) {
    S.supabase = library.createClient(
      C.SUPABASE_URL,
      C.SUPABASE_ANON_KEY
    );

    S.supabase.auth.onAuthStateChange((_event, session) => {
      S.user = session?.user || null;
      usage();

      const loginButton = $('#login');
      if (loginButton) {
        loginButton.textContent = S.user
          ? '◉ Signed in'
          : '◉ Sign in / Log in';
      }
    });
  }

  return S.supabase;
}

function login() {
  modal(`
    <small>WELCOME TO TASKYA</small>
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
    <input id="em" type="email" autocomplete="email" placeholder="Email address">
    <input id="pw" type="password" autocomplete="current-password" placeholder="Password">

    <div class="authgrid">
      <button id="li">Log in</button>
      <button id="su">Create account</button>
    </div>
    <p id="am" role="status"></p>
  `);

  const status = text => {
    const el = $('#am');
    if (el) el.textContent = text;
  };

  const setBusy = busy => {
    ['google', 'li', 'su'].forEach(id => {
      const button = $('#' + id);
      if (button) button.disabled = busy;
    });
  };

  $('#google').onclick = async () => {
    setBusy(true);
    status('Connecting to Google…');

    try {
      const sb = await getSupabase();
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });

      if (error) throw error;
    } catch (error) {
      status(error.message || 'Google sign-in failed.');
      setBusy(false);
    }
  };

  $('#li').onclick = async () => {
    const email = $('#em').value.trim();
    const password = $('#pw').value;

    if (!email || !password) {
      status('Enter your email and password.');
      return;
    }

    setBusy(true);

    try {
      const sb = await getSupabase();
      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error) throw error;

      S.user = data.user;
      usage();
      status('Login successful.');
      setTimeout(closeModal, 700);
    } catch (error) {
      status(error.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  $('#su').onclick = async () => {
    const email = $('#em').value.trim();
    const password = $('#pw').value;

    if (!email || !password) {
      status('Enter your email and password.');
      return;
    }

    if (password.length < 6) {
      status('Password must contain at least 6 characters.');
      return;
    }

    setBusy(true);

    try {
      const sb = await getSupabase();
      const { data, error } = await sb.auth.signUp({ email, password });

      if (error) throw error;

      if (data.session) {
        S.user = data.user;
        usage();
        status('Account created successfully.');
        setTimeout(closeModal, 900);
      } else {
        status('Account created. Check your email to confirm your account.');
      }
    } catch (error) {
      status(error.message || 'Account creation failed.');
    } finally {
      setBusy(false);
    }
  };
}

async function restoreSession() {
  try {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;

    S.user = data.session?.user || null;
    usage();
  } catch (error) {
    console.warn('Taskya session restore:', error.message);
  }
}

/* Payments */
function pay() {
  modal(`
    <small>TASKYA PRO</small>
    <h2>Upgrade for ₹${Number(C.PRO_PRICE_INR) || 19}</h2>
    <p>Secure checkout requires valid Razorpay credentials on the backend.</p>
    <button class="primary" id="payNow">Pay ₹${Number(C.PRO_PRICE_INR) || 19}</button>
    <p id="payMsg" role="status"></p>
  `);

  $('#payNow').onclick = async () => {
    const message = $('#payMsg');
    const button = $('#payNow');
    button.disabled = true;
    message.textContent = 'Creating secure order…';

    try {
      const response = await fetch(`${API}/api/billing/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_inr: Number(C.PRO_PRICE_INR) || 19
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Payment setup failed.');
      }

      if (!data.key_id || !data.order_id || !data.amount) {
        throw new Error('Payment backend returned incomplete order details.');
      }

      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Razorpay checkout could not load.'));
          document.head.appendChild(script);
        });
      }

      const checkout = new window.Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency || 'INR',
        name: 'Taskya AI',
        description: 'Taskya AI Pro',
        order_id: data.order_id,
        handler: async payment => {
          try {
            const verifyResponse = await fetch(`${API}/api/billing/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payment)
            });

            if (!verifyResponse.ok) {
              throw new Error('Payment verification failed.');
            }

            localStorage.setItem('taskya_pro', '1');
            modal('<small>TASKYA PRO</small><h2>Payment successful</h2><p>Payment verified by the backend.</p>');
          } catch (error) {
            modal('<small>TASKYA PRO</small><h2>Verification failed</h2><p>' + esc(error.message) + '</p>');
          }
        }
      });

      checkout.open();
      message.textContent = '';
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  };
}

function policy(type) {
  const policies = {
    privacy: [
      'Privacy Policy',
      'Taskya may process account information, prompts, files, usage data and technical logs to provide and secure the service. Finalize and publish your privacy policy before launch.'
    ],
    terms: [
      'Terms of Service',
      'Use Taskya only for lawful purposes. AI output may contain errors and should be reviewed before important actions. Finalize your terms before launch.'
    ],
    refund: [
      'Refund & Cancellation Policy',
      'Please review the published refund and cancellation terms before purchasing. Contact support for billing assistance.'
    ],
    contact: [
      'Contact Taskya',
      `Support email: <a href="mailto:${esc(C.SUPPORT_EMAIL || '')}">${esc(C.SUPPORT_EMAIL || 'Configure SUPPORT_EMAIL in config.js')}</a><br><br>Website: taskya.in`
    ]
  };

  const content = policies[type] || ['Information', 'No information available.'];

  modal(`
    <small>LEGAL &amp; SUPPORT</small>
    <h2>${content[0]}</h2>
    <p>${content[1]}</p>
  `);
}

function closeMenu() {
  $('#side').classList.remove('open');
  $('#mobileShade').classList.remove('open');
}

function openMenu() {
  $('#side').classList.add('open');
  $('#mobileShade').classList.add('
