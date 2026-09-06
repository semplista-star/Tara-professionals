import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Edita aquesta llista abans de fer `npm run db:seed`.
// Posa el nom d'usuari i una contrasenya provisional per a cada persona
// (que cadascú hauria de canviar després del primer login).
const TEAM = [
  { name: "Marky", username: "marky", password: "canvia-aquesta-1", color: "#C97B3C" },
  { name: "Musta", username: "musta", password: "canvia-aquesta-2", color: "#3E7C74" },
  { name: "La Flor", username: "flor", password: "canvia-aquesta-3", color: "#7C9473" },
  { name: "La Mireia", username: "mireia", password: "canvia-aquesta-4", color: "#A85751" },
  { name: "Membre 5", username: "membre5", password: "canvia-aquesta-5", color: "#5B7A9D" }
];

async function main() {
  for (const member of TEAM) {
    const passwordHash = await bcrypt.hash(member.password, 10);
    await prisma.user.upsert({
      where: { username: member.username },
      update: {},
      create: {
        name: member.name,
        username: member.username,
        passwordHash,
        color: member.color
      }
    });
    console.log(`Usuari creat: ${member.username}`);
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
