/**
 * 认证表单验证 Schema
 */

import { z } from 'zod';

// 用户名验证
export const HandleSchema = z.string()
  .min(3, '用户名至少需要3个字符')
  .max(30, '用户名不能超过30个字符')
  .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含英文、数字和下划线');

// 邮箱验证
export const EmailSchema = z.string()
  .email('请输入有效的邮箱地址')
  .max(100, '邮箱地址过长');

// 密码验证
export const PasswordSchema = z.string()
  .min(6, '密码至少需要6个字符')
  .max(50, '密码不能超过50个字符')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    '密码必须包含大小写字母和数字'
  );

// 登录表单 Schema
export const LoginSchema = z.object({
  handle: z.string().min(1, '请输入用户名或邮箱'),
  password: z.string().optional(),
});

// 注册表单 Schema
export const RegisterSchema = z.object({
  handle: HandleSchema,
  name: z.string()
    .min(1, '昵称不能为空')
    .max(50, '昵称不能超过50个字符'),
  email: EmailSchema,
  password: PasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
});

// 修改密码表单 Schema
export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, '请输入当前密码'),
  newPassword: PasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
});

// 导出类型
export type LoginFormData = z.infer<typeof LoginSchema>;
export type RegisterFormData = z.infer<typeof RegisterSchema>;
export type ChangePasswordFormData = z.infer<typeof ChangePasswordSchema>;

// 验证函数
export function validateLogin(data: unknown): {
  success: boolean;
  data?: LoginFormData;
  errors?: Record<string, string>;
} {
  const result = LoginSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: formatAuthErrors(result.error),
  };
}

export function validateRegister(data: unknown): {
  success: boolean;
  data?: RegisterFormData;
  errors?: Record<string, string>;
} {
  const result = RegisterSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: formatAuthErrors(result.error),
  };
}

export function validateChangePassword(data: unknown): {
  success: boolean;
  data?: ChangePasswordFormData;
  errors?: Record<string, string>;
} {
  const result = ChangePasswordSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: formatAuthErrors(result.error),
  };
}

// 格式化错误
function formatAuthErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const err of error.issues) {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = err.message;
    }
  }
  return errors;
}
