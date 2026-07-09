import { AttendanceService } from '../attendance.service';

describe('AttendanceService - Módulo Asistencias', () => {
  let service: AttendanceService;

  beforeEach(() => {
    service = new AttendanceService();
  });

  // Test 1: validateAttendanceStatus
  describe('validateAttendanceStatus', () => {
    it('debe aceptar PRESENT, ABSENT, LATE', () => {
      expect(service.validateAttendanceStatus('PRESENT')).toBe(true);
      expect(service.validateAttendanceStatus('ABSENT')).toBe(true);
      expect(service.validateAttendanceStatus('LATE')).toBe(true);
    });

    it('debe rechazar cualquier otro estado', () => {
      expect(service.validateAttendanceStatus('INVALID')).toBe(false);
      expect(service.validateAttendanceStatus('')).toBe(false);
    });
  });

  // Test 2: validateAttendanceDate
  describe('validateAttendanceDate', () => {
    it('debe rechazar fechas futuras', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(service.validateAttendanceDate(tomorrow)).toBe(false);
    });

    it('debe aceptar fechas pasadas o hoy', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(service.validateAttendanceDate(yesterday)).toBe(true);
    });
  });

  // Test 3: calculateAttendanceStats
  describe('calculateAttendanceStats', () => {
    it('debe calcular porcentajes correctamente', () => {
      const records = [
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'ABSENT' },
        { status: 'LATE' }
      ];
      const stats = service.calculateAttendanceStats(records);
      
      expect(stats.attendance).toBe(50);
      expect(stats.absences).toBe(25);
      expect(stats.lates).toBe(25);
    });

    it('debe retornar 0 si no hay registros', () => {
      const stats = service.calculateAttendanceStats([]);
      expect(stats.attendance).toBe(0);
      expect(stats.absences).toBe(0);
      expect(stats.lates).toBe(0);
    });
  });
});