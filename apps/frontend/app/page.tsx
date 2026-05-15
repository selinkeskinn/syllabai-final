"use client";

import { useRouter } from "next/navigation";
import { AuthScreen } from "@/components/AuthScreen";
import { authService } from "@/services/auth.service";

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
      const response = await authService.login({
        email: email.trim().toLowerCase(),
        password,
      });

      localStorage.setItem("token", response.access_token);

      const user = await authService.getMe();
      localStorage.setItem("user", JSON.stringify(user));

      redirectByRole(user);
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login başarısız. Email veya şifreyi kontrol et.");
      throw error;
    }
  };

  const handleRegister = async (data: any) => {
    try {
      const response = await authService.register({
        ...data,
        email: data.email.trim().toLowerCase(),
      });

      localStorage.setItem("token", response.access_token);

      const user = await authService.getMe();
      localStorage.setItem("user", JSON.stringify(user));

      redirectByRole(user);
    } catch (error) {
      console.error("Register failed:", error);
      throw error;
    }
  };

  return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />;
}
