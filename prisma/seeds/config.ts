export interface SeedConfig {
  cleanDatabase: boolean;
  seeds: {
    users: boolean;
    courses: boolean;
    schedules: boolean;
    enrollments: boolean;
    attendance: boolean;
    payments: boolean;
    reservations: boolean;
    notifications: boolean;
  };
  quantities: {
    admins: number;
    teachers: number;
    students: number;
  };
  options: {
    attendanceHistoryMonths: number;
    reservationFutureDays: number;
    coursesPerStudent: [number, number];
    attendanceRate: number;
    paymentCompletionRate: number;
  };
}

// CONFIGURACIÓN POR DEFECTO CON TODOS LOS SEEDS ACTIVADOS
export const defaultConfig: SeedConfig = {
  cleanDatabase: true,
  seeds: {
    users: true,           // ✅ ACTIVADO
    courses: true,         // ✅ ACTIVADO
    schedules: true,       // ✅ ACTIVADO
    enrollments: true,     // ✅ ACTIVADO
    attendance: true,      // ✅ ACTIVADO
    payments: true,        // ✅ ACTIVADO
    reservations: true,    // ✅ ACTIVADO
    notifications: true,   // ✅ ACTIVADO
  },
  quantities: {
    admins: 1,
    teachers: 2,
    students: 10,
  },
  options: {
    attendanceHistoryMonths: 1,
    reservationFutureDays: 7,
    coursesPerStudent: [1, 2],
    attendanceRate: 0.7,
    paymentCompletionRate: 0.7,
  },
};

// Configuración para desarrollo
export const devConfig: SeedConfig = {
  ...defaultConfig,
  quantities: {
    admins: 1,
    teachers: 3,
    students: 20,
  },
  options: {
    ...defaultConfig.options,
    attendanceHistoryMonths: 1,
    reservationFutureDays: 15,
  },
};

// Configuración para testing
export const testConfig: SeedConfig = {
  ...defaultConfig,
  quantities: {
    admins: 1,
    teachers: 2,
    students: 10,
  },
  options: {
    ...defaultConfig.options,
    attendanceHistoryMonths: 1,
    reservationFutureDays: 7,
    coursesPerStudent: [1, 2],
  },
};