/* =========================================================
   TASKYA AI — COMPLETE FRONTEND APP.JS
   Chat • Send • Enter • History • Markdown • Web • Upload
   Supabase Auth • Mobile Friendly
   ========================================================= */

(() => {
  'use strict';

  const C = window.TASKYA_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const S = {
    web: false,
    used: Number(localStorage.getItem('taskya_used') || 0),
    user: null,
    model: localStorage.getItem('taskya_model') || 'taskya-fast-v1',
    busy: false,
    file: null
  };

  let supabaseClient = null;

  /* -------------------- HELPERS -------------------- */

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[ch]);
  }

  function setText(selector, value) {
    const el = $(selector);
    if (el) el.textContent = value;
  }

  function setStatus(text, state = '') {
    const el = $('#agentState');
    if (!el) return;
    el.textContent = text;
    el.className = 'agent-state' + (state ? ' ' + state : '');
  }

  function scrollToBottom(el) {
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }

  function apiUrl(path) {
    const base = String(C.API_BASE_URL || '').replace(/\/+$/, '');
    if (!base) {
      throw new Error('API_BASE_URL is missing in config.js');
    }
    return base + path;
  }

  /* -------------------- MARKDOWN -------------------- */

  function inlineMarkdown(value) {
    let s = esc(value);

    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    return s;
  }

  function renderMarkdown(value) {
    const lines = String(value || '')
      .replace(/\r\n/g, '\n')
      .split('\n');

    let html = '';
    let ul = false;
    let ol = false;

    const closeLists = () => {
      if (ul) {
        html += '</ul>';
        ul = false;
      }
      if (ol) {
        html += '</ol>';
        ol = false;
      }
    };

    const isSeparator = line =>
      /^\|?\s*:?-{2,}\s*(\|\s*:?-{2,}\s*)+\|?$/.test(line);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) {
        closeLists();
        continue;
      }

      /* Markdown tables */
      if (
        line.includes('|') &&
        i + 1 < lines.length &&
        isSeparator(lines[i + 1].trim())
      ) {
        closeLists();

        const headers = line
          .replace(/^\||\|$/g, '')
          .split('|')
          .map(x => x.trim());

        html += '<div class="answer-table-wrap"><table class="answer-table"><thead><tr>';

        headers.forEach(cell => {
          html += '<th>' + inlineMarkdown(cell) + '</th>';
        });

        html += '</tr></thead><tbody>';
        i += 2;

        while (i < lines.length) {
          const row = lines[i].trim();

          if (!row || !row.includes('|')) break;

          const cells = row
            .replace(/^\||\|$/g, '')
            .split('|')
            .map(x => x.trim());

          html += '<tr>';

          cells.forEach(cell => {
            html += '<td>' + inlineMarkdown(cell) + '</td>';
          });

          html += '</tr>';
          i++;
        }

        html += '</tbody></table></div>';
        i--;
        continue;
      }

      /* Headings */
      if (/^###\s+/.test(line)) {
        closeLists();
        html += '<h3>' +
          inlineMarkdown(line.replace(/^###\s+/, '')) +
          '</h3>';
        continue;
      }

      if (/^##\s+/.test(line) || /^#\s+/.test(line)) {
        closeLists();
        html += '<h2>' +
          inlineMarkdown(line.replace(/^#{1,2}\s+/, '')) +
          '</h2>';
        continue;
      }

      /* Bullet list */
      if (/^[-•*]\s+/.test(line)) {
        if (ol) {
          html += '</ol>';
          ol = false;
        }
        if (!ul) {
          html += '<ul>';
          ul = true;
        }

        html += '<li>' +
          inlineMarkdown(line.replace(/^[-•*]\s+/, '')) +
          '</li>';
        continue;
      }

      /* Numbered list */
      if (/^\d+[.)]\s+/.test(line)) {
        if (ul) {
          html += '</ul>';
          ul = false;
        }
        if (!ol) {
          html += '<ol>';
          ol = true;
        }

        html += '<li>' +
          inlineMarkdown(line.replace(/^\d+[.)]\s+/, '')) +
          '</li>';
        continue;
      }

      closeLists();
      html += '<p>' + inlineMarkdown(line) + '</p>';
    }

    closeLists();
    return html || '<p></p>';
  }

  /* -------------------- CHAT MESSAGES -------------------- */

  function msg(role, text) {
    const chat = $('#chat');
    if (!chat) throw new Error('Chat container #chat was not found.');

    const welcome = $('#welcome');
    if (welcome) welcome.classList.add('hidden');

    const item = document.createElement('div');
    item.className = 'msg ' + role;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = renderMarkdown(text);

    item.appendChild(bubble);
    chat.appendChild(item);

    scrollToBottom(item);
    return item;
  }

  function thinking(item) {
    const bubble = item?.querySelector('.bubble');
    if (bubble) {
      bubble.innerHTML =
        '<span class="shimmer" aria-label="Taskya is thinking">' +
        '<i></i><i></i><i></i>' +
        '<span>Taskya is thinking…</span></span>';
    }
    setStatus('Thinking…', 'thinking');
  }

  function typeText(item, text) {
    const bubble = item?.querySelector('.bubble');
    if (!bubble) return Promise.resolve();

    /* Render complete answer safely after response arrives. */
    bubble.innerHTML = renderMarkdown(text);
    scrollToBottom(item);
    return Promise.resolve();
  }

  /* -------------------- HISTORY -------------------- */

  function getHistory() {
    try {
      const value = JSON.parse(
        localStorage.getItem('taskya_history') || '[]'
      );
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistory(items) {
    try {
      localStorage.setItem(
        'taskya_history',
        JSON.stringify(items.slice(0, 12))
      );
    } catch (e) {
      console.warn('Could not save chat history:', e);
    }
  }

  function history() {
    const box = $('#history');
    if (!box) return;

    const items = getHistory();

    box.innerHTML = items.map((item, index) => {
      const question = typeof item === 'string'
        ? item
        : (item.question || '');

      return '<button type="button" class="history-item" ' +
        'data-history-index="' + index + '">' +
        esc(question) + '</button>';
    }).join('');

    $$('#history .history-item').forEach(button => {
      button.addEventListener('click', () => {
        openHistory(Number(button.dataset.historyIndex));
      });
    });
  }

  function openHistory(index) {
    const item = getHistory()[index];
    if (!item) return;

    const question = typeof item === 'string'
      ? item
      : (item.question || '');

    const answer = typeof item === 'string'
      ? ''
      : (item.answer || '');

    $$('.view').forEach(el => el.classList.add('hidden'));

    $('#agent')?.classList.remove('hidden');
    $('#welcome')?.classList.add('hidden');

    const chat = $('#chat');
    if (chat) chat.innerHTML = '';

    if (question) msg('user', question);
    if (answer) msg('ai', answer);

    setText('#crumb', 'Task History');
    closeMenu();
  }

  /* -------------------- USAGE -------------------- */

  function usage() {
    const limit = Number(C.FREE_TASK_LIMIT || 3);
    const remaining = Math.max(0, limit - S.used);

    setText(
      '#usage',
      S.user ? 'Workspace synced' : remaining + ' free tasks available'
    );
  }

  /* -------------------- AUTH -------------------- */

  async function initAuth() {
    if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) {
      usage();
      return;
    }

    try {
      if (!window.supabase?.createClient) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src =
            'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
          script.onload = resolve;
          script.onerror = () =>
            reject(new Error('Supabase library failed to load.'));
          document.head.appendChild(script);
        });
      }

      supabaseClient = window.supabase.createClient(
        C.SUPABASE_URL,
        C.SUPABASE_ANON_KEY
      );

      const result = await supabaseClient.auth.getSession();
      S.user = result.data?.session?.user || null;
      usage();

      supabaseClient.auth.onAuthStateChange((_event, session) => {
        S.user = session?.user || null;
        usage();
      });
    } catch (error) {
      console.error('Taskya Auth Error:', error);
      usage();
    }
  }

  function modal(html) {
    const body = $('#modalBody');
    const box = $('#modal');
    if (!body || !box) return;

    body.innerHTML = html;
    box.classList.remove('hidden');
  }

  function closeModal() {
    $('#modal')?.classList.add('hidden');
  }

  async function googleLogin() {
    const status = $('#am');
    const button = $('#google');

    if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) {
      if (status) {
        status.textContent =
          'Supabase URL or public key is missing in config.js.';
      }
      return;
    }

    if (button) button.disabled = true;

    try {
      if (!supabaseClient) {
        if (!window.supabase?.createClient) {
          throw new Error('Supabase library is not loaded.');
        }

        supabaseClient = window.supabase.createClient(
          C.SUPABASE_URL,
          C.SUPABASE_ANON_KEY
        );
      }

      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) throw error;
    } catch (error) {
      if (status) status.textContent = error.message || 'Google login failed.';
      if (button) button.disabled = false;
    }
  }

  function login() {
    modal(`
      <small>WELCOME TO TASKYA</small>
      <h2>Sign in to continue</h2>
      <p>Save chats, sync tasks and unlock your workspace.</p>
      <button class="google" id="google" type="button"
        style="width:100%;padding:13px;background:#fff;color:#202124;
        border:1px solid #dadce0;border-radius:12px;cursor:pointer">
        Continue with Google
      </button>
      <p>Or use email</p>
      <input id="em" type="email" placeholder="Email address">
      <input id="pw" type="password" placeholder="Password">
      <div class="authgrid">
        <button id="li" type="button">Log in</button>
        <button id="su" type="button">Create account</button>
      </div>
      <p id="am"></p>
    `);

    $('#google')?.addEventListener('click', googleLogin);

    ['li', 'su'].forEach(id => {
      $('#' + id)?.addEventListener('click', () => {
        setText(
          '#am',
          'Email login needs to be connected to Supabase Auth.'
        );
      });
    });
  }

  /* -------------------- SEND MESSAGE -------------------- */

  async function send() {
    const prompt = $('#prompt');
    const button = $('#send');

    if (!prompt || !button || S.busy) return;

    const question = prompt.value.trim();
    if (!question) {
      prompt.focus();
      return;
    }

    const limit = Number(C.FREE_TASK_LIMIT || 3);

    if (!S.user && S.used >= limit) {
      login();
      return;
    }

    S.busy = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');

    prompt.value = '';
    prompt.style.height = 'auto';

    msg('user', question);

    const answerElement = msg('ai', '');
    thinking(answerElement);

    const items = getHistory();
    items.unshift({
      question,
      answer: '',
      createdAt: new Date().toISOString()
    });
    saveHistory(items);
    history();

    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: question,
          web_enabled: S.web,
          style: 'Balanced',
          model: S.model,
          history: getHistory()
            .filter(item =>
              typeof item === 'object' &&
              item.answer &&
              item.question !== question
            )
            .slice(0, 10)
            .reverse()
            .flatMap(item => [
              { role: 'user', content: item.question },
              { role: 'assistant', content: item.answer }
            ])
        })
      });

      let data = {};

      try {
        data = await response.json();
      } catch (_) {
        throw new Error(
          'Server response was not valid JSON. Check the backend.'
        );
      }

      if (!response.ok) {
        throw new Error(
          data.detail || data.error || ('Server error ' + response.status)
        );
      }

      const answer = String(
        data.response ??
        data.answer ??
        data.message ??
        'Task completed.'
      );

      const updated = getHistory();

      if (
        updated.length &&
        typeof updated[0] === 'object' &&
        updated[0].question === question
      ) {
        updated[0].answer = answer;
        updated[0].updatedAt = new Date().toISOString();
        saveHistory(updated);
      }

      await typeText(answerElement, answer);

      S.used++;
      localStorage.setItem('taskya_used', String(S.used));

      usage();
      setStatus('Done', 'done');
      history();

    } catch (error) {
      console.error('Taskya send error:', error);

      const message = error.message || 'An unexpected error occurred.';

      await typeText(
        answerElement,
        'Sorry, your message could not be completed.\n\n' +
        '**Problem:** ' + message +
        '\n\nPlease check the Render backend URL in config.js and make sure /api/chat is working.'
      );

      const updated = getHistory();

      if (
        updated.length &&
        typeof updated[0] === 'object' &&
        updated[0].question === question
      ) {
        updated[0].answer = 'Error: ' + message;
        saveHistory(updated);
      }

      setStatus('Ready');
      history();

    } finally {
      S.busy = false;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      prompt.focus();
    }
  }

  /* -------------------- WEB SEARCH -------------------- */

  function toggleWeb() {
    S.web = !S.web;

    $('#web')?.classList.toggle('on', S.web);
    setText('#mode', S.web ? 'Web' : 'Auto');

    const checkbox = $('#web2');
    if (checkbox) checkbox.checked = S.web;
  }

  /* -------------------- FILE PICKER -------------------- */

  function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    S.file = file;

    const label = $('#file');
    if (label) {
      label.textContent = file.name;
      label.classList.remove('hidden');
    }

    /*
      This keeps the file selection visible.
      The existing /api/chat backend must support file uploads
      before the actual file contents can be sent to the AI.
    */
  }

  /* -------------------- MENU -------------------- */

  function closeMenu() {
    $('#side')?.classList.remove('open');
    $('#mobileShade')?.classList.remove('open');
  }

  function openMenu() {
    $('#side')?.classList.add('open');
    $('#mobileShade')?.classList.add('open');
  }

  /* -------------------- POLICIES -------------------- */

  function policy(type) {
    const policies = {
      privacy: [
        'Privacy Policy',
        'Taskya may process account information, prompts, usage data and technical logs to provide and secure the service.'
      ],
      terms: [
        'Terms of Service',
        'Use Taskya only for lawful purposes. AI output may contain errors and should be reviewed before important actions.'
      ],
      refund: [
        'Refund & Cancellation Policy',
        'Review the actual billing and refund terms before making a payment.'
      ],
      contact: [
        'Contact Taskya',
        'Support email: info@taskya.in'
      ]
    };

    const item = policies[type] || ['Taskya', ''];
    modal(
      '<small>LEGAL & SUPPORT</small>' +
      '<h2>' + esc(item[0]) + '</h2>' +
      '<p>' + esc(item[1]) + '</p>' +
      (type === 'contact'
        ? '<p><a href="mailto:info@taskya.in">info@taskya.in</a></p>'
        : '')
    );
  }

  /* -------------------- INITIALIZE EVENTS -------------------- */

  function init() {
    $('#send')?.addEventListener('click', send);

    /*
      Enter sends.
      Shift+Enter adds a new line.
    */
    $('#prompt')?.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        send();
      }
    });

    $('#prompt')?.addEventListener('input', event => {
      const el = event.target;
      el.style.height = 'auto';
      el.style.height = Math.min(130, el.scrollHeight) + 'px';
    });

    $('#web')?.addEventListener('click', toggleWeb);

    $('#web2')?.addEventListener('change', event => {
      S.web = event.target.checked;
      $('#web')?.classList.toggle('on', S.web);
      setText('#mode', S.web ? 'Web' : 'Auto');
    });

    $('#upload')?.addEventListener('change', handleUpload);

    $('#voice')?.addEventListener('click', () => {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        alert('Voice input is not supported in this browser. Try Chrome.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = event => {
        const transcript = event.results[0][0].transcript;
        const prompt = $('#prompt');

        if (prompt) {
          prompt.value = (prompt.value + ' ' + transcript).trim();
          prompt.dispatchEvent(new Event('input'));
          prompt.focus();
        }
      };

      recognition.onerror = event => {
        console.warn('Voice input error:', event.error);
      };

      recognition.start();
    });

    $('#clear')?.addEventListener('click', () => {
      localStorage.removeItem('taskya_history');
      const chat = $('#chat');
      if (chat) chat.innerHTML = '';
      $('#welcome')?.classList.remove('hidden');
      history();
    });

    $('#upgrade')?.addEventListener('click', () => {
      modal(
        '<small>TASKYA PRO</small>' +
        '<h2>More work. Fewer limits.</h2>' +
        '<p>Payment gateway activation is required before subscriptions can be purchased.</p>'
      );
    });

    $('#topUpgrade')?.addEventListener('click', () => {
      $('#upgrade')?.click();
    });

    $('#login')?.addEventListener('click', login);
    $('#topLogin')?.addEventListener('click', login);

    $('.x')?.addEventListener('click', closeModal);
    $('.shade')?.addEventListener('click', closeModal);

    $('#menu')?.addEventListener('click', openMenu);
    $('#sideClose')?.addEventListener('click', closeMenu);
    $('#mobileShade')?.addEventListener('click', closeMenu);

    $$('[data-policy]').forEach(button => {
      button.addEventListener('click', () => {
        policy(button.dataset.policy);
      });
    });

    $('#new')?.addEventListener('click', () => {
      $$('.view').
