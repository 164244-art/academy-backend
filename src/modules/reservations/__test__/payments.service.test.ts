import { PaymentService } from '../payments.service';

describe('PaymentService - Módulo Pagos', () => {
  let service: PaymentService;

  beforeEach(() => {
    service = new PaymentService();
  });

  // Test 1: validatePaymentAmount
  describe('validatePaymentAmount', () => {
    it('debe rechazar montos negativos', () => {
      expect(service.validatePaymentAmount(-50)).toBe(false);
    });

    it('debe rechazar monto cero', () => {
      expect(service.validatePaymentAmount(0)).toBe(false);
    });

    it('debe aceptar montos positivos', () => {
      expect(service.validatePaymentAmount(100)).toBe(true);
    });
  });

  // Test 2: formatPaymentConcept
  describe('formatPaymentConcept', () => {
    it('debe eliminar caracteres especiales', () => {
      expect(service.formatPaymentConcept('Pago$#Matrícula')).toBe('PagoMatrícula');
    });

    it('debe recortar espacios', () => {
      expect(service.formatPaymentConcept('  Matrícula  ')).toBe('Matrícula');
    });
  });
});