-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MONITOR');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('EN_RUTA', 'CONCLUIDO');

-- CreateEnum
CREATE TYPE "ClosureType" AS ENUM ('AUTO_GEOFENCE', 'MANUAL_OPERATOR', 'MANUAL_ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MONITOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "providerNumber" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "frontPlate" TEXT NOT NULL,
    "rearPlate" TEXT,
    "destinationId" TEXT NOT NULL,
    "destinationLat" DOUBLE PRECISION NOT NULL,
    "destinationLng" DOUBLE PRECISION NOT NULL,
    "destinationRadiusMeters" INTEGER NOT NULL,
    "photoPath" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'EN_RUTA',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "closureType" "ClosureType",
    "observations" TEXT,
    "closedById" TEXT,
    "closeRequestId" TEXT,
    "deviceId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "tripTokenHash" TEXT NOT NULL,
    "lastLocationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "tripId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracyMeters" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Destination_isActive_idx" ON "Destination"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_closeRequestId_key" ON "Trip"("closeRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_clientRequestId_key" ON "Trip"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_tripTokenHash_key" ON "Trip"("tripTokenHash");

-- CreateIndex
CREATE INDEX "Trip_status_idx" ON "Trip"("status");

-- CreateIndex
CREATE INDEX "Trip_destinationId_idx" ON "Trip"("destinationId");

-- CreateIndex
CREATE INDEX "Location_tripId_recordedAt_idx" ON "Location"("tripId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Location_tripId_batchId_recordedAt_key" ON "Location"("tripId", "batchId", "recordedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Destination" ADD CONSTRAINT "Destination_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RN-11: a lo sumo UN viaje EN_RUTA por dispositivo (índice único parcial; Prisma no lo
-- expresa en el schema, se mantiene aquí como SQL crudo en la migración inicial).
CREATE UNIQUE INDEX "uniq_active_trip_per_device" ON "Trip"("deviceId") WHERE "status" = 'EN_RUTA';
