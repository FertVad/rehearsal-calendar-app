// RSVP system: 'yes' = accepted, 'no' = declined, null = no response yet
export type RSVPStatus = 'yes' | 'no' | null;

export interface UserResponse {
    status: RSVPStatus;
    responseAt?: string;
    notes?: string;
}

export interface ResponseStats {
    total: number;
    confirmed: number; // Number of 'yes' responses
    invited: number;   // Number of members without response
}

/**
 * ISO 8601 timestamp string (e.g., "2025-12-10T19:00:00+02:00")
 */
export type ISOTimestamp = string;

export interface Rehearsal {
    id: string;
    // New TIMESTAMPTZ format (ISO 8601)
    startsAt: ISOTimestamp;
    endsAt: ISOTimestamp;
    // Legacy fields for backward compatibility
    date?: string;
    time?: string;
    endTime?: string;
    duration?: string;
    location?: string;
    status?: string;
    projectId?: string;
    projectName?: string;
    scene?: string;
    actorNameSnapshot?: string[];
    createdAt?: string | Date;
    updatedAt?: string | Date;
    // RSVP data
    myResponse?: UserResponse;
    responseStats?: ResponseStats;
}

export interface ProjectMember {
    id: string;
    userId: string;
    role: 'owner' | 'admin' | 'member';
    characterName?: string;
    status: 'active' | 'invited' | 'declined' | 'left';
    joinedAt?: string;
    firstName: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string;
}

export interface Project {
    id: string;
    chat_id: string;
    name: string;
    description?: string;
    timezone?: string;
    is_admin?: boolean;
    createdAt?: string | Date;
    updatedAt?: string | Date;
    created_at?: string;
    updated_at?: string;
}

