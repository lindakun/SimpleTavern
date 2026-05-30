/**
 * 角色表单验证 Schema — V3 角色卡格式
 */

import { z } from 'zod';

// 标签验证
export const TagSchema = z.string()
  .min(1, '标签不能为空')
  .max(30, '标签长度不能超过30个字符');

// 创建/编辑角色表单 Schema — V3 角色卡 data 字段
export const CreateCharacterSchema = z.object({
  name: z.string()
    .min(1, '角色名称不能为空')
    .max(100, '角色名称不能超过100个字符'),

  description: z.string()
    .max(5000, '描述不能超过5000个字符')
    .optional()
    .default(''),

  personality: z.string()
    .max(3000, '性格不能超过3000个字符')
    .optional()
    .default(''),

  scenario: z.string()
    .max(3000, '场景不能超过3000个字符')
    .optional()
    .default(''),

  first_mes: z.string()
    .max(5000, '第一条消息不能超过5000个字符')
    .optional()
    .default(''),

  mes_example: z.string()
    .max(10000, '对话示例不能超过10000个字符')
    .optional()
    .default(''),

  creator_notes: z.string()
    .max(3000, '创作者备注不能超过3000个字符')
    .optional()
    .default(''),

  system_prompt: z.string()
    .max(5000, '系统提示词不能超过5000个字符')
    .optional()
    .default(''),

  post_history_instructions: z.string()
    .max(3000, '后指令不能超过3000个字符')
    .optional()
    .default(''),

  alternate_greetings: z.array(z.string())
    .max(10, '替代问候语不能超过10条')
    .optional()
    .default([]),

  tags: z.array(TagSchema)
    .max(50, '标签不能超过50个')
    .optional()
    .default([]),

  creator: z.string()
    .max(100, '创作者名称不能超过100个字符')
    .optional()
    .default(''),

  character_version: z.string()
    .max(20, '版本号不能超过20个字符')
    .optional()
    .default('1.0'),

  avatar: z.string()
    .refine((value) => {
      if (!value) return true;
      if (value.startsWith('data:image/')) return true;
      return z.string().url().safeParse(value).success;
    }, '头像必须是有效的URL或图片文件')
    .optional(),

  status: z.enum(['online', 'offline', 'draft', 'private']).optional().default('online'),
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
