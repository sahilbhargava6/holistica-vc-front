'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { UserRole, ROLE_UI_CONFIG } from '@/lib/types';

interface GreenRoomProps {
  roomId: string;
  userName: string;
  role: UserRole;
  onJoin: (blurEnabled: boolean, videoDeviceId?: string, audioDeviceId?: string) => void;
}

interface DeviceInfo {
  deviceId: string;
  label: string;
}

/**
 * GreenRoom — Pre-Call Device Check & Privacy Setup Screen
 *
 * Uses native browser APIs (navigator.mediaDevices) directly to avoid
 * LiveKit hook conflicts. This ensures reliable camera/mic previews
 * across all browsers and devices.
 */
export default function GreenRoom({ roomId, userName, role, onJoin }: GreenRoomProps) {
  const config = ROLE_UI_CONFIG[role];
  const [blurEnabled, setBlurEnabled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Device lists
  const [videoDevices, setVideoDevices] = useState<DeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<DeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Enumerate available devices
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 8)}` }));
      const audios = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }));

      setVideoDevices(videos);
      setAudioDevices(audios);

      if (videos.length > 0 && !selectedVideoId) setSelectedVideoId(videos[0].deviceId);
      if (audios.length > 0 && !selectedAudioId) setSelectedAudioId(audios[0].deviceId);
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  }, [selectedVideoId, selectedAudioId]);

  // Start camera stream with selected device
  const startCamera = useCallback(async (videoDeviceId?: string) => {
    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      setCameraError(null);
      const constraints: MediaStreamConstraints = {
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        audio: false, // Don't grab audio for the preview — just camera
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      setCameraReady(true);

      // Re-enumerate to get proper labels (labels are only available after permission grant)
      await enumerateDevices();
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraReady(false);
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission was denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found. Please connect a camera and try again.');
      } else if (err.name === 'NotReadableError' || err.name === 'AbortError') {
        setCameraError('Camera is in use by another application. Please close other apps using the camera and refresh.');
      } else {
        setCameraError(`Camera error: ${err.message || 'Unknown error'}`);
      }
    }
  }, [enumerateDevices]);

  // Initial camera start
  useEffect(() => {
    startCamera();

    return () => {
      // Cleanup: stop all tracks when leaving the Green Room
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch camera when user changes the dropdown
  const handleVideoDeviceChange = (deviceId: string) => {
    setSelectedVideoId(deviceId);
    startCamera(deviceId);
  };

  // Handle join — stop the preview stream and pass control to parent
  const handleJoin = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    onJoin(blurEnabled, selectedVideoId, selectedAudioId);
  };

  return (
    <div className="min-h-screen w-full bg-gray-950 text-gray-100 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-2xl w-full bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#76C7A6]/10 border border-[#76C7A6]/20 flex items-center justify-center text-[#76C7A6]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-gray-100">Pre-Call Green Room</h2>
              <p className="text-xs text-gray-400">
                Test your devices and privacy settings before joining
              </p>
            </div>
          </div>

          <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${config.badgeClass}`}>
            {config.label}
          </span>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Video Preview Box */}
          <div className="relative aspect-video w-full bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-inner flex items-center justify-center">
            {cameraError ? (
              <div className="flex flex-col items-center justify-center text-red-400 gap-3 p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-sm font-medium">{cameraError}</p>
                <button
                  onClick={() => startCamera(selectedVideoId || undefined)}
                  className="mt-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-xs font-semibold text-gray-300 border border-gray-700 transition-colors"
                >
                  Retry Camera Access
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover -scale-x-100 ${cameraReady ? 'opacity-100' : 'opacity-0'}`}
                />
                {!cameraReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-2 p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-gray-800/80 flex items-center justify-center text-gray-400">
                      <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-400">Connecting camera &amp; microphone...</p>
                    <p className="text-xs text-gray-600">Please allow browser permissions when prompted.</p>
                  </div>
                )}
              </>
            )}

            {/* Privacy Background Blur Toggle Overlay inside preview */}
            <div className="absolute bottom-3.5 right-3.5 z-10">
              <button
                type="button"
                onClick={() => setBlurEnabled(!blurEnabled)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all duration-200 border ${
                  blurEnabled
                    ? 'bg-[#76C7A6]/90 text-gray-950 border-[#76C7A6] shadow-lg shadow-[#76C7A6]/20'
                    : 'bg-gray-900/85 text-gray-300 border-gray-700/80 hover:bg-gray-800/90'
                }`}
              >
                <span>🔒 Background Blur</span>
                <span className={`w-2 h-2 rounded-full ${blurEnabled ? 'bg-gray-950 animate-pulse' : 'bg-gray-500'}`} />
              </button>
            </div>
          </div>

          {/* Device Selection & Privacy Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Camera Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Camera Device
              </label>
              <select
                value={selectedVideoId}
                onChange={(e) => handleVideoDeviceChange(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#76C7A6] transition-colors"
              >
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
                {videoDevices.length === 0 && <option value="">No cameras detected</option>}
              </select>
            </div>

            {/* Microphone Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Microphone Device
              </label>
              <select
                value={selectedAudioId}
                onChange={(e) => setSelectedAudioId(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#76C7A6] transition-colors"
              >
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
                {audioDevices.length === 0 && <option value="">No microphones detected</option>}
              </select>
            </div>
          </div>

          {/* Summary Banner */}
          <div className="p-4 rounded-2xl bg-gray-950/60 border border-gray-800/80 flex items-center justify-between text-sm">
            <div className="space-y-0.5">
              <span className="text-gray-400 block text-xs">Joining Room</span>
              <span className="font-mono text-gray-200 font-semibold">{roomId}</span>
            </div>
            <div className="text-right space-y-0.5">
              <span className="text-gray-400 block text-xs">Participant Name</span>
              <span className="font-semibold text-[#76C7A6]">{userName}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#76C7A6]/15 border border-[#76C7A6]/30 text-xs text-[#76C7A6] font-medium flex items-center gap-2">
            <span className="text-base">💡</span>
            <span>
              <strong>Ready to connect?</strong> Click the green &quot;Join Therapy Session&quot; button below to enter the live room and connect with remote participants right now!
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-900/90 border-t border-gray-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleJoin}
            className="w-full sm:w-auto px-8 py-3 bg-[#76C7A6]/90 hover:bg-[#76C7A6] text-gray-950 font-bold text-sm rounded-xl shadow-lg shadow-[#76C7A6]/20 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <span>Join Therapy Session</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
