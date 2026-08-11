// academy-backend/src/modules/attendance/attendance.controller.ts

import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from './attendance.service';
import { RegisterAttendanceDto, AttendanceStatus, AttendanceRecord } from './attendance.types';
import { AttendancePDFService } from './attendance-pdf.service';

const service = new AttendanceService();
const pdfService = new AttendancePDFService();

const getAuthUser = (req: Request) => {
  return (req as any).user as
    | {
        id: string;
        email: string;
        role: 'STUDENT' | 'TEACHER' | 'ADMIN';
        firstName: string;
        lastName: string;
      }
    | undefined;
};

export class AttendanceController {
  // ============================================================
  // 📌 POST /api/attendance - Registrar asistencia
  // ============================================================
  async registerAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const { courseId, classDate, records } = req.body;

      console.log('📥 Backend recibió:', JSON.stringify(req.body, null, 2));

      if (classDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const classDateObj = new Date(classDate + 'T00:00:00.000Z');
        classDateObj.setUTCHours(0, 0, 0, 0);

        if (classDateObj > today) {
          return res.status(400).json({
            success: false,
            message: 'No se puede registrar asistencia en una fecha futura',
          });
        }
      }

      if (!records || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere al menos un registro de asistencia',
        });
      }

      const validStatuses = Object.values(AttendanceStatus);
      
      const processedRecords = records.map((record: any) => {
        let status = record.status;
        
        if (status === undefined || status === null) {
          if (record.present !== undefined) {
            status = record.present === true ? 'PRESENT' : 'ABSENT';
            console.log(`🔄 Convertido: present=${record.present} → status=${status}`);
          } else {
            status = 'ABSENT';
          }
        }
        
        if (typeof status === 'string') {
          status = status.toUpperCase();
        }
        
        if (!validStatuses.includes(status)) {
          console.warn(`⚠️ Status inválido: "${status}", usando ABSENT`);
          status = 'ABSENT';
        }
        
        return {
          studentId: record.studentId,
          status: status,
          notes: record.notes || '',
        };
      });

      console.log('📤 Records procesados:', JSON.stringify(processedRecords, null, 2));

      const teacherId = user.id;
      const data: RegisterAttendanceDto = {
        courseId,
        classDate,
        records: processedRecords,
        recordedBy: teacherId,
      };

      const result = await service.registerBatch(data);

      res.status(201).json({
        success: true,
        message: `Asistencia registrada exitosamente (${result.length} registros)`,
        count: result.length,
        data: result,
      });
    } catch (error) {
      console.error('❌ Error en registerAttendance:', error);
      next(error);
    }
  }

  // ============================================================
  // 📌 GET /api/attendance/course/:courseId/date/:date
  // ============================================================
  async getByDate(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId, date } = req.params;

      if (!courseId || !date) {
        return res.status(400).json({
          success: false,
          message: 'courseId y date son requeridos',
        });
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha inválido. Use YYYY-MM-DD',
        });
      }

      const result = await service.getFullRosterWithAttendance(courseId, date);
      
      console.log('📊 Datos devueltos al frontend:', JSON.stringify(result.map((r: any) => ({
        student: r.student?.firstName + ' ' + r.student?.lastName,
        status: r.status,
        id: r.studentId
      })), null, 2));

      const summary = {
        present: result.filter((r) => r.status === AttendanceStatus.PRESENT).length,
        permit: result.filter((r) => r.status === AttendanceStatus.PERMIT).length,
        absent: result.filter((r) => r.status === AttendanceStatus.ABSENT || r.status === null).length,
        total: result.length,
      };

      res.json({
        success: true,
        data: {
          students: result,
          summary,
          date,
          courseId,
        },
      });
    } catch (error) {
      console.error('❌ Error al obtener asistencia:', error);
      next(error);
    }
  }

  // ============================================================
  // 📌 GET /api/attendance/student/:studentId
  // ============================================================
  async getStudentHistoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const { courseId } = req.query;

      if (!studentId || studentId === 'undefined') {
        return res.status(400).json({
          success: false,
          message: 'Student ID es requerido',
        });
      }

      const history = await service.getStudentHistory(studentId, courseId as string);

      const total = history.length;
      const present = history.filter((r: AttendanceRecord) => r.status === AttendanceStatus.PRESENT).length;
      const permits = history.filter((r: AttendanceRecord) => r.status === AttendanceStatus.PERMIT).length;
      const absences = history.filter((r: AttendanceRecord) => r.status === AttendanceStatus.ABSENT).length;

      res.json({
        success: true,
        data: {
          history,
          stats: {
            total,
            present,
            permits,
            absences,
            attendanceRate: total > 0 ? Number(((present / total) * 100).toFixed(2)) : 0,
          },
        },
      });
    } catch (error) {
      console.error('❌ Error fetching student history:', error);
      next(error);
    }
  }

  // ============================================================
  // 📌 GET /api/attendance/student/:studentId/stats
  // ============================================================
  async getStudentStatsById(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const { courseId } = req.query;

      if (!studentId || studentId === 'undefined') {
        return res.status(400).json({
          success: false,
          message: 'Student ID es requerido',
        });
      }

      const stats = await service.getStudentStats(studentId, courseId as string);

      res.json({
        success: true,
        data: {
          totalClasses: stats.totalClasses,
          presentClasses: stats.attendedClasses,
          permits: stats.permits,
          absentClasses: stats.absences,
          attendanceRate: stats.attendancePercentage,
        },
      });
    } catch (error) {
      console.error('❌ Error calculating student stats:', error);
      next(error);
    }
  }

  // ============================================================
  // 📌 GET /api/attendance/me/stats
  // ============================================================
  async getMyStats(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
        });
      }

      const stats = await service.getStudentStats(user.id);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // 📌 GET /api/attendance/me/history
  // ============================================================
  async getMyHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
        });
      }

      const history = await service.getStudentHistory(user.id);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // 📌 GET /api/attendance/stats
  // ============================================================
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as {
        courseId?: string;
        startDate?: string;
        endDate?: string;
      };

      const stats = await service.getStats(query);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // 📌 GET /api/attendance/report
  // ============================================================
  async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as {
        courseId?: string;
        studentId?: string;
        startDate?: string;
        endDate?: string;
      };

      const report = await service.getReport(query);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // 📌 GET /api/attendance/report/pdf - Descargar PDF
  // ============================================================
  async downloadReportPDF(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('📄 Solicitud de PDF recibida');
      
      const query = req.query as {
        courseId?: string;
        studentId?: string;
        startDate?: string;
        endDate?: string;
      };

      // Obtener los datos del reporte
      const report = await service.getReport(query);

      // Verificar si hay datos
      if (!report.attendances || report.attendances.length === 0) {
        console.log('⚠️ No hay datos para generar PDF');
        return res.status(404).json({
          success: false,
          message: 'No hay registros de asistencia para generar el PDF'
        });
      }

      console.log(`📄 Generando PDF con ${report.attendances.length} registros`);

      // Obtener información del usuario que genera el PDF
      const user = getAuthUser(req);
      const generatedBy = {
        name: user ? `${user.firstName} ${user.lastName}` : 'Sistema',
        role: user ? user.role : 'ADMIN'
      };

      // Preparar datos para el PDF
      const pdfData = {
        attendances: report.attendances,
        stats: {
          totalClasses: report.stats.totalClasses,
          presentClasses: report.stats.presentClasses,
          absentClasses: report.stats.absentClasses,
          attendanceRate: report.stats.attendanceRate
        },
        filters: {
          courseName: query.courseId ? 'Curso seleccionado' : 'Todos los cursos',
          startDate: query.startDate || '',
          endDate: query.endDate || ''
        },
        generatedBy: generatedBy
      };

      // Generar el PDF
      await pdfService.generateAttendancePDF(pdfData, res);

    } catch (error) {
      console.error('❌ Error generando PDF:', error);
      
      // Si la respuesta ya se envió, no intentar enviar otra
      if (res.headersSent) return;
      
      res.status(500).json({
        success: false,
        message: 'Error al generar el PDF',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
}