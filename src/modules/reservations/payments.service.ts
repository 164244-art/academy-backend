// academy-backend/src/modules/reservations/payments.service.ts
import { PrismaClient, PaymentStatus } from '@prisma/client';
import { AppError } from '../../utils/errors';

const prisma = new PrismaClient();

interface CreatePaymentDto {
  studentId: string;
  amount: number;
  concept: string;
  dueDate?: Date;
  paymentMethod?: string;
  notes?: string;
  status?: PaymentStatus;
  recordedBy: string;
}

interface UpdatePaymentDto {
  amount?: number;
  concept?: string;
  dueDate?: Date;
  status?: PaymentStatus;
  paymentMethod?: string;
  receiptNumber?: string;
  notes?: string;
}

interface PaymentFilters {
  status?: string;
  studentId?: string;
  startDate?: string;
  endDate?: string;
}

// ✅ Obtener el monto total de la pensión del estudiante
export const getStudentMonthlyPayment = async (studentId: string): Promise<number> => {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId,
      status: 'ACTIVE',
    },
    include: {
      course: true,
    },
  });

  if (enrollments.length === 0) {
    throw new AppError('El estudiante no tiene cursos activos', 404);
  }

  const total = enrollments.reduce((sum, enrollment) => {
    return sum + Number(enrollment.course.monthlyPrice);
  }, 0);

  return total;
};

// ✅ PAG-01 + PAG-02: Crear pago con validaciones
export const createPayment = async (data: CreatePaymentDto) => {
  const { studentId, amount, concept, dueDate, paymentMethod, notes, status, recordedBy } = data;

  console.log('📊 PAG-01/PAG-02 DEBUG:');
  console.log('  studentId:', studentId);
  console.log('  amount:', amount);
  console.log('  status:', status);
  console.log('  paymentMethod:', paymentMethod);

  // Validar que el estudiante existe
  const student = await prisma.user.findUnique({
    where: { id: studentId },
  });

  if (!student || student.role !== 'STUDENT') {
    throw new AppError('Estudiante no encontrado', 404);
  }

  // ✅ PAG-01: Validar el monto según método de pago (solo si es PAID)
  if (status === 'PAID') {
    const monthlyAmount = await getStudentMonthlyPayment(studentId);
    
    const exactPaymentMethods = ['TARJETA', 'TRANSFERENCIA', 'YAPE', 'PLIN'];
    const metodo = paymentMethod?.toUpperCase() || '';
    
    if (exactPaymentMethods.includes(metodo)) {
      if (amount !== monthlyAmount) {
        throw new AppError(
          `El monto debe ser EXACTO (S/ ${monthlyAmount}) para pagos con ${paymentMethod}`,
          400
        );
      }
    } else if (metodo === 'EFECTIVO') {
      if (amount < monthlyAmount) {
        throw new AppError(
          `El monto pagado (S/ ${amount}) es insuficiente. El monto de la pensión es S/ ${monthlyAmount}`,
          400
        );
      }
      if (amount > monthlyAmount) {
        const vuelto = amount - monthlyAmount;
        console.log(`💰 Vuelto: S/ ${vuelto.toFixed(2)}`);
      }
    } else {
      if (amount < monthlyAmount) {
        throw new AppError(
          `El monto pagado (S/ ${amount}) es insuficiente. El monto de la pensión es S/ ${monthlyAmount}`,
          400
        );
      }
    }

    // ✅ PAG-02: Verificar pagos duplicados en el mismo periodo
    const firstDay = new Date();
    firstDay.setUTCDate(1);
    firstDay.setUTCHours(0, 0, 0, 0);
    
    const lastDay = new Date(firstDay);
    lastDay.setUTCMonth(lastDay.getUTCMonth() + 1);

    const existingPayment = await prisma.payment.findFirst({
      where: {
        studentId,
        concept,
        status: 'PAID',
        paymentDate: {
          gte: firstDay,
          lt: lastDay,
        },
      },
    });

    if (existingPayment) {
      throw new AppError(
        `⚠️ Ya existe un pago registrado para "${concept}" en este periodo. 
         Fecha: ${existingPayment.paymentDate.toLocaleDateString()}
         Monto: S/ ${existingPayment.amount}`,
        409
      );
    }
  }

  // Generar número de recibo si el pago está marcado como PAID
  let receiptNumber: string | undefined;
  if (status === 'PAID') {
    const count = await prisma.payment.count();
    receiptNumber = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  const payment = await prisma.payment.create({
    data: {
      studentId,
      amount,
      concept,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      paymentMethod,
      notes,
      status: status || 'PENDING',
      receiptNumber,
      recordedBy,
    },
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          dni: true,
        },
      },
      recorder: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  console.log('✅ Pago registrado:', payment.id);
  return payment;
};

export const getAllPayments = async (filters: PaymentFilters) => {
  const { status, studentId, startDate, endDate } = filters;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (studentId) {
    where.studentId = studentId;
  }

  if (startDate || endDate) {
    where.paymentDate = {};
    if (startDate) {
      where.paymentDate.gte = new Date(startDate);
    }
    if (endDate) {
      where.paymentDate.lte = new Date(endDate);
    }
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          dni: true,
        },
      },
      recorder: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      paymentDate: 'desc',
    },
  });

  return payments;
};

export const getPaymentById = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          dni: true,
        },
      },
      recorder: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError('Pago no encontrado', 404);
  }

  return payment;
};

export const updatePayment = async (paymentId: string, data: UpdatePaymentDto) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new AppError('Pago no encontrado', 404);
  }

  let receiptNumber = data.receiptNumber;
  if (data.status === 'PAID' && !payment.receiptNumber && !receiptNumber) {
    const count = await prisma.payment.count();
    receiptNumber = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      ...data,
      receiptNumber,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    },
    include: {
      student: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          dni: true,
        },
      },
      recorder: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return updated;
};

export const deletePayment = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new AppError('Pago no encontrado', 404);
  }

  await prisma.payment.delete({
    where: { id: paymentId },
  });
};

export const getStudentPayments = async (studentId: string) => {
  const payments = await prisma.payment.findMany({
    where: { studentId },
    orderBy: {
      paymentDate: 'desc',
    },
  });

  return payments;
};