import React, { useState, useRef, useEffect } from 'react';
import { ScreenId, Character } from '../types';
import { ChevronLeft, Plus, X, ChevronDown, ChevronUp, Globe, Lock, Unlock } from 'lucide-react';
import BottomNav from './BottomNav';
import { useToast } from './Toast';
import { useWorldApi } from '../api/worlds';

interface CreateCharacterScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onGoBack?: () => void;
  onPublish: (character: Character) => Promise<void>;
  editCharacter?: Character | null;
}

interface CharacterForm {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  tags: string[];
  creator: string;
  character_version: string;
  worldBook: string;
  voiceType: 'sweet' | 'mature';
  privacyType: 'public' | 'private';
}

const defaultForm: CharacterForm = {
  name: '',
  description: '',
  personality: '',
  scenario: '',
  first_mes: '',
  mes_example: '',
  creator_notes: '',
  system_prompt: '',
  post_history_instructions: '',
  alternate_greetings: [],
  tags: [],
  creator: '',
  character_version: '1.0',
  worldBook: '',
  voiceType: 'sweet',
  privacyType: 'private',
};

function formFromCharacter(c: Character | null | undefined): CharacterForm {
  if (!c) return { ...defaultForm };
  return {
    name: c.name || '',
    description: c.description || '',
    personality: c.personality || '',
    scenario: c.scenario || '',
    first_mes: c.first_mes || '',
    mes_example: c.mes_example || '',
    creator_notes: c.creator_notes || '',
    system_prompt: c.system_prompt || '',
    post_history_instructions: c.post_history_instructions || '',
    alternate_greetings: c.alternate_greetings || [],
    tags: c.tags || [],
    creator: c.creator || '',
    character_version: c.character_version || '1.0',
    worldBook: c.worldBook || '',
    voiceType: c.voiceType || 'sweet',
    privacyType: c.privacyType || 'private',
  };
}

// 可折叠区块
function Section({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-surface-container/40 border border-outline-variant/20 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-surface-elevated/20 transition-colors"
      >
        <div>
          <span className="text-xs font-bold text-white">{title}</span>
          {subtitle && <span className="text-[10px] text-on-surface-variant ml-2">{subtitle}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

// 可复用的 textarea（含字符统计）
function Field({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  maxChars,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxChars?: number;
}) {
  const current = value.length;
  const ratio = maxChars ? current / maxChars : 0;
  const warnColor = ratio > 1 ? 'text-red-400' : ratio > 0.8 ? 'text-amber-400' : 'text-on-surface-variant/40';
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-on-surface-variant ml-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-surface-elevated/60 border border-outline-variant/20 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors resize-none"
      />
      {maxChars !== undefined && (
        <div className={`text-[9px] text-right font-mono ${warnColor}`}>
          {current} / {maxChars}
        </div>
      )}
    </div>
  );
}

export default function CreateCharacterScreen({ onNavigate, onPublish, editCharacter }: CreateCharacterScreenProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState<CharacterForm>(() => formFromCharacter(editCharacter));
  const worldApi = useWorldApi();
  const [avatar, setAvatar] = useState(editCharacter?.avatar || '');
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 世界书
  const [worldList, setWorldList] = useState<{ file_id: string; name: string }[]>([]);
  const [selectedWorldFile, setSelectedWorldFile] = useState(editCharacter?.worldBook || '');

  // 加载世界书列表
  useEffect(() => {
    worldApi.listWorlds()
      .then((data) => {
        setWorldList(Array.isArray(data) ? data : []);
      })
      .catch(() => { /* 世界书功能不可用时静默失败 */ });
  }, []);

  // 编辑模式：外部 editCharacter 变化时同步
  useEffect(() => {
    setForm(formFromCharacter(editCharacter));
    setAvatar(editCharacter?.avatar || '');
    // 同步 worldBook：如果 editCharacter 有 worldBook 则使用，否则重置为空字符串
    setSelectedWorldFile(editCharacter?.worldBook || '');
  }, [editCharacter]);

  const updateForm = (key: keyof CharacterForm, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 标签管理
  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !form.tags.includes(t)) {
      updateForm('tags', [...form.tags, t]);
    }
    setTagInput('');
    setShowTagInput(false);
  };

  const removeTag = (tag: string) => {
    updateForm('tags', form.tags.filter((t) => t !== tag));
  };

  // 替代问候语管理
  const addGreeting = () => {
    updateForm('alternate_greetings', [...form.alternate_greetings, '']);
  };

  const updateGreeting = (index: number, value: string) => {
    const updated = [...form.alternate_greetings];
    updated[index] = value;
    updateForm('alternate_greetings', updated);
  };

  const removeGreeting = (index: number) => {
    updateForm('alternate_greetings', form.alternate_greetings.filter((_, i) => i !== index));
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('角色名称不能为空', 'error');
      return;
    }

    // 字符数限制校验
    const limits: [string, string, number][] = [
      ['描述', form.description, 500],
      ['性格', form.personality, 1000],
      ['场景', form.scenario, 2000],
      ['第一条消息', form.first_mes, 1000],
    ];
    for (const [label, text, max] of limits) {
      if (text.length > max) {
        showToast(`${label}不能超过${max}字（当前${text.length}字）`, 'error');
        return;
      }
    }

    // 使用 selectedWorldFile 作为 worldBook 的源，确保与 UI 选择同步
    const worldBookValue = selectedWorldFile || undefined;

    const newChar: Character = {
      id: editCharacter?.id || 'custom_' + Date.now(),
      name: form.name.trim(),
      avatar: avatar || '',
      creator: form.creator || editCharacter?.creator || '',
      rating: editCharacter?.rating || 0,
      reviewCount: editCharacter?.reviewCount || 0,
      tags: form.tags,
      description: form.description,
      personality: form.personality || undefined,
      scenario: form.scenario || undefined,
      first_mes: form.first_mes || undefined,
      mes_example: form.mes_example || undefined,
      creator_notes: form.creator_notes || undefined,
      system_prompt: form.system_prompt || undefined,
      post_history_instructions: form.post_history_instructions || undefined,
      alternate_greetings: form.alternate_greetings.length > 0 ? form.alternate_greetings : undefined,
      character_version: form.character_version || '1.0',
      worldBook: worldBookValue,
      voiceType: form.voiceType || undefined,
      status: editCharacter?.status || 'online',
      privacyType: form.privacyType,
      reviews: editCharacter?.reviews || [],
    };

    setSaving(true);
    try {
      await onPublish(newChar);
      showToast(editCharacter ? '角色已保存' : '角色已发布', 'success');
      onNavigate(ScreenId.MY_CHARACTERS);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存失败';
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex-1 overflow-y-auto bg-[#090A0F] text-[#E0E0E6] safe-content-bottom">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0F111A]/90 backdrop-blur-md px-6 h-16 flex items-center justify-between border-b border-white/5">
        <button
          onClick={() => onNavigate(editCharacter ? ScreenId.MY_CHARACTERS : ScreenId.CREATE_CHOICE)}
          className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full bg-surface-container/60 hover:bg-surface-elevated border border-accent-pink/30 hover:border-accent-pink/60 transition-all duration-200 cursor-pointer text-white shadow-[0_0_10px_rgba(232,121,199,0.1)] group/back"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-accent-pink group-hover/back:-translate-x-0.5 transition-transform" />
          <span className="text-[11px] font-bold tracking-wide text-[#ffade2]">取消</span>
        </button>

        <h1 className="text-sm font-bold tracking-widest text-[#ffd8ee]">
          {editCharacter ? '编辑角色' : '创建角色'}
        </h1>

        <button
          onClick={handlePublish}
          disabled={saving}
          className="text-xs font-bold text-accent-pink hover:text-white px-4 py-2 bg-accent-pink/15 rounded-lg border border-accent-pink/40 hover:bg-accent-pink transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '保存中...' : editCharacter ? '保存修改' : '发布'}
        </button>
      </header>

      {/* Main form */}
      <main className="max-w-xl mx-auto px-6 py-8 space-y-6">
        {/* Avatar uploader */}
        <div className="flex flex-col items-center text-center space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  if (ev.target?.result) setAvatar(ev.target.result as string);
                };
                reader.readAsDataURL(file);
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 border-2 border-dashed border-accent-pink/40 hover:border-accent-pink rounded-xl flex flex-col items-center justify-center bg-surface-container/30 text-accent-pink gap-1 active:scale-95 transition-all cursor-pointer overflow-hidden p-1"
          >
            {avatar.startsWith('data:') ? (
              <img src={avatar} alt="角色头像" className="w-full h-full object-cover rounded-lg" />
            ) : avatar ? (
              <img src={avatar} alt="角色头像" referrerPolicy="no-referrer" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <>
                <span className="text-xl font-bold">+</span>
                <span className="text-[10px] tracking-wide">上传头像</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] px-3 py-1 bg-accent-pink/10 hover:bg-accent-pink/20 border border-accent-pink/30 rounded-full text-accent-pink cursor-pointer transition-colors"
          >
            选择图片
          </button>
        </div>

        {/* 基本信息 — 默认展开 */}
        <Section title="基本信息" subtitle="名称、描述、性格" defaultOpen>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-on-surface-variant ml-1">角色名称 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder="给你的角色起个名字..."
              className="w-full bg-surface-elevated/60 border border-outline-variant/20 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
            />
          </div>

          <Field
            label="描述 (Description)"
            value={form.description}
            onChange={(v) => updateForm('description', v)}
            placeholder="角色的背景故事、外貌特征、核心设定..."
            rows={5}
            maxChars={500}
          />

          <Field
            label="性格 (Personality)"
            value={form.personality}
            onChange={(v) => updateForm('personality', v)}
            placeholder="角色的性格特征、说话风格、行为习惯..."
            rows={3}
            maxChars={1000}
          />

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-on-surface-variant ml-1">标签 (Tags)</label>
            <div className="flex flex-wrap gap-1.5">
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-accent-pink/10 border border-accent-pink/30 rounded-full text-[11px] text-[#ffade2]"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {showTagInput ? (
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }
                    if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); }
                  }}
                  onBlur={() => { if (tagInput.trim()) addTag(tagInput); else setShowTagInput(false); }}
                  placeholder="输入标签..."
                  autoFocus
                  className="px-2 py-1 bg-surface-elevated/60 border border-accent-pink/40 rounded-full text-[11px] text-white outline-none w-20"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTagInput(true)}
                  className="px-2 py-1 border border-dashed border-outline-variant/30 rounded-full text-[11px] text-on-surface-variant hover:text-white hover:border-accent-pink/40 cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3 inline" /> 标签
                </button>
              )}
            </div>
          </div>
        </Section>

        {/* 隐私设置 */}
        <Section title="隐私设置" subtitle={form.privacyType === 'public' ? '所有人可见' : '仅自己可见'} defaultOpen>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => updateForm('privacyType', 'public')}
              className={`flex-1 p-3 rounded-xl border text-center transition-all cursor-pointer ${
                form.privacyType === 'public'
                  ? 'border-accent-green/60 bg-accent-green/15 text-accent-green'
                  : 'border-outline-variant/20 bg-surface-elevated/40 text-on-surface-variant hover:border-accent-green/30'
              }`}
            >
              <Unlock className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs font-bold block">公开</span>
              <span className="text-[10px] text-on-surface-variant/60">所有人可见</span>
            </button>
            <button
              type="button"
              onClick={() => updateForm('privacyType', 'private')}
              className={`flex-1 p-3 rounded-xl border text-center transition-all cursor-pointer ${
                form.privacyType === 'private'
                  ? 'border-accent-pink/60 bg-accent-pink/15 text-[#ffade2]'
                  : 'border-outline-variant/20 bg-surface-elevated/40 text-on-surface-variant hover:border-accent-pink/30'
              }`}
            >
              <Lock className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs font-bold block">私有</span>
              <span className="text-[10px] text-on-surface-variant/60">仅自己可见</span>
            </button>
          </div>
          <p className="text-[10px] text-on-surface-variant/50 leading-relaxed">
            公开角色将出现在"发现角色"页面，其他用户可以浏览和对话；私有角色仅自己可见和管理。
          </p>
        </Section>

        {/* 场景与开场 */}
        <Section title="场景与开场" subtitle="初始场景、第一条消息">
          <Field
            label="场景 (Scenario)"
            value={form.scenario}
            onChange={(v) => updateForm('scenario', v)}
            placeholder="角色出现的初始场景设定、环境描述..."
            rows={3}
            maxChars={2000}
          />

          <Field
            label="第一条消息 (First Message)"
            value={form.first_mes}
            onChange={(v) => updateForm('first_mes', v)}
            placeholder="角色对用户说的第一句话，可以用 {{user}} 代表用户名，{{char}} 代表角色名..."
            rows={4}
            maxChars={1000}
          />
        </Section>

        {/* 对话示例 */}
        <Section title="对话示例" subtitle="Mes Example">
          <Field
            label="对话示例 (Message Example)"
            value={form.mes_example}
            onChange={(v) => updateForm('mes_example', v)}
            placeholder={"{{char}}: 角色的回复示例\n{{user}}: 用户的回复示例\n{{char}}: 角色的回复示例"}
            rows={6}
          />
        </Section>

        {/* 系统提示词 */}
        <Section title="系统提示词" subtitle="System Prompt / 后指令">
          <Field
            label="系统提示词 (System Prompt)"
            value={form.system_prompt}
            onChange={(v) => updateForm('system_prompt', v)}
            placeholder="给 AI 的系统级指令，定义角色扮演规则、说话风格、行为准则..."
            rows={4}
          />

          <Field
            label="历史记录后指令 (Post History Instructions)"
            value={form.post_history_instructions}
            onChange={(v) => updateForm('post_history_instructions', v)}
            placeholder="在聊天历史记录之后追加的指令，用于在对话过程中维持角色一致性..."
            rows={3}
          />
        </Section>

        {/* 替代问候语 */}
        <Section title="替代问候语" subtitle={`Alternate Greetings (${form.alternate_greetings.length})`}>
          {form.alternate_greetings.length === 0 && (
            <p className="text-[11px] text-on-surface-variant/50">添加不同的开场白，让每次对话有新鲜感</p>
          )}
          {form.alternate_greetings.map((greeting, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1">
                <textarea
                  value={greeting}
                  onChange={(e) => updateGreeting(index, e.target.value)}
                  placeholder={`替代问候语 #${index + 1}`}
                  rows={3}
                  className="w-full bg-surface-elevated/60 border border-outline-variant/20 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors resize-none"
                />
              </div>
              <button
                type="button"
                onClick={() => removeGreeting(index)}
                className="mt-2 p-1.5 text-red-400 hover:text-red-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addGreeting}
            className="w-full py-2 border border-dashed border-outline-variant/30 hover:border-accent-pink/40 rounded-xl text-[11px] text-on-surface-variant hover:text-accent-pink cursor-pointer transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> 添加替代问候语
          </button>
        </Section>

        {/* 世界书 */}
        <Section title="世界书" subtitle={selectedWorldFile ? `已绑定: ${worldList.find(w => w.file_id === selectedWorldFile)?.name || selectedWorldFile}` : '可选'}>
          {worldList.length > 0 ? (
            <div className="space-y-2">
              <div className="relative">
                <Globe className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 pointer-events-none" />
                <select
                  value={selectedWorldFile}
                  onChange={(e) => {
                    const fileId = e.target.value;
                    setSelectedWorldFile(fileId);
                    updateForm('worldBook', fileId);
                  }}
                  className="w-full bg-surface-elevated/60 border border-outline-variant/20 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white outline-none appearance-none cursor-pointer focus:border-accent-pink transition-colors"
                >
                  <option value="">不绑定世界书</option>
                  {worldList.map((w) => (
                    <option key={w.file_id} value={w.file_id}>{w.name}</option>
                  ))}
                </select>
              </div>
              {selectedWorldFile && (
                <p className="text-[10px] text-on-surface-variant/60">世界书将在角色聊天时自动注入到对话上下文中</p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-on-surface-variant/50">暂无可用世界书，需管理员先创建</p>
          )}
        </Section>

        {/* 配音方案 */}
        <Section title="配音方案" subtitle="Voice Type">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => updateForm('voiceType', 'sweet')}
              className={`flex-1 p-3 rounded-xl border text-center transition-all cursor-pointer ${
                form.voiceType === 'sweet'
                  ? 'border-accent-pink/60 bg-accent-pink/15 text-[#ffade2]'
                  : 'border-outline-variant/20 bg-surface-elevated/40 text-on-surface-variant hover:border-accent-pink/30'
              }`}
            >
              <span className="text-lg block mb-1">🎵</span>
              <span className="text-xs font-bold block">甜美少女</span>
              <span className="text-[10px] text-on-surface-variant/60">Sweet</span>
            </button>
            <button
              type="button"
              onClick={() => updateForm('voiceType', 'mature')}
              className={`flex-1 p-3 rounded-xl border text-center transition-all cursor-pointer ${
                form.voiceType === 'mature'
                  ? 'border-accent-purple/60 bg-accent-purple/15 text-accent-purple'
                  : 'border-outline-variant/20 bg-surface-elevated/40 text-on-surface-variant hover:border-accent-purple/30'
              }`}
            >
              <span className="text-lg block mb-1">🎙️</span>
              <span className="text-xs font-bold block">成熟御姐</span>
              <span className="text-[10px] text-on-surface-variant/60">Mature</span>
            </button>
          </div>
        </Section>

        {/* 创作者信息 */}
        <Section title="创作者信息" subtitle="Creator / Notes / Version">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-on-surface-variant ml-1">创作者 (Creator)</label>
            <input
              type="text"
              value={form.creator}
              onChange={(e) => updateForm('creator', e.target.value)}
              placeholder="创作者名称"
              className="w-full bg-surface-elevated/60 border border-outline-variant/20 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
            />
          </div>

          <Field
            label="创作者备注 (Creator Notes)"
            value={form.creator_notes}
            onChange={(v) => updateForm('creator_notes', v)}
            placeholder="给其他用户的备注，如使用建议、角色设计意图..."
            rows={3}
          />

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-on-surface-variant ml-1">角色版本 (Version)</label>
            <input
              type="text"
              value={form.character_version}
              onChange={(e) => updateForm('character_version', e.target.value)}
              placeholder="1.0"
              className="w-full bg-surface-elevated/60 border border-outline-variant/20 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
            />
          </div>
        </Section>
      </main>

      <BottomNav currentScreen={ScreenId.CREATE_CHARACTER} onNavigate={onNavigate} />
    </div>
  );
}
