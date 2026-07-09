// src\modules\attendance\attendance.controller.ts
import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from './attendance.service';
import { AttendancePDFService } from './attendance-pdf.service';
import { RegisterAttendanceDto } from './attendance.types';

const service = new AttendanceService();
const pdfService = new AttendancePDFService();

// Helper para obtener el usuario autenticado
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
  // Registrar asistencia (Docente)
  async registerAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);

      if (!user) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const { courseId, classDate, records } = req.body;

      // VALIDACIÓN DE FECHA FUTURA
      if (classDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const classDateObj = new Date(classDate);
        classDateObj.setHours(0, 0, 0, 0);

        if (classDateObj > today) {
          return res.status(400).json({
            success: false,
            message: 'No se puede registrar asistencia en una fecha futura'
          });
        }
      }

      const teacherId = user.id;
      const data: RegisterAttendanceDto = {
        courseId,
        classDate,
        records,
        recordedBy: teacherId,
      };

      const result = await service.registerBatch(data);
      res.status(201).json({
        message: 'Asistencia registrada exitosamente',
        count: result.length,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener asistencia por fecha (Docente)
  async getByDate(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId, date } = req.params;
      const result = await service.getByCourseAndDate(courseId, date);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // Obtener historial de un estudiante específico por ID
  async getStudentHistoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const { courseId } = req.query;

      if (!studentId || studentId === 'undefined') {
        return res.status(400).json({ message: 'Student ID es requerido' });
      }

      const history = await service.getStudentHistory(studentId, courseId as string);

      console.log(`📊 Found ${history.length} attendance records for student ${studentId}`);

      res.json(history);
    } catch (error) {
      console.error('❌ Error fetching student history:', error);
      next(error);
    }
  }

  // Obtener estadísticas de un estudiante específico por ID
  async getStudentStatsById(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const { courseId } = req.query;

      if (!studentId || studentId === 'undefined') {
        return res.status(400).json({ message: 'Student ID es requerido' });
      }

      const stats = await service.getStudentStats(studentId, courseId as string);

      const response = {
        totalClasses: stats.totalClasses,
        presentClasses: stats.attendedClasses,
        absentClasses: stats.absences,
        attendanceRate: stats.attendancePercentage,
      };

      console.log(`📈 Calculated stats for student ${studentId}:`, response);

      res.json(response);
    } catch (error) {
      console.error('❌ Error calculating student stats:', error);
      next(error);
    }
  }

  // GET /api/attendance/student/:studentId/pdf
  async downloadStudentPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const { courseId, startDate, endDate } = req.query;
      const user = getAuthUser(req);

      if (!user) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const history = await service.getStudentHistory(studentId, courseId as string);

      let filteredHistory = history;
      if (startDate || endDate) {
        filteredHistory = history.filter((record: any) => {
          const recordDate = new Date(record.classDate);
          const isAfterStart = !startDate || recordDate >= new Date(startDate as string);
          const isBeforeEnd = !endDate || recordDate <= new Date(endDate as string);
          return isAfterStart && isBeforeEnd;
        });
      }

      const totalClasses = filteredHistory.length;
      const presentClasses = filteredHistory.filter((r: any) => r.present).length;
      const absentClasses = totalClasses - presentClasses;
      const attendanceRate = totalClasses > 0 ? (presentClasses / totalClasses) * 100 : 0;

      const stats = {
        totalClasses,
        presentClasses,
        absentClasses,
        attendanceRate: Number(attendanceRate.toFixed(2)),
      };

      const studentInfo = filteredHistory[0]?.student || {
        firstName: 'N/A',
        lastName: '',
        dni: 'N/A',
        email: 'N/A',
      };

      await pdfService.generateAttendancePDF(
        {
          student: studentInfo,
          attendances: filteredHistory,
          stats,
          filters: {
            courseName: filteredHistory[0]?.course?.name,
            startDate: startDate as string,
            endDate: endDate as string,
          },
          generatedBy: {
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
          },
        },
        res
      );
    } catch (error) {
      console.error('❌ Error generating student PDF:', error);
      next(error);
    }
  }

  // Descargar PDF de reporte general
  async downloadReportPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId, studentId, startDate, endDate } = req.query;
      const user = getAuthUser(req);

      if (!user) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const reportData = await service.getReport({
        courseId: courseId as string,
        studentId: studentId as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      await pdfService.generateMultiStudentPDF(
        {
          attendances: reportData.attendances,
          stats: reportData.stats,
          filters: {
            courseName: reportData.attendances[0]?.course?.name,
            startDate: startDate as string,
            endDate: endDate as string,
          },
          generatedBy: {
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
          },
        },
        res
      );
    } catch (error) {
      console.error('❌ Error generating report PDF:', error);
      next(error);
    }
  }

  // Estadísticas (Estudiante)
  async getMyStats(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);

      if (!user) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const studentId = user.id;
      const stats = await service.getStudentStats(studentId);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  // Historial (Estudiante)
  async getMyHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);

      if (!user) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const studentId = user.id;
      const history = await service.getStudentHistory(studentId);
      res.json(history);
    } catch (error) {
      next(error);
    }
  }

  // Estadísticas generales (Admin/Teacher)
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as {
        courseId?: string;
        startDate?: string;
        endDate?: string;
      };
      const stats = await service.getStats(query);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  // Reporte detallado (Admin/Teacher)
  async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as {
        courseId?: string;
        studentId?: string;
        startDate?: string;
        endDate?: string;
      };
      const report = await service.getReport(query);
      res.json(report);
    } catch (error) {
      next(error);
    }
  }
}