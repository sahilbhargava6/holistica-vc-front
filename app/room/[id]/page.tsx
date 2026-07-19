'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import VideoRoom from '@/components/VideoRoom';
import GreenRoom from '@/components/GreenRoom';
import {
  UserRole,
  TokenRequestPayload,
  TokenResponse,
  RoomConnectionState,
  ROLE_UI_CONFIG,
} from '@/lib/types';

/**
 * Room Page — /room/[id]
 *
 * Reads connection parameters from the URL:
 * - Path param `id` → roomId
 * - Search param `role` → user role (therapist | client | supervisor)
 * - Search param `userId` → user identifier
 *
 * On mount, fetches a LiveKit token from the NestJS backend, presents the Pre-Call Green Room,
 * and renders the video room once the user is ready.
 */
export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const roomId = decodeURIComponent(params.id || '').trim();
  const rawRole = (searchParams.get('role') || 'client').trim().toLowerCase();
  const role = rawRole as UserRole;
  const userId = (searchParams.get('userId') || 'anonymous').trim();
  const userName = (searchParams.get('name') || searchParams.get('userName') || userId).trim();

  const [state, setState] = useState<RoomConnectionState>({
    token: null,
    isLoading: true,
    error: null,
  });

  const [isReadyToJoin, setIsReadyToJoin] = useState(false);
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [videoDeviceId, setVideoDeviceId] = useState<string | undefined>();
  const [audioDeviceId, setAudioDeviceId] = useState<string | undefined>();
  const [sessionMeta, setSessionMeta] = useState<{ durationMinutes?: number; expiresAt?: number }>({});

  const serverUrl = (process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://holistica-vc-l3ziqon2.livekit.cloud').trim().replace(/\/+$/, '');
  
  let rawApiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://holisticabackend-srapp.ondigitalocean.app/api/v1').trim().replace(/\/+$/, '');
  // If NEXT_PUBLIC_API_URL was accidentally set to the LiveKit wss:// URL or starts with ws, fallback to backend
  if (rawApiUrl.startsWith('ws://') || rawApiUrl.startsWith('wss://') || rawApiUrl.includes('livekit.cloud')) {
    rawApiUrl = 'https://holisticabackend-srapp.ondigitalocean.app/api/v1';
  }
  // Ensure digitalocean URL includes /api/v1
  if (rawApiUrl.includes('holisticabackend-srapp.ondigitalocean.app') && !rawApiUrl.endsWith('/api/v1')) {
    rawApiUrl = 'https://holisticabackend-srapp.ondigitalocean.app/api/v1';
  }
  const apiUrl = rawApiUrl;

  useEffect(() => {
    // Validate the role before making the API call
    const validRoles: UserRole[] = ['therapist', 'client', 'supervisor'];
    if (!validRoles.includes(role)) {
      setState({
        token: null,
        isLoading: false,
        error: `Invalid role "${role}". Must be one of: ${validRoles.join(', ')}`,
      });
      return;
    }

    const fetchToken = async () => {
      try {
        const payload: TokenRequestPayload = { roomId, userId, userName, role, durationMinutes: 60 };

        const response = await fetch(`${apiUrl}/video/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `Token request failed with status ${response.status}`
          );
        }

        const data: TokenResponse = await response.json();
        setSessionMeta({
          durationMinutes: data.durationMinutes,
          expiresAt: data.expiresAt,
        });
        setState({ token: data.token, isLoading: false, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to connect to video service';
        setState({ token: null, isLoading: false, error: message });
      }
    };

    fetchToken();
  }, [roomId, role, userId, userName, apiUrl]);

  // ── Loading State ──────────────────────────────────────────
  if (state.isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-6">
          {/* Animated loading spinner */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-gray-800" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-[#76C7A6] animate-spin" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-gray-100">Connecting to session</h2>
            <p className="text-sm text-gray-500">
              Joining room <span className="text-gray-300 font-mono">{roomId}</span> as{' '}
              <span className="text-[#76C7A6]">{ROLE_UI_CONFIG[role]?.label ?? role}</span>
            </p>
          </div>

          {/* Subtle progress bar animation */}
          <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#76C7A6] to-cyan-400 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────
  if (state.error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-950">
        <div className="max-w-md w-full mx-4">
          <div className="bg-gray-900 border border-red-500/20 rounded-2xl p-8 space-y-6">
            {/* Error icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-gray-100">Connection Failed</h2>
              <p className="text-sm text-gray-400">{state.error}</p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl font-medium transition-colors duration-200 border border-gray-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pre-Call Green Room (For Therapist / Client) ───────────
  if (!state.token) return null;

  // Supervisors (observers without camera) bypass the green room directly to observer mode
  if (role !== 'supervisor' && !isReadyToJoin) {
    return (
      <GreenRoom
        roomId={roomId}
        userName={userId}
        role={role}
        onJoin={(blur, vidId, audId) => {
          setBlurEnabled(blur);
          setVideoDeviceId(vidId);
          setAudioDeviceId(audId);
          setIsReadyToJoin(true);
        }}
      />
    );
  }

  // ── Video Room ─────────────────────────────────────────────
  return (
    <VideoRoom
      token={state.token}
      serverUrl={serverUrl}
      role={role}
      userName={userId}
      durationMinutes={sessionMeta.durationMinutes}
      expiresAt={sessionMeta.expiresAt}
      blurEnabled={blurEnabled}
      videoDeviceId={videoDeviceId}
      audioDeviceId={audioDeviceId}
    />
  );
}
