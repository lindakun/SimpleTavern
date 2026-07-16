import { create } from 'zustand';
import type { Character } from '../types';

export type DiscoverLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CharacterStore {
  characters: Character[];
  editingCharacter: Character | null;
  /** 发现页首屏加载状态 */
  discoverStatus: DiscoverLoadStatus;

  setCharacters: (chars: Character[]) => void;
  addCharacters: (chars: Character[]) => void;
  updateCharacter: (char: Character) => void;
  removeCharacter: (characterId: string) => void;
  setEditingCharacter: (char: Character | null) => void;
  setDiscoverStatus: (status: DiscoverLoadStatus) => void;
}

export const useCharacterStore = create<CharacterStore>((set) => ({
  characters: [],
  editingCharacter: null,
  discoverStatus: 'idle',

  setCharacters: (chars) => set({ characters: chars }),
  addCharacters: (chars) =>
    set((state) => {
      const existingIds = new Set(state.characters.map((c) => c.id));
      const newChars = chars.filter((c) => !existingIds.has(c.id));
      return { characters: [...state.characters, ...newChars] };
    }),
  updateCharacter: (char) =>
    set((state) => ({
      characters: state.characters.map((c) => (c.id === char.id ? char : c)),
    })),
  removeCharacter: (characterId) =>
    set((state) => ({
      characters: state.characters.filter((c) => c.id !== characterId),
    })),
  setEditingCharacter: (char) => set({ editingCharacter: char }),
  setDiscoverStatus: (status) => set({ discoverStatus: status }),
}));
