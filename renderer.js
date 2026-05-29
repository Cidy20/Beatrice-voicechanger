'use strict';

const fs   = require('path'); // We'll keep fs and path imports clean
const fsModule = require('fs');
const path = require('path');

// ── i18n Dictionary ──────────────────────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    app_title: "PROJECT BEATRICE · AI VOICE CHANGER",
    dsp_version: "Real-time DSP Engine v2.0.0",
    voice_changer: "Voice Changer",
    bypassed: "BYPASSED",
    live: "LIVE",
    audio_routing: "Audio Routing",
    input_microphone: "Input Microphone",
    default_microphone: "Default Microphone",
    output_device: "Output Device",
    default_speaker: "Default Speaker",
    hear_yourself: "Hear Yourself",
    monitor_device: "Monitor Device",
    default_headphones: "Default Headphones",
    input_controls: "Input Controls",
    noise_gate: "Noise Gate",
    input_level: "Input Level",
    dsp_modifiers: "DSP Modifiers",
    pitch_shift: "Pitch Shift",
    formant_shift: "Formant Shift",
    output_controls: "Output Controls",
    output_volume: "Output Volume",
    output_level: "Output Level",
    theme: "Theme",
    language: "Language",
    theme_cyber_neon: "Cyber Neon (Dark)",
    theme_deep_ocean: "Deep Ocean (Dark)",
    theme_sunset_crimson: "Sunset Crimson (Dark)",
    theme_nordic_light: "Nordic Light (Light)",
    theme_sakura_light: "Sakura Light (Light)",
    theme_cyber_mint_light: "Cyber Mint (Light)",
    connecting: "Connecting…",
    backend_connected: "Backend connected",
    backend_offline: "Backend offline",
    stream_active: "Audio Stream Active",
    waiting_backend: "Waiting for backend…",
    buffer: "Buffer:",
    target_voices: "Target Voices",
    target_voices_desc: "Select a JVS speaker to morph your voice. Each speaker maps to a unique chemical element in the periodic table.",
    loading_speakers: "Loading 100 speaker profiles…",
    search_placeholder: "Search 100 voices by name or element…",
    voices_count: "{shown} / {total} voices",
    all_voices_count: "{total} voices",
    empty_voices: "No voices match your search.",
    empty_voices_sub: "Try a different name or element.",
    model_config_error: "Model config file not found. Please check beatrice_paraphernalia_jvs/",
    no_speakers_found: "No speaker profiles found in TOML config.",
    failed_load_speakers: "Failed to load speakers: {err}"
  },
  zh: {
    app_title: "BEATRICE 项目 · AI 变声器",
    dsp_version: "实时 DSP 引擎 v2.0.0",
    voice_changer: "变声器开关",
    bypassed: "已旁路",
    live: "工作模式",
    audio_routing: "音频路由",
    input_microphone: "输入麦克风",
    default_microphone: "默认麦克风",
    output_device: "输出设备",
    default_speaker: "默认扬声器",
    hear_yourself: "耳返监听",
    monitor_device: "耳返设备",
    default_headphones: "默认耳机",
    input_controls: "输入控制",
    noise_gate: "降噪门限",
    input_level: "输入电平",
    dsp_modifiers: "DSP 调节",
    pitch_shift: "音高偏差",
    formant_shift: "共振峰偏差",
    output_controls: "输出控制",
    output_volume: "输出音量",
    output_level: "输出电平",
    theme: "界面主题",
    language: "界面语言",
    theme_cyber_neon: "赛博霓虹 (深色)",
    theme_deep_ocean: "深海翡翠 (深色)",
    theme_sunset_crimson: "暮色红莲 (深色)",
    theme_nordic_light: "极简北欧 (浅色)",
    theme_sakura_light: "粉黛樱花 (浅色)",
    theme_cyber_mint_light: "薄荷冰晶 (浅色)",
    connecting: "正在连接后端...",
    backend_connected: "后端已连接",
    backend_offline: "后端未启动",
    stream_active: "音频流传输中",
    waiting_backend: "等待变声引擎...",
    buffer: "缓冲区:",
    target_voices: "变声音色列表",
    target_voices_desc: "选择一个 JVS 说话人来改变您的声音。每个说话人均对应元素周期表中的一个独特化学元素。",
    loading_speakers: "正在加载 100 位说话人配置...",
    search_placeholder: "通过姓名或化学元素搜索 100 种音色...",
    voices_count: "找到 {shown} / {total} 种音色",
    all_voices_count: "共 {total} 种音色",
    empty_voices: "没有找到符合搜索条件的音色。",
    empty_voices_sub: "请尝试使用其他姓名或化学元素进行检索。",
    model_config_error: "未找到模型配置文件。请检查 beatrice_paraphernalia_jvs/ 目录是否存在。",
    no_speakers_found: "未在 TOML 配置中找到说话人配置文件。",
    failed_load_speakers: "加载音色失败: {err}"
  }
};

let currentLanguage = 'zh'; // Default to Chinese

function t(key, replaces = {}) {
  let text = (TRANSLATIONS[currentLanguage] && TRANSLATIONS[currentLanguage][key]) || TRANSLATIONS['en'][key] || key;
  for (const [k, v] of Object.entries(replaces)) {
    text = text.replaceAll(`{${k}}`, v);
  }
  return text;
}

function applyLanguage(lang) {
  currentLanguage = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });

  // Re-sync dynamic elements text
  applyBypassUI(voiceChangerBypass);
  if (speakerProfiles.length > 0) {
    const query = searchBox.value.toLowerCase().trim();
    if (query) {
      const filteredCount = speakersGrid.querySelectorAll('.speaker-card').length;
      updateSearchCount(filteredCount, speakerProfiles.length);
    } else {
      updateSearchCount(speakerProfiles.length, speakerProfiles.length);
    }
  }
  setBackendStatus(backendOnline);
}

// ── State ─────────────────────────────────────────────────────────────────────
let speakerProfiles    = [];
let activeSpeakerIndex = 0;
// Match Python backend startup state: bypass=false means DSP is ACTIVE
let voiceChangerBypass = false;
let devicesLoaded      = false;
let backendOnline      = false;

// ── DOM References ─────────────────────────────────────────────────────────────
const powerToggleBtn       = document.getElementById('power-toggle');
const bypassStatusEl       = document.getElementById('bypass-status');
const powerLabelEl         = document.getElementById('power-label');

const gateSlider           = document.getElementById('gate-slider');
const gateValSpan          = document.getElementById('gate-val');
const inputMeterFill       = document.getElementById('input-meter-fill');
const inputDbVal           = document.getElementById('input-db-val');

const pitchSlider          = document.getElementById('pitch-slider');
const pitchValSpan         = document.getElementById('pitch-val');

const formantSlider        = document.getElementById('formant-slider');
const formantValSpan       = document.getElementById('formant-val');

const volumeSlider         = document.getElementById('volume-slider');
const volumeValSpan        = document.getElementById('volume-val');
const outputMeterFill      = document.getElementById('output-meter-fill');
const outputDbVal          = document.getElementById('output-db-val');

const searchBox            = document.getElementById('search-box');
const searchCount          = document.getElementById('search-count');
const speakersGrid         = document.getElementById('speakers-grid');

const inputDeviceSelect    = document.getElementById('input-device-select');
const outputDeviceSelect   = document.getElementById('output-device-select');
const monitorDeviceSelect  = document.getElementById('monitor-device-select');
const hearYourselfToggle   = document.getElementById('hear-yourself-toggle');
const monitorContainer     = document.getElementById('monitor-container');

const connDot              = document.getElementById('conn-dot');
const connLabel            = document.getElementById('conn-label');
const streamDot            = document.getElementById('stream-dot');
const streamStatusText     = document.getElementById('stream-status-text');

const themeSelect          = document.getElementById('theme-select');
const langSelect           = document.getElementById('lang-select');

// ── TOML Speaker Loader ───────────────────────────────────────────────────────

function loadSpeakerData() {
  try {
    const tomlPath = path.join(__dirname, 'beatrice_paraphernalia_jvs', 'beatrice_paraphernalia_jvs.toml');
    if (!fsModule.existsSync(tomlPath)) {
      showSpeakerError(t('model_config_error'));
      return;
    }
    const tomlText = fsModule.readFileSync(tomlPath, 'utf8');
    speakerProfiles = parseTOML(tomlText);

    if (speakerProfiles.length === 0) {
      showSpeakerError(t('no_speakers_found'));
      return;
    }

    renderSpeakers(speakerProfiles);
    updateSearchCount(speakerProfiles.length, speakerProfiles.length);
  } catch (err) {
    console.error('[Beatrice] Error loading speaker config:', err);
    showSpeakerError(t('failed_load_speakers', { err: err.message }));
  }
}

function parseTOML(text) {
  const speakers = [];
  let cur = null;
  let inDesc = false;
  let descLines = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    // --- multi-line description accumulator ---
    if (inDesc) {
      if (line.endsWith('"""')) {
        descLines.push(line.slice(0, -3));
        if (cur) cur.description = descLines.join('\n').trim();
        inDesc = false;
        descLines = [];
      } else {
        descLines.push(rawLine);
      }
      continue;
    }

    // --- [voice.N] section header ---
    const voiceMatch = line.match(/^\[voice\.(\d+)\]$/);
    if (voiceMatch) {
      cur = { index: parseInt(voiceMatch[1], 10), name: '', description: '', average_pitch: 0 };
      speakers.push(cur);
      continue;
    }

    if (!cur) continue;

    // --- name field ---
    if (line.startsWith('name =')) {
      cur.name = line.slice(line.indexOf('=') + 1).trim().replace(/^"|"$/g, '');
      continue;
    }

    // --- average_pitch field ---
    if (line.startsWith('average_pitch =')) {
      const v = parseFloat(line.split('=')[1]);
      if (!isNaN(v)) cur.average_pitch = v;
      continue;
    }

    // --- description = """ (multi-line string start) ---
    if (line.startsWith('description = """')) {
      const afterOpen = line.slice('description = """'.length);
      // Single-line triple-quoted string
      if (afterOpen.endsWith('"""')) {
        cur.description = afterOpen.slice(0, -3).trim();
      } else {
        inDesc = true;
        descLines = [afterOpen];
      }
      continue;
    }
  }

  return speakers;
}

// ── Render Speakers ───────────────────────────────────────────────────────────

/**
 * Derive a short element tag from a speaker description.
 * Returns e.g. "Hydrogen (H)" or falls back to "JVS Voice".
 */
function extractElement(description) {
  const m = description.match(/Element:\s*\r?\n\s*(.+)/i);
  return m ? m[1].trim() : 'JVS Voice';
}

/**
 * Generate a deterministic hue from the periodic-table element symbol for
 * colour variety across the 100 cards.
 */
function elementHue(elementStr) {
  // Extract abbreviation, e.g. "Hydrogen (H)" → "H"
  const sym = (elementStr.match(/\(([^)]+)\)/) || [])[1] || elementStr;
  let hash = 0;
  for (let i = 0; i < sym.length; i++) {
    hash = (hash * 31 + sym.charCodeAt(i)) & 0xffff;
  }
  return hash % 360;
}

function renderSpeakers(profiles) {
  speakersGrid.innerHTML = '';

  if (profiles.length === 0) {
    speakersGrid.innerHTML = `
      <div class="empty-state" role="status">
        <div class="empty-state-icon" aria-hidden="true">🔍</div>
        <p>${t('empty_voices')}</p>
        <small>${t('empty_voices_sub')}</small>
      </div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  profiles.forEach((speaker, i) => {
    const elemStr = extractElement(speaker.description);
    const hue     = elementHue(elemStr);
    const jvsId   = `JVS-${String(speaker.index + 1).padStart(3, '0')}`;
    const isActive = speaker.index === activeSpeakerIndex;

    // First line of description (before the Element: block)
    const firstLine = speaker.description.split('\n').find(l => l.trim() && !l.trim().startsWith('Element:')) || '';

    const card = document.createElement('div');
    card.className = `card speaker-card${isActive ? ' active' : ''}`;
    card.id        = `speaker-card-${speaker.index}`;
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', String(isActive));
    card.setAttribute('tabindex', '0');
    card.style.animationDelay = `${Math.min(i * 18, 600)}ms`;

    const isDefaultTag = elemStr === 'JVS Voice';

    // Inline colour from element hue
    card.innerHTML = `
      <div class="speaker-elem-tag"
           ${isDefaultTag ? '' : `style="--elem-hue:${hue};"`}
           aria-hidden="true">${elemStr}</div>
      <div class="speaker-id">${jvsId}</div>
      <div class="speaker-name">${speaker.name}</div>
      <div class="speaker-desc">${firstLine.trim()}</div>
      <div class="speaker-pitch">
        ♩&nbsp;<span class="speaker-pitch-val">${speaker.average_pitch.toFixed(1)} Hz</span>
      </div>`;

    // Click
    card.addEventListener('click', () => selectSpeaker(speaker.index));

    // Keyboard activation
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectSpeaker(speaker.index);
      }
    });

    frag.appendChild(card);
  });

  speakersGrid.appendChild(frag);
}

function showSpeakerError(msg) {
  speakersGrid.innerHTML = `
    <div class="empty-state" role="alert">
      <div class="empty-state-icon" aria-hidden="true">⚠️</div>
      <p>${msg}</p>
    </div>`;
}

// ── Backend Communication ─────────────────────────────────────────────────────

const BACKEND_URL = 'http://127.0.0.1:5005';

async function setBackendConfig(params) {
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${BACKEND_URL}/set_config?${qs}`);
    if (!res.ok) console.warn('[Beatrice] Backend returned', res.status);
  } catch (err) {
    // Silently ignore — status poll will surface disconnect
  }
}

// ── Speaker Selection ─────────────────────────────────────────────────────────

function selectSpeaker(index) {
  const prev = document.getElementById(`speaker-card-${activeSpeakerIndex}`);
  if (prev) {
    prev.classList.remove('active');
    prev.setAttribute('aria-selected', 'false');
  }

  activeSpeakerIndex = index;

  const next = document.getElementById(`speaker-card-${activeSpeakerIndex}`);
  if (next) {
    next.classList.add('active');
    next.setAttribute('aria-selected', 'true');
    // Scroll into view smoothly if needed
    next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  setBackendConfig({ speaker_index: index });
}

// ── Power Toggle ──────────────────────────────────────────────────────────────

powerToggleBtn.addEventListener('click', () => {
  voiceChangerBypass = !voiceChangerBypass;
  applyBypassUI(voiceChangerBypass);
  setBackendConfig({ bypass: voiceChangerBypass });
});

function applyBypassUI(bypass) {
  if (bypass) {
    powerToggleBtn.classList.add('active');        // red glow = bypassed
    powerToggleBtn.setAttribute('aria-pressed', 'false');
    bypassStatusEl.className  = 'bypass-indicator active';
    bypassStatusEl.textContent = t('bypassed');
    powerLabelEl.textContent  = t('bypassed');
  } else {
    powerToggleBtn.classList.remove('active');     // no glow = live processing
    powerToggleBtn.setAttribute('aria-pressed', 'true');
    bypassStatusEl.className  = 'bypass-indicator live';
    bypassStatusEl.textContent = t('live');
    powerLabelEl.textContent  = t('live');
  }
}

// ── Slider Bindings ───────────────────────────────────────────────────────────

gateSlider.addEventListener('input', () => {
  const val = parseFloat(gateSlider.value);
  gateValSpan.textContent = val.toFixed(3);
  gateSlider.setAttribute('aria-valuenow', val);
  setBackendConfig({ gate_threshold: val });
});

pitchSlider.addEventListener('input', () => {
  const val = parseFloat(pitchSlider.value);
  pitchValSpan.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)} st`;
  pitchSlider.setAttribute('aria-valuenow', val);
  setBackendConfig({ pitch_shift: val });
});

formantSlider.addEventListener('input', () => {
  const val = parseFloat(formantSlider.value);
  formantValSpan.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}`;
  formantSlider.setAttribute('aria-valuenow', val);
  setBackendConfig({ formant_shift: val });
});

volumeSlider.addEventListener('input', () => {
  const val = parseFloat(volumeSlider.value);
  const pct = Math.round(val * 100);
  volumeValSpan.textContent = `${pct}%`;
  volumeSlider.setAttribute('aria-valuenow', pct);
  setBackendConfig({ volume: val });
});

// ── Search ────────────────────────────────────────────────────────────────────

let searchDebounce = null;

searchBox.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const query = searchBox.value.toLowerCase().trim();
    if (!query) {
      renderSpeakers(speakerProfiles);
      updateSearchCount(speakerProfiles.length, speakerProfiles.length);
      return;
    }
    const filtered = speakerProfiles.filter(s => {
      const id = `jvs-${String(s.index + 1).padStart(3, '0')}`;
      return (
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        id.includes(query)
      );
    });
    renderSpeakers(filtered);
    updateSearchCount(filtered.length, speakerProfiles.length);
  }, 120);
});

function updateSearchCount(shown, total) {
  if (shown === total) {
    searchCount.textContent = t('all_voices_count', { total });
  } else {
    searchCount.textContent = t('voices_count', { shown, total });
  }
}

// ── Audio Device Loader ───────────────────────────────────────────────────────

async function loadAudioDevices() {
  try {
    const res     = await fetch(`${BACKEND_URL}/devices`);
    const devices = await res.json();

    const prevIn  = inputDeviceSelect.value;
    const prevOut = outputDeviceSelect.value;
    const prevMon = monitorDeviceSelect.value;

    inputDeviceSelect.innerHTML   = `<option value="null">${t('default_microphone')}</option>`;
    outputDeviceSelect.innerHTML  = `<option value="null">${t('default_speaker')}</option>`;
    monitorDeviceSelect.innerHTML = `<option value="null">${t('default_headphones')}</option>`;

    devices.forEach(dev => {
      const makeOpt = () => {
        const o = document.createElement('option');
        o.value = dev.id;
        o.textContent = dev.name;
        return o;
      };
      if (dev.max_input_channels  > 0) inputDeviceSelect.appendChild(makeOpt());
      if (dev.max_output_channels > 0) {
        outputDeviceSelect.appendChild(makeOpt());
        monitorDeviceSelect.appendChild(makeOpt());
      }
    });

    if ([...inputDeviceSelect.options].some(o => o.value === prevIn))   inputDeviceSelect.value  = prevIn;
    if ([...outputDeviceSelect.options].some(o => o.value === prevOut)) outputDeviceSelect.value = prevOut;
    if ([...monitorDeviceSelect.options].some(o => o.value === prevMon)) monitorDeviceSelect.value = prevMon;
  } catch {
    // Backend not yet available
  }
}

// Lazy-load devices on first focus of any dropdown
[inputDeviceSelect, outputDeviceSelect, monitorDeviceSelect].forEach(sel => {
  sel.addEventListener('focus', loadAudioDevices, { once: false });
});

inputDeviceSelect.addEventListener('change', () =>
  setBackendConfig({ input_device_id: inputDeviceSelect.value }));

outputDeviceSelect.addEventListener('change', () =>
  setBackendConfig({ output_device_id: outputDeviceSelect.value }));

monitorDeviceSelect.addEventListener('change', () =>
  setBackendConfig({ monitor_device_id: monitorDeviceSelect.value }));

hearYourselfToggle.addEventListener('change', () => {
  const checked = hearYourselfToggle.checked;
  monitorContainer.style.display = checked ? 'flex' : 'none';
  monitorContainer.style.flexDirection = 'column';
  monitorContainer.setAttribute('aria-hidden', String(!checked));
  setBackendConfig({ hear_yourself: checked });
});

// ── Backend Status Polling ────────────────────────────────────────────────────

/**
 * Convert a linear 0-1 meter value to a dBFS string.
 * Returns "—" at silence.
 */
function linearToDb(linear) {
  if (linear <= 0.0001) return '—';
  const db = 20 * Math.log10(linear);
  return `${db.toFixed(0)} dB`;
}

function setBackendStatus(online) {
  backendOnline = online;

  if (online) {
    connDot.className = 'conn-dot connected';
    connLabel.textContent = t('backend_connected');
    streamDot.className  = 'status-dot live';
    streamStatusText.textContent = t('stream_active');
  } else {
    connDot.className = 'conn-dot error';
    connLabel.textContent = t('backend_offline');
    streamDot.className  = 'status-dot error';
    streamStatusText.textContent = t('backend_offline');
    inputMeterFill.style.width  = '0%';
    outputMeterFill.style.width = '0%';
    inputDbVal.textContent  = '—';
    outputDbVal.textContent = '—';
  }
}

async function pollBackendStatus() {
  try {
    const res    = await fetch(`${BACKEND_URL}/status`, { signal: AbortSignal.timeout(800) });
    const status = await res.json();

    setBackendStatus(true);

    // One-time device sync on first successful poll
    if (!devicesLoaded) {
      await loadAudioDevices();
      if (status.input_device_id   != null) inputDeviceSelect.value  = String(status.input_device_id);
      if (status.output_device_id  != null) outputDeviceSelect.value = String(status.output_device_id);
      if (status.monitor_device_id != null) monitorDeviceSelect.value = String(status.monitor_device_id);
      if (typeof status.hear_yourself === 'boolean') {
        hearYourselfToggle.checked = status.hear_yourself;
        monitorContainer.style.display = status.hear_yourself ? 'flex' : 'none';
        monitorContainer.style.flexDirection = 'column';
        monitorContainer.setAttribute('aria-hidden', String(!status.hear_yourself));
      }
      devicesLoaded = true;
    }

    // VU meters — scale 0-1 linear → 0-100% bar width
    const inW  = Math.min(100, (status.input_meter  || 0) * 350);
    const outW = Math.min(100, (status.output_meter || 0) * 350);

    inputMeterFill.style.width  = `${inW}%`;
    outputMeterFill.style.width = `${outW}%`;

    inputDbVal.textContent  = linearToDb(status.input_meter  || 0);
    outputDbVal.textContent = linearToDb(status.output_meter || 0);

    // Sync bypass state if changed externally
    if (typeof status.bypass === 'boolean' && status.bypass !== voiceChangerBypass) {
      voiceChangerBypass = status.bypass;
      applyBypassUI(voiceChangerBypass);
    }
  } catch {
    setBackendStatus(false);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

// Load user preferences for Theme & Language
let savedTheme = localStorage.getItem('beatrice-theme') || 'cyber-neon';
let savedLang  = localStorage.getItem('beatrice-lang') || 'zh'; // Default to Chinese

document.body.setAttribute('data-theme', savedTheme);
themeSelect.value = savedTheme;

langSelect.value = savedLang;
applyLanguage(savedLang);

themeSelect.addEventListener('change', () => {
  const theme = themeSelect.value;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('beatrice-theme', theme);
});

langSelect.addEventListener('change', () => {
  const lang = langSelect.value;
  localStorage.setItem('beatrice-lang', lang);
  applyLanguage(lang);
});

loadSpeakerData();
applyBypassUI(voiceChangerBypass);   // initialise UI to correct state
setInterval(pollBackendStatus, 100);
