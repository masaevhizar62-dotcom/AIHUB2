import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  Settings,
  History as HistoryIcon,
  Bookmark,
  Plus,
  X,
  Copy,
  Check,
  Search,
  Pin,
  PinOff,
  ChevronDown,
  ChevronLeft,
  Trash2,
  Sparkles,
  Sun,
  Moon,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  AlertCircle,
  ArrowUpRight,
  RotateCcw
} from 'lucide-react';

/* =========================================================================
   PERFORMANCE NOTES (Poco F5 / 120Hz panel)
   -------------------------------------------------------------------------
   1. Every interactive transition below animates only `transform` and
      `opacity` — the two properties the compositor can run without
      triggering layout/paint, so they stay smooth at 120fps.
   2. `active:scale-[0.96] transition-transform duration-100` gives instant
      tactile feedback on tap without waiting for a full re-render.
   3. List rows (history, templates, app chips) are wrapped in `memo()` so
      typing in the composer does not re-render rows that haven't changed.
   4. Handlers passed down to memoized rows are wrapped in `useCallback` so
      their identity is stable across renders (otherwise memo() is defeated).
   5. `content-visibility:auto` is set on long scrollable lists so the
      browser skips layout work for rows currently off-screen.
   6. No JS-driven animation loops (no setInterval-based motion) — anything
      that moves is a CSS transition, which the browser can schedule against
      the real display refresh rate instead of a fixed 60fps timer.
   ========================================================================= */

// --- INITIAL DATA & AI APP CONFIGURATIONS ---
const DEFAULT_AI_APPS = [
  {
    id: 'gemini',
    name: 'Gemini',
    packageName: 'com.google.android.apps.bard',
    brandColor: '#1A73E8',
    isPinned: true,
    isInstalled: true,
    description: 'Google AI ассистент',
    slashCommands: [
      { command: '/Видео', label: 'Генерация видео по описанию', tag: '[Режим: Видео] ' },
      { command: '/Генерация', label: 'Генерация изображения по описанию', tag: '[Режим: Генерация фото] ' },
    ]
  },
  {
    id: 'claude',
    name: 'Claude',
    packageName: 'com.anthropic.claude',
    brandColor: '#D97706',
    isPinned: true,
    isInstalled: true,
    description: 'Anthropic Claude AI',
    slashCommands: [
      { command: '/Кратко', label: 'Сформулировать ответ лаконично', tag: '[Инструкция: Ответь максимально кратко] ' },
      { command: '/Код', label: 'Запрос на написание и аудит кода', tag: '[Инструкция: Напиши чистый код] ' },
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    packageName: 'com.deepseek.chat',
    brandColor: '#2563EB',
    isPinned: true,
    isInstalled: true,
    description: 'DeepSeek R1 и Vision',
    slashCommands: [
      { command: '/Распознавание', label: 'Режим распознавания и анализа изображений', tag: '[DeepSeek Vision] ' },
      { command: '/Поиск', label: 'Включить веб-поиск в реальном времени', tag: '[DeepSeek Search] ' },
      { command: '/Рассуждение', label: 'Включить пошаговое рассуждение (R1)', tag: '[DeepSeek Reasoner R1] ' },
    ]
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    packageName: 'com.openai.chatgpt',
    brandColor: '#10B981',
    isPinned: true,
    isInstalled: true,
    description: 'OpenAI ChatGPT',
    slashCommands: [
      { command: '/Перевод', label: 'Перевести текст на русский язык', tag: '[Инструкция: Переведи на русский] ' },
    ]
  },
  {
    id: 'grok',
    name: 'Grok',
    packageName: 'com.x.grok',
    brandColor: '#6B7280',
    isPinned: false,
    isInstalled: true,
    description: 'xAI Grok',
    slashCommands: []
  },
  {
    id: 'qwen',
    name: 'Qwen Studio',
    packageName: 'com.alibaba.qwen',
    brandColor: '#7C3AED',
    isPinned: false,
    isInstalled: false,
    description: 'Alibaba Qwen LLM',
    slashCommands: []
  },
  {
    id: 'kimi',
    name: 'Kimi',
    packageName: 'com.moonshot.kimichat',
    brandColor: '#EC4899',
    isPinned: false,
    isInstalled: false,
    description: 'Moonshot AI Kimi',
    slashCommands: []
  }
];

const GENERAL_SLASH_COMMANDS = [
  { command: '/Кратко', label: 'Сформулировать краткий и точный ответ', tag: '[Инструкция: Ответь кратко] ' },
  { command: '/Перевод', label: 'Перевести сообщение на русский язык', tag: '[Инструкция: Переведи на русский] ' },
  { command: '/Код', label: 'Режим написания и анализа кода', tag: '[Инструкция: Ответь в виде кода] ' }
];

const INITIAL_TEMPLATES = [
  {
    id: 't1',
    title: 'Рефакторинг кода',
    text: 'Проведи ревью этого кода, найди потенциальные баги, узкие места в производительности и предложи улучшенную версию:',
    tag: 'Разработка'
  },
  {
    id: 't2',
    title: 'Сводка и выжимка',
    text: 'Сделай краткую структурированную выжимку текста выше в виде ключевых тезисов с буллетами:',
    tag: 'Анализ'
  },
  {
    id: 't3',
    title: 'Анализ фото / документа',
    text: 'Внимательно изучи прикреплённый файл и подробно опиши, что на нём изображено, либо переведи содержимое в текст:',
    tag: 'Зрение / OCR'
  }
];

const ACCENT_COLORS = {
  monochrome: { name: 'Монохром', primary: 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900', ring: 'ring-zinc-500', hex: '#71717a' },
  emerald: { name: 'Изумруд', primary: 'bg-emerald-600 text-white', ring: 'ring-emerald-500', hex: '#059669' },
  indigo: { name: 'Индиго', primary: 'bg-indigo-600 text-white', ring: 'ring-indigo-500', hex: '#4f46e5' },
  rose: { name: 'Розовый', primary: 'bg-rose-600 text-white', ring: 'ring-rose-500', hex: '#e11d48' },
  amber: { name: 'Янтарь', primary: 'bg-amber-600 text-white', ring: 'ring-amber-500', hex: '#d97706' },
};

// A single shared tap-feedback class used everywhere for a consistent,
// 120Hz-friendly press animation (transform + opacity only).
const TAP = 'transition-transform duration-100 ease-out active:scale-[0.96] touch-manipulation';

const AppLogo = memo(function AppLogo({ appId, className = 'w-5 h-5' }) {
  switch (appId) {
    case 'gemini':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" fill="url(#gemini-grad)" />
          <defs>
            <linearGradient id="gemini-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4285F4" />
              <stop offset="0.5" stopColor="#9B51E0" />
              <stop offset="1" stopColor="#E91E63" />
            </linearGradient>
          </defs>
        </svg>
      );
    case 'claude':
      return (
        <div className={`${className} flex items-center justify-center font-serif font-bold text-amber-700 dark:text-amber-400 border border-amber-500/40 rounded-full text-xs`}>C</div>
      );
    case 'deepseek':
      return (
        <div className={`${className} flex items-center justify-center font-mono font-bold text-blue-600 dark:text-blue-400 border border-blue-500/40 rounded-md text-[10px]`}>DS</div>
      );
    case 'chatgpt':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.259 23a6.0557 6.0557 0 0 0 5.7712-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.746-7.0729z" />
        </svg>
      );
    case 'grok':
      return <div className={`${className} flex items-center justify-center font-black text-zinc-900 dark:text-zinc-100 text-xs`}>𝕏</div>;
    case 'qwen':
      return <div className={`${className} flex items-center justify-center font-bold text-purple-600 dark:text-purple-400 text-xs`}>Q</div>;
    case 'kimi':
      return <div className={`${className} flex items-center justify-center font-bold text-pink-600 dark:text-pink-400 text-xs`}>K</div>;
    default:
      return <Sparkles className={className} />;
  }
});

// --- Memoized row: app chip in the bottom picker ---
const AppChip = memo(function AppChip({ app, isSelected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(app.id)}
      className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full border ${TAP} ${
        isSelected
          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
      } ${!app.isInstalled ? 'opacity-40' : ''}`}
    >
      <AppLogo appId={app.id} className="w-4 h-4" />
      <span className="text-[13px] font-medium whitespace-nowrap">{app.name}</span>
    </button>
  );
});

// --- Memoized row: sent-prompt bubble in the chat feed ---
const PromptBubble = memo(function PromptBubble({ item, app, onCopy, copiedId }) {
  return (
    <div className="flex flex-col items-end gap-1 animate-[fadeIn_150ms_ease-out]">
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 pr-1">
        <AppLogo appId={app?.id} className="w-3.5 h-3.5" />
        <span>{app?.name || 'Неизвестно'}</span>
        <span>·</span>
        <span>{new Date(item.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div className="max-w-[85%] bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl rounded-tr-sm px-4 py-2.5 text-[14px] leading-snug shadow-sm">
        {item.text}
        {item.attachments?.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {item.attachments.map(a => (
              <span key={a.id} className="inline-flex items-center gap-1 bg-white/15 dark:bg-black/10 rounded-full px-2 py-0.5 text-[11px]">
                {a.type === 'image' ? <ImageIcon className="w-3 h-3" /> : a.type === 'video' ? <VideoIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                {a.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <button onClick={() => onCopy(item.text, item.id)} className={`flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 pr-1 ${TAP}`}>
        {copiedId === item.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copiedId === item.id ? 'Скопировано' : 'Копировать'}
      </button>
    </div>
  );
});

// --- Memoized row: history list item with resend picker ---
const HistoryRow = memo(function HistoryRow({ item, app, apps, onResend, onCopy, copiedId }) {
  const [showResend, setShowResend] = useState(false);
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
          <AppLogo appId={app?.id} className="w-4 h-4" />
          <span className="font-medium text-zinc-700 dark:text-zinc-200">{app?.name}</span>
          <span>·</span>
          <span>{new Date(item.timestamp).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <p className="text-[14px] text-zinc-700 dark:text-zinc-300 leading-snug line-clamp-3">{item.text}</p>
      <div className="flex items-center gap-3 mt-2">
        <button onClick={() => onCopy(item.text, item.id)} className={`flex items-center gap-1 text-[12px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 ${TAP}`}>
          {copiedId === item.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedId === item.id ? 'Скопировано' : 'Копировать'}
        </button>
        <div className="relative">
          <button onClick={() => setShowResend(s => !s)} className={`flex items-center gap-1 text-[12px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 ${TAP}`}>
            <RotateCcw className="w-3.5 h-3.5" />
            Отправить снова
          </button>
          {showResend && (
            <div className="absolute z-30 bottom-full mb-1 left-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg p-1 flex gap-1 origin-bottom-left animate-[popIn_120ms_ease-out]">
              {apps.filter(a => a.isInstalled).map(a => (
                <button key={a.id} onClick={() => { onResend(item, a.id); setShowResend(false); }} className={`p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 ${TAP}`} title={a.name}>
                  <AppLogo appId={a.id} className="w-4 h-4" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// --- Memoized row: template card ---
const TemplateCard = memo(function TemplateCard({ template, onUse, onDelete }) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3.5 bg-white dark:bg-zinc-900 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-100">{template.title}</h3>
          <span className="text-[11px] text-zinc-400">{template.tag}</span>
        </div>
        <button onClick={() => onDelete(template.id)} className={`p-1.5 text-zinc-300 hover:text-red-500 ${TAP}`}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-snug line-clamp-2">{template.text}</p>
      <button onClick={() => onUse(template)} className={`self-start flex items-center gap-1 text-[12px] font-medium text-zinc-700 dark:text-zinc-200 ${TAP}`}>
        Использовать <ArrowUpRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});

export default function App() {
  const [apps, setApps] = useState(() => {
    try { const saved = localStorage.getItem('ai_hub_apps'); return saved ? JSON.parse(saved) : DEFAULT_AI_APPS; }
    catch { return DEFAULT_AI_APPS; }
  });
  const [selectedAppId, setSelectedAppId] = useState(() => localStorage.getItem('ai_hub_default_app') || 'claude');
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [activeTab, setActiveTab] = useState('chat');
  const [theme, setTheme] = useState(() => localStorage.getItem('ai_hub_theme') || 'dark');
  const [accentKey, setAccentKey] = useState(() => localStorage.getItem('ai_hub_accent') || 'monochrome');

  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('ai_hub_history');
      return saved ? JSON.parse(saved) : [
        { id: 'h1', appId: 'claude', text: 'Помоги структурировать план работы над проектом мобильного приложения.', timestamp: Date.now() - 3600000, attachments: [] },
        { id: 'h2', appId: 'deepseek', text: '[DeepSeek Reasoner R1] Объясни принцип квантовой запутанности простыми словами.', timestamp: Date.now() - 7200000, attachments: [] }
      ];
    } catch { return []; }
  });

  const [templates, setTemplates] = useState(() => {
    try { const saved = localStorage.getItem('ai_hub_templates'); return saved ? JSON.parse(saved) : INITIAL_TEMPLATES; }
    catch { return INITIAL_TEMPLATES; }
  });

  const [showAppSheet, setShowAppSheet] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [intentModalData, setIntentModalData] = useState(null);
  const [notInstalledModal, setNotInstalledModal] = useState(null);
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateText, setNewTemplateText] = useState('');

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { localStorage.setItem('ai_hub_apps', JSON.stringify(apps)); }, [apps]);
  useEffect(() => { localStorage.setItem('ai_hub_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('ai_hub_templates', JSON.stringify(templates)); }, [templates]);
  useEffect(() => {
    localStorage.setItem('ai_hub_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  useEffect(() => { localStorage.setItem('ai_hub_accent', accentKey); }, [accentKey]);
  useEffect(() => { localStorage.setItem('ai_hub_default_app', selectedAppId); }, [selectedAppId]);

  // Auto-grow textarea without layout thrash: only touch height, rAF-batched.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    });
  }, [inputText]);

  const currentApp = useMemo(() => apps.find(a => a.id === selectedAppId) || apps[0], [apps, selectedAppId]);

  const pinnedApps = useMemo(() => apps.filter(a => a.isPinned), [apps]);
  const unpinnedApps = useMemo(() => apps.filter(a => !a.isPinned), [apps]);
  const orderedApps = useMemo(() => [...pinnedApps, ...unpinnedApps], [pinnedApps, unpinnedApps]);

  const availableSlashCommands = useMemo(() => {
    const appSpecific = currentApp?.slashCommands || [];
    const set = new Set(appSpecific.map(c => c.command));
    const merged = [...appSpecific, ...GENERAL_SLASH_COMMANDS.filter(gc => !set.has(gc.command))];
    if (!slashFilter) return merged;
    const f = slashFilter.toLowerCase();
    return merged.filter(c => c.command.toLowerCase().includes(f) || c.label.toLowerCase().includes(f));
  }, [currentApp, slashFilter]);

  const triggerHaptic = useCallback(() => { if (navigator.vibrate) navigator.vibrate(20); }, []);

  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    setInputText(val);
    const lastSlashIndex = val.lastIndexOf('/');
    if (lastSlashIndex !== -1 && (lastSlashIndex === 0 || val[lastSlashIndex - 1] === ' ' || val[lastSlashIndex - 1] === '\n')) {
      const query = val.slice(lastSlashIndex);
      if (!query.includes(' ')) { setShowSlashMenu(true); setSlashFilter(query); return; }
    }
    setShowSlashMenu(false);
  }, []);

  const applySlashCommand = useCallback((cmdObj) => {
    triggerHaptic();
    setInputText(prev => {
      const lastSlashIndex = prev.lastIndexOf('/');
      return lastSlashIndex !== -1 ? prev.slice(0, lastSlashIndex) + cmdObj.tag : cmdObj.tag + prev;
    });
    setShowSlashMenu(false);
    textareaRef.current?.focus();
  }, [triggerHaptic]);

  const handleFileUpload = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newAttachments = files.map((file, i) => {
      let type = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      return {
        id: `att_${Date.now()}_${i}`,
        name: file.name,
        type,
        size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
        previewUrl: type === 'image' ? URL.createObjectURL(file) : null
      };
    });
    setAttachments(prev => [...prev, ...newAttachments]);
    setShowAttachMenu(false);
    triggerHaptic();
    e.target.value = '';
  }, [triggerHaptic]);

  const removeAttachment = useCallback((id) => {
    triggerHaptic();
    setAttachments(prev => {
   