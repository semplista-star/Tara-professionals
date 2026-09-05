import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Edita aquesta llista abans de fer `npm run db:seed`.
// Canvia els correus i posa una contrasenya provisional per a cada persona
// (que cadascú hauria de canviar després del primer login).
const TEAM = [
  { name: "Marky", email: "marky@tara-project.com", password: "canvia-aquesta-1", color: "#C97B3C" },
  { name: "Musta", email: "musta@tara-project.com", password: "canvia-aquesta-2", color: "#3E7C74" },
  { name: "La Flor", email: "flor@tara-project.com", password: "canvia-aquesta-3", color: "#7C9473" },
  { name: "La Mireia", email: "mireia@tara-project.com", password: "canvia-aquesta-4", color: "#A85751" },
  { name: "Membre 5", email: "membre5@tara-project.com", password: "canvia-aquesta-5", color: "#5B7A9D" }
];

async function main() {
  for (const member of TEAM) {
    const passwordHash = await bcrypt.hash(member.password, 10);
    await prisma.user.upsert({
      where: { email: member.email },
      update: {},
      create: {
        name: member.name,
        email: member.email,
        passwordHash,
        color: member.color
      }
    });
    console.log(`Usuari creat: ${member.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
