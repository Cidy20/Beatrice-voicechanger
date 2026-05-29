'use strict';

const fs   = require('path');
const fsModule = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { ipcRenderer } = require('electron');

const APP_ROOT = process.env.APP_ROOT || process.cwd();

// 全局异常捕捉与可视化报警，加速多环境联调
window.addEventListener('error', (event) => {
  console.error('[Beatrice UI Error]', event.error);
  alert('Renderer Process Error: ' + event.message + '\nFile: ' + event.filename + ':' + event.lineno);
});

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
    model_config_error: "Model config file not found. Please check models directory.",
    no_speakers_found: "No speaker profiles found in TOML config.",
    failed_load_speakers: "Failed to load speakers: {err}",
    ui_config: "Interface Config",
    model_config: "Voice Models",
    upload_model_title: "Import new voice model (.zip)",
    upload_success: "Model uploaded successfully!",
    upload_failed: "Import failed: {err}",
    uploading: "Importing & Unzipping model...",
    invalid_model_zip: "Invalid model Zip. Could not find phone_extractor.bin"
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
    loading_speakers: "正在加载音色配置...",
    search_placeholder: "通过姓名或化学元素搜索音色...",
    voices_count: "找到 {shown} / {total} 种音色",
    all_voices_count: "共 {total} 种音色",
    empty_voices: "没有找到符合搜索条件的音色。",
    empty_voices_sub: "请尝试使用其他姓名或化学元素进行检索。",
    model_config_error: "未找到模型配置文件。请检查 models 目录结构。",
    no_speakers_found: "未在 TOML 配置中找到说话人配置文件。",
    failed_load_speakers: "加载音色失败: {err}",
    ui_config: "界面配置",
    model_config: "音色模型",
    upload_model_title: "导入新音色模型 (.zip 压缩包)",
    upload_success: "音色模型导入成功！",
    upload_failed: "导入失败: {err}",
    uploading: "正在导入并解压缩模型中...",
    invalid_model_zip: "无效的音色包。未在压缩包中检索到 phone_extractor.bin 权重文件。"
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

let availableModels    = [];
let activeModelDir     = 'models/beatrice_paraphernalia_jvs'; // Default model path relative to root

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

const modelsListContainer  = document.getElementById('models-list');
const btnUploadModel       = document.getElementById('btn-upload-model');
const modelZipInput        = document.getElementById('model-zip-input');

// ── LocalStorage Speaker-Specific Memory Helper (For Local Settings) ────────────

function getSpeakerLocalConfig(index) {
  const saved = localStorage.getItem(`beatrice-speaker-config-${activeModelDir}-${index}`);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function saveSpeakerLocalConfig(index, config) {
  const current = getSpeakerLocalConfig(index) || { pitch_shift: 0.0, formant_shift: 0.0 };
  const updated = { ...current, ...config };
  localStorage.setItem(`beatrice-speaker-config-${activeModelDir}-${index}`, JSON.stringify(updated));
}

// ── Multi-Model Loader ─────────────────────────────────────────────────────────

function scanModels() {
  try {
    const modelsPath = path.join(APP_ROOT, 'models');
    if (!fsModule.existsSync(modelsPath)) {
      fsModule.mkdirSync(modelsPath);
    }
    const files = fsModule.readdirSync(modelsPath);
    availableModels = files.filter(f => {
      const fullPath = path.join(modelsPath, f);
      // Check if it's a directory and contains a TOML file
      if (fsModule.statSync(fullPath).isDirectory()) {
        const children = fsModule.readdirSync(fullPath);
        return children.some(c => c.endsWith('.toml'));
      }
      return false;
    });

    renderModelsList();
  } catch (err) {
    console.error('[Beatrice] Error scanning models:', err);
  }
}

function getModelImage(modelName) {
  try {
    const modelDir = path.join(APP_ROOT, 'models', modelName);
    if (fsModule.existsSync(modelDir)) {
      const files = fsModule.readdirSync(modelDir);
      const imgFile = files.find(f => /\.(png|jpe?g|webp)$/i.test(f));
      if (imgFile) {
        return `models/${modelName}/${imgFile}`;
      }
    }
  } catch (e) {
    console.error('[Beatrice] Error finding model image:', e);
  }
  return 'models/beatrice_paraphernalia_jvs/noimage.png';
}

function renderModelsList() {
  modelsListContainer.innerHTML = '';
  if (availableModels.length === 0) return;

  availableModels.forEach(modelName => {
    const modelRelativePath = `models/${modelName}`;
    const isActive = modelRelativePath === activeModelDir;

    const card = document.createElement('div');
    card.className = `model-card${isActive ? ' active' : ''}`;
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', String(isActive));

    const displayName = modelName.replace('beatrice_paraphernalia_', '').toUpperCase().replaceAll('_', ' ');
    const imgSrc = getModelImage(modelName);

    card.innerHTML = `
      <div class="model-card-img-wrapper">
        <img class="model-card-img" src="${imgSrc}" alt="${displayName}" onerror="this.src='models/beatrice_paraphernalia_jvs/noimage.png'">
      </div>
      <div class="model-card-name">${displayName}</div>
    `;
    
    card.addEventListener('click', () => {
      if (modelRelativePath !== activeModelDir) {
        switchModel(modelRelativePath);
      }
    });

    modelsListContainer.appendChild(card);
  });
}

async function switchModel(modelPath) {
  activeModelDir = modelPath;
  localStorage.setItem('beatrice-active-model-dir', modelPath);
  renderModelsList();

  // Show loading
  speakersGrid.innerHTML = `
    <div class="loading-state" id="loading-state">
      <div class="spinner" aria-hidden="true"></div>
      <p data-i18n="loading_speakers">${t('loading_speakers')}</p>
    </div>`;

  // Hot Sync Python Backend Weights reload
  setBackendConfig({ model_dir: modelPath });

  // Load new speaker profile TOML configs
  activeSpeakerIndex = 0; // Reset active speaker on model change
  const savedIndex = localStorage.getItem(`beatrice-speaker-index-${activeModelDir}`);
  if (savedIndex !== null) {
    activeSpeakerIndex = parseInt(savedIndex, 10);
  }

  loadSpeakerData();
  applyBypassUI(voiceChangerBypass);
}

// ── File Upload / ZIP Extraction with Depth Normalization ───────────────────

btnUploadModel.addEventListener('click', async () => {
  try {
    const result = await ipcRenderer.invoke('select-model-source');
    if (result.canceled || result.filePaths.length === 0) return;

    const sourcePath = result.filePaths[0];
    const isZip = sourcePath.toLowerCase().endsWith('.zip');
    const modelsPath = path.join(APP_ROOT, 'models');
    const tempUnzipPath = path.join(modelsPath, '.tmp_upload');

    // Show loading
    speakersGrid.innerHTML = `
      <div class="loading-state">
        <div class="spinner" aria-hidden="true"></div>
        <p>${t('uploading')}</p>
      </div>`;

    if (isZip) {
      if (fsModule.existsSync(tempUnzipPath)) {
        fsModule.rmSync(tempUnzipPath, { recursive: true, force: true });
      }
      fsModule.mkdirSync(tempUnzipPath);

      // macOS 原生极速提取 ZIP
      exec(`unzip -o "${sourcePath}" -d "${tempUnzipPath}"`, (err) => {
        if (err) {
          alert(t('upload_failed', { err: err.message }));
          scanModels();
          loadSpeakerData();
          return;
        }
        processSelectedFolder(tempUnzipPath, path.basename(sourcePath, '.zip'), true);
      });
    } else {
      // 文件夹直接拷贝（在此过程中也将自动通过 findBinDirectory 锁定含 weights 的最内层）
      processSelectedFolder(sourcePath, path.basename(sourcePath), false);
    }
  } catch (err) {
    alert(t('upload_failed', { err: err.message }));
    scanModels();
    loadSpeakerData();
  }
});

// 通用的多维度模型扁平化导入策略函数
function processSelectedFolder(sourceDir, defaultModelName, isTempFolder) {
  const modelsPath = path.join(APP_ROOT, 'models');
  const tempUnzipPath = path.join(modelsPath, '.tmp_upload');

  try {
    // ── 深度递归搜索权重文件直接父层 ──
    const innerBinDir = findBinDirectory(sourceDir);
    if (!innerBinDir) {
      alert(t('invalid_model_zip'));
      if (isTempFolder && fsModule.existsSync(tempUnzipPath)) {
        fsModule.rmSync(tempUnzipPath, { recursive: true, force: true });
      }
      scanModels();
      loadSpeakerData();
      return;
    }

    const tomlFiles = fsModule.readdirSync(innerBinDir).filter(f => f.endsWith('.toml'));
    if (tomlFiles.length === 0) {
      alert(t('invalid_model_zip') + " (Missing .toml configuration)");
      if (isTempFolder && fsModule.existsSync(tempUnzipPath)) {
        fsModule.rmSync(tempUnzipPath, { recursive: true, force: true });
      }
      scanModels();
      loadSpeakerData();
      return;
    }

    const cleanModelName = defaultModelName.replace(/\s+/g, '_');
    const targetModelFolder = path.join(modelsPath, `beatrice_paraphernalia_${cleanModelName}`);

    if (fsModule.existsSync(targetModelFolder)) {
      fsModule.rmSync(targetModelFolder, { recursive: true, force: true });
    }
    fsModule.mkdirSync(targetModelFolder);

    // ── 仅拷贝文件，实现扁平化提取 ──
    const filesToCopy = fsModule.readdirSync(innerBinDir);
    filesToCopy.forEach(fileName => {
      const src = path.join(innerBinDir, fileName);
      const dest = path.join(targetModelFolder, fileName);
      if (fsModule.statSync(src).isFile()) {
        fsModule.copyFileSync(src, dest);
      }
    });

    if (isTempFolder && fsModule.existsSync(tempUnzipPath)) {
      fsModule.rmSync(tempUnzipPath, { recursive: true, force: true });
    }

    alert(t('upload_success'));
    
    scanModels();
    switchModel(`models/beatrice_paraphernalia_${cleanModelName}`);
  } catch (e) {
    alert(t('upload_failed', { err: e.message }));
    if (isTempFolder && fsModule.existsSync(tempUnzipPath)) {
      fsModule.rmSync(tempUnzipPath, { recursive: true, force: true });
    }
    scanModels();
    loadSpeakerData();
  }
}

function findBinDirectory(dir) {
  const files = fsModule.readdirSync(dir);
  if (files.includes('phone_extractor.bin')) {
    return dir;
  }
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fsModule.statSync(fullPath).isDirectory()) {
      const found = findBinDirectory(fullPath);
      if (found) return found;
    }
  }
  return null;
}

// ── TOML Speaker Loader ───────────────────────────────────────────────────────

function loadSpeakerData() {
  try {
    // Locate the active model configuration relative to root
    const paraphernalia_dir = path.join(APP_ROOT, activeModelDir);
    if (!fsModule.existsSync(paraphernalia_dir)) {
      showSpeakerError(t('model_config_error') + ` (未找到路径: ${paraphernalia_dir})`);
      return;
    }

    const children = fsModule.readdirSync(paraphernalia_dir);
    const tomlFile = children.find(c => c.endsWith('.toml'));
    if (!tomlFile) {
      showSpeakerError(t('model_config_error') + ` (未在 ${paraphernalia_dir} 下检索到 .toml 配置文件)`);
      return;
    }

    const tomlPath = path.join(paraphernalia_dir, tomlFile);
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

  localStorage.setItem(`beatrice-speaker-index-${activeModelDir}`, index);

  // ── Restore speaker-specific pitch & formant adjustments (Local Memory) ──
  const localConfig = getSpeakerLocalConfig(index) || { pitch_shift: 0.0, formant_shift: 0.0 };

  pitchSlider.value = localConfig.pitch_shift;
  pitchValSpan.textContent = `${localConfig.pitch_shift > 0 ? '+' : ''}${localConfig.pitch_shift.toFixed(1)} st`;
  pitchSlider.setAttribute('aria-valuenow', localConfig.pitch_shift);

  formantSlider.value = localConfig.formant_shift;
  formantValSpan.textContent = `${localConfig.formant_shift > 0 ? '+' : ''}${localConfig.formant_shift.toFixed(1)}`;
  formantSlider.setAttribute('aria-valuenow', localConfig.formant_shift);

  // Synchronise speaker selection, along with its specific pitch and formant configurations
  setBackendConfig({ 
    speaker_index: index,
    pitch_shift: localConfig.pitch_shift,
    formant_shift: localConfig.formant_shift
  });
}

// ── Power Toggle ──────────────────────────────────────────────────────────────

powerToggleBtn.addEventListener('click', () => {
  voiceChangerBypass = !voiceChangerBypass;
  applyBypassUI(voiceChangerBypass);
  localStorage.setItem('beatrice-bypass', voiceChangerBypass);
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

// 1. Noise Gate (Global Memory)
gateSlider.addEventListener('input', () => {
  const val = parseFloat(gateSlider.value);
  gateValSpan.textContent = val.toFixed(3);
  gateSlider.setAttribute('aria-valuenow', val);
  localStorage.setItem('beatrice-gate-threshold', val);
  setBackendConfig({ gate_threshold: val });
});

// 2. Pitch Shift (Local Model Memory)
pitchSlider.addEventListener('input', () => {
  const val = parseFloat(pitchSlider.value);
  pitchValSpan.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)} st`;
  pitchSlider.setAttribute('aria-valuenow', val);
  saveSpeakerLocalConfig(activeSpeakerIndex, { pitch_shift: val });
  setBackendConfig({ pitch_shift: val });
});

// 3. Formant Shift (Local Model Memory)
formantSlider.addEventListener('input', () => {
  const val = parseFloat(formantSlider.value);
  formantValSpan.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}`;
  formantSlider.setAttribute('aria-valuenow', val);
  saveSpeakerLocalConfig(activeSpeakerIndex, { formant_shift: val });
  setBackendConfig({ formant_shift: val });
});

// 4. Output Volume (Global Memory)
volumeSlider.addEventListener('input', () => {
  const val = parseFloat(volumeSlider.value);
  const pct = Math.round(val * 100);
  volumeValSpan.textContent = `${pct}%`;
  volumeSlider.setAttribute('aria-valuenow', pct);
  localStorage.setItem('beatrice-output-volume', val);
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

    // ── LocalStorage Device Restoration ──
    const savedIn = localStorage.getItem('beatrice-input-device');
    const savedOut = localStorage.getItem('beatrice-output-device');
    const savedMon = localStorage.getItem('beatrice-monitor-device');

    if (savedIn !== null && [...inputDeviceSelect.options].some(o => o.value === savedIn)) {
      inputDeviceSelect.value = savedIn;
      setBackendConfig({ input_device_id: savedIn });
    } else if ([...inputDeviceSelect.options].some(o => o.value === prevIn)) {
      inputDeviceSelect.value  = prevIn;
    }

    if (savedOut !== null && [...outputDeviceSelect.options].some(o => o.value === savedOut)) {
      outputDeviceSelect.value = savedOut;
      setBackendConfig({ output_device_id: savedOut });
    } else if ([...outputDeviceSelect.options].some(o => o.value === prevOut)) {
      outputDeviceSelect.value = prevOut;
    }

    if (savedMon !== null && [...monitorDeviceSelect.options].some(o => o.value === savedMon)) {
      monitorDeviceSelect.value = savedMon;
      setBackendConfig({ monitor_device_id: savedMon });
    } else if ([...monitorDeviceSelect.options].some(o => o.value === prevMon)) {
      monitorDeviceSelect.value = prevMon;
    }
  } catch {
    // Backend not yet available
  }
}

// Lazy-load devices on first focus of any dropdown
[inputDeviceSelect, outputDeviceSelect, monitorDeviceSelect].forEach(sel => {
  sel.addEventListener('focus', loadAudioDevices, { once: false });
});

inputDeviceSelect.addEventListener('change', () => {
  const val = inputDeviceSelect.value;
  localStorage.setItem('beatrice-input-device', val);
  setBackendConfig({ input_device_id: val });
});

outputDeviceSelect.addEventListener('change', () => {
  const val = outputDeviceSelect.value;
  localStorage.setItem('beatrice-output-device', val);
  setBackendConfig({ output_device_id: val });
});

monitorDeviceSelect.addEventListener('change', () => {
  const val = monitorDeviceSelect.value;
  localStorage.setItem('beatrice-monitor-device', val);
  setBackendConfig({ monitor_device_id: val });
});

hearYourselfToggle.addEventListener('change', () => {
  const checked = hearYourselfToggle.checked;
  monitorContainer.style.display = checked ? 'flex' : 'none';
  monitorContainer.style.flexDirection = 'column';
  monitorContainer.setAttribute('aria-hidden', String(!checked));
  localStorage.setItem('beatrice-hear-yourself', checked);
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

      // Prioritise LocalStorage. If not present, fall back to backend status
      const savedIn = localStorage.getItem('beatrice-input-device');
      const savedOut = localStorage.getItem('beatrice-output-device');
      const savedMon = localStorage.getItem('beatrice-monitor-device');
      const savedHearYourself = localStorage.getItem('beatrice-hear-yourself');

      if (savedIn !== null) {
        inputDeviceSelect.value = savedIn;
        setBackendConfig({ input_device_id: savedIn });
      } else if (status.input_device_id != null) {
        inputDeviceSelect.value = String(status.input_device_id);
      }

      if (savedOut !== null) {
        outputDeviceSelect.value = savedOut;
        setBackendConfig({ output_device_id: savedOut });
      } else if (status.output_device_id != null) {
        outputDeviceSelect.value = String(status.output_device_id);
      }

      if (savedMon !== null) {
        monitorDeviceSelect.value = savedMon;
        setBackendConfig({ monitor_device_id: savedMon });
      } else if (status.monitor_device_id != null) {
        monitorDeviceSelect.value = String(status.monitor_device_id);
      }

      if (savedHearYourself !== null) {
        const checked = savedHearYourself === 'true';
        hearYourselfToggle.checked = checked;
        monitorContainer.style.display = checked ? 'flex' : 'none';
        monitorContainer.style.flexDirection = 'column';
        monitorContainer.setAttribute('aria-hidden', String(!checked));
        setBackendConfig({ hear_yourself: checked });
      } else if (typeof status.hear_yourself === 'boolean') {
        hearYourselfToggle.checked = status.hear_yourself;
        monitorContainer.style.display = status.hear_yourself ? 'flex' : 'none';
        monitorContainer.style.flexDirection = 'column';
        monitorContainer.setAttribute('aria-hidden', String(!status.hear_yourself));
      }
      // ── 首次连接成功，全量将本地 LocalStorage 的控制及 DSP 状态强力热同步到后端 ──
      loadSavedAudioAndControls();
      
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

// ── Restore Slider & Control Configurations ────────────────────────────────────

function loadSavedAudioAndControls() {
  // 1. Noise Gate (Global Memory)
  const savedGate = localStorage.getItem('beatrice-gate-threshold');
  if (savedGate !== null) {
    const val = parseFloat(savedGate);
    gateSlider.value = val;
    gateValSpan.textContent = val.toFixed(3);
    gateSlider.setAttribute('aria-valuenow', val);
    setBackendConfig({ gate_threshold: val });
  }

  // 2. Volume (Global Memory)
  const savedVolume = localStorage.getItem('beatrice-output-volume');
  if (savedVolume !== null) {
    const val = parseFloat(savedVolume);
    volumeSlider.value = val;
    const pct = Math.round(val * 100);
    volumeValSpan.textContent = `${pct}%`;
    volumeSlider.setAttribute('aria-valuenow', pct);
    setBackendConfig({ volume: val });
  }

  // 3. Bypass (Global Memory)
  const savedBypass = localStorage.getItem('beatrice-bypass');
  if (savedBypass !== null) {
    voiceChangerBypass = savedBypass === 'true';
    applyBypassUI(voiceChangerBypass);
    setBackendConfig({ bypass: voiceChangerBypass });
  }

  // 4. Selected Speaker Index & Local Model parameters (Local Model Memory)
  const savedSpeakerIndex = localStorage.getItem(`beatrice-speaker-index-${activeModelDir}`);
  if (savedSpeakerIndex !== null) {
    activeSpeakerIndex = parseInt(savedSpeakerIndex, 10);
  } else {
    activeSpeakerIndex = 0;
  }
  
  const localConfig = getSpeakerLocalConfig(activeSpeakerIndex) || { pitch_shift: 0.0, formant_shift: 0.0 };
  
  pitchSlider.value = localConfig.pitch_shift;
  pitchValSpan.textContent = `${localConfig.pitch_shift > 0 ? '+' : ''}${localConfig.pitch_shift.toFixed(1)} st`;
  pitchSlider.setAttribute('aria-valuenow', localConfig.pitch_shift);
  
  formantSlider.value = localConfig.formant_shift;
  formantValSpan.textContent = `${localConfig.formant_shift > 0 ? '+' : ''}${localConfig.formant_shift.toFixed(1)}`;
  formantSlider.setAttribute('aria-valuenow', localConfig.formant_shift);

  setBackendConfig({ 
    speaker_index: activeSpeakerIndex,
    pitch_shift: localConfig.pitch_shift,
    formant_shift: localConfig.formant_shift
  });
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

// Load multi-model profiles
let savedActiveModel = localStorage.getItem('beatrice-active-model-dir');
if (savedActiveModel !== null) {
  activeModelDir = savedActiveModel;
}

scanModels();
// If the saved active model directory is no longer scanned, revert to default
if (!availableModels.some(m => `models/${m}` === activeModelDir)) {
  activeModelDir = 'models/beatrice_paraphernalia_jvs';
  localStorage.setItem('beatrice-active-model-dir', activeModelDir);
}
renderModelsList();

// Tell Python backend the initial model folder to sync VST3 weights
setBackendConfig({ model_dir: activeModelDir });

// Restore saved settings and hot-sync to python backend
loadSavedAudioAndControls();

loadSpeakerData();
applyBypassUI(voiceChangerBypass);   // initialise UI to correct state
setInterval(pollBackendStatus, 100);
