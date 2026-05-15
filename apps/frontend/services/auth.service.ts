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

function normalizeAuthResponse(data: any): AuthResponse {
  const token = data?.access_token || data?.accessToken || data?.token;

  if (!token) {
    throw new Error("Auth token was not returned by the server.");
  }

  return {
    access_token: token,
  };
}

export const authService = {
  async login(data: LoginDto): Promise<AuthResponse> {
    const response = await api.post("/auth/login", data);
    return normalizeAuthResponse(response.data);
  },

  async register(data: RegisterDto): Promise<AuthResponse> {
    const response = await api.post("/auth/register", data);
    return normalizeAuthResponse(response.data);
  },

  async getMe() {
    const response = await api.get("/users/me");
    return response.data;
  },
};
