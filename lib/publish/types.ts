export interface PublishOutcome {
  status: "PUBLISHED" | "MANUAL_REQUIRED" | "FAILED";
  externalId?: string;
  permalink?: string;
  /** Motivo del estado manual o del fallo, para mostrar al usuario */
  error?: string;
}
