import { PrismaClient, EnrollmentStatus } from '@prisma/client';
import { CreateEnrollmentDto, UpdateEnrollmentStatusDto } from './enrollments.types';
const prisma = new PrismaClient();

export class EnrollmentsService {
  async enrollStudent(data: CreateEnrollmentDto) {
    const { studentId, courseId } = data;

    const student = await prisma.user.findUnique({
      where: { id: studentId },
    });

    if (!student || !student.isActive) {
      throw new Error('Student not found or inactive');
    }

    if (student.role !== 'STUDENT') {
      throw new Error('User is not a student');
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        _count: { select: { enrollments: true } },
      },
    });

    if (!course || !course.isActive) {
      throw new Error('Course not found or inactive');
    }

    if (course._count.enrollments >= course.capacity) {
      throw new Error('Course is already full');
    }

    const exists = await prisma.enrollment.findFirst({
      where: {
        studentId,
        courseId,
      },
    });

    if (exists) {
      throw new Error('Student already enrolled in this course');
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId,
        courseId,
      },
      include: {
        student: true,
        course: true,
      },
    });

    return enrollment;
  }

  async getEnrolledStudents(courseId: string) {
    return prisma.enrollment.findMany({
      where: { courseId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            dni: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAvailableStudents(courseId: string) {
    const enrolledStudents = await prisma.enrollment.findMany({
      where: {
        courseId,
        status: 'ACTIVE',
      },
      select: { studentId: true },
    });

    const enrolledIds = enrolledStudents.map((e) => e.studentId);

    return prisma.user.findMany({
      where: {
        role: 'STUDENT',
        isActive: true,
        id: {
          notIn: enrolledIds.length > 0 ? enrolledIds : undefined,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        dni: true,
        phone: true,
      },
      orderBy: {
        firstName: 'asc',
      },
    });
  }

  async updateEnrollmentStatus(id: string, data: UpdateEnrollmentStatusDto) {
    const { status } = data;

    const enrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        course: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    const currentStatus = enrollment.status;

    if (currentStatus === 'COMPLETED' && status !== 'COMPLETED') {
      throw new Error('Cannot change status of a completed enrollment');
    }

    const updated = await prisma.enrollment.update({
      where: { id },
      data: { status: status as EnrollmentStatus },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            dni: true,
            phone: true,
          },
        },
        course: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updated;
  }

  async deleteEnrollment(id: string) {
    return prisma.enrollment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async getMyEnrollments(studentId: string) {
    return prisma.enrollment.findMany({
      where: {
        studentId,
        status: 'ACTIVE',
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            subject: true,
            description: true,
            monthlyPrice: true,
            teacher: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            schedules: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ✅ NUEVO: Obtener inscripciones de un estudiante por ID
  async getEnrollmentsByStudent(studentId: string) {
    return prisma.enrollment.findMany({
      where: {
        studentId,
        status: 'ACTIVE',
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            subject: true,
            monthlyPrice: true,
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
      },
      orderBy: {
        enrollmentDate: 'desc',
      },
    });
  }
}