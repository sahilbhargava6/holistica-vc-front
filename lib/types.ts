/**
 * TypeScript interfaces and types for the telehealth video conferencing feature.
 * Used across components, API calls, and state management.
 */

/**
 * The three strict user roles in the telehealth system.
 * Must match the backend's UserRole enum exactly.
 */
export type UserRole = 'therapist' | 'client' | 'supervisor';

/**
 * Payload sent to POST /video/token to request a LiveKit access token.
 */
export interface TokenRequestPayload {
  roomId: string;
  userId: string;
  userName?: string;
  role: UserRole;
  durationMinutes?: number;
}

/**
 * Response from POST /video/token.
 */
export interface TokenResponse {
  token: string;
  durationMinutes?: number;
  expiresAt?: number;
  isObserver?: boolean;
  bookingType?: string;
}

/**
 * Props for the VideoRoom component.
 */
export interface VideoRoomProps {
  /** LiveKit access token (JWT) */
  token: string;
  /** LiveKit WebSocket server URL (e.g., ws://localhost:7880) */
  serverUrl: string;
  /** The user's role — determines UI visibility and permissions */
  role: UserRole;
  /** Whether a supervisor is in observer mode (`true` for client sessions, `false` for supervisor meetings) */
  isObserver?: boolean;
  /** Display name for the user */
  userName: string;
  /** Timestamp when the session expires */
  expiresAt?: number;
  /** Duration of the session in minutes */
  durationMinutes?: number;
  /** Whether background blur is enabled */
  blurEnabled?: boolean;
  /** Selected video device ID from Green Room */
  videoDeviceId?: string;
  /** Selected audio device ID from Green Room */
  audioDeviceId?: string;
}

/**
 * State shape for the Room page's token-fetching logic.
 */
export interface RoomConnectionState {
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Configuration for role-based UI behavior.
 * Maps each role to its allowed UI capabilities.
 */
export interface RoleUIConfig {
  /** Whether to show the control bar (mute, camera, screen share) */
  showControlBar: boolean;
  /** Whether to enable video on connect */
  enableVideo: boolean;
  /** Whether to enable audio on connect */
  enableAudio: boolean;
  /** Display label for the role badge */
  label: string;
  /** CSS class for the role badge styling */
  badgeClass: string;
}

/**
 * Mapping of each role to its UI configuration.
 *
 * SECURITY NOTE: These are UI-only conveniences. The actual permission
 * enforcement happens server-side via LiveKit JWT grants. A supervisor
 * who tampers with the frontend to show controls will still be blocked
 * by the LiveKit SFU from publishing any tracks.
 */
export const ROLE_UI_CONFIG: Record<UserRole, RoleUIConfig> = {
  therapist: {
    showControlBar: true,
    enableVideo: true,
    enableAudio: true,
    label: 'Therapist',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  client: {
    showControlBar: true,
    enableVideo: true,
    enableAudio: true,
    label: 'Client',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  },
  supervisor: {
    showControlBar: false,
    enableVideo: false,
    enableAudio: false,
    label: 'Supervisor (Observer)',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
};
