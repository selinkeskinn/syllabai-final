"use client";

import { useRouter } from "next/navigation";
import { AuthScreen } from "@/components/AuthScreen";
import { authService, RegisterDto } from "@/services/auth.service";

const getAuthErrorMessage = (error: any, fallback: string) => {
  const status = error?.response?.status;
  const message = error?.response?.data?.message;

  if (status === 401) {
    return "Email or password is incorrect.";
  }

  if (status === 409) {
    return "This email or student ID is already registered.";
  }

  if (status === 400) {
    if (Array.isArray(message)) {
      return message.join("\n");
    }

    if (typeof message === "string") {
      return message;
    }

    return "Please check the form fields and try again.";
  }

  if (typeof message === "string") {
    return message;
  }

  return fallback;
};

export default function HomePage() {
  const router = useRouter();

  const redirectByRole = (user: any) => {
    if (user.role === "INSTRUCTOR") {
      router.push("/instructor/dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await authService.login({ email, password });

      localStorage.setItem("token", response.access_token);

      const user = await authService.getMe();
      localStorage.setItem("user", JSON.stringify(user));

      redirectByRole(user);
    } catch (error: any) {
      throw new Error(
        getAuthErrorMessage(error, "Login failed. Please try again.")
      );
    }
  };

  const handleRegister = async (data: RegisterDto) => {
    try {
      const response = await authService.register(data);

      localStorage.setItem("token", response.access_token);

      const user = await authService.getMe();
      localStorage.setItem("user", JSON.stringify(user));

      redirectByRole(user);
    } catch (error: any) {
      throw new Error(
        getAuthErrorMessage(error, "Registration failed. Please try again.")
      );
    }
  };

  return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />;
}
