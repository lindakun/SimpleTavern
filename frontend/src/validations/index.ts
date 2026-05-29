/**
 * 验证模块统一导出
 */

export {
  CreateCharacterSchema,
  PartialCreateCharacterSchema,
  VoiceTypeSchema,
  CharacterStatusSchema,
  TagSchema,
  validateCharacterForm,
  formatValidationErrors,
} from './character';
export type { CreateCharacterFormData } from './character';

export {
  LoginSchema,
  RegisterSchema,
  ChangePasswordSchema,
  HandleSchema,
  EmailSchema,
  PasswordSchema,
  validateLogin,
  validateRegister,
  validateChangePassword,
} from './auth';
export type { LoginFormData, RegisterFormData, ChangePasswordFormData } from './auth';
