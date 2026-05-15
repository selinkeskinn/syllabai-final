"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Lock, Mail, UserRound } from "lucide-react";
import type { RegisterDto, UserRole } from "@/services/auth.service";
import { authService } from "@/services/auth.service";

interface AuthScreenProps {
  onLogin: (email: string, password: string) => void;
  onRegister?: (data: any) => Promise<any>;
}

const getRequiredDomain = (role: UserRole) =>
  role === "STUDENT" ? "@bahcesehir.edu.tr" : "@bau.edu.tr";

const getRoleLabel = (role: UserRole) =>
  role === "STUDENT" ? "Student" : "Instructor";

export function AuthScreen({ onLogin, onRegister }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<UserRole>("STUDENT");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const requiredDomain = useMemo(() => getRequiredDomain(role), [role]);

  const resetMessages = () => {
    setMessage("");
    setErrorMessage("");
  };

  const switchMode = (nextIsSignUp: boolean) => {
    setIsSignUp(nextIsSignUp);
    resetMessages();
  };

  const validateSignUp = () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!firstName.trim() || !lastName.trim()) {
      return "Please enter your first and last name.";
    }

    if (role === "STUDENT" && !studentId.trim()) {
      return "Please enter your student ID.";
    }

    if (!normalizedEmail.endsWith(requiredDomain)) {
      return `${getRoleLabel(role)} accounts must use ${requiredDomain}.`;
    }

    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }

    if (!acceptedTerms) {
      return "Please accept the terms and privacy policy.";
    }

    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    try {
      setLoading(true);

      if (!isSignUp) {
        await onLogin(email.trim().toLowerCase(), password);
        return;
      }

      const validationError = validateSignUp();

      if (validationError) {
        setErrorMessage(validationError);
        return;
      }

      await (onRegister ?? authService.register)({
        name: `${firstName.trim()} ${lastName.trim()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        studentId: role === "STUDENT" ? studentId.trim() : undefined,
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        role,
      });

      setMessage("Account created successfully. Redirecting...");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isSignUp
          ? "Registration failed. Please try again."
          : "Login failed. Please check your email and password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-[480px] rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Syllabus Workspace
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isSignUp
              ? "Create your university workspace account"
              : "Sign in to continue to your workspace"}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => switchMode(false)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              !isSignUp
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={() => switchMode(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              isSignUp
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      resetMessages();
                      setFirstName(e.target.value);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="Jane"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      resetMessages();
                      setLastName(e.target.value);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["STUDENT", "INSTRUCTOR"] as UserRole[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        resetMessages();
                        setRole(item);
                      }}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        role === item
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <p className="text-sm font-semibold">
                        {getRoleLabel(item)}
                      </p>
                      <p className="mt-1 text-xs">
                        {item === "STUDENT"
                          ? "@bahcesehir.edu.tr"
                          : "@bau.edu.tr"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {role === "STUDENT" ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Student ID
                  </label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => {
                      resetMessages();
                      setStudentId(e.target.value);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="2026000001"
                  />
                </div>
              ) : null}
            </>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  resetMessages();
                  setEmail(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pl-9 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder={
                  isSignUp
                    ? role === "STUDENT"
                      ? "name@bahcesehir.edu.tr"
                      : "name@bau.edu.tr"
                    : "Email"
                }
              />
            </div>
            {isSignUp ? (
              <p className="mt-1.5 text-xs text-slate-500">
                {getRoleLabel(role)} email must end with{" "}
                <span className="font-semibold text-blue-600">
                  {requiredDomain}
                </span>
                .
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  resetMessages();
                  setPassword(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pl-9 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Password"
              />
            </div>
          </div>

          {isSignUp ? (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Confirm Password
                </label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      resetMessages();
                      setConfirmPassword(e.target.value);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pl-9 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="Confirm password"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => {
                    resetMessages();
                    setAcceptedTerms(e.target.checked);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  I agree to the terms and privacy policy for using the Syllabus
                  Workspace.
                </span>
              </label>
            </>
          ) : null}

          {errorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 p-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? isSignUp
                ? "Creating account..."
                : "Signing in..."
              : isSignUp
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
