import { create } from 'zustand';
import type { Character } from '../types';

interface CharacterStore {
  characters: Character[];
  editingCharacter: Character | null;

  setCharacters: (chars: Character[]) => void;
  addCharacters: (chars: Character[]) => void;
  updateCharacter: (char: Character) => void;
  removeCharacter: (characterId: string) => void;
  setEditingCharacter: (char: Character | null) => void;
}

export const useCharacterStore = create<CharacterStore>((set) => ({
  characters: [],
  editingCharacter: null,

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
}));
