import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Edita aquesta llista abans de fer `npm run db:seed`.
// Posa el nom d'usuari i una contrasenya provisional per a cada persona
// (que cadascú hauria de canviar després del primer login).
//
// Els 5 comptes reals de l'equip ja s'han creat a la base de dades de
// producció; aquest fitxer es deixa amb valors d'exemple perquè les
// contrasenyes reals no quedin desades en text pla al repositori.
const TEAM = [
  { name: "Marky", username: "marky", password: "canvia-aquesta-1", color: "#C97B3C" },
  { name: "Musta", username: "musta", password: "canvia-aquesta-2", color: "#3E7C74" },
  { name: "Flor", username: "flor", password: "canvia-aquesta-3", color: "#7C9473" },
  { name: "Mireia", username: "mireia", password: "canvia-aquesta-4", color: "#A85751" },
  { name: "Marc", username: "marc", password: "canvia-aquesta-5", color: "#5B7A9D" }
];

async function main() {
  // Neteja comptes creats amb una capitalització diferent del nom d'usuari
  await prisma.user.deleteMany({ where: { username: { in: TEAM.map((m) => m.username) } } });

  for (const member of TEAM) {
    const username = member.username.toLowerCase();
    const passwordHash = await bcrypt.hash(member.password, 10);
    await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        name: member.name,
        username,
        passwordHash,
        color: member.color
      }
    });
    console.log(`Usuari creat: ${username}`);
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
