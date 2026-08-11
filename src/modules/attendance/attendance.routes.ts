// academy-backend/src/modules/attendance/attendance.routes.ts

import { Router } from 'express';
import { AttendanceController } from './attendance.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
const controller = new AttendanceController();

// ✅ TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN
router.use(authMiddleware);

// ============================================================
// 📌 RUTAS PRINCIPALES
// ============================================================
router.post('/', controller.registerAttendance.bind(controller));
router.get('/course/:courseId/date/:date', controller.getByDate.bind(controller));

// ============================================================
// 📌 RUTAS DE ESTUDIANTE AUTENTICADO
// ============================================================
router.get('/me/stats', controller.getMyStats.bind(controller));
router.get('/me/history', controller.getMyHistory.bind(controller));

// ============================================================
// 📌 RUTAS DE ESTUDIANTE POR ID
// ============================================================
router.get('/student/:studentId', controller.getStudentHistoryById.bind(controller));
router.get('/student/:studentId/stats', controller.getStudentStatsById.bind(controller));

// ============================================================
// 📌 RUTAS DE REPORTES
// ============================================================
router.get('/stats', controller.getStats.bind(controller));
router.get('/report', controller.getReport.bind(controller));
router.get('/report/pdf', controller.downloadReportPDF.bind(controller));

export default router;