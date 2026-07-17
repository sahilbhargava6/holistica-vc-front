'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/lib/types';

/**
 * Lobby Page — /
 *
 * A polished landing page where users enter their room ID, user ID,
 * and select their role before joining a telehealth video session.
 */
export default function LobbyPage() {
  const router = useRouter();

  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<UserRole>('client');

  const roles: { value: UserRole; label: string; description: string; icon: string }[] = [
    {
      value: 'therapist',
      label: 'Therapist',
      description: 'Full audio/video access with session controls',
      icon: '🩺',
    },
    {
      value: 'client',
      label: 'Client',
      description: 'Full audio/video access as a participant',
      icon: '👤',
    },
    {
      value: 'supervisor',
      label: 'Supervisor',
      description: 'Hidden observer — watch & listen only',
      icon: '👁️',
    },
  ];

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !userId.trim()) return;

    const params = new URLSearchParams({ role, userId: userId.trim() });
    router.push(`/room/${encodeURIComponent(roomId.trim())}?${params.toString()}`);
  };

  const isFormValid = roomId.trim().length > 0 && userId.trim().length > 0;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* Background gradient effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* ── Header ────────────────────────────────────────── */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/80 border border-gray-800/60 mb-4">
            <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span className="text-sm font-medium text-gray-300">TeleHealth</span>
          </div>

          <h1 className="text-3xl font-bold text-gray-100 tracking-tight">
            Join a Session
          </h1>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Enter your details below to connect to a secure telehealth video session
          </p>
        </div>

        {/* ── Form Card ─────────────────────────────────────── */}
        <form
          onSubmit={handleJoin}
          className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-8 space-y-6 backdrop-blur-sm"
        >
          {/* Room ID */}
          <div className="space-y-2">
            <label htmlFor="roomId" className="block text-sm font-medium text-gray-300">
              Room ID
            </label>
            <input
              id="roomId"
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="e.g. session-2024-001"
              className="w-full px-4 py-3 bg-gray-800/60 border border-gray-700/60 rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40 transition-all duration-200"
            />
          </div>

          {/* User ID */}
          <div className="space-y-2">
            <label htmlFor="userId" className="block text-sm font-medium text-gray-300">
              Your Name / User ID
            </label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g. dr-johnson"
              className="w-full px-4 py-3 bg-gray-800/60 border border-gray-700/60 rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40 transition-all duration-200"
            />
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              Your Role
            </label>
            <div className="grid gap-3">
              {roles.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left ${
                    role === r.value
                      ? 'bg-teal-500/10 border-teal-500/40 ring-1 ring-teal-500/20'
                      : 'bg-gray-800/30 border-gray-700/40 hover:bg-gray-800/50 hover:border-gray-600/50'
                  }`}
                >
                  <span className="text-2xl">{r.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${role === r.value ? 'text-teal-300' : 'text-gray-200'}`}>
                      {r.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
                  </div>
                  {/* Selection indicator */}
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    role === r.value
                      ? 'border-teal-400 bg-teal-400'
                      : 'border-gray-600'
                  }`}>
                    {role === r.value && (
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-950" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isFormValid}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 ${
              isFormValid
                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-400 hover:to-cyan-400 shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            {isFormValid ? 'Join Session' : 'Fill in all fields to continue'}
          </button>
        </form>

        {/* ── Footer ────────────────────────────────────────── */}
        <p className="text-center text-xs text-gray-600 mt-6">
          Secured with end-to-end encryption • HIPAA-ready infrastructure
        </p>
      </div>
    </div>
  );
}
