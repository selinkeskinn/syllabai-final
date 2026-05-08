"use client";

import { useRouter } from "next/navigation";
import { AuthScreen } from "@/components/AuthScreen";
import { authService, RegisterDto } from "@/services/auth.service";

type UserSession = {
  role?: "STUDENT" | "INSTRUCTOR";
};

const getAuthErrorMessage = (error: unknown) => {
  const apiError = error as {
    response?: {
      data?: {
        message?: string | string[];
        error?: string;
      };
    };
    message?: string;
  };

  const message =
    apiError.response?.data?.message ||
    apiError.response?.data?.error ||
    apiError.message ||
    "Authentication failed. Please try again.";

  return Array.isArray(message) ? message.join(", ") : message;
};

export default function HomePage() {
  const router = useRouter();

  const redirectForUser = (user: UserSession) => {
    if (user.role === "INSTRUCTOR") {
      router.push("/instructor/dashboard");
      return;
    }

    router.push("/dashboard");
  };

  const loadUserAndRedirect = async () => {
    const user = await authService.getMe();
    localStorage.setItem("user", JSON.stringify(user));
    redirectForUser(user);
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await authService.login({ email, password });

      localStorage.setItem("token", response.access_token);
      await loadUserAndRedirect();
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const handleRegister = async (data: RegisterDto) => {
    try {
      const response = await authService.register(data);

      if (response?.access_token) {
        localStorage.setItem("token", response.access_token);
        await loadUserAndRedirect();
        return;
      }

      await handleLogin(data.email, data.password);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />;
}
