"use client";

import { useRouter } from "next/navigation";

interface DashboardProps {
    user: {
        id?: string;
        email: string;
        role: string;
        firstName?: string;
        lastName?: string;
        name?: string;
    };
    courses: any[];
    onSignOut: () => void;
}

export function Dashboard({ user, courses, onSignOut }: DashboardProps) {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-slate-100 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl shadow-md p-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        Welcome, {user.name || user.email}
                    </h1>

                    <p className="text-slate-600 mb-1">{user.email}</p>
                    <p className="text-slate-500 mb-6">Role: {user.role}</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <div className="bg-slate-50 rounded-xl p-4 border">
                            <h2 className="font-semibold mb-2">My Courses</h2>

                            <div className="space-y-2">
                                {courses.length === 0 ? (
                                    <p className="text-sm text-slate-500">Hiç ders yok</p>
                                ) : (
                                    courses.map((course: any) => (
                                        <div
                                            key={course.id}
                                            onClick={() => router.push(`/courses/${course.id}`)}
                                            className="p-2 border rounded-lg text-sm bg-white cursor-pointer hover:bg-slate-100"
                                        >
                                            <div className="font-medium">{course.title}</div>
                                            <div className="text-slate-500 text-xs">{course.code}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 border">
                            <h2 className="font-semibold mb-2">Announcements</h2>
                            <p className="text-sm text-slate-600">
                                Burada duyurular görünecek.
                            </p>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 border">
                            <h2 className="font-semibold mb-2">Deadlines</h2>
                            <p className="text-sm text-slate-600">
                                Burada deadline bilgileri olacak.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onSignOut}
                        className="bg-black text-white px-5 py-3 rounded-lg hover:bg-slate-800"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}