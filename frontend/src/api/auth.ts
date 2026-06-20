import api from './axios';
import { AuthResponse } from '../types';

export const register = (data: { firstName: string; lastName: string; email: string; password: string }) =>
  api.post<{ email: string; message: string }>('/api/auth/register', data);

export const login = (data: { email: string; password: string }) =>
  api.post<AuthResponse>('/api/auth/login', data);

export const refreshToken = (data: { refreshToken: string }) =>
  api.post<AuthResponse>('/api/auth/refresh', data);

export const confirmEmail = (token: string) =>
  api.get(`/api/auth/confirm-email?token=${token}`);

export const forgotPassword = (email: string) =>
  api.post('/api/auth/forgot-password', { email });

export const resetPassword = (data: { token: string; newPassword: string }) =>
  api.post('/api/auth/reset-password', data);
