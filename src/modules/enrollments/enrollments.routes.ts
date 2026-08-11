import { Router } from 'express';
import { EnrollmentsController } from './enrollments.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { createEnrollmentSchema, updateEnrollmentStatusSchema } from './enrollments.types';

const router = Router();
const controller = new EnrollmentsController();

router.use(authMiddleware);

// Crear matrícula (ADMIN)
router.post(
  '/',
  validate(createEnrollmentSchema, 'body'),
  controller.enrollStudent.bind(controller)
);

// Obtener estudiantes disponibles para matricular en un curso
router.get('/available/:courseId', controller.getAvailableStudents.bind(controller));

// Obtener mis matrículas (Estudiante)
router.get('/my-enrollments', controller.getMyEnrollments.bind(controller));

// ✅ RUTA NUEVA: Obtener inscripciones de un estudiante específico
router.get('/student/:studentId', controller.getEnrollmentsByStudent.bind(controller));

// Listar estudiantes matriculados por curso
router.get('/course/:courseId', controller.getEnrolledStudents.bind(controller));

// Actualizar estado de matrícula
router.patch(
  '/:id/status',
  validate(updateEnrollmentStatusSchema, 'body'),
  controller.updateEnrollmentStatus.bind(controller)
);

// Cancelar matrícula (método antiguo, mantener por compatibilidad)
router.delete('/:id', controller.deleteEnrollment.bind(controller));

export default router;