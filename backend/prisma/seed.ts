import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Seed idempotente (Fase 6.1): garantiza un usuario ADMIN para poder entrar al
 * portal. Las credenciales vienen de env (SEED_ADMIN_*) con defaults de dev.
 * Ejecutar: `npx prisma db seed`.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@exiros.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234';
  const name = process.env.SEED_ADMIN_NAME ?? 'Admin Exiros';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed: admin ya existe (${email}), sin cambios.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, name, passwordHash, role: Role.SUPER_ADMIN },
  });
  console.log(`Seed: super admin creado (${email}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
