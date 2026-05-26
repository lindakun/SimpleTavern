/**
 * 角色数据校验
 */

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * 校验角色数据的基本字段
 */
export function validateCharacterData(data: unknown): ValidationResult {
    const errors: string[] = [];
    if (!data || typeof data !== 'object') {
        errors.push('Character data must be an object');
        return { valid: false, errors };
    }

    const char = data as Record<string, unknown>;

    // V2 格式校验
    if (char.spec === 'chara_card_v2') {
        if (!char.data || typeof char.data !== 'object') {
            errors.push('Spec V2 requires a data field');
        } else {
            const d = char.data as Record<string, unknown>;
            if (!d.name) {
                errors.push('Character name is required');
            }
        }
    } else {
        // V1 格式校验
        if (!char.name) {
            errors.push('Character name is required');
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * 创建空的角色卡数据（用于新角色）
 */
export function createDefaultCharacterData(name: string): Record<string, unknown> {
    return {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        name: name,
        description: '',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
        data: {
            name: name,
            description: '',
            personality: '',
            scenario: '',
            first_mes: '',
            mes_example: '',
            creator_notes: '',
            system_prompt: '',
            post_history_instructions: '',
            tags: [],
            creator: '',
            character_version: '',
            alternate_greetings: [],
            extensions: {
                talkativeness: 0.5,
                fav: false,
                world: '',
                depth_prompt: { prompt: '', depth: 4, role: 'system' },
            },
        },
    };
}
