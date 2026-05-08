"use client";

import { useRouter } from "next/navigation";
import { AuthScreen } from "@/components/AuthScreen";
import { authService } from "@/services/auth.service";

export default function HomePage() {
  const router = useRouter();

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await authService.login({ email, password });

      localStorage.setItem("token", response.access_token);

      const user = await authService.getMe();
      localStorage.setItem("user", JSON.stringify(user));

      if (user.role === "INSTRUCTOR") {
        router.push("/instructor/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login başarısız. Email veya şifreyi kontrol et.");
    }
  };

  return <AuthScreen onLogin={handleLogin} />;
}