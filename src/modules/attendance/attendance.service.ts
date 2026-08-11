// academy-backend/src/modules/attendance/attendance.service.ts

import { PrismaClient } from '@prisma/client';
import { 
  RegisterAttendanceDto, 
  AttendanceStatsDto, 
  FullRosterAttendance, 
  AttendanceRecord,
  AttendanceStatusType,
} from './attendance.types';

const prisma = new PrismaClient();

export class AttendanceService {
  // ============================================================
  // 📌 REGISTRAR ASISTENCIA - SIN TRANSACCIÓN
  // ============================================================
  async registerBatch(data: RegisterAttendanceDto) {
    const { courseId, classDate, records, recordedBy } = data;

    const dateObj = new Date(classDate + 'T00:00:00.000Z');

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (dateObj > today) {
      throw new Error('No se puede registrar asistencia en una fecha futura');
    }

    const results = [];

    for (const record of records) {
      const notes = record.status === 'PERMIT' 
        ? `${record.notes || ''} [PERMISO]`.trim() 
        : record.notes || '';

      try {
        const existing = await prisma.attendance.findUnique({
          where: {
            studentId_courseId_classDate: {
              studentId: record.studentId,
              courseId: courseId,
              classDate: dateObj,
            },
          },
        });

        let attendance;

        if (existing) {
          attendance = await prisma.attendance.update({
            where: {
              studentId_courseId_classDate: {
                studentId: record.studentId,
                courseId: courseId,
                classDate: dateObj,
              },
            },
            data: {
              status: record.status,
              notes: notes,
              recordedBy: recordedBy,
            },
          });
        } else {
          attendance = await prisma.attendance.create({
            data: {
              studentId: record.studentId,
              courseId: courseId,
              classDate: dateObj,
              status: record.status,
              notes: notes,
              recordedBy: recordedBy,
            },
          });
        }

        results.push(attendance);
      } catch (error) {
        console.error(`❌ Error procesando estudiante ${record.studentId}:`, error);
        throw error;
      }
    }

    return results;
  }

  // ============================================================
  // 📌 OBTENER ROSTER COMPLETO
  // ============================================================
  async getFullRosterWithAttendance(courseId: string, date: string): Promise<FullRosterAttendance[]> {
    const dateObj = new Date(date + 'T00:00:00.000Z');

    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId,
        status: 'ACTIVE',
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dni: true,
            email: true,
          },
        },
      },
    });

    const existingAttendances = await prisma.attendance.findMany({
      where: {
        courseId,
        classDate: dateObj,
      },
    });

    return enrollments.map((enrollment) => {
      const attendanceRecord = existingAttendances.find(
        (att: any) => att.studentId === enrollment.student.id
      );

      let status: AttendanceStatusType | null = null;
      
      if (attendanceRecord) {
        status = attendanceRecord.status as AttendanceStatusType;
      }

      return {
        studentId: enrollment.student.id,
        student: enrollment.student,
        status: status,
        notes: attendanceRecord ? attendanceRecord.notes : null,
        id: attendanceRecord ? attendanceRecord.id : null,
        classDate: attendanceRecord ? attendanceRecord.classDate : dateObj,
        recordedBy: attendanceRecord ? attendanceRecord.recordedBy : null,
      };
    });
  }

  // ============================================================
  // 📌 ESTADÍSTICAS DE ESTUDIANTE
  // ============================================================
  async getStudentStats(studentId: string, courseId?: string): Promise<AttendanceStatsDto> {
    const where: any = { studentId };
    if (courseId && courseId !== 'undefined') where.courseId = courseId;

    const allRecords = await prisma.attendance.findMany({
      where,
      orderBy: { classDate: 'desc' },
    });

    const totalClasses = allRecords.length;
    const presentClasses = allRecords.filter((record: any) => record.status === 'PRESENT').length;
    const permits = allRecords.filter((record: any) => record.status === 'PERMIT').length;
    const absences = allRecords.filter((record: any) => record.status === 'ABSENT').length;

    return {
      totalClasses,
      attendedClasses: presentClasses,
      attendancePercentage: totalClasses > 0 ? Number(((presentClasses / totalClasses) * 100).toFixed(2)) : 0,
      absences,
      permits,
    };
  }

  // ============================================================
  // 📌 HISTORIAL DE ESTUDIANTE (CORREGIDO)
  // ============================================================
  async getStudentHistory(studentId: string, courseId?: string): Promise<AttendanceRecord[]> {
    const where: any = { studentId };
    if (courseId && courseId !== 'undefined') where.courseId = courseId;

    console.log('📡 getStudentHistory - Buscando registros para:', { studentId, courseId });

    const results = await prisma.attendance.findMany({
      where,
      include: {
        course: {
          select: {
            id: true,
            name: true,
            subject: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dni: true,
            email: true,
          },
        },
        recorder: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { classDate: 'desc' },
    });

    console.log('📊 getStudentHistory - Registros encontrados:', results.length);
    if (results.length > 0) {
      console.log('📊 Primer registro:', JSON.stringify(results[0], null, 2));
    }

    return results.map((record: any): AttendanceRecord => {
      return {
        ...record,
        status: record.status as AttendanceStatusType,
      };
    });
  }

  // ============================================================
  // 📌 ESTADÍSTICAS GENERALES
  // ============================================================
  async getStats(query: { courseId?: string; startDate?: string; endDate?: string }) {
    const where: any = {};
    if (query.courseId) where.courseId = query.courseId;

    if (query.startDate || query.endDate) {
      where.classDate = {};
      if (query.startDate) where.classDate.gte = new Date(query.startDate + 'T00:00:00.000Z');
      if (query.endDate) where.classDate.lte = new Date(query.endDate + 'T00:00:00.000Z');
    }

    const allRecords = await prisma.attendance.findMany({ where });

    const totalClasses = allRecords.length;
    const present = allRecords.filter((record: any) => record.status === 'PRESENT').length;
    const permits = allRecords.filter((record: any) => record.status === 'PERMIT').length;
    const absences = allRecords.filter((record: any) => record.status === 'ABSENT').length;

    return {
      totalClasses,
      present,
      permits,
      absences,
      attendanceRate: totalClasses > 0 ? Number(((present / totalClasses) * 100).toFixed(2)) : 0,
    };
  }

  // ============================================================
  // 📌 REPORTE
  // ============================================================
  async getReport(query: {
    courseId?: string;
    studentId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};
    if (query.courseId) where.courseId = query.courseId;

    if (query.studentId) {
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(query.studentId);
      if (isUuid) {
        where.studentId = query.studentId;
      } else {
        where.student = { dni: { contains: query.studentId } };
      }
    }

    if (query.startDate || query.endDate) {
      where.classDate = {};
      if (query.startDate) where.classDate.gte = new Date(query.startDate + 'T00:00:00.000Z');
      if (query.endDate) where.classDate.lte = new Date(query.endDate + 'T00:00:00.000Z');
    }

    const results = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dni: true,
            email: true,
          },
        },
        course: {
          select: {
            id: true,
            name: true,
            subject: true,
          },
        },
      },
      orderBy: { classDate: 'desc' },
    });

    const attendances = results.map((record: any): any => {
      return {
        ...record,
        status: record.status as AttendanceStatusType,
        present: record.status === 'PRESENT',
      };
    });

    const total = attendances.length;
    const present = attendances.filter((record) => record.status === 'PRESENT').length;
    const permits = attendances.filter((record) => record.status === 'PERMIT').length;
    const absences = attendances.filter((record) => record.status === 'ABSENT').length;

    return {
      attendances,
      stats: {
        totalClasses: total,
        presentClasses: present,
        permitClasses: permits,
        absentClasses: absences,
        attendanceRate: total > 0 ? Number(((present / total) * 100).toFixed(2)) : 0,
      },
    };
  }

  validateAttendanceStatus(status: string): boolean {
    return ['PRESENT', 'PERMIT', 'ABSENT'].includes(status);
  }

  validateAttendanceDate(date: Date): boolean {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const inputDate = new Date(date);
    inputDate.setUTCHours(0, 0, 0, 0);
    return inputDate <= today;
  }
}