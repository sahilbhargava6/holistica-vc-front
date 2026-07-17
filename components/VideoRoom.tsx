'use client';

import { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
  ParticipantTile,
} from '@livekit/components-react';
import { LocalVideoTrack, Track } from 'livekit-client';
import { BackgroundBlur } from '@livekit/track-processors';
import '@livekit/components-styles';
import { VideoRoomProps, ROLE_UI_CONFIG, UserRole } from '@/lib/types';
import SessionChat from '@/components/SessionChat';

/**
 * CustomVideoLayout — Renders the custom layout matching the healthcare wireframe:
 * - Left side: Large black video container with status pill, session timer, and PiP local camera
 * - Right side: Dedicated real-time chat panel
 */
function CustomVideoLayout({
  role,
  userName,
  expiresAt,
  blurEnabled,
}: {
  role: UserRole;
  userName: string;
  expiresAt?: number;
  blurEnabled?: boolean;
}) {
  const config = ROLE_UI_CONFIG[role];

  // Fetch camera and screen share tracks of all participants
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const participants = useParticipants();

  // Separate local participant's tracks vs remote participants' tracks
  const localTracks = tracks.filter((t) => t.participant.isLocal);
  const remoteTracks = tracks.filter((t) => !t.participant.isLocal);

  // Find the primary local camera track for the picture-in-picture box
  const localCameraTrack = localTracks.find((t) => t.source === Track.Source.Camera);

  // ── Background Blur Persistence ────────────────────────────
  useEffect(() => {
    const track = localCameraTrack?.publication?.track as LocalVideoTrack | undefined;
    if (!track) return;

    if (blurEnabled) {
      track.setProcessor(BackgroundBlur(10)).catch((err) => {
        console.error('Failed to apply background blur inside room:', err);
      });
    } else {
      track.stopProcessor().catch(() => {});
    }
  }, [localCameraTrack?.publication?.track, blurEnabled]);

  // ── Session Timer & Auto-Wrap Up Countdown ────────────────
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : null
  );

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isLowTime = remainingSeconds !== null && remainingSeconds <= 300 && remainingSeconds > 0;
  const isExpired = remainingSeconds !== null && remainingSeconds === 0;

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full p-3 sm:p-4 gap-4 bg-gray-950 text-gray-100 overflow-hidden">
      {/* ── LEFT SECTION: Large Black Video Container ──────────────────────── */}
      <div className="flex-1 relative bg-black rounded-2xl overflow-hidden border border-gray-800/80 shadow-2xl flex flex-col justify-center items-center">
        {/* Top-Left Status Box (with Session Timer) */}
        <div className="absolute top-4 left-4 z-30 bg-gray-900/85 border border-gray-700/60 rounded-xl px-4 py-2.5 backdrop-blur-md shadow-lg flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#76C7A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span className="text-sm font-semibold tracking-tight text-gray-200">TeleHealth</span>
          </div>

          <div className="w-px h-4 bg-gray-700" />

          {/* Role badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border ${config.badgeClass}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {config.label}
          </span>

          <div className="w-px h-4 bg-gray-700 hidden sm:block" />

          <span className="text-xs text-gray-400 hidden sm:block truncate max-w-[120px]">
            {userName}
          </span>

          {/* Session Timer Pill */}
          {remainingSeconds !== null && (
            <>
              <div className="w-px h-4 bg-gray-700" />
              <div
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold transition-all ${
                  isExpired
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                    : isLowTime
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-bounce'
                    : 'bg-gray-800 text-gray-300 border border-gray-700'
                }`}
              >
                <span>⏱️</span>
                <span>{formatTimer(remainingSeconds)}</span>
              </div>
            </>
          )}
        </div>

        {/* Top-Center 5-Minute Grace Notice */}
        {isLowTime && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-full bg-amber-500/90 text-gray-950 font-bold text-xs shadow-xl animate-pulse backdrop-blur-md">
            ⏳ 5 minutes remaining in your scheduled therapy session. Please begin wrapping up.
          </div>
        )}

        {isExpired && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-full bg-red-600/90 text-white font-bold text-xs shadow-xl animate-pulse backdrop-blur-md">
            ⚠️ Scheduled session duration has expired.
          </div>
        )}

        {/* Main Big Screen (Remote Participants View) */}
        <div className="w-full h-full flex items-center justify-center p-4">
          {remoteTracks.length === 0 ? (
            /* Waiting state when no remote participant has published yet */
            <div className="text-center space-y-3 max-w-sm px-6 py-8 rounded-2xl bg-gray-900/40 border border-gray-800/60 backdrop-blur-sm">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#76C7A6]/10 border border-[#76C7A6]/20 flex items-center justify-center text-[#76C7A6] animate-pulse">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-200">Waiting for others</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                You are inside the session. Remote participants ({participants.length - 1} connected) will appear right here when their camera turns on.
              </p>
            </div>
          ) : remoteTracks.length === 1 ? (
            /* Single Remote Participant (Full Screen inside Black Box) */
            <div className="w-full h-full rounded-xl overflow-hidden relative">
              <ParticipantTile
                trackRef={remoteTracks[0]}
                className="w-full h-full object-cover !rounded-xl"
              />
            </div>
          ) : (
            /* Multiple Remote Participants (Grid layout inside Black Box) */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
              {remoteTracks.map((trackRef) => (
                <div key={trackRef.participant.identity + trackRef.source} className="w-full h-full rounded-xl overflow-hidden relative">
                  <ParticipantTile
                    trackRef={trackRef}
                    className="w-full h-full object-cover !rounded-xl"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lower Right Box for Camera (PiP Local Video overlay as requested) */}
        {role !== 'supervisor' && (
          <div className="absolute bottom-20 right-4 sm:bottom-20 sm:right-6 z-30 w-44 sm:w-64 aspect-video bg-gray-900 border-2 border-gray-700/80 rounded-xl overflow-hidden shadow-2xl transition-all duration-300 hover:scale-105">
            {localCameraTrack ? (
              <ParticipantTile
                trackRef={localCameraTrack}
                className="w-full h-full object-cover !rounded-none"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-500 gap-1.5 p-2">
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <span className="text-[11px] font-medium text-gray-400">Your Camera Off</span>
              </div>
            )}
            <div className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] font-medium text-gray-300 pointer-events-none">
              You ({role})
            </div>
          </div>
        )}

        {/* Supervisor Observer Notice (Bottom Center inside Black Box) */}
        {role === 'supervisor' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 bg-amber-500/15 border border-amber-500/30 rounded-full backdrop-blur-md shadow-lg max-w-md w-full mx-4 text-center">
            <span className="text-amber-300 text-xs font-medium">
              👁️ <strong>Observer Mode</strong> — Invisible to participants (`hidden: true`)
            </span>
          </div>
        )}

        {/* Bottom Center ControlBar (Therapist/Client controls) */}
        {config.showControlBar && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
            <div className="bg-gray-900/90 border border-gray-700/80 rounded-full shadow-2xl backdrop-blur-md px-3 py-1">
              <ControlBar
                variation="minimal"
                controls={{
                  microphone: true,
                  camera: true,
                  screenShare: true,
                  leave: true,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT SECTION: Dedicated Chat Panel (Right Box as requested) ── */}
      <SessionChat role={role} />
    </div>
  );
}

/**
 * VideoRoom — Wraps the LiveKitRoom and renders the custom healthcare layout.
 */
export default function VideoRoom({
  token,
  serverUrl,
  role,
  userName,
  expiresAt,
  blurEnabled,
}: VideoRoomProps) {
  const config = ROLE_UI_CONFIG[role];

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      video={config.enableVideo}
      audio={config.enableAudio}
      data-lk-theme="default"
      className="h-full w-full"
      connect={true}
    >
      {/* Ensure audio is played for all participants */}
      <RoomAudioRenderer />

      {/* Custom UI layout matching wireframe with timer & blur */}
      <CustomVideoLayout
        role={role}
        userName={userName}
        expiresAt={expiresAt}
        blurEnabled={blurEnabled}
      />
    </LiveKitRoom>
  );
}
