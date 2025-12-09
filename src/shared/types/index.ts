export interface TimeRange {
    start: string;
    end: string;
}

export interface AvailabilityInfo {
    timeRanges: TimeRange[];
}

export type RSVPStatus = 'invited' | 'confirmed' | 'declined' | 'tentative';

export interface UserResponse {
    status: RSVPStatus;
    responseAt?: string;
    notes?: string;
}

export interface ResponseStats {
    total: number;
    confirmed: number;
    declined: number;
    tentative: number;
    invited: number;
}

export interface Rehearsal {
    id: string;
    date: string;
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

export interface Actor {
    id: string;
    telegram_id: string;
    name: string;
    is_admin: boolean;
    project_id?: string;
    created_at?: string;
    updated_at?: string;
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