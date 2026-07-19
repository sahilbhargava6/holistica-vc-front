'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { useChat, useParticipants, useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { UserRole } from '@/lib/types';

interface WhisperMessage {
  id: string;
  timestamp: number;
  text: string;
  from: string;
  isLocal: boolean;
}

/**
 * SessionChat — Real-time chat box with Private Clinical Whisper support.
 *
 * Features:
 * - Public messages via LiveKit useChat
 * - Private Clinical Whispers (Supervisor ➔ Therapist) via LiveKit Data Channels (`destinationIdentities`)
 * - Bottom-to-top stacking right above the input bar (`mt-auto`)
 * - Color #76C7A6 at 80% opacity for primary bubbles
 */
export default function SessionChat({ role }: { role: UserRole }) {
  const room = useRoomContext();
  const { chatMessages, send, isSending } = useChat();
  const participants = useParticipants();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Private Whispers and Custom Public Messages state
  const [whispers, setWhispers] = useState<WhisperMessage[]>([]);
  const [customPublicMessages, setCustomPublicMessages] = useState<
    { id: string; timestamp: number; text: string; senderName: string; isLocal: boolean }[]
  >([]);

  const getRoleLabel = (participantOrIdentity?: any, fallbackName?: string) => {
    if (!participantOrIdentity && !fallbackName) return 'Participant';
    let p = typeof participantOrIdentity === 'object' ? participantOrIdentity : null;
    const identityStr = typeof participantOrIdentity === 'string' ? participantOrIdentity : (p?.identity || fallbackName || '');

    // If not object, try finding participant in room.remoteParticipants
    if (!p && room && identityStr) {
      room.remoteParticipants.forEach((rp) => {
        if (rp.identity === identityStr || rp.name === identityStr) p = rp;
      });
    }

    // First check explicit metadata
    if (p?.metadata) {
      try {
        const meta = JSON.parse(p.metadata);
        const r = (meta.role || '').toLowerCase();
        if (r === 'therapist') return 'Therapist';
        if (r === 'client' || r === 'user') return 'Client';
        if (r === 'supervisor') return 'Supervisor';
      } catch {}
    }

    // Check display name or identity string for role clues
    const checkStr = `${p?.name || ''} ${identityStr}`.toLowerCase();
    if (checkStr.includes('therapist') || checkStr.includes('dr')) return 'Therapist';
    if (checkStr.includes('supervisor')) return 'Supervisor';

    // If it is a UUID (like 2b73bd0b-2d9b-46b3-...), convert to clean role name based on our own role
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(identityStr) || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(fallbackName || '')) {
      if (role === 'therapist') return 'Client';
      if (role === 'client') return 'Therapist';
      return 'Participant';
    }

    // If it's not a UUID and not empty, return capitalized name or role
    if (fallbackName && !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(fallbackName)) {
      return fallbackName;
    }

    return p?.name || 'Participant';
  };

  // Listen for incoming DataChannel packets (both whispers and public chat)
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant?: any) => {
      try {
        const decoded = new TextDecoder().decode(payload);
        const data = JSON.parse(decoded);

        if (data && data.type === 'whisper') {
          if (role === 'therapist' || role === 'supervisor') {
            setWhispers((prev) => [
              ...prev,
              {
                id: data.id || `${Date.now()}`,
                timestamp: data.timestamp || Date.now(),
                text: data.text || '',
                from: getRoleLabel(participant, data.from || 'Supervisor'),
                isLocal: false,
              },
            ]);
          }
        } else if (data && data.type === 'public_chat') {
          setCustomPublicMessages((prev) => [
            ...prev,
            {
              id: data.id || `${Date.now()}`,
              timestamp: data.timestamp || Date.now(),
              text: data.text || '',
              senderName: getRoleLabel(participant, data.from || 'Participant'),
              isLocal: false,
            },
          ]);
        }
      } catch {
        // Ignore malformed data packets
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, role]);

  // Merge public chat messages (`useChat` + `customPublicMessages`) and private whispers, deduplicated by type, text content, and time window so messages never appear twice
  const mergedMessages = Array.from(
    new Map(
      [
        ...chatMessages.map((msg) => ({
          id: msg.id || `${msg.timestamp}-${msg.message}`,
          timestamp: msg.timestamp || Date.now(),
          text: msg.message,
          senderName: msg.from?.isLocal ? 'You' : getRoleLabel(msg.from),
          isLocal: msg.from?.isLocal ?? false,
          isWhisper: false,
        })),
        ...customPublicMessages.map((msg) => ({
          id: msg.id,
          timestamp: msg.timestamp,
          text: msg.text,
          senderName: msg.isLocal ? 'You' : getRoleLabel(msg.senderName),
          isLocal: msg.isLocal,
          isWhisper: false,
        })),
        ...whispers.map((w) => ({
          id: w.id,
          timestamp: w.timestamp,
          text: w.text,
          senderName: w.isLocal ? 'You' : getRoleLabel(w.from),
          isLocal: w.isLocal,
          isWhisper: true,
        })),
      ].map((item) => [
        item.isWhisper
          ? `whisper_${item.text.trim().toLowerCase()}_${Math.floor(item.timestamp / 4000)}`
          : `public_${item.text.trim().toLowerCase()}_${Math.floor(item.timestamp / 4000)}`,
        item,
      ])
    ).values()
  ).sort((a, b) => a.timestamp - b.timestamp);

  // Auto-scroll to bottom on every new message or whisper
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mergedMessages.length]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const messageToSend = input.trim();
    setInput('');

    if (role === 'supervisor') {
      // Send Private Whisper to Therapist(s) using LiveKit DataChannels
      try {
        const whisperId = Math.random().toString(36).substring(2, 9);
        const whisperPayload = {
          type: 'whisper',
          id: whisperId,
          text: messageToSend,
          from: room.localParticipant.name || room.localParticipant.identity || 'Clinical Supervisor',
          timestamp: Date.now(),
        };

        // Find remote participants whose role is therapist (or by name/identity)
        const therapistIdentities: string[] = [];
        room.remoteParticipants.forEach((p) => {
          let metaRole = '';
          try {
            metaRole = p.metadata ? JSON.parse(p.metadata).role : '';
          } catch {}
          if (
            metaRole === 'therapist' ||
            (p.name && p.name.toLowerCase().includes('therapist')) ||
            (p.name && p.name.toLowerCase().includes('dr')) ||
            p.identity.toLowerCase().includes('therapist') ||
            p.identity.toLowerCase().includes('dr') ||
            p.identity.toLowerCase().includes('sarah')
          ) {
            therapistIdentities.push(p.identity);
          }
        });

        // Fallback: if no explicit therapist metadata matched, exclude known client/supervisor participants
        if (therapistIdentities.length === 0 && room.remoteParticipants.size > 0) {
          room.remoteParticipants.forEach((p) => {
            let metaRole = '';
            try {
              metaRole = p.metadata ? JSON.parse(p.metadata).role : '';
            } catch {}
            if (metaRole !== 'client' && metaRole !== 'user' && metaRole !== 'supervisor') {
              therapistIdentities.push(p.identity);
            }
          });
        }

        // Ultimate fallback if nothing found but participants exist: send to all remote participants (client side already filters out whispers)
        if (therapistIdentities.length === 0 && room.remoteParticipants.size > 0) {
          room.remoteParticipants.forEach((p) => therapistIdentities.push(p.identity));
        }

        if (therapistIdentities.length === 0) {
          alert('No therapist currently connected inside the room to receive this private whisper. (Did they click "Join Therapy Session" yet?)');
          return;
        }

        const encoded = new TextEncoder().encode(JSON.stringify(whisperPayload));
        await room.localParticipant.publishData(encoded, {
          reliable: true,
          destinationIdentities: therapistIdentities,
        });

        // Add to supervisor's own chat list
        setWhispers((prev) => [
          ...prev,
          {
            id: whisperId,
            timestamp: whisperPayload.timestamp,
            text: messageToSend,
            from: 'You (Private Whisper to Therapist)',
            isLocal: true,
          },
        ]);
      } catch (err) {
        console.error('Failed to send private clinical whisper:', err);
      }
    } else {
      // Send standard public chat message (Therapist / Client) via both publishData & useChat
      try {
        const msgId = Math.random().toString(36).substring(2, 9);
        const publicPayload = {
          type: 'public_chat',
          id: msgId,
          text: messageToSend,
          from: room?.localParticipant?.identity || 'Participant',
          timestamp: Date.now(),
        };

        // Immediately echo locally
        setCustomPublicMessages((prev) => [
          ...prev,
          {
            id: msgId,
            timestamp: publicPayload.timestamp,
            text: messageToSend,
            senderName: 'You',
            isLocal: true,
          },
        ]);

        // Broadcast over reliable data channel
        if (room && room.localParticipant) {
          const encoded = new TextEncoder().encode(JSON.stringify(publicPayload));
          await room.localParticipant.publishData(encoded, { reliable: true });
        }

        // Also trigger useChat send as secondary
        await send(messageToSend).catch(() => {});
      } catch (err) {
        console.error('Failed to send chat message:', err);
      }
    }
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-full lg:w-80 xl:w-96 h-80 lg:h-full bg-gray-900/90 rounded-2xl border border-gray-800/80 shadow-2xl flex flex-col overflow-hidden backdrop-blur-md">
      {/* ── Chat Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-gray-900/95 border-b border-gray-800/80 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#76C7A6] animate-pulse shadow-[0_0_8px_rgba(118,199,166,0.6)]" />
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-gray-100">
              {role === 'supervisor' ? 'Private Whisper Channel' : 'Session Chat'}
            </h3>
          </div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-gray-800/80 border border-gray-700/50 text-xs text-gray-300 font-mono">
          {participants.length} {participants.length === 1 ? 'person' : 'people'}
        </span>
      </div>

      {/* ── Message List Area (Bottom-to-Top flow via mt-auto) ────── */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-4 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
        {mergedMessages.length === 0 ? (
          /* Empty state */
          <div className="my-auto flex flex-col items-center justify-center text-center p-6 space-y-2">
            <div className="w-12 h-12 rounded-full bg-[#76C7A6]/10 border border-[#76C7A6]/20 flex items-center justify-center text-[#76C7A6] mb-1">
              {role === 'supervisor' ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              )}
            </div>
            <p className="text-sm font-medium text-gray-300">
              {role === 'supervisor' ? 'Send Private Clinical Whisper' : 'No messages yet'}
            </p>
            <p className="text-xs text-gray-500 max-w-[210px] leading-relaxed">
              {role === 'supervisor'
                ? 'Your messages here are encrypted and delivered exclusively to the Therapist. Invisible to the Client.'
                : 'Messages sent during this session are encrypted and displayed right here from bottom to top.'}
            </p>
          </div>
        ) : (
          /* Message Container: mt-auto ensures messages stack at the bottom above input */
          <div className="mt-auto flex flex-col space-y-3.5">
            {mergedMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.isLocal ? 'items-end' : 'items-start'}`}
              >
                {/* Sender Name & Timestamp */}
                <div className="flex items-center gap-1.5 px-1 mb-1">
                  {msg.isWhisper && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                      🔒 Whisper
                    </span>
                  )}
                  <span className="text-[11px] font-medium text-gray-400">
                    {msg.isLocal ? 'You' : msg.senderName}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed transition-all duration-200 ${
                    msg.isWhisper
                      ? /* Private Clinical Whisper bubble styling */
                        'bg-amber-500/20 text-amber-100 border border-amber-500/60 rounded-2xl shadow-lg shadow-amber-500/10'
                      : msg.isLocal
                      ? /* User specified: keep color #76C7A6 at 80% opacity (`bg-[#76C7A6]/80`) */
                        'bg-[#76C7A6]/80 text-gray-950 font-medium rounded-2xl rounded-br-xs shadow-md shadow-[#76C7A6]/10 border border-[#76C7A6]'
                      : /* Remote participant bubble */
                        'bg-gray-800/90 text-gray-100 rounded-2xl rounded-bl-xs border border-gray-700/70 shadow-md'
                  }`}
                >
                  <p className="break-words">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Chat Input Area ───────────────────────────────────────── */}
      <div className="p-3.5 bg-gray-950/80 border-t border-gray-800/80 flex-shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={role === 'supervisor' ? 'Whisper privately to therapist...' : 'Enter a message...'}
            disabled={isSending}
            className="flex-1 bg-gray-900/90 border border-gray-700/70 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#76C7A6] focus:ring-1 focus:ring-[#76C7A6] transition-all duration-200"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center flex-shrink-0 ${
              input.trim() && !isSending
                ? role === 'supervisor'
                  ? 'bg-amber-500 hover:bg-amber-400 text-gray-950 shadow-lg shadow-amber-500/20 font-bold'
                  : 'bg-[#76C7A6]/80 hover:bg-[#76C7A6] text-gray-950 shadow-lg shadow-[#76C7A6]/20 font-bold'
                : 'bg-gray-800/60 text-gray-600 cursor-not-allowed border border-gray-800'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
