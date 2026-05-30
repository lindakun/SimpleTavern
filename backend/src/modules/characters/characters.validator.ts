/**
 * 角色数据校验
 */

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * 校验角色数据的基本字段（V1/V2/V3）
 */
export function validateCharacterData(data: unknown): ValidationResult {
    const errors: string[] = [];
    if (!data || typeof data !== 'object') {
        errors.push('Character data must be an object');
        return { valid: false, errors };
    }

    const char = data as Record<string, unknown>;

    // V2/V3 格式校验
    if (char.spec === 'chara_card_v2' || char.spec === 'chara_card_v3') {
        if (!char.data || typeof char.data !== 'object') {
            errors.push('Spec V2/V3 requires a data field');
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
 * 创建空的角色卡数据（V3 格式，用于新角色）
 */
export function createDefaultCharacterData(name: string): Record<string, unknown> {
    return {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
            name,
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
            extensions: {},
        },
    };
}
