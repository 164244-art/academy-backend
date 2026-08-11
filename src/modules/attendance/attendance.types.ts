// academy-backend/src/modules/attendance/attendance.types.ts

export type AttendanceStatusType = 'PRESENT' | 'PERMIT' | 'ABSENT';

export const AttendanceStatus = {
  PRESENT: 'PRESENT' as AttendanceStatusType,
  PERMIT: 'PERMIT' as AttendanceStatusType,
  ABSENT: 'ABSENT' as AttendanceStatusType,
} as const;

export interface RegisterAttendanceDto {
  courseId: string;
  classDate: string;
  records: {
    studentId: string;
    status: AttendanceStatusType;
    notes?: string;
  }[];
  recordedBy: string;
}

export interface AttendanceStatsDto {
  totalClasses: number;
  attendedClasses: number;
  attendancePercentage: number;
  absences: number;
  permits: number;
}

export interface AttendanceReportQueryDto {
  startDate?: string;
  endDate?: string;
  courseId?: string;
  studentId?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  courseId: string;
  classDate: Date;
  status: AttendanceStatusType;
  notes: string | null;
  recordedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    dni: string;
    email: string;
  };
  course?: {
    id: string;
    name: string;
    subject: string;
  };
  recorder?: {
    firstName: string;
    lastName: string;
  } | null;
}

export interface FullRosterAttendance {
  studentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    dni: string;
    email: string;
  };
  status: AttendanceStatusType | null;
  notes: string | null;
  id: string | null;
  classDate: Date;
  recordedBy: string | null;
}

export function presentToStatus(present: boolean): AttendanceStatusType {
  return present ? 'PRESENT' : 'ABSENT';
}

export function statusToPresent(status: AttendanceStatusType): boolean {
  return status === 'PRESENT';
}