-- Defensa en BD (M-4): el radio de geocerca debe estar entre 100 y 700 m (RN doc database-spec §7).
-- El DTO ya lo valida; esta constraint cierra el bypass por escritura directa a la BD.
ALTER TABLE "Destination"
    ADD CONSTRAINT "Destination_radiusMeters_check"
    CHECK ("radiusMeters" BETWEEN 100 AND 700);
