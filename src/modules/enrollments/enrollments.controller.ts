import { Request, Response, NextFunction } from 'express';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto, UpdateEnrollmentStatusDto } from './enrollments.types';

const service = new EnrollmentsService();

export class EnrollmentsController {
  async enrollStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const data: CreateEnrollmentDto = req.body;
      const result = await service.enrollStudent(data);
      res.status(201).json({
        message: 'Estudiante matriculado exitosamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEnrolledStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.params;
      const students = await service.getEnrolledStudents(courseId);
      res.json(students);
    } catch (error) {
      next(error);
    }
  }

  async getAvailableStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const { courseId } = req.params;
      const students = await service.getAvailableStudents(courseId);
      res.json(students);
    } catch (error) {
      next(error);
    }
  }

  async updateEnrollmentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: UpdateEnrollmentStatusDto = req.body;
      const result = await service.updateEnrollmentStatus(id, data);

      const statusMessages = {
        ACTIVE: 'Matrícula reactivada exitosamente',
        CANCELLED: 'Matrícula cancelada exitosamente',
        COMPLETED: 'Matrícula marcada como completada',
      };

      res.json({
        message: statusMessages[data.status],
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteEnrollment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await service.deleteEnrollment(id);
      res.json({
        message: 'Matrícula cancelada exitosamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyEnrollments(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = (req as any).user?.id;

      if (!studentId) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const result = await service.getMyEnrollments(studentId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // ✅ NUEVO MÉTODO
  async getEnrollmentsByStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID es requerido'
        });
      }

      const enrollments = await service.getEnrollmentsByStudent(studentId);

      res.json({
        success: true,
        data: enrollments,
      });
    } catch (error) {
      console.error('❌ Error al obtener inscripciones del estudiante:', error);
      next(error);
    }
  }
}