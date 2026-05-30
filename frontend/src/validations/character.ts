/**
 * 角色表单验证 Schema
 */

import { z } from 'zod';

// 配音类型
export const VoiceTypeSchema = z.enum(['sweet', 'mature']);

// 角色状态
export const CharacterStatusSchema = z.enum(['online', 'offline', 'draft', 'private']);

// 标签验证
export const TagSchema = z.string()
  .min(1, '标签不能为空')
  .max(20, '标签长度不能超过20个字符')
  .regex(/^[一-龥a-zA-Z0-9_]+$/, '标签只能包含中文、英文、数字和下划线');

// 创建/编辑角色表单 Schema
export const CreateCharacterSchema = z.object({
  name: z.string()
    .min(1, '角色名称不能为空')
    .max(50, '角色名称不能超过50个字符')
    .regex(/^[一-龥a-zA-Z0-9_\s]+$/, '角色名称只能包含中文、英文、数字、下划线和空格'),

  tagline: z.string()
    .max(100, 'Tagline 不能超过100个字符')
    .optional()
    .default(''),

  description: z.string()
    .max(2000, '角色设定不能超过2000个字符')
    .optional()
    .default(''),

  worldBook: z.string()
    .max(10000, '世界书不能超过10000个字符')
    .optional()
    .default(''),

  voiceType: VoiceTypeSchema.optional().default('sweet'),

  status: CharacterStatusSchema.optional().default('online'),

  tags: z.array(TagSchema)
    .max(50, '标签不能超过50个')
    .optional()
    .default([]),

  avatar: z.string()
    .refine((value) => {
      if (!value) return true;
      if (value.startsWith('data:image/')) return true;
      return z.string().url().safeParse(value).success;
    }, '头像必须是有效的URL或图片文件')
    .optional(),
});

// 导出类型
export type CreateCharacterFormData = z.infer<typeof CreateCharacterSchema>;

// 部分验证（用于实时验证）
export const PartialCreateCharacterSchema = CreateCharacterSchema.partial();

// 验证函数
export function validateCharacterForm(data: unknown): {
  success: boolean;
  data?: CreateCharacterFormData;
  errors?: z.ZodError;
} {
  const result = CreateCharacterSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

// 格式化验证错误为可读消息
export function formatValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const err of error.issues) {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = err.message;
    }
  }
  return errors;
}
