import { api } from "@/lib/api";

export type UserRole = "STUDENT" | "INSTRUCTOR";

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  name?: string;
  firstName?: string;
  lastName?: string;
  studentId?: string;
  email: string;
  password: string;
  confirmPassword?: string;
  role: UserRole;
}

export interface AuthResponse {
  access_token: string;
}

export const authService = {
  async login(data: LoginDto): Promise<AuthResponse> {
    const response = await api.post("/auth/login", data);
    return response.data;
  },

  async register(data: RegisterDto): Promise<AuthResponse> {
    const response = await api.post("/auth/register", data);
    return response.data;
  },

  async getMe() {
    const response = await api.get("/users/me");
    return response.data;
  },
};
