"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";

interface AuthScreenProps {
    onLogin: (email: string, password: string) => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(email, password);
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

                <div className="flex flex-col items-center mb-6">
                    <GraduationCap className="w-10 h-10 mb-2" />
                    <h1 className="text-xl font-bold">Syllabus Workspace</h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                    <input
                        type="email"
                        placeholder="Email"
                        className="w-full border p-3 rounded-lg"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        className="w-full border p-3 rounded-lg"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <button
                        type="submit"
                        className="w-full bg-black text-white p-3 rounded-lg"
                    >
                        Sign In
                    </button>
                </form>

            </div>
        </div>
    );
}