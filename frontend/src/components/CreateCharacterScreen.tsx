import React, { useState, useRef, useEffect } from 'react';
import { ScreenId, Character } from '../types';
import { ChevronLeft, BookOpen, ChevronRight, Volume2, Check, Globe } from 'lucide-react';
import BottomNav from './BottomNav';

interface CreateCharacterScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onPublish: (character: Character) => void;
  editCharacter?: Character | null;
}

export default function CreateCharacterScreen({ onNavigate, onPublish, editCharacter }: CreateCharacterScreenProps) {
  const [name, setName] = useState(editCharacter?.name || '');
  const [tagline, setTagline] = useState(editCharacter?.tagline || '');
  const [description, setDescription] = useState(editCharacter?.description || '');
  const [worldBook, setWorldBook] = useState(editCharacter?.worldBook || '');
  const [voiceType, setVoiceType] = useState<'sweet' | 'mature'>((editCharacter?.voiceType as 'sweet' | 'mature') || 'sweet');
  const [avatar, setAvatar] = useState(editCharacter?.avatar || 'https://picsum.photos/seed/cyber_custom/300/300');
  const [selectedTags, setSelectedTags] = useState<string[]>(editCharacter?.tags || ['高冷', '毒舌']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 世界书列表
  const [worldList, setWorldList] = useState<{ file_id: string; name: string }[]>([]);
  const [selectedWorldFile, setSelectedWorldFile] = useState('');

  useEffect(() => {
    fetch('/api/worlds/list', { method: 'POST', credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setWorldList(Array.isArray(data) ? data : []);
      })
      .catch(() => { /* 世界书功能不可用时静默失败 */ });

    // 编辑模式：如果已有 worldBook 且匹配某个世界书名称，预选
    if (editCharacter?.worldBook) {
      setSelectedWorldFile(editCharacter.worldBook);
    }
  }, [editCharacter]);

  const handleWorldSelect = (fileId: string) => {
    setSelectedWorldFile(fileId);
    if (fileId) {
      setWorldBook(fileId);  // 选择已有世界书，存储其名称
    } else if (!fileId && !editCharacter?.worldBook) {
      setWorldBook('');
    }
  };
  const allTags = ['高冷', '毒舌', '傲娇', '治愈', '活泼', '纯欲', '慵懒', '娇憨', '御姐', '野性', '含蓄', '撩人', '娇软', '知性熟韵', '随性浪']; // prettier-ignore

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('请先输入角色名称！');
      return;
    }

    const newChar: Character = {
      id: editCharacter?.id || 'custom_' + Date.now(),
      name,
      avatar,
      tagline: tagline || `${name} - 赛博幻行者`,
      creator: editCharacter?.creator || '霓虹特工_Pilot',
      rating: editCharacter?.rating || 5.0,
      reviewCount: editCharacter?.reviewCount || 0,
      tags: selectedTags,
      description: description || '暂无更多设定信息。',
      worldBook: worldBook || '标准世界观设定已激活。',
      voiceType,
      status: editCharacter?.status || 'online',
      reviews: editCharacter?.reviews || [],
    };

    onPublish(newChar);
    alert(editCharacter
      ? `✅ 角色 [${name}] 已更新保存！`
      : `🎉 角色 [${name}] 已成功在 Yuzu AI 注册并发布！您可以立即与她对话了。`);
    onNavigate(ScreenId.MY_CHARACTERS);
  };

  return (
    <div className="relative min-h-screen bg-[#090A0F] text-[#E0E0E6] pb-24">
      {/* Top action header conforming with: //button[.//span[text()='chevron_left']] */}
      <header className="sticky top-0 z-40 bg-[#0F111A]/90 backdrop-blur-md px-6 h-16 flex items-center justify-between border-b border-white/5">
        <button
          onClick={() => onNavigate(editCharacter ? ScreenId.MY_CHARACTERS : ScreenId.CREATE_CHOICE)}
          className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full bg-surface-container/60 hover:bg-surface-elevated border border-accent-pink/30 hover:border-accent-pink/60 transition-all duration-200 cursor-pointer text-white shadow-[0_0_10px_rgba(232,121,199,0.1)] group/back"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-accent-pink group-hover/back:-translate-x-0.5 transition-transform" />
          <img
            src="/yuzuai_logo.png"
            alt="Yuzu AI Logo"
            referrerPolicy="no-referrer"
            className="w-4 h-4 rounded-full object-cover border border-accent-pink/40"
          />
          <span className="text-[11px] font-bold tracking-wide text-[#ffade2]">取消</span>
        </button>

        <h1 className="text-sm font-bold tracking-widest text-[#ffd8ee] font-headline-lg-mobile">
          {editCharacter ? '编辑角色' : '创建角色'}
        </h1>

        <button
          onClick={handlePublish}
          className="text-xs font-bold text-accent-pink hover:text-white px-4 py-2 bg-accent-pink/15 rounded-lg border border-accent-pink/40 hover:bg-accent-pink transition-all cursor-pointer"
        >
          {editCharacter ? '保存修改' : '发布'}
        </button>
      </header>

      {/* Main setup areas */}
      <main className="max-w-xl mx-auto px-6 py-8 space-y-6">
        {/* Avatar Uploader box */}
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
            ) : (
              <>
                <span className="text-xl font-bold">+</span>
                <span className="text-[10px] tracking-wide">上传头像</span>
              </>
            )}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { fileInputRef.current?.click(); }}
              className="text-[10px] px-3 py-1 bg-accent-pink/10 hover:bg-accent-pink/20 border border-accent-pink/30 rounded-full text-accent-pink cursor-pointer transition-colors"
            >
              选择图片
            </button>
            <button
              type="button"
              onClick={() => {
                const seedId = Math.floor(Math.random() * 1000);
                setAvatar(`https://picsum.photos/seed/cyber_${seedId}/300/300`);
              }}
              className="text-[10px] px-3 py-1 bg-surface-elevated/40 hover:bg-surface-elevated border border-outline-variant/30 rounded-full text-on-surface-variant cursor-pointer transition-colors"
            >
              随机生成
            </button>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">角色名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="给你的角色起个名字..."
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">简短一言 (Tagline)</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="一句话介绍她的独特之处，例如：元气歌姬、落魄武士..."
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">角色设定</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述角色的性格、背景故事以及说话风格..."
              rows={4}
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors resize-none"
            />
          </div>

          {/* Interactive Worldbook item trigger with custom drawer simulation */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">世界书 (Worldbook)</label>
            <div className="bg-surface-container border border-outline-variant/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>选择管理员已创建的世界书，或自定义世界观设定。</span>
              </div>

              {/* 已有世界书下拉选择 */}
              {worldList.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-on-surface-variant/60 ml-1">从已有世界书中选择</label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 pointer-events-none" />
                    <select
                      value={selectedWorldFile}
                      onChange={(e) => handleWorldSelect(e.target.value)}
                      className="w-full bg-surface-elevated/60 border border-outline-variant/20 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white outline-none appearance-none cursor-pointer focus:border-accent-pink transition-colors"
                    >
                      <option value="">不使用世界书</option>
                      {worldList.map((w) => (
                        <option key={w.file_id} value={w.file_id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="bg-surface-elevated/40 border border-outline-variant/20 p-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 text-accent-pink" />
                  <div>
                    <h4 className="text-xs font-bold text-white leading-tight">
                      {selectedWorldFile
                        ? `已绑定: ${worldList.find((w) => w.file_id === selectedWorldFile)?.name || selectedWorldFile}`
                        : '自定义世界观/设定'}
                    </h4>
                    <span className="text-[10px] text-on-surface-variant/80">
                      {selectedWorldFile ? '世界书将在对话中自动激活' : '让角色的回答更符合背景设定'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-on-surface-variant" />
              </div>

              {!selectedWorldFile && (
                <textarea
                  value={worldBook}
                  onChange={(e) => setWorldBook(e.target.value)}
                  placeholder="在此处为您的角色注入深层世界书（如：地名、世界秩序、技能表、敏感禁词词库等）..."
                  rows={3}
                  className="w-full bg-surface-elevated/80 border border-outline-variant/20 rounded-xl p-3 text-[11px] text-[#ffade2] placeholder:text-on-surface-variant/30 outline-none resize-none"
                />
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">性格标签</label>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => {
                const isActive = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-accent-pink text-white border border-accent-pink'
                        : 'bg-surface-elevated border border-outline-variant/30 text-on-surface-variant hover:border-accent-pink/35'
                    }`}
                  >
                    {isActive ? tag : `+ ${tag}`}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  const customTag = prompt('输入自定义性格标签：');
                  if (customTag && customTag.trim()) {
                    setSelectedTags([...selectedTags, customTag.trim()]);
                  }
                }}
                className="px-3 py-1.5 bg-surface-elevated border border-outline-variant/30 border-dashed rounded-full text-xs text-on-surface-variant hover:text-white cursor-pointer"
              >
                + 自定义
              </button>
            </div>
          </div>

          {/* Voices selection Panels */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#ffd8ee] ml-1">角色配音</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setVoiceType('sweet')}
                className={`p-4 rounded-xl border relative flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                  voiceType === 'sweet'
                    ? 'border-accent-pink bg-accent-pink/5 text-[#ffade2]'
                    : 'border-outline-variant/30 bg-surface-container text-on-surface-variant hover:border-accent-pink/40'
                }`}
              >
                <Volume2 className="w-5 h-5 text-accent-pink" />
                <span className="text-xs font-bold">甜美少女</span>
                {voiceType === 'sweet' && (
                  <Check className="absolute top-2 right-2 w-4 h-4 text-accent-pink" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setVoiceType('mature')}
                className={`p-4 rounded-xl border relative flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                  voiceType === 'mature'
                    ? 'border-accent-pink bg-accent-pink/5 text-[#ffade2]'
                    : 'border-outline-variant/30 bg-surface-container text-on-surface-variant hover:border-accent-pink/40'
                }`}
              >
                <Volume2 className="w-5 h-5 text-accent-purple" />
                <span className="text-xs font-bold">成熟御姐</span>
                {voiceType === 'mature' && (
                  <Check className="absolute top-2 right-2 w-4 h-4 text-accent-pink" />
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      <BottomNav currentScreen={ScreenId.CREATE_CHARACTER} onNavigate={onNavigate} />
    </div>
  );
}
