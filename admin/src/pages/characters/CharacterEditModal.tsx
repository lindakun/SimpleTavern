import { useState } from 'react';
import { X } from 'lucide-react';
import type { AdminCharacterItem } from '../../types';
import { getFileName } from './utils';

export interface CharacterEditPayload {
  name: string;
  tags: string[];
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  system_prompt: string;
}

interface Props {
  char: AdminCharacterItem;
  onSave: (payload: CharacterEditPayload) => Promise<void>;
  onClose: () => void;
  isPending: boolean;
}

export default function CharacterEditModal({ char, onSave, onClose, isPending }: Props) {
  const [name, setName] = useState(char.name || '');
  const [tagsStr, setTagsStr] = useState(Array.isArray(char.tags) ? char.tags.join(', ') : '');
  const [description, setDescription] = useState(char.description || '');
  const [personality, setPersonality] = useState(char.personality || '');
  const [scenario, setScenario] = useState(char.scenario || '');
  const [firstMes, setFirstMes] = useState(char.first_mes || '');
  const [systemPrompt, setSystemPrompt] = useState(char.system_prompt || '');
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      setError('角色名称不能为空');
      return;
    }
    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    await onSave({
      name: name.trim(),
      tags,
      description,
      personality,
      scenario,
      first_mes: firstMes,
      system_prompt: systemPrompt,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-surface border border-outline-variant/20 rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20 flex-shrink-0">
          <h2 className="text-sm font-bold text-white font-mono">编辑角色</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <div className="flex items-center gap-3 pb-2 border-b border-outline-variant/10 text-[10px] text-on-surface-variant font-mono">
            <span>拥有者: {char._owner}</span>
            <span>{getFileName(char) || char.id || char._source}</span>
          </div>

          <Field label="角色名称" value={name} onChange={setName} />
          <Field label="标签（逗号分隔）" value={tagsStr} onChange={setTagsStr} placeholder="傲娇, 治愈" />
          <Area label="描述" value={description} onChange={setDescription} rows={3} />
          <Area label="性格 personality" value={personality} onChange={setPersonality} rows={3} />
          <Area label="场景 scenario" value={scenario} onChange={setScenario} rows={2} />
          <Area label="开场白 first_mes" value={firstMes} onChange={setFirstMes} rows={3} />
          <Area label="系统提示 system_prompt" value={systemPrompt} onChange={setSystemPrompt} rows={3} />

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-surface-elevated border border-outline-variant/30 text-xs text-on-surface-variant rounded-xl hover:text-white transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 py-2.5 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isPending ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-on-surface-variant ml-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-accent-pink transition-colors"
      />
    </div>
  );
}

function Area({
  label, value, onChange, rows = 3,
}: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-on-surface-variant ml-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-accent-pink transition-colors resize-y"
      />
    </div>
  );
}
