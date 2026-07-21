export interface SriTransmissionResult {
  isSuccess: boolean;
  estado: 'AUTORIZADA' | 'RECHAZADA' | 'PENDIENTE_CONTINGENCIA';
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  xmlAutorizado?: string;
  errorMessage?: string;
}
